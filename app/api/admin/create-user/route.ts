import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let createdUserId: string | null = null;
  try {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });
    const body = await req.json().catch(() => null);
    const organizationId = typeof body?.organizationId === "string" ? body.organizationId : "";
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const requestedRole = body?.role;
    const password = typeof body?.password === "string" ? body.password : "";
    if (!organizationId || name.length < 2 || name.length > 120 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !["admin", "empleado"].includes(requestedRole) || password.length < 10 || password.length > 128) {
      return NextResponse.json({ error: "Revisa el nombre, correo y rol seleccionados." }, { status: 400 });
    }
    const url = process.env.CBDEVS_CENTRAL_SUPABASE_URL || process.env.NEXT_PUBLIC_CBDEVS_SUPABASE_URL;
    const serviceKey = process.env.CBDEVS_CENTRAL_SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) return NextResponse.json({ error: "Falta configurar la conexión administrativa de Supabase en el servidor." }, { status: 503 });
    const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: { user: caller }, error: authError } = await db.auth.getUser(token);
    if (authError || !caller) return NextResponse.json({ error: "La sesión expiró. Inicia sesión otra vez." }, { status: 401 });

    const { data: callerMembership, error: membershipError } = await db.from("organization_members")
      .select("role,status").eq("organization_id", organizationId).eq("user_id", caller.id)
      .eq("status", "active").maybeSingle();
    if (membershipError) {
      console.error("[TEAM_CREATE_AUTH_CHECK]", { code: membershipError.code, message: membershipError.message, details: membershipError.details, hint: membershipError.hint });
      return NextResponse.json({ error: "Supabase no pudo consultar tu membresía. Revisa la variable CBDEVS_CENTRAL_SUPABASE_URL y CBDEVS_CENTRAL_SUPABASE_SERVICE_ROLE_KEY en Vercel, y que apunten al proyecto central correcto." }, { status: 500 });
    }
    if (!callerMembership || !["owner", "admin"].includes(callerMembership.role))
      return NextResponse.json({ error: "Necesitas ser propietario o administrador de esta organización." }, { status: 403 });
    if (requestedRole === "admin" && callerMembership.role !== "owner")
      return NextResponse.json({ error: "Solo el propietario puede crear otros administradores." }, { status: 403 });

    const { data: app, error: appError } = await db.from("organization_apps").select("enabled")
      .eq("organization_id", organizationId).eq("app_key", "admin").maybeSingle();
    if (appError || !app?.enabled) return NextResponse.json({ error: "CBDEVS Admin no está habilitado para esta organización." }, { status: 403 });

    const initialPassword = password;
    const { data: created, error: createError } = await db.auth.admin.createUser({
      email, password: initialPassword, email_confirm: true,
      user_metadata: { display_name: name, name },
    });
    if (createError || !created.user) {
      const duplicate = /already|registered|exists/i.test(createError?.message || "");
      return NextResponse.json({
        error: duplicate ? "Ya existe una cuenta con ese correo. Usa el proceso de restablecimiento de acceso." : "No se pudo crear la cuenta. Verifica la configuración de Supabase Auth.",
      }, { status: duplicate ? 409 : 400 });
    }
    createdUserId = created.user.id;

    const { error: profileError } = await db.from("profiles").upsert({
      id: createdUserId, display_name: name, email,
    }, { onConflict: "id" });
    if (profileError) throw new Error("La cuenta se creó, pero no se pudo guardar el perfil.");

    const { error: memberError } = await db.from("organization_members").insert({
      organization_id: organizationId, user_id: createdUserId,
      role: requestedRole === "admin" ? "admin" : "manager", status: "active",
    });
    if (memberError) throw new Error("La cuenta se creó, pero no se pudo asignar su acceso al equipo.");

    return NextResponse.json({
      ok: true, user: { id: createdUserId, name, email, role: requestedRole },
      message: "Cuenta creada correctamente con la contraseña que definiste.",
    }, { status: 201 });
  } catch (error) {
    console.error("[TEAM_CREATE_USER_FAILED]", error instanceof Error ? error.message : "unknown");
    if (createdUserId) {
      try {
        const url = process.env.CBDEVS_CENTRAL_SUPABASE_URL || process.env.NEXT_PUBLIC_CBDEVS_SUPABASE_URL;
        const key = process.env.CBDEVS_CENTRAL_SUPABASE_SERVICE_ROLE_KEY;
        if (url && key) {
          const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
          await db.auth.admin.deleteUser(createdUserId);
        }
      } catch (rollbackError) {
        console.error("[TEAM_CREATE_ROLLBACK_FAILED]", rollbackError instanceof Error ? rollbackError.message : "unknown");
      }
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo crear la cuenta." }, { status: 500 });
  }
}