import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_KEYS = ["admin", "web", "courses", "client-portal"] as const;

export async function POST(req: Request) {
  try {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });

    const url = process.env.CBDEVS_CENTRAL_SUPABASE_URL;
    const serviceKey = process.env.CBDEVS_CENTRAL_SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.NEXT_PUBLIC_CBDEVS_SUPABASE_ANON_KEY;
    const ownerEmail = (process.env.CBDEVS_INITIAL_OWNER_EMAIL || "").trim().toLowerCase();
    if (!url || !serviceKey || !anonKey || !ownerEmail) {
      return NextResponse.json({ error: "La configuración segura del primer propietario está incompleta." }, { status: 503 });
    }

    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    const user = authData.user;
    if (authError || !user) return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });
    if (!user.email_confirmed_at || (user.email || "").trim().toLowerCase() !== ownerEmail) {
      return NextResponse.json({ error: "Esta cuenta no está autorizada para inicializar CBDEVS." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const requestedName = typeof body?.displayName === "string" ? body.displayName.trim() : "";
    const displayName = (requestedName || user.user_metadata?.display_name || user.email || "Propietario").slice(0, 120);

    const { data: organizations, error: orgReadError } = await admin
      .from("organizations")
      .select("id,slug,created_by")
      .limit(2);
    if (orgReadError) return NextResponse.json({ error: "No se pudo verificar el estado inicial." }, { status: 500 });

    let organizationId: string | null = null;
    if (organizations?.length) {
      if (organizations.length !== 1 || organizations[0].slug !== "cbdevs" || organizations[0].created_by !== user.id) {
        return NextResponse.json({ error: "La plataforma ya fue inicializada. No se hicieron cambios." }, { status: 409 });
      }
      const { data: membership, error: membershipError } = await admin
        .from("organization_members")
        .select("role,status")
        .eq("organization_id", organizations[0].id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (membershipError || membership?.role !== "owner" || membership.status !== "active") {
        return NextResponse.json({ error: "La organización existente no permite completar esta inicialización." }, { status: 409 });
      }
      organizationId = organizations[0].id;
    } else {
      const userClient = createClient(url, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: createdId, error: createError } = await userClient.rpc("create_organization", {
        p_name: "CBDEVS",
        p_slug: "cbdevs",
      });
      if (createError || typeof createdId !== "string") {
        console.error("[CBDEVS_OWNER_BOOTSTRAP_ORG_FAILED]", createError?.code, createError?.message);
        return NextResponse.json({ error: "No se pudo crear la organización inicial." }, { status: 500 });
      }
      organizationId = createdId;
    }

    const { error: profileError } = await admin.from("profiles").upsert({
      id: user.id,
      display_name: displayName,
      email: user.email,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });
    if (profileError) {
      console.error("[CBDEVS_OWNER_BOOTSTRAP_PROFILE_FAILED]", profileError.code, profileError.message);
      return NextResponse.json({ error: "No se pudo completar el perfil del propietario." }, { status: 500 });
    }

    const { data: apps, error: appsError } = await admin
      .from("app_catalog")
      .select("app_key")
      .in("app_key", [...APP_KEYS])
      .eq("active", true);
    if (appsError || !apps?.length) {
      console.error("[CBDEVS_OWNER_BOOTSTRAP_CATALOG_FAILED]", appsError?.code, appsError?.message);
      return NextResponse.json({ error: "No se pudo verificar el catálogo de aplicaciones." }, { status: 500 });
    }

    const enabledApps = apps.map((app) => ({
      organization_id: organizationId,
      app_key: app.app_key,
      enabled: true,
      enabled_by: user.id,
    }));
    const { error: appEnableError } = await admin
      .from("organization_apps")
      .upsert(enabledApps, { onConflict: "organization_id,app_key" });
    if (appEnableError) {
      console.error("[CBDEVS_OWNER_BOOTSTRAP_APPS_FAILED]", appEnableError.code, appEnableError.message);
      return NextResponse.json({ error: "La organización existe, pero no se pudieron habilitar todas las aplicaciones. Puedes reintentar." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, organizationId, enabledApps: apps.map((app) => app.app_key) }, { status: 200 });
  } catch (error) {
    console.error("[CBDEVS_OWNER_BOOTSTRAP_FAILED]", error);
    return NextResponse.json({ error: "No se pudo completar la inicialización segura." }, { status: 500 });
  }
}
