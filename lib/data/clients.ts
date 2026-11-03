import { callAdminApi, db, getWorkspace } from "@/lib/data/workspace";
import { AppError, toAppError } from "@/lib/errors";
import { email, longText, optionalPhone, text } from "@/lib/validation";

export interface Client {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  notes: string;
  active: boolean;
  linkedUserId: string | null;
  createdAt: string;
  updatedAt: string;
  projectCount?: number;
}

type ClientRow = { id: string; organization_id: string; name: string; email: string; phone: string | null; company: string | null; notes: string | null; active: boolean; linked_user_id: string | null; created_at: string; updated_at: string };
const COLUMNS = "id, organization_id, name, email, phone, company, notes, active, linked_user_id, created_at, updated_at";

const mapClient = (r: ClientRow): Client => ({
  id: r.id, organizationId: r.organization_id, name: r.name, email: r.email, phone: r.phone ?? "", company: r.company ?? "",
  notes: r.notes ?? "", active: r.active, linkedUserId: r.linked_user_id, createdAt: r.created_at, updatedAt: r.updated_at,
});

export interface ClientInput { name: string; email: string; phone: string; company: string; notes: string; active: boolean }

function clean(input: ClientInput) {
  return {
    name: text(input.name, "El nombre", { required: true, min: 2, max: 160 }),
    email: email(input.email),
    phone: optionalPhone(input.phone),
    company: text(input.company, "La empresa", { max: 160 }) || null,
    notes: longText(input.notes, "Las notas", 4000),
    active: Boolean(input.active),
  };
}

const DUPLICATE = { "23505": "Ya existe un cliente con ese correo en tu organización." };

export async function listClients(): Promise<Client[]> {
  const { organizationId } = await getWorkspace();
  const [clients, projects] = await Promise.all([
    db().from("cbdevs_clients").select(COLUMNS).eq("organization_id", organizationId).order("name").limit(1000),
    db().from("cbdevs_projects").select("client_id").eq("organization_id", organizationId).not("client_id", "is", null).limit(5000),
  ]);
  if (clients.error) throw toAppError(clients.error, "No se pudieron cargar los clientes.");
  const counts = new Map<string, number>();
  for (const p of (projects.data ?? []) as Array<{ client_id: string }>) counts.set(p.client_id, (counts.get(p.client_id) ?? 0) + 1);
  return ((clients.data ?? []) as ClientRow[]).map((r) => ({ ...mapClient(r), projectCount: counts.get(r.id) ?? 0 }));
}

export async function getClient(id: string): Promise<Client | null> {
  const { organizationId } = await getWorkspace();
  const { data, error } = await db().from("cbdevs_clients").select(COLUMNS).eq("id", id).eq("organization_id", organizationId).maybeSingle();
  if (error) throw toAppError(error, "No se pudo cargar el cliente.");
  return data ? mapClient(data as ClientRow) : null;
}

export async function createClient(input: ClientInput): Promise<Client> {
  const { organizationId, userId } = await getWorkspace();
  const { data, error } = await db().from("cbdevs_clients")
    .insert({ ...clean(input), organization_id: organizationId, created_by: userId })
    .select(COLUMNS).single();
  if (error || !data) throw toAppError(error, "No se pudo crear el cliente.", DUPLICATE);
  return mapClient(data as ClientRow);
}

export async function updateClient(id: string, input: ClientInput): Promise<Client> {
  const { organizationId } = await getWorkspace();
  const values = clean(input);
  const { data, error } = await db().from("cbdevs_clients")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("id", id).eq("organization_id", organizationId)
    .select(COLUMNS).maybeSingle();
  if (error) throw toAppError(error, "No se pudo guardar el cliente.", DUPLICATE);
  if (!data) throw new AppError("No tienes permiso para editar este cliente.", "42501");
  // Keep the denormalized name shown on project cards in sync.
  await db().from("cbdevs_projects").update({ client_name: values.company || values.name }).eq("client_id", id).eq("organization_id", organizationId);
  return mapClient(data as ClientRow);
}

export async function deleteClient(id: string): Promise<void> {
  const { organizationId } = await getWorkspace();
  const { count, error: countError } = await db().from("cbdevs_projects").select("id", { count: "exact", head: true }).eq("client_id", id);
  if (countError) throw toAppError(countError, "No se pudo verificar el cliente.");
  if ((count ?? 0) > 0) throw new AppError("Este cliente tiene proyectos. Reasígnalos o desactiva el cliente en lugar de eliminarlo.");
  const { data, error } = await db().from("cbdevs_clients").delete().eq("id", id).eq("organization_id", organizationId).select("id");
  if (error) throw toAppError(error, "No se pudo eliminar el cliente.");
  if (!data?.length) throw new AppError("Solo un administrador puede eliminar clientes.", "42501");
}

// ---------------------------------------------------------------- portal access (server route)

export interface PortalAccess {
  linked: boolean;
  email?: string;
  confirmed?: boolean;
  lastSignInAt?: string | null;
  invitedAt?: string | null;
  message?: string;
  /** One-time invitation link, only returned by `invite_link`. Never persisted. */
  inviteLink?: string;
}

export type PortalAction = "status" | "link" | "invite" | "invite_link" | "unlink";

export function portalAccess(clientId: string, action: PortalAction, emailAddress?: string): Promise<PortalAccess> {
  return callAdminApi<PortalAccess>("/api/admin/client-portal-access", { clientId, action, email: emailAddress });
}
