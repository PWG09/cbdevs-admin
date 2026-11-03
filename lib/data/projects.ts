import { db, getWorkspace } from "@/lib/data/workspace";
import { AppError, toAppError } from "@/lib/errors";
import {
  CURRENCIES, DELIVERY_STATUSES, DOCUMENT_TYPES, MILESTONE_STATUSES, PAYMENT_LINK_STATUSES, PAYMENT_RECORD_STATUSES, PAYMENT_STATUSES, SERVICES,
  longText, money, oneOf, optionalDate, optionalHttpsUrl, positiveMoney, requiredHttpsUrl, text,
} from "@/lib/validation";

// ---------------------------------------------------------------- projects

export interface AdminProject {
  id: string;
  organizationId: string;
  clientId: string | null;
  clientName: string;
  name: string;
  serviceType: string;
  deliveryStatus: string;
  paymentStatus: string;
  currency: string;
  amount: number;
  initialPayment: number;
  monthlyMaintenance: number;
  startDate: string;
  estimatedDelivery: string;
  actualDelivery: string;
  nextMaintenanceDate: string;
  notes: string;
  repoUrl: string;
  productionUrl: string;
  proposalUrl: string;
  updatedAt: string;
}

type ProjectRow = {
  id: string; organization_id: string; client_id: string | null; client_name: string; name: string; service_type: string; delivery_status: string; payment_status: string;
  currency: string; amount: number | string; initial_payment: number | string; monthly_maintenance: number | string; start_date: string | null; estimated_delivery: string | null;
  actual_delivery: string | null; next_maintenance_date: string | null; notes: string | null; repo_url: string | null; production_url: string | null; proposal_url: string | null; updated_at: string;
};

const PROJECT_COLUMNS = "id, organization_id, client_id, client_name, name, service_type, delivery_status, payment_status, currency, amount, initial_payment, monthly_maintenance, start_date, estimated_delivery, actual_delivery, next_maintenance_date, notes, repo_url, production_url, proposal_url, updated_at";

const num = (v: number | string | null) => Number(v) || 0;
export const mapProject = (r: ProjectRow): AdminProject => ({
  id: r.id, organizationId: r.organization_id, clientId: r.client_id, clientName: r.client_name, name: r.name, serviceType: r.service_type,
  deliveryStatus: r.delivery_status, paymentStatus: r.payment_status, currency: r.currency, amount: num(r.amount), initialPayment: num(r.initial_payment),
  monthlyMaintenance: num(r.monthly_maintenance), startDate: r.start_date ?? "", estimatedDelivery: r.estimated_delivery ?? "", actualDelivery: r.actual_delivery ?? "",
  nextMaintenanceDate: r.next_maintenance_date ?? "", notes: r.notes ?? "", repoUrl: r.repo_url ?? "", productionUrl: r.production_url ?? "", proposalUrl: r.proposal_url ?? "",
  updatedAt: r.updated_at,
});

export interface ProjectInput {
  name: string; clientId: string | null; serviceType: string; deliveryStatus: string; paymentStatus: string; currency: string;
  amount: string | number; initialPayment: string | number; monthlyMaintenance: string | number;
  startDate: string; estimatedDelivery: string; actualDelivery: string; nextMaintenanceDate: string;
  notes: string; repoUrl: string; productionUrl: string; proposalUrl: string;
}

async function clientName(clientId: string | null, organizationId: string): Promise<string> {
  if (!clientId) return "Sin cliente";
  const { data, error } = await db().from("cbdevs_clients").select("name, company").eq("id", clientId).eq("organization_id", organizationId).maybeSingle();
  if (error) throw toAppError(error, "No se pudo verificar el cliente.");
  if (!data) throw new AppError("El cliente seleccionado no existe en tu organización.");
  return (data.company as string | null)?.trim() || (data.name as string);
}

