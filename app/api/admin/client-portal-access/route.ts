import { NextResponse } from "next/server";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ACTIONS = new Set(["status", "link", "invite", "unlink"]);

type Action = "status" | "link" | "invite" | "unlink";
type ClientRow = { id: string; organization_id: string; name: string; email: string; active: boolean; linked_user_id: string | null };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** Canonical Client Portal URL used for invitation redirects (must be in the Supabase Auth allowlist). */
function portalUrl(): string | null {
  const raw = process.env.CBDEVS_PORTAL_URL || "https://cbdevs-portal.vercel.app";
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

async function findUserByEmail(admin: SupabaseClient, email: string): Promise<User | null> {
  // profiles.email is stored lowercase and kept in sync with auth.users by the database trigger.
  const { data: profile } = await admin.from("profiles").select("id").eq("email", email).limit(1).maybeSingle();
  if (profile?.id) {
    const { data } = await admin.auth.admin.getUserById(profile.id as string);
    if (data.user && data.user.email?.toLowerCase() === email) return data.user;
  }
  // Fallback for accounts without a profile row: scan a bounded number of pages.
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) break;
    const match = data.users.find((u) => u.email?.toLowerCase() === email);
    if (match) return match;
    if (data.users.length < 200) break;
  }
  return null;
}

function describe(user: User | null, message?: string) {
  if (!user) return { linked: false, message };
  return {
    linked: true,
    email: user.email ?? "",
    confirmed: Boolean(user.email_confirmed_at),
    lastSignInAt: user.last_sign_in_at ?? null,
    invitedAt: user.invited_at ?? null,
    message,
  };
}

/** Audit rows are written with the server key (clients cannot forge audit history). */
async function audit(admin: SupabaseClient, client: ClientRow, actor: string, action: string, metadata: Record<string, unknown>) {
  const { error } = await admin.from("audit_logs").insert({
    organization_id: client.organization_id, actor_user_id: actor, app_key: "admin",
    action, resource_type: "cbdevs_clients", resource_id: client.id, metadata,
  });
  if (error) console.error("[CLIENT_PORTAL_AUDIT_FAILED]", error.code);
}

/**
 * Manages a client's Client Portal account.
 * - status: linked account details
 * - link:   link an existing account by email
 * - invite: email an invitation (or link the existing account with that email)
 * - unlink: remove portal access (the Auth account itself is kept)
 * Only active owner/admin/manager members of the client's organization with CBDEVS Admin enabled.
 */
