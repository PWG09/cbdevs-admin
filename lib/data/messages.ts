import { db, getWorkspace } from "@/lib/data/workspace";
import { AppError, toAppError } from "@/lib/errors";

export interface Message { id: string; channelId: string | null; senderId: string; text: string; createdAt: string }
type MessageRow = { id: string; channel_id: string | null; sender_id: string; text: string; created_at: string };
const COLUMNS = "id, channel_id, sender_id, text, created_at";
export const MAX_MESSAGE = 4000;

export const mapMessage = (r: MessageRow): Message => ({ id: r.id, channelId: r.channel_id, senderId: r.sender_id, text: r.text, createdAt: r.created_at });

/** Latest messages of a channel; `null` is the internal team channel (never visible to clients). */
export async function listMessages(channelId: string | null, limit = 200): Promise<Message[]> {
  const { organizationId } = await getWorkspace();
  let query = db().from("cbdevs_messages").select(COLUMNS).eq("organization_id", organizationId);
  query = channelId ? query.eq("channel_id", channelId) : query.is("channel_id", null);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(limit);
  if (error) throw toAppError(error, "No se pudieron cargar los mensajes.");
  return ((data ?? []) as MessageRow[]).reverse().map(mapMessage);
}

export async function sendMessage(channelId: string | null, text: string): Promise<Message> {
  const { organizationId, userId } = await getWorkspace();
  const value = text.trim();
  if (!value) throw new AppError("Escribe un mensaje.");
  if (value.length > MAX_MESSAGE) throw new AppError(`El mensaje admite como máximo ${MAX_MESSAGE} caracteres.`);
  const { data, error } = await db().from("cbdevs_messages")
    .insert({ organization_id: organizationId, channel_id: channelId, sender_id: userId, text: value })
    .select(COLUMNS).single();
  if (error || !data) throw toAppError(error, "No se pudo enviar el mensaje.");
  return mapMessage(data as MessageRow);
}

/** Display names of team members (profiles are readable for the organization's members). */
export async function teamNames(): Promise<Map<string, string>> {
  const { organizationId } = await getWorkspace();
  const { data: members } = await db().from("organization_members").select("user_id").eq("organization_id", organizationId);
  const ids = (members ?? []).map((m) => m.user_id as string);
  if (!ids.length) return new Map();
  const { data: profiles } = await db().from("profiles").select("id, display_name, email").in("id", ids);
  return new Map((profiles ?? []).map((p) => [p.id as string, ((p.display_name as string | null)?.trim() || (p.email as string | null)?.split("@")[0] || "Equipo")]));
}

export interface ProjectChannel { id: string; projectId: string; projectName: string; clientName: string; lastAt?: string }

/** Project channels with their project names, most recent activity first. */
export async function listProjectChannels(): Promise<ProjectChannel[]> {
  const { organizationId } = await getWorkspace();
  const [{ data: channels, error }, { data: projects }] = await Promise.all([
    db().from("cbdevs_channels").select("id, project_id").eq("organization_id", organizationId).not("project_id", "is", null).limit(1000),
    db().from("cbdevs_projects").select("id, name, client_name").eq("organization_id", organizationId).limit(1000),
  ]);
  if (error) throw toAppError(error, "No se pudieron cargar los canales.");
  const projectById = new Map((projects ?? []).map((p) => [p.id as string, p as { id: string; name: string; client_name: string }]));
  const ids = (channels ?? []).map((c) => c.id as string);
  const lastByChannel = new Map<string, string>();
  if (ids.length) {
    const { data: recent } = await db().from("cbdevs_messages").select("channel_id, created_at").in("channel_id", ids).order("created_at", { ascending: false }).limit(1000);
    for (const r of recent ?? []) if (!lastByChannel.has(r.channel_id as string)) lastByChannel.set(r.channel_id as string, r.created_at as string);
  }
  return (channels ?? []).flatMap((c) => {
    const p = projectById.get(c.project_id as string);
    return p ? [{ id: c.id as string, projectId: p.id, projectName: p.name, clientName: p.client_name, lastAt: lastByChannel.get(c.id as string) }] : [];
  }).sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? "") || a.projectName.localeCompare(b.projectName));
}
