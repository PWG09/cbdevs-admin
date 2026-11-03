import { NextResponse } from "next/server";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ACTIONS = new Set(["status", "link", "invite", "invite_link", "unlink"]);

type Action = "status" | "link" | "invite" | "invite_link" | "unlink";
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

/** Human message for Auth email failures (default Supabase mailer only reaches project team members). */
function emailFailure(error: { status?: number; message?: string } | null) {
  if (error?.status === 429 || /rate limit/i.test(error?.message ?? "")) {
    return { status: 429, error: "Se alcanzó el límite de correos de Supabase. Usa “Generar enlace de invitación” y compártelo tú, o configura un SMTP propio." };
  }
  if (/not authorized/i.test(error?.message ?? "")) {
    return { status: 502, error: "Supabase no puede enviar correos a este cliente sin un SMTP propio. Usa “Generar enlace de invitación” y compártelo tú." };
  }
  return { status: 502, error: "No se pudo enviar la invitación por correo. Usa “Generar enlace de invitación” o revisa el SMTP de Supabase Auth." };
}

/** One-time invitation link (no email is sent). Works for new and previously invited, unconfirmed accounts. */
async function invitationLink(admin: SupabaseClient, email: string, redirectTo: string, displayName: string) {
  const invite = await admin.auth.admin.generateLink({ type: "invite", email, options: { redirectTo, data: { display_name: displayName } } });
  if (!invite.error && invite.data.user && invite.data.properties?.action_link) return { user: invite.data.user, link: invite.data.properties.action_link };
  // An existing unconfirmed account may refuse a new "invite" link; a sign-in link confirms it the same way.
  const magic = await admin.auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo } });
  if (!magic.error && magic.data.user && magic.data.properties?.action_link) return { user: magic.data.user, link: magic.data.properties.action_link };
  console.error("[CLIENT_PORTAL_INVITE_LINK_FAILED]", invite.error?.status, invite.error?.code, magic.error?.status, magic.error?.code);
  return null;
}

const LINK_NOTE = "Cópialo y envíaselo al cliente por un canal privado (WhatsApp o tu correo). Es de un solo uso y caduca pronto; si expira, genera otro.";

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
 * - invite_link: same as invite, but returns a one-time invitation link instead of sending an email
 *   (works without custom SMTP; the link is shown only to the authorized staff member and never logged)
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

    const wantsLink = action === "invite_link";
    const redirect = portalUrl();
    if (!redirect) return json({ error: "La URL del portal (CBDEVS_PORTAL_URL) no es válida." }, 500);
    const redirectTo = `${redirect}/auth/accept`;

    let message: string;
    let inviteLink: string | undefined;
    if (!target) {
      if (action === "link") return json({ error: "No existe una cuenta con ese correo. Usa “Invitar por correo” para crearla." }, 404);
      if (wantsLink) {
        const generated = await invitationLink(admin, email, redirectTo, client.name);
        if (!generated) return json({ error: "No se pudo generar el enlace de invitación." }, 502);
        target = generated.user;
        inviteLink = generated.link;
        message = `Enlace de invitación generado para ${email}. ${LINK_NOTE}`;
      } else {
        const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo, data: { display_name: client.name } });
        if (inviteError || !invited.user) {
          console.error("[CLIENT_PORTAL_INVITE_FAILED]", inviteError?.status, inviteError?.code);
          const failure = emailFailure(inviteError);
          return json({ error: failure.error, canGenerateLink: true }, failure.status);
        }
        target = invited.user;
        message = `Invitación enviada a ${email}. El cliente debe abrir el correo y crear su contraseña.`;
      }
      await admin.from("profiles").upsert({ id: target.id, email, display_name: client.name }, { onConflict: "id" });
    } else if ((action === "invite" || wantsLink) && !target.email_confirmed_at) {
      // Unconfirmed (previously invited) account: new link or email, and keep it linked either way.
      if (wantsLink) {
        const generated = await invitationLink(admin, email, redirectTo, client.name);
        if (!generated) return json({ error: "No se pudo generar el enlace de invitación." }, 502);
        inviteLink = generated.link;
        message = `Nuevo enlace de invitación para ${email}. ${LINK_NOTE}`;
      } else {
        const { error: resendError } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo, data: { display_name: client.name } });
        if (resendError) console.error("[CLIENT_PORTAL_REINVITE_FAILED]", resendError.status, resendError.code);
        message = resendError ? `La cuenta quedó vinculada, pero no se pudo enviar el correo: ${emailFailure(resendError).error}` : `Invitación reenviada a ${email}.`;
      }
    } else {
      message = `Cuenta existente vinculada. ${email} ya tiene contraseña y puede iniciar sesión en el portal.`;
    }

    if (client.linked_user_id !== target.id) {
      const { data: updated, error } = await asCaller.from("cbdevs_clients").update({ linked_user_id: target.id, updated_at: new Date().toISOString() }).eq("id", client.id).select("id");
      if (error || !updated?.length) return json({ error: "No se pudo vincular la cuenta al cliente." }, error ? 500 : 403);
    }
    // The invitation link itself is never written to audit logs or server logs.
    await audit(admin, client, caller.id, action === "link" ? "client.portal.link" : wantsLink ? "client.portal.invite_link" : "client.portal.invite", { user_id: target.id, email, previous_user_id: client.linked_user_id });
    return json({ ...describe(target, message), ...(inviteLink ? { inviteLink } : {}) });
  } catch (error) {
    console.error("[CLIENT_PORTAL_ACCESS_FAILED]", error instanceof Error ? error.message : "unknown");
    return json({ error: "No se pudo completar la operación." }, 500);
  }
}
