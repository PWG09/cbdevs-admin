"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { AlertTriangle, Save } from "lucide-react";
import { ErrorBanner, Field, Modal } from "@/components/ui";
import { listClients, type Client } from "@/lib/data/clients";
import { createProject, updateProject, type AdminProject, type ProjectInput } from "@/lib/data/projects";
import { messageOf } from "@/lib/errors";
import { CURRENCIES, DELIVERY_STATUSES, PAYMENT_STATUSES, SERVICES } from "@/lib/validation";

/** Local calendar date (YYYY-MM-DD); toISOString would use UTC and can show tomorrow in the evening. */
const localDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const today = () => localDate(new Date());
const plusDays = (days: number) => localDate(new Date(Date.now() + days * 86_400_000));

function initial(project?: AdminProject, clientId?: string): ProjectInput {
  if (project) {
    return {
      name: project.name, clientId: project.clientId, serviceType: project.serviceType, deliveryStatus: project.deliveryStatus, paymentStatus: project.paymentStatus,
      currency: project.currency, amount: String(project.amount), initialPayment: String(project.initialPayment), monthlyMaintenance: String(project.monthlyMaintenance),
      startDate: project.startDate, estimatedDelivery: project.estimatedDelivery, actualDelivery: project.actualDelivery, nextMaintenanceDate: project.nextMaintenanceDate,
      notes: project.notes, repoUrl: project.repoUrl, productionUrl: project.productionUrl, proposalUrl: project.proposalUrl,
    };
  }
  return {
    name: "", clientId: clientId ?? null, serviceType: "Sitio Web", deliveryStatus: "Cotizado", paymentStatus: "Pendiente", currency: "MXN",
    amount: "0", initialPayment: "0", monthlyMaintenance: "0", startDate: today(), estimatedDelivery: plusDays(30), actualDelivery: "", nextMaintenanceDate: "",
    notes: "", repoUrl: "", productionUrl: "", proposalUrl: "",
  };
}

/** Create/edit form for projects. `inline` renders without a modal (project detail page). */
export default function ProjectForm({ project, defaultClientId, onClose, onSaved, inline = false }: { project?: AdminProject; defaultClientId?: string; onClose?: () => void; onSaved: (project: AdminProject) => void; inline?: boolean }) {
  const [form, setForm] = useState<ProjectInput>(() => initial(project, defaultClientId));
  const [clients, setClients] = useState<Client[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const set = <K extends keyof ProjectInput>(key: K, value: ProjectInput[K]) => { setSaved(false); setForm((f) => ({ ...f, [key]: value })); };

  useEffect(() => {
    let active = true;
    listClients().then((list) => { if (active) setClients(list.filter((c) => c.active || c.id === form.clientId)); }).catch(() => undefined);
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedClient = clients.find((c) => c.id === form.clientId);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(""); setSaved(false);
    try {
      const result = project ? await updateProject(project.id, form) : await createProject(form);
      setSaved(true);
      onSaved(result);
    } catch (cause) {
      setError(messageOf(cause, "No se pudo guardar el proyecto."));
    } finally { setBusy(false); }
  }

  const body = (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre del proyecto" className="sm:col-span-2"><input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} required maxLength={200} /></Field>
        <Field label="Cliente" hint={!form.clientId ? "Sin cliente, el proyecto no aparece en ningún portal." : undefined}>
          <select className="input" value={form.clientId ?? ""} onChange={(e) => set("clientId", e.target.value || null)}>
            <option value="">— Sin cliente —</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.company ? `${c.company} (${c.name})` : c.name}{c.active ? "" : " · inactivo"}</option>)}
          </select>
        </Field>
        <Field label="Servicio"><select className="input" value={form.serviceType} onChange={(e) => set("serviceType", e.target.value)}>{SERVICES.map((s) => <option key={s}>{s}</option>)}</select></Field>
      </div>
      {selectedClient && !selectedClient.linkedUserId && (
        <p className="flex items-start gap-2 rounded-xl border border-cb-amber/20 bg-cb-amber/5 p-3 text-xs text-cb-amber"><AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
          <span>Este cliente aún no tiene acceso al portal. <Link className="underline" href={`/clients/${selectedClient.id}`}>Dale acceso</Link> para que vea el proyecto.</span></p>
      )}

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-cb-muted">Estado</legend>
        <Field label="Entrega"><select className="input" value={form.deliveryStatus} onChange={(e) => set("deliveryStatus", e.target.value)}>{DELIVERY_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Pago"><select className="input" value={form.paymentStatus} onChange={(e) => set("paymentStatus", e.target.value)}>{PAYMENT_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></Field>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-4">
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-cb-muted">Montos</legend>
        <Field label="Moneda"><select className="input" value={form.currency} onChange={(e) => set("currency", e.target.value)}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Total"><input className="input" type="number" min="0" step="0.01" inputMode="decimal" value={form.amount} onChange={(e) => set("amount", e.target.value)} /></Field>
        <Field label="Anticipo acordado"><input className="input" type="number" min="0" step="0.01" inputMode="decimal" value={form.initialPayment} onChange={(e) => set("initialPayment", e.target.value)} /></Field>
        <Field label="Mantenimiento / mes"><input className="input" type="number" min="0" step="0.01" inputMode="decimal" value={form.monthlyMaintenance} onChange={(e) => set("monthlyMaintenance", e.target.value)} /></Field>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-4">
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-cb-muted">Fechas</legend>
        <Field label="Inicio"><input className="input" type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} /></Field>
        <Field label="Entrega estimada"><input className="input" type="date" value={form.estimatedDelivery} onChange={(e) => set("estimatedDelivery", e.target.value)} /></Field>
        <Field label="Entrega real"><input className="input" type="date" value={form.actualDelivery} onChange={(e) => set("actualDelivery", e.target.value)} /></Field>
        <Field label="Próximo mantenimiento"><input className="input" type="date" value={form.nextMaintenanceDate} onChange={(e) => set("nextMaintenanceDate", e.target.value)} /></Field>
      </fieldset>

      <Field label="Descripción para el cliente" hint="Se muestra en el portal."><textarea className="input min-h-[100px]" value={form.notes} onChange={(e) => set("notes", e.target.value)} maxLength={4000} /></Field>

      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-cb-muted">Enlaces (https)</legend>
        <Field label="Sitio en línea" hint="Visible en el portal."><input className="input" type="url" placeholder="https://" value={form.productionUrl} onChange={(e) => set("productionUrl", e.target.value)} /></Field>
        <Field label="Propuesta" hint="Visible en el portal."><input className="input" type="url" placeholder="https://" value={form.proposalUrl} onChange={(e) => set("proposalUrl", e.target.value)} /></Field>
        <Field label="Repositorio" hint="Solo uso interno."><input className="input" type="url" placeholder="https://" value={form.repoUrl} onChange={(e) => set("repoUrl", e.target.value)} /></Field>
      </fieldset>

      <ErrorBanner>{error || null}</ErrorBanner>
      <div className="flex items-center justify-end gap-3 border-t border-cb-line pt-4">
        {saved && inline && <span className="text-sm text-emerald-300" role="status">Cambios guardados.</span>}
        {onClose && <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>}
        <button className="btn-primary" disabled={busy}><Save size={16} aria-hidden />{busy ? "Guardando…" : project ? "Guardar cambios" : "Crear proyecto"}</button>
      </div>
    </form>
  );

  if (inline) return body;
  return <Modal title={project ? "Editar proyecto" : "Nuevo proyecto"} eyebrow="Proyectos" onClose={onClose ?? (() => undefined)} wide>{body}</Modal>;
}