async function cleanProject(input: ProjectInput, organizationId: string) {
  const amount = money(input.amount, "El monto total");
  const initialPayment = money(input.initialPayment, "El anticipo");
  if (initialPayment > amount) throw new AppError("El anticipo no puede ser mayor al monto total.");
  const startDate = optionalDate(input.startDate, "La fecha de inicio");
  const estimatedDelivery = optionalDate(input.estimatedDelivery, "La entrega estimada");
  if (startDate && estimatedDelivery && estimatedDelivery < startDate) throw new AppError("La entrega estimada no puede ser anterior al inicio.");
  return {
    name: text(input.name, "El nombre del proyecto", { required: true, max: 200 }),
    client_id: input.clientId || null,
    client_name: await clientName(input.clientId || null, organizationId),
    service_type: oneOf(input.serviceType, SERVICES, "El servicio"),
    delivery_status: oneOf(input.deliveryStatus, DELIVERY_STATUSES, "El estado de entrega"),
    payment_status: oneOf(input.paymentStatus, PAYMENT_STATUSES, "El estado de pago"),
    currency: oneOf(input.currency, CURRENCIES, "La moneda"),
    amount,
    initial_payment: initialPayment,
    monthly_maintenance: money(input.monthlyMaintenance, "El mantenimiento mensual"),
    start_date: startDate,
    estimated_delivery: estimatedDelivery,
    actual_delivery: optionalDate(input.actualDelivery, "La entrega real"),
    next_maintenance_date: optionalDate(input.nextMaintenanceDate, "El próximo mantenimiento"),
    notes: longText(input.notes, "La descripción", 4000),
    repo_url: optionalHttpsUrl(input.repoUrl, "El repositorio"),
    production_url: optionalHttpsUrl(input.productionUrl, "El sitio en producción"),
    proposal_url: optionalHttpsUrl(input.proposalUrl, "La propuesta"),
  };
}

export async function listProjects(): Promise<AdminProject[]> {
  const { organizationId } = await getWorkspace();
  const { data, error } = await db().from("cbdevs_projects").select(PROJECT_COLUMNS).eq("organization_id", organizationId).order("updated_at", { ascending: false }).limit(1000);
  if (error) throw toAppError(error, "No se pudieron cargar los proyectos.");
  return ((data ?? []) as ProjectRow[]).map(mapProject);
}

export async function listClientProjects(clientId: string): Promise<AdminProject[]> {
  const { organizationId } = await getWorkspace();
  const { data, error } = await db().from("cbdevs_projects").select(PROJECT_COLUMNS).eq("organization_id", organizationId).eq("client_id", clientId).order("updated_at", { ascending: false });
  if (error) throw toAppError(error, "No se pudieron cargar los proyectos del cliente.");
  return ((data ?? []) as ProjectRow[]).map(mapProject);
}

export async function getProject(id: string): Promise<AdminProject | null> {
  const { organizationId } = await getWorkspace();
  const { data, error } = await db().from("cbdevs_projects").select(PROJECT_COLUMNS).eq("id", id).eq("organization_id", organizationId).maybeSingle();
  if (error) throw toAppError(error, "No se pudo cargar el proyecto.");
  return data ? mapProject(data as ProjectRow) : null;
}

export async function createProject(input: ProjectInput): Promise<AdminProject> {
  const { organizationId, userId } = await getWorkspace();
  const values = await cleanProject(input, organizationId);
  const { data, error } = await db().from("cbdevs_projects").insert({ ...values, organization_id: organizationId, created_by: userId }).select(PROJECT_COLUMNS).single();
  if (error || !data) throw toAppError(error, "No se pudo crear el proyecto.");
  const project = mapProject(data as ProjectRow);
  // The database trigger normally creates the private chat channel; make sure it exists.
  await ensureProjectChannel(project).catch(() => undefined);
  return project;
}

export async function updateProject(id: string, input: ProjectInput): Promise<AdminProject> {
  const { organizationId } = await getWorkspace();
  const values = await cleanProject(input, organizationId);
  const { data, error } = await db().from("cbdevs_projects").update({ ...values, updated_at: new Date().toISOString() }).eq("id", id).eq("organization_id", organizationId).select(PROJECT_COLUMNS).maybeSingle();
  if (error) throw toAppError(error, "No se pudo guardar el proyecto.");
  if (!data) throw new AppError("No tienes permiso para editar este proyecto.", "42501");
  return mapProject(data as ProjectRow);
}

export async function setDeliveryStatus(id: string, status: string): Promise<void> {
  const { organizationId } = await getWorkspace();
  const value = oneOf(status, DELIVERY_STATUSES, "El estado");
  const { data, error } = await db().from("cbdevs_projects").update({ delivery_status: value, updated_at: new Date().toISOString() }).eq("id", id).eq("organization_id", organizationId).select("id");
  if (error) throw toAppError(error, "No se pudo actualizar el estado.");
  if (!data?.length) throw new AppError("No tienes permiso para editar este proyecto.", "42501");
}