export async function POST(req: Request) {
  try {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "Inicia sesión para continuar." }, 401);

    const body = await req.json().catch(() => null);
    const clientId = typeof body?.clientId === "string" ? body.clientId : "";
    const action = (typeof body?.action === "string" ? body.action : "") as Action;
    const requestedEmail = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!UUID.test(clientId) || !ACTIONS.has(action)) return json({ error: "Solicitud no válida." }, 400);
    if (requestedEmail && (requestedEmail.length > 254 || !EMAIL.test(requestedEmail))) return json({ error: "El correo no es válido." }, 400);

    const url = process.env.CBDEVS_CENTRAL_SUPABASE_URL || process.env.NEXT_PUBLIC_CBDEVS_SUPABASE_URL;
    const serviceKey = process.env.CBDEVS_CENTRAL_SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.NEXT_PUBLIC_CBDEVS_SUPABASE_ANON_KEY;
    if (!url || !serviceKey || !anonKey) return json({ error: "Falta configurar la conexión administrativa de Supabase en el servidor." }, 503);
    // Server key: only Auth admin operations, profile lookup and audit writes.
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    // Caller-scoped client: the client row is read and updated under the caller's RLS permissions.
    const asCaller = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });

    const { data: { user: caller }, error: authError } = await admin.auth.getUser(token);
    if (authError || !caller) return json({ error: "La sesión expiró. Inicia sesión otra vez." }, 401);

    const { data: client, error: clientError } = await asCaller.from("cbdevs_clients")
      .select("id, organization_id, name, email, active, linked_user_id").eq("id", clientId).maybeSingle<ClientRow>();
    if (clientError) return json({ error: "No se pudo cargar el cliente." }, 500);

    // Same response for "missing" and "not visible to you" so client IDs cannot be probed.
    const notAllowed = () => json({ error: "No tienes permiso para administrar este cliente." }, 403);
    if (!client) return notAllowed();
    const [{ data: membership }, { data: app }, { data: globalAdmin }] = await Promise.all([
      admin.from("organization_members").select("role, status").eq("organization_id", client.organization_id).eq("user_id", caller.id).maybeSingle(),
      admin.from("organization_apps").select("enabled").eq("organization_id", client.organization_id).eq("app_key", "admin").maybeSingle(),
      asCaller.from("cbdevs_global_admins").select("active").eq("user_id", caller.id).maybeSingle(),
    ]);
    const isStaff = Boolean(membership && membership.status === "active" && ["owner", "admin", "manager"].includes(membership.role) && app?.enabled);
    if (!isStaff && !globalAdmin?.active) return notAllowed();

    const current = client.linked_user_id ? (await admin.auth.admin.getUserById(client.linked_user_id)).data.user : null;

    if (action === "status") return json(describe(current));

    if (action === "unlink") {
      if (!client.linked_user_id) return json(describe(null, "El cliente no tenía acceso al portal."));
      const { data: updated, error } = await asCaller.from("cbdevs_clients").update({ linked_user_id: null, updated_at: new Date().toISOString() }).eq("id", client.id).select("id");
      if (error || !updated?.length) return json({ error: "No se pudo quitar el acceso." }, error ? 500 : 403);
      await audit(admin, client, caller.id, "client.portal.unlink", { user_id: client.linked_user_id });
      return json(describe(null, "Acceso al portal retirado. La cuenta sigue existiendo, pero ya no ve los proyectos de este cliente."));
    }

    // link / invite
    if (!client.active) return json({ error: "Activa el cliente antes de darle acceso al portal." }, 409);
    const email = requestedEmail || client.email.trim().toLowerCase();
    if (!EMAIL.test(email)) return json({ error: "El cliente no tiene un correo válido." }, 400);

    let target = await findUserByEmail(admin, email);

    if (target) {
      const { data: staff } = await admin.from("organization_members").select("user_id").eq("organization_id", client.organization_id).eq("user_id", target.id).maybeSingle();
      if (staff) return json({ error: "Ese correo pertenece a un miembro del equipo. Usa un correo distinto para el acceso del cliente." }, 409);
    }

    let message: string;
    if (!target) {
      if (action === "link") return json({ error: "No existe una cuenta con ese correo. Usa “Invitar por correo” para crearla." }, 404);
      const redirect = portalUrl();
      if (!redirect) return json({ error: "La URL del portal (CBDEVS_PORTAL_URL) no es válida." }, 500);
      const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${redirect}/auth/accept`,
        data: { display_name: client.name },
      });
      if (inviteError || !invited.user) {
        const rate = inviteError?.status === 429 || /rate limit/i.test(inviteError?.message ?? "");
        console.error("[CLIENT_PORTAL_INVITE_FAILED]", inviteError?.status, inviteError?.code);
        return json({ error: rate ? "Se alcanzó el límite de correos de Supabase. Espera unos minutos o configura un SMTP propio." : "No se pudo enviar la invitación. Revisa la configuración de correo de Supabase Auth." }, rate ? 429 : 502);
      }
      target = invited.user;
      await admin.from("profiles").upsert({ id: target.id, email, display_name: client.name }, { onConflict: "id" });
      message = `Invitación enviada a ${email}. El cliente debe abrir el correo y crear su contraseña.`;
    } else if (action === "invite" && !target.email_confirmed_at) {
      // Unconfirmed (previously invited) account: send the invitation again.
      const redirect = portalUrl();
      const { error: resendError } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: `${redirect}/auth/accept`, data: { display_name: client.name } });
      if (resendError) console.error("[CLIENT_PORTAL_REINVITE_FAILED]", resendError.status, resendError.code);
      message = resendError ? "La cuenta ya existe; no se pudo reenviar la invitación, pero quedó vinculada." : `Invitación reenviada a ${email}.`;
    } else {
      message = `Cuenta existente vinculada. ${email} ya puede iniciar sesión en el portal con su contraseña.`;
    }

    if (client.linked_user_id !== target.id) {
      const { data: updated, error } = await asCaller.from("cbdevs_clients").update({ linked_user_id: target.id, updated_at: new Date().toISOString() }).eq("id", client.id).select("id");
      if (error || !updated?.length) return json({ error: "No se pudo vincular la cuenta al cliente." }, error ? 500 : 403);
    }
    await audit(admin, client, caller.id, action === "invite" ? "client.portal.invite" : "client.portal.link", { user_id: target.id, email, previous_user_id: client.linked_user_id });
    return json(describe(target, message));
  } catch (error) {
    console.error("[CLIENT_PORTAL_ACCESS_FAILED]", error instanceof Error ? error.message : "unknown");
    return json({ error: "No se pudo completar la operación." }, 500);
  }
}
