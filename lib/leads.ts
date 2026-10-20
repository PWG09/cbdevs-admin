// Leads CRM types, labels and helpers shared by the Leads page, nav badge and dashboard.
// Mirrors the cbdevs-database migration 20261019201500_cbdevs_leads_crm.sql.

export type LeadStatus = "new" | "contacted" | "qualified" | "proposal" | "won" | "lost" | "spam";
export type LeadCurrency = "MXN" | "USD" | "CAD";
export type ActivityType =
  | "created"
  | "note"
  | "call"
  | "email"
  | "whatsapp"
  | "meeting"
  | "status_change"
  | "assignment"
  | "conversion";
export type ManualActivityType = Extract<ActivityType, "note" | "call" | "email" | "whatsapp" | "meeting">;

export interface Lead {
  id: string;
  organization_id: string;
  created_at: string;
  updated_at: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  message: string;
  service_interest: string | null;
  budget_range: string | null;
  source: string;
  attribution: Record<string, string>;
  status: LeadStatus;
  assigned_to: string | null;
  next_follow_up_at: string | null;
  last_contacted_at: string | null;
  estimated_value: number | null;
  currency: LeadCurrency;
  lost_reason: string | null;
  client_id: string | null;
  project_id: string | null;
}

export interface LeadActivity {
  id: string;
  inquiry_id: string;
  actor_id: string | null;
  type: ActivityType;
  body: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
}

export const LEAD_COLUMNS =
  "id,organization_id,created_at,updated_at,name,email,phone,company,message,service_interest,budget_range,source,attribution,status,assigned_to,next_follow_up_at,last_contacted_at,estimated_value,currency,lost_reason,client_id,project_id";

export const ACTIVITY_COLUMNS = "id,inquiry_id,actor_id,type,body,metadata,created_at";

export const STATUSES: { value: LeadStatus; label: string; badge: string }[] = [
  { value: "new", label: "Nuevo", badge: "bg-cb-amber/15 text-cb-amber" },
  { value: "contacted", label: "Contactado", badge: "bg-sky-500/10 text-sky-300" },
  { value: "qualified", label: "Calificado", badge: "bg-violet-500/10 text-violet-300" },
  { value: "proposal", label: "Propuesta", badge: "bg-cb-teal/10 text-cb-teal" },
  { value: "won", label: "Ganado", badge: "bg-emerald-500/10 text-emerald-300" },
  { value: "lost", label: "Perdido", badge: "bg-red-500/10 text-red-300" },
  { value: "spam", label: "Spam", badge: "bg-slate-500/10 text-slate-400" },
];

export const OPEN_STATUSES: LeadStatus[] = ["new", "contacted", "qualified", "proposal"];
export const CLOSED_STATUSES: LeadStatus[] = ["won", "lost", "spam"];

export const statusMeta = (status: LeadStatus) => STATUSES.find((s) => s.value === status) ?? STATUSES[0];

export const BUDGET_LABELS: Record<string, string> = {
  lt_10k: "Menos de $10,000 MXN",
  "10k_30k": "$10,000 – $30,000 MXN",
  "30k_80k": "$30,000 – $80,000 MXN",
  gt_80k: "Más de $80,000 MXN",
  unknown: "Aún no lo sabe",
};

export const PROJECT_SERVICES = ["Sitio Web", "Aplicación Web", "Software Personalizado/Automatización"] as const;

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  created: "Lead recibido",
  note: "Nota",
  call: "Llamada",
  email: "Email",
  whatsapp: "WhatsApp",
  meeting: "Reunión",
  status_change: "Cambio de estado",
  assignment: "Asignación",
  conversion: "Convertido",
};

export const MANUAL_ACTIVITY_TYPES: ManualActivityType[] = ["note", "call", "email", "whatsapp", "meeting"];

export function normalizeLead(row: Record<string, unknown>): Lead {
  const value = row.estimated_value;
  return {
    ...(row as unknown as Lead),
    attribution: row.attribution && typeof row.attribution === "object" ? (row.attribution as Record<string, string>) : {},
    estimated_value: value === null || value === undefined || value === "" ? null : Number(value),
  };
}

export function isOverdue(lead: Pick<Lead, "next_follow_up_at" | "status">, now: number = Date.now()): boolean {
  return !!lead.next_follow_up_at && OPEN_STATUSES.includes(lead.status) && new Date(lead.next_follow_up_at).getTime() < now;
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

// wa.me needs the full international number. Numbers typed without a "+" are
// assumed to be local to the default country (NEXT_PUBLIC_CBDEVS_DEFAULT_PHONE_COUNTRY_CODE, default 52 = México).
export function whatsappNumber(phone: string | null, defaultCountryCode: string = "52"): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 7) return null;
  if (trimmed.startsWith("+")) return digits;
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.length === 10) return `${defaultCountryCode.replace(/\D/g, "")}${digits}`;
  return digits;
}

export function contactTemplates(lead: Lead, senderName: string) {
  const hello = `Hola ${firstName(lead.name)}`;
  const topic = lead.service_interest && lead.service_interest !== "Otro" ? `tu proyecto de ${lead.service_interest.toLowerCase()}` : "tu proyecto";
  const signature = senderName ? `\n\n${senderName}\nC.B.devs` : "\n\nC.B.devs";
  return {
    emailSubject: `Tu proyecto con C.B.devs`,
    emailBody: `${hello},\n\nGracias por escribirnos sobre ${topic}. Me gustaría conocer un poco más para preparar una propuesta. ¿Tienes 20 minutos esta semana para una llamada?${signature}`,
    whatsapp: `${hello}, soy ${senderName ? firstName(senderName) : "parte del equipo"} de C.B.devs. Recibimos tu mensaje sobre ${topic}. ¿Te parece si agendamos una llamada corta para conocer los detalles?`,
  };
}

export function mailtoUrl(email: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

const relative = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31536000],
  ["month", 2592000],
  ["week", 604800],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];

export function timeAgo(iso: string, now: number = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return "justo ahora";
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
}

// <input type="datetime-local"> works in local time without a zone.
export function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function money(value: number, currency: LeadCurrency): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

// Turns database/RLS errors into messages the team can act on, without leaking internals.
export function friendlyLeadError(error: unknown, fallback = "No se pudo guardar. Intenta de nuevo."): string {
  const e = (error ?? {}) as { code?: string; message?: string };
  const message = e.message || "";
  if (message.includes("lost_reason")) return "Indica el motivo por el que se perdió el lead.";
  if (message.includes("Assignee")) return "El responsable debe ser un miembro activo del equipo.";
  if (message.includes("Spam leads")) return "Un lead marcado como spam no se puede convertir.";
  if (e.code === "42501" || e.code === "PGRST116" || message.includes("not allowed")) return "No tienes permiso para esta acción o el lead ya no existe.";
  if (e.code === "23514") return "Revisa los datos: hay un valor que no es válido.";
  return fallback;
}