/**
 * Deletes a project (owner/admin only by RLS). Project messages are removed first because the
 * message → channel foreign key would otherwise leave them orphaned in the team's general chat.
 */
export async function deleteProject(id: string): Promise<void> {
  const { organizationId } = await getWorkspace();
  const { data: channels, error: channelError } = await db().from("cbdevs_channels").select("id").eq("project_id", id).eq("organization_id", organizationId);
  if (channelError) throw toAppError(channelError, "No se pudo eliminar el proyecto.");
  const channelIds = (channels ?? []).map((c) => c.id as string);
  if (channelIds.length) {
    const { error: messageError } = await db().from("cbdevs_messages").delete().in("channel_id", channelIds);
    if (messageError) throw toAppError(messageError, "No se pudieron eliminar los mensajes del proyecto.");
  }
  const { data, error } = await db().from("cbdevs_projects").delete().eq("id", id).eq("organization_id", organizationId).select("id");
  if (error) throw toAppError(error, "No se pudo eliminar el proyecto.");
  if (!data?.length) throw new AppError("Solo un administrador puede eliminar proyectos.", "42501");
}

// ---------------------------------------------------------------- milestones

export interface Milestone { id: string; projectId: string; title: string; status: string; dueDate: string; sortOrder: number }
type MilestoneRow = { id: string; project_id: string; title: string; status: string; due_date: string | null; sort_order: number };
const mapMilestone = (r: MilestoneRow): Milestone => ({ id: r.id, projectId: r.project_id, title: r.title, status: r.status, dueDate: r.due_date ?? "", sortOrder: r.sort_order });
const MS_COLUMNS = "id, project_id, title, status, due_date, sort_order";

export async function listMilestones(projectId: string): Promise<Milestone[]> {
  const { data, error } = await db().from("cbdevs_project_milestones").select(MS_COLUMNS).eq("project_id", projectId).order("sort_order").order("created_at").limit(500);
  if (error) throw toAppError(error, "No se pudieron cargar los hitos.");
  return ((data ?? []) as MilestoneRow[]).map(mapMilestone);
}

export async function createMilestone(project: AdminProject, input: { title: string; status: string; dueDate: string }, sortOrder: number): Promise<Milestone> {
  const { data, error } = await db().from("cbdevs_project_milestones").insert({
    organization_id: project.organizationId, project_id: project.id,
    title: text(input.title, "El hito", { required: true, max: 240 }),
    status: oneOf(input.status, MILESTONE_STATUSES, "El estado"),
    due_date: optionalDate(input.dueDate, "La fecha"),
    sort_order: sortOrder,
  }).select(MS_COLUMNS).single();
  if (error || !data) throw toAppError(error, "No se pudo crear el hito.");
  return mapMilestone(data as MilestoneRow);
}

export async function updateMilestone(id: string, input: Partial<{ title: string; status: string; dueDate: string; sortOrder: number }>): Promise<void> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.title !== undefined) row.title = text(input.title, "El hito", { required: true, max: 240 });
  if (input.status !== undefined) row.status = oneOf(input.status, MILESTONE_STATUSES, "El estado");
  if (input.dueDate !== undefined) row.due_date = optionalDate(input.dueDate, "La fecha");
  if (input.sortOrder !== undefined) row.sort_order = input.sortOrder;
  const { data, error } = await db().from("cbdevs_project_milestones").update(row).eq("id", id).select("id");
  if (error) throw toAppError(error, "No se pudo actualizar el hito.");
  if (!data?.length) throw new AppError("No tienes permiso para editar este hito.", "42501");
}

export async function deleteMilestone(id: string): Promise<void> {
  const { data, error } = await db().from("cbdevs_project_milestones").delete().eq("id", id).select("id");
  if (error) throw toAppError(error, "No se pudo eliminar el hito.");
  if (!data?.length) throw new AppError("Solo un administrador puede eliminar hitos.", "42501");
}

// ---------------------------------------------------------------- documents

export interface ProjectDocument { id: string; projectId: string; title: string; url: string; type: string; createdAt: string }
type DocumentRow = { id: string; project_id: string; title: string; url: string; document_type: string; created_at: string };
const mapDocument = (r: DocumentRow): ProjectDocument => ({ id: r.id, projectId: r.project_id, title: r.title, url: r.url, type: r.document_type, createdAt: r.created_at });
const DOC_COLUMNS = "id, project_id, title, url, document_type, created_at";

export async function listDocuments(projectId: string): Promise<ProjectDocument[]> {
  const { data, error } = await db().from("cbdevs_project_documents").select(DOC_COLUMNS).eq("project_id", projectId).order("created_at", { ascending: false }).limit(500);
  if (error) throw toAppError(error, "No se pudieron cargar los documentos.");
  return ((data ?? []) as DocumentRow[]).map(mapDocument);
}

export async function createDocument(project: AdminProject, input: { title: string; url: string; type: string }): Promise<ProjectDocument> {
  const { data, error } = await db().from("cbdevs_project_documents").insert({
    organization_id: project.organizationId, project_id: project.id,
    title: text(input.title, "El título", { required: true, max: 240 }),
    url: requiredHttpsUrl(input.url, "El enlace"),
    document_type: oneOf(input.type, DOCUMENT_TYPES, "El tipo"),
  }).select(DOC_COLUMNS).single();
  if (error || !data) throw toAppError(error, "No se pudo agregar el documento.");
  return mapDocument(data as DocumentRow);
}

export async function deleteDocument(id: string): Promise<void> {
  const { data, error } = await db().from("cbdevs_project_documents").delete().eq("id", id).select("id");
  if (error) throw toAppError(error, "No se pudo eliminar el documento.");
  if (!data?.length) throw new AppError("Solo un administrador puede eliminar documentos.", "42501");
}

// ---------------------------------------------------------------- payments

export interface Payment { id: string; projectId: string | null; clientId: string | null; amount: number; currency: string; status: string; provider: string; reference: string; paidAt: string; createdAt: string }
type PaymentRow = { id: string; project_id: string | null; client_id: string | null; amount: number | string; currency: string; status: string; provider: string | null; provider_reference: string | null; paid_at: string | null; created_at: string };
const mapPayment = (r: PaymentRow): Payment => ({ id: r.id, projectId: r.project_id, clientId: r.client_id, amount: num(r.amount), currency: r.currency, status: r.status, provider: r.provider ?? "", reference: r.provider_reference ?? "", paidAt: r.paid_at ?? "", createdAt: r.created_at });
const PAY_COLUMNS = "id, project_id, client_id, amount, currency, status, provider, provider_reference, paid_at, created_at";
export const PAYMENT_PROVIDERS = [
  { value: "transfer", label: "Transferencia" },
  { value: "cash", label: "Efectivo" },
  { value: "stripe", label: "Stripe" },
  { value: "mercadopago", label: "Mercado Pago" },
  { value: "paypal", label: "PayPal" },
  { value: "other", label: "Otro" },
] as const;

export async function listPayments(projectId: string): Promise<Payment[]> {
  const { data, error } = await db().from("cbdevs_payments").select(PAY_COLUMNS).eq("project_id", projectId).order("created_at", { ascending: false }).limit(500);
  if (error) throw toAppError(error, "No se pudieron cargar los pagos.");
  return ((data ?? []) as PaymentRow[]).map(mapPayment);
}

export interface PaymentInput { amount: string | number; currency: string; status: string; provider: string; reference: string; paidAt: string }

export async function createPayment(project: AdminProject, input: PaymentInput): Promise<Payment> {
  const { userId } = await getWorkspace();
  const status = oneOf(input.status, PAYMENT_RECORD_STATUSES, "El estado");
  const paidAt = optionalDate(input.paidAt, "La fecha de pago");
  if (status === "paid" && !paidAt) throw new AppError("Indica la fecha en que se recibió el pago.");
  const { data, error } = await db().from("cbdevs_payments").insert({
    organization_id: project.organizationId, project_id: project.id, client_id: project.clientId,
    amount: positiveMoney(input.amount, "El monto"),
    currency: oneOf(input.currency, CURRENCIES, "La moneda"),
    status,
    provider: PAYMENT_PROVIDERS.some((p) => p.value === input.provider) ? input.provider : "other",
    provider_reference: text(input.reference, "La referencia", { max: 120 }) || null,
    paid_at: paidAt ? `${paidAt}T12:00:00Z` : null,
    created_by: userId,
  }).select(PAY_COLUMNS).single();
  if (error || !data) throw toAppError(error, "No se pudo registrar el pago.");
  return mapPayment(data as PaymentRow);
}

export async function updatePaymentStatus(id: string, status: string, paidAt?: string): Promise<void> {
  const value = oneOf(status, PAYMENT_RECORD_STATUSES, "El estado");
  const row: Record<string, unknown> = { status: value };
  if (value === "paid") row.paid_at = optionalDate(paidAt, "La fecha") ? `${paidAt}T12:00:00Z` : new Date().toISOString();
  const { data, error } = await db().from("cbdevs_payments").update(row).eq("id", id).select("id");
  if (error) throw toAppError(error, "No se pudo actualizar el pago.");
  if (!data?.length) throw new AppError("No tienes permiso para editar este pago.", "42501");
}

export async function deletePayment(id: string): Promise<void> {
  const { data, error } = await db().from("cbdevs_payments").delete().eq("id", id).select("id");
  if (error) throw toAppError(error, "No se pudo eliminar el pago.");
  if (!data?.length) throw new AppError("Solo un administrador puede eliminar pagos.", "42501");
}

// ---------------------------------------------------------------- payment links

export interface PaymentLink { id: string; amount: number; currency: string; url: string; status: string; provider: string; expiresAt: string; createdAt: string }
type LinkRow = { id: string; amount: number | string; currency: string; url: string | null; status: string; provider: string | null; expires_at: string | null; created_at: string };
const mapLink = (r: LinkRow): PaymentLink => ({ id: r.id, amount: num(r.amount), currency: r.currency, url: r.url ?? "", status: r.status, provider: r.provider ?? "", expiresAt: r.expires_at ?? "", createdAt: r.created_at });
const LINK_COLUMNS = "id, amount, currency, url, status, provider, expires_at, created_at";

export async function listPaymentLinks(projectId: string): Promise<PaymentLink[]> {
  const { data, error } = await db().from("cbdevs_payment_links").select(LINK_COLUMNS).eq("project_id", projectId).order("created_at", { ascending: false }).limit(200);
  if (error) throw toAppError(error, "No se pudieron cargar los enlaces de pago.");
  return ((data ?? []) as LinkRow[]).map(mapLink);
}

export async function createPaymentLink(project: AdminProject, input: { amount: string | number; currency: string; url: string; provider: string; expiresAt: string }): Promise<PaymentLink> {
  const { userId } = await getWorkspace();
  const expires = optionalDate(input.expiresAt, "La fecha de vencimiento");
  const now = new Date();
  const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  if (expires && expires < todayLocal) throw new AppError("La fecha de vencimiento ya pasó.");
  const { data, error } = await db().from("cbdevs_payment_links").insert({
    organization_id: project.organizationId, project_id: project.id, client_id: project.clientId,
    amount: positiveMoney(input.amount, "El monto"),
    currency: oneOf(input.currency, CURRENCIES, "La moneda"),
    url: requiredHttpsUrl(input.url, "El enlace de pago"),
    provider: PAYMENT_PROVIDERS.some((p) => p.value === input.provider) ? input.provider : "other",
    status: "active",
    expires_at: expires ? `${expires}T23:59:59Z` : null,
    created_by: userId,
  }).select(LINK_COLUMNS).single();
  if (error || !data) throw toAppError(error, "No se pudo crear el enlace de pago.");
  return mapLink(data as LinkRow);
}

export async function setPaymentLinkStatus(id: string, status: string): Promise<void> {
  const value = oneOf(status, PAYMENT_LINK_STATUSES, "El estado");
  const { data, error } = await db().from("cbdevs_payment_links").update({ status: value }).eq("id", id).select("id");
  if (error) throw toAppError(error, "No se pudo actualizar el enlace.");
  if (!data?.length) throw new AppError("No tienes permiso para editar este enlace.", "42501");
}

// ---------------------------------------------------------------- channels

/** Returns the project's private channel, creating it when the database trigger did not. */
export async function ensureProjectChannel(project: Pick<AdminProject, "id" | "organizationId">): Promise<string> {
  const { data, error } = await db().from("cbdevs_channels").select("id").eq("project_id", project.id).limit(1).maybeSingle();
  if (error) throw toAppError(error, "No se pudo cargar el canal del proyecto.");
  if (data?.id) return data.id as string;
  const { userId } = await getWorkspace();
  const { data: created, error: createError } = await db().from("cbdevs_channels")
    .insert({ organization_id: project.organizationId, name: `project:${project.id}`, created_by: userId, project_id: project.id })
    .select("id").single();
  if (createError || !created) throw toAppError(createError, "No se pudo crear el canal del proyecto.");
  return created.id as string;
}
