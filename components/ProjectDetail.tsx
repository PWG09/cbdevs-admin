"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, CheckCircle2, CreditCard, ExternalLink, FileText, Flag, Info, KeyRound, Link2, MessageSquare, Plus, Trash2, Users, XCircle } from "lucide-react";
import ConfirmButton from "@/components/ConfirmButton";
import ProjectForm from "@/components/ProjectForm";
import ProjectChat from "@/components/ProjectChat";
import { EmptyState, ErrorBanner, PageHeader, ProgressBar, Skeleton, StatusBadge } from "@/components/ui";
import { getClient, type Client } from "@/lib/data/clients";
import {
  PAYMENT_PROVIDERS, createDocument, createMilestone, createPayment, createPaymentLink, deleteDocument, deleteMilestone, deletePayment, deleteProject, getProject,
  listDocuments, listMilestones, listPaymentLinks, listPayments, setPaymentLinkStatus, updateMilestone, updatePaymentStatus,
  type AdminProject, type Milestone, type Payment, type PaymentLink, type ProjectDocument,
} from "@/lib/data/projects";
import { getWorkspace } from "@/lib/data/workspace";
import { messageOf } from "@/lib/errors";
import { formatDate, formatMoney } from "@/lib/format";
import { paymentStatusLabel } from "@/lib/status";
import { safeExternalUrl } from "@/lib/safe-url";
import { CURRENCIES, DOCUMENT_TYPES, MILESTONE_STATUSES } from "@/lib/validation";

type Tab = "summary" | "milestones" | "documents" | "payments" | "messages";
const TABS: Array<{ id: Tab; label: string; icon: typeof Info }> = [
  { id: "summary", label: "Datos", icon: Info },
  { id: "milestones", label: "Hitos", icon: Flag },
  { id: "documents", label: "Documentos", icon: FileText },
  { id: "payments", label: "Pagos", icon: CreditCard },
  { id: "messages", label: "Mensajes", icon: MessageSquare },
];

/** Local calendar date (YYYY-MM-DD); toISOString would use UTC and can show tomorrow in the evening. */
const localDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const today = () => localDate(new Date());

// ---------------------------------------------------------------- milestones

function MilestonesTab({ project, isAdmin }: { project: AdminProject; isAdmin: boolean }) {
  const [items, setItems] = useState<Milestone[] | null>(null);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => listMilestones(project.id).then(setItems), [project.id]);
  useEffect(() => { load().catch((c) => { setError(messageOf(c, "No se pudieron cargar los hitos.")); setItems([]); }); }, [load]);

  async function run(action: () => Promise<unknown>, fallback: string) {
    setBusy(true); setError("");
    try { await action(); await load(); } catch (c) { setError(messageOf(c, fallback)); } finally { setBusy(false); }
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    const order = (items ?? []).reduce((m, i) => Math.max(m, i.sortOrder), -1) + 1;
    await run(() => createMilestone(project, { title, status: "Pendiente", dueDate }, order).then(() => { setTitle(""); setDueDate(""); }), "No se pudo crear el hito.");
  }

  async function swap(i: number, dir: -1 | 1) {
    const list = items ?? [];
    const a = list[i], b = list[i + dir];
    if (!a || !b) return;
    // sort_order is not unique for milestones, so two updates are safe; normalize to index order.
    await run(async () => { await updateMilestone(a.id, { sortOrder: i + dir }); await updateMilestone(b.id, { sortOrder: i }); }, "No se pudo reordenar.");
  }

  const done = (items ?? []).filter((m) => m.status === "Completado").length;
  const total = items?.length ?? 0;

  return (
    <div className="space-y-4">
      <p className="text-sm text-cb-muted">El avance que ve el cliente en el portal se calcula con estos hitos.</p>
      {total > 0 && <div><div className="mb-1.5 flex justify-between text-sm"><span className="text-cb-muted">{done} de {total} completados</span><span className="font-semibold">{Math.round((done / total) * 100)}%</span></div><ProgressBar value={(done / total) * 100} label="Avance por hitos" /></div>}
      <ErrorBanner>{error || null}</ErrorBanner>
      {items === null ? <Skeleton className="h-40" /> : items.length === 0 ? <EmptyState icon={Flag} title="Sin hitos" description="Agrega las etapas del proyecto (por ejemplo: Diseño, Desarrollo, Pruebas, Lanzamiento)." /> : (
        <ul className="divide-y divide-cb-line rounded-xl border border-cb-line">
          {items.map((m, i) => (
            <li key={m.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
              <span className="w-6 shrink-0 text-center font-mono text-xs text-slate-500">{i + 1}</span>
              <input className="input min-w-0 flex-1" defaultValue={m.title} aria-label="Título del hito" maxLength={240}
                onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== m.title) void run(() => updateMilestone(m.id, { title: v }), "No se pudo renombrar el hito."); }} />
              <input className="input sm:w-40" type="date" defaultValue={m.dueDate} aria-label="Fecha objetivo"
                onBlur={(e) => { if (e.target.value !== m.dueDate) void run(() => updateMilestone(m.id, { dueDate: e.target.value }), "No se pudo cambiar la fecha."); }} />
              <select className="input sm:w-40" value={m.status} aria-label="Estado" disabled={busy} onChange={(e) => void run(() => updateMilestone(m.id, { status: e.target.value }), "No se pudo cambiar el estado.")}>
                {MILESTONE_STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
              <div className="flex gap-1.5">
                <button type="button" className="rounded-lg border border-cb-line p-2 text-slate-300 disabled:opacity-40" disabled={busy || i === 0} onClick={() => void swap(i, -1)} aria-label="Subir"><ArrowUp size={14} /></button>
                <button type="button" className="rounded-lg border border-cb-line p-2 text-slate-300 disabled:opacity-40" disabled={busy || i === items.length - 1} onClick={() => void swap(i, 1)} aria-label="Bajar"><ArrowDown size={14} /></button>
                {isAdmin && <ConfirmButton className="rounded-lg border border-cb-line p-2 text-slate-300" confirmLabel="¿Sí?" title="Eliminar hito" onConfirm={() => run(() => deleteMilestone(m.id), "No se pudo eliminar el hito.")}><Trash2 size={14} /></ConfirmButton>}
              </div>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="flex flex-col gap-2 rounded-xl border border-dashed border-cb-line p-3 sm:flex-row">
        <input className="input flex-1" placeholder="Nuevo hito" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={240} required aria-label="Nuevo hito" />
        <input className="input sm:w-44" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} aria-label="Fecha objetivo del nuevo hito" />
        <button className="btn-primary" disabled={busy || !title.trim()}><Plus size={15} aria-hidden />Agregar</button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------- documents

function DocumentsTab({ project, isAdmin }: { project: AdminProject; isAdmin: boolean }) {
  const [items, setItems] = useState<ProjectDocument[] | null>(null);
  const [form, setForm] = useState({ title: "", url: "", type: "Entrega" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => listDocuments(project.id).then(setItems), [project.id]);
  useEffect(() => { load().catch((c) => { setError(messageOf(c, "No se pudieron cargar los documentos.")); setItems([]); }); }, [load]);

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try { await createDocument(project, form); setForm({ title: "", url: "", type: form.type }); await load(); }
    catch (c) { setError(messageOf(c, "No se pudo agregar el documento.")); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-cb-muted">Enlaces que el cliente verá en el portal: propuesta, contrato, facturas, entregables. Usa enlaces https (Google Drive, Dropbox, Figma…).</p>
      <ErrorBanner>{error || null}</ErrorBanner>
      {items === null ? <Skeleton className="h-32" /> : items.length === 0 ? <EmptyState icon={FileText} title="Sin documentos" description="Agrega el primer documento con el formulario de abajo." /> : (
        <ul className="divide-y divide-cb-line rounded-xl border border-cb-line">
          {items.map((d) => (
            <li key={d.id} className="flex items-center gap-3 p-3">
              <FileText size={16} className="shrink-0 text-cb-amber" aria-hidden />
              <div className="min-w-0 flex-1"><div className="truncate font-medium">{d.title}</div><div className="text-xs text-cb-muted">{d.type} · {formatDate(d.createdAt)}</div></div>
              <a href={safeExternalUrl(d.url)} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-cb-line p-2 text-slate-300 hover:text-cb-amber" aria-label={`Abrir ${d.title}`}><ExternalLink size={14} /></a>
              {isAdmin && <ConfirmButton className="rounded-lg border border-cb-line p-2 text-slate-300" confirmLabel="¿Sí?" title="Eliminar documento" onConfirm={async () => { try { await deleteDocument(d.id); await load(); } catch (c) { setError(messageOf(c, "No se pudo eliminar.")); } }}><Trash2 size={14} /></ConfirmButton>}
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="grid gap-2 rounded-xl border border-dashed border-cb-line p-3 sm:grid-cols-[1fr_1.4fr_150px_auto]">
        <input className="input" placeholder="Título" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={240} aria-label="Título del documento" />
        <input className="input" type="url" placeholder="https://…" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} required aria-label="Enlace del documento" />
        <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} aria-label="Tipo">{DOCUMENT_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
        <button className="btn-primary" disabled={busy}><Plus size={15} aria-hidden />Agregar</button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------- payments

function PaymentsTab({ project, isAdmin }: { project: AdminProject; isAdmin: boolean }) {
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pay, setPay] = useState({ amount: "", currency: project.currency, status: "paid", provider: "transfer", reference: "", paidAt: today() });
  const [link, setLink] = useState({ amount: "", currency: project.currency, url: "", provider: "stripe", expiresAt: "" });

  const load = useCallback(async () => {
    const [p, l] = await Promise.all([listPayments(project.id), listPaymentLinks(project.id)]);
    setPayments(p); setLinks(l);
  }, [project.id]);
  useEffect(() => { load().catch((c) => { setError(messageOf(c, "No se pudieron cargar los pagos.")); setPayments([]); }); }, [load]);

  async function run(action: () => Promise<unknown>, fallback: string) {
    setBusy(true); setError("");
    try { await action(); await load(); return true; } catch (c) { setError(messageOf(c, fallback)); return false; } finally { setBusy(false); }
  }

  const paid = useMemo(() => (payments ?? []).filter((p) => p.status === "paid" && p.currency === project.currency).reduce((s, p) => s + p.amount, 0), [payments, project.currency]);
  const balance = Math.max(project.amount - paid, 0);
  const activeLinks = links.filter((l) => l.status === "active" && (!l.expiresAt || new Date(l.expiresAt).getTime() > Date.now()));

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        {[["Total", formatMoney(project.amount, project.currency)], ["Pagado (confirmado)", formatMoney(paid, project.currency)], ["Saldo", formatMoney(balance, project.currency)]].map(([l, v]) => (
          <div key={l} className="rounded-xl border border-cb-line bg-cb-bg p-4"><div className="text-xs text-cb-muted">{l}</div><div className="mt-1 text-xl font-bold tabular-nums">{v}</div></div>
        ))}
      </div>
      <p className="text-xs text-cb-muted">El cliente ve exactamente estos números en el portal: solo cuentan los pagos con estado “Pagado” en la moneda del proyecto. Recuerda actualizar también el “Estado de pago” en Datos.</p>
      <ErrorBanner>{error || null}</ErrorBanner>

      <section>
        <h3 className="font-semibold">Pagos registrados</h3>
        {payments === null ? <Skeleton className="mt-3 h-24" /> : payments.length === 0 ? <p className="mt-2 text-sm text-cb-muted">Aún no hay pagos.</p> : (
          <ul className="mt-3 divide-y divide-cb-line rounded-xl border border-cb-line">
            {payments.map((p) => (
              <li key={p.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold tabular-nums">{formatMoney(p.amount, p.currency)}</div>
                  <div className="text-xs text-cb-muted">{PAYMENT_PROVIDERS.find((x) => x.value === p.provider)?.label ?? (p.provider || "—")}{p.reference ? ` · Ref. ${p.reference}` : ""} · {formatDate(p.paidAt || p.createdAt)}</div>
                </div>
                <StatusBadge status={p.status} label={paymentStatusLabel(p.status)} />
                <div className="flex gap-1.5">
                  {p.status !== "paid" && <button type="button" className="btn-ghost px-3 py-1.5 text-xs" disabled={busy} onClick={() => void run(() => updatePaymentStatus(p.id, "paid", today()), "No se pudo actualizar.")}><CheckCircle2 size={13} aria-hidden />Marcar pagado</button>}
                  {p.status === "pending" && <button type="button" className="btn-ghost px-3 py-1.5 text-xs" disabled={busy} onClick={() => void run(() => updatePaymentStatus(p.id, "cancelled"), "No se pudo actualizar.")}><XCircle size={13} aria-hidden />Cancelar</button>}
                  {isAdmin && <ConfirmButton className="rounded-lg border border-cb-line p-2 text-slate-300" confirmLabel="¿Sí?" title="Eliminar pago" onConfirm={() => run(() => deletePayment(p.id), "No se pudo eliminar.").then(() => undefined)}><Trash2 size={14} /></ConfirmButton>}
                </div>
              </li>
            ))}
          </ul>
        )}
        <form className="mt-3 grid gap-2 rounded-xl border border-dashed border-cb-line p-3 sm:grid-cols-3 lg:grid-cols-[1fr_90px_140px_150px_1fr_150px_auto]"
          onSubmit={async (e) => { e.preventDefault(); if (await run(() => createPayment(project, pay), "No se pudo registrar el pago.")) setPay({ ...pay, amount: "", reference: "" }); }}>
          <input className="input" type="number" min="0.01" step="0.01" placeholder="Monto" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} required aria-label="Monto del pago" />
          <select className="input" value={pay.currency} onChange={(e) => setPay({ ...pay, currency: e.target.value })} aria-label="Moneda">{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
          <select className="input" value={pay.status} onChange={(e) => setPay({ ...pay, status: e.target.value })} aria-label="Estado"><option value="paid">Pagado</option><option value="pending">Pendiente</option></select>
          <select className="input" value={pay.provider} onChange={(e) => setPay({ ...pay, provider: e.target.value })} aria-label="Método">{PAYMENT_PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select>
          <input className="input" placeholder="Referencia (opcional)" value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} maxLength={120} aria-label="Referencia" />
          <input className="input" type="date" value={pay.paidAt} onChange={(e) => setPay({ ...pay, paidAt: e.target.value })} aria-label="Fecha de pago" />
          <button className="btn-primary" disabled={busy}><Plus size={15} aria-hidden />Registrar</button>
        </form>
      </section>

      <section>
        <h3 className="flex items-center gap-2 font-semibold"><Link2 size={16} className="text-cb-amber" aria-hidden />Enlaces de pago</h3>
        <p className="mt-1 text-xs text-cb-muted">Pega aquí un enlace de cobro (Stripe, Mercado Pago, PayPal…). Mientras esté activo, el cliente verá un botón “Pagar” en el portal.</p>
        {links.length > 0 && (
          <ul className="mt-3 divide-y divide-cb-line rounded-xl border border-cb-line">
            {links.map((l) => {
              const expired = l.expiresAt && new Date(l.expiresAt).getTime() <= Date.now();
              const shown = l.status === "active" && !expired;
              return (
                <li key={l.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1"><div className="font-semibold tabular-nums">{formatMoney(l.amount, l.currency)}</div><div className="truncate text-xs text-cb-muted">{l.url}{l.expiresAt ? ` · vence ${formatDate(l.expiresAt)}` : ""}</div></div>
                  <StatusBadge status={expired ? "expired" : l.status} label={expired ? "Vencido" : paymentStatusLabel(l.status)} />
                  {shown && <div className="flex gap-1.5">
                    <button type="button" className="btn-ghost px-3 py-1.5 text-xs" disabled={busy} onClick={() => void run(() => setPaymentLinkStatus(l.id, "completed"), "No se pudo actualizar.")}>Marcar completado</button>
                    <button type="button" className="btn-ghost px-3 py-1.5 text-xs" disabled={busy} onClick={() => void run(() => setPaymentLinkStatus(l.id, "cancelled"), "No se pudo actualizar.")}>Desactivar</button>
                  </div>}
                </li>
              );
            })}
          </ul>
        )}
        {activeLinks.length > 0 && <p className="mt-2 text-xs text-emerald-300">{activeLinks.length === 1 ? "1 enlace visible" : `${activeLinks.length} enlaces visibles`} para el cliente.</p>}
        <form className="mt-3 grid gap-2 rounded-xl border border-dashed border-cb-line p-3 sm:grid-cols-2 lg:grid-cols-[1fr_90px_2fr_150px_150px_auto]"
          onSubmit={async (e) => { e.preventDefault(); if (await run(() => createPaymentLink(project, link), "No se pudo crear el enlace.")) setLink({ ...link, amount: "", url: "", expiresAt: "" }); }}>
          <input className="input" type="number" min="0.01" step="0.01" placeholder="Monto" value={link.amount} onChange={(e) => setLink({ ...link, amount: e.target.value })} required aria-label="Monto a cobrar" />
          <select className="input" value={link.currency} onChange={(e) => setLink({ ...link, currency: e.target.value })} aria-label="Moneda">{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
          <input className="input" type="url" placeholder="https://checkout…" value={link.url} onChange={(e) => setLink({ ...link, url: e.target.value })} required aria-label="Enlace de pago" />
          <select className="input" value={link.provider} onChange={(e) => setLink({ ...link, provider: e.target.value })} aria-label="Proveedor">{PAYMENT_PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select>
          <input className="input" type="date" value={link.expiresAt} onChange={(e) => setLink({ ...link, expiresAt: e.target.value })} aria-label="Vence (opcional)" title="Vence (opcional)" />
          <button className="btn-primary" disabled={busy}><Plus size={15} aria-hidden />Crear</button>
        </form>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- page

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const [project, setProject] = useState<AdminProject | null | undefined>(undefined);
  const [client, setClient] = useState<Client | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tab, setTab] = useState<Tab>("summary");
  const [error, setError] = useState("");

  useEffect(() => {
    const hash = window.location.hash.replace("#", "") as Tab;
    if (TABS.some((t) => t.id === hash)) setTab(hash);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([getProject(projectId), getWorkspace()]).then(async ([p, ws]) => {
      if (!active) return;
      setProject(p);
      setIsAdmin(ws.role === "admin");
      if (p?.clientId) setClient(await getClient(p.clientId).catch(() => null));
    }).catch((c) => { if (active) { setError(messageOf(c, "No se pudo cargar el proyecto.")); setProject(null); } });
    return () => { active = false; };
  }, [projectId]);

  function selectTab(next: Tab) {
    setTab(next);
    window.history.replaceState(null, "", `#${next}`);
  }

  const back = <Link className="inline-flex items-center gap-1.5 text-sm text-cb-muted hover:text-white" href="/projects"><ArrowLeft size={15} aria-hidden />Proyectos</Link>;
  if (project === undefined) return <div className="mx-auto max-w-[1200px] space-y-5"><Skeleton className="h-24" /><Skeleton className="h-96" /></div>;
  if (!project) return <div className="mx-auto max-w-3xl space-y-5">{back}<EmptyState icon={Flag} title="Proyecto no encontrado" description={error || "El proyecto no existe o pertenece a otra organización."} /></div>;

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      {back}
      <PageHeader eyebrow={project.serviceType} title={project.name}
        actions={<div className="flex flex-wrap items-center gap-2"><StatusBadge status={project.deliveryStatus} className="text-xs" /><StatusBadge status={project.paymentStatus} className="text-xs" /></div>} />

      <div className={`flex flex-col gap-3 rounded-xl border p-4 text-sm sm:flex-row sm:items-center ${!client ? "border-red-400/30 bg-red-500/5" : client.linkedUserId ? "border-emerald-400/20 bg-emerald-500/5" : "border-cb-amber/30 bg-cb-amber/5"}`}>
        {client ? <Users size={18} className="shrink-0 text-cb-amber" aria-hidden /> : <KeyRound size={18} className="shrink-0 text-red-300" aria-hidden />}
        <div className="min-w-0 flex-1">
          {!client ? <><b>Sin cliente asignado.</b> <span className="text-cb-muted">Este proyecto no aparece en ningún portal. Asígnale un cliente en “Datos”.</span></>
            : <><b>{client.company || client.name}</b> <span className="text-cb-muted">· {client.linkedUserId ? "ve este proyecto en su portal." : "aún no tiene acceso al portal."}</span></>}
        </div>
        {client && <Link href={`/clients/${client.id}`} className="btn-ghost px-3 py-1.5 text-xs">{client.linkedUserId ? "Ver cliente" : "Dar acceso al portal"}</Link>}
      </div>

      <div className="scrollbar flex gap-1 overflow-x-auto rounded-xl border border-cb-line bg-cb-panel p-1" role="tablist" aria-label="Secciones del proyecto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => selectTab(id)}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${tab === id ? "bg-cb-amber/10 text-cb-amber" : "text-cb-muted hover:text-white"}`}>
            <Icon size={15} aria-hidden />{label}
          </button>
        ))}
      </div>

      <section className="panel p-5 sm:p-6" role="tabpanel">
        {tab === "summary" && (
          <>
            <ProjectForm inline project={project} onSaved={async (p) => { setProject(p); setClient(p.clientId ? await getClient(p.clientId).catch(() => null) : null); }} />
            {isAdmin && (
              <div className="mt-8 border-t border-red-500/20 pt-5">
                <h3 className="font-semibold text-red-200">Eliminar proyecto</h3>
                <p className="mt-1 text-sm text-cb-muted">Borra el proyecto con sus hitos, documentos, mensajes y canal. Los pagos registrados se conservan sin proyecto. No se puede deshacer.</p>
                <ConfirmButton className="btn-ghost mt-3" confirmLabel="Confirmar: eliminar proyecto"
                  onConfirm={async () => { try { await deleteProject(project.id); router.replace("/projects"); } catch (c) { setError(messageOf(c, "No se pudo eliminar el proyecto.")); } }}>
                  <Trash2 size={15} aria-hidden />Eliminar proyecto
                </ConfirmButton>
                <div className="mt-3"><ErrorBanner>{error || null}</ErrorBanner></div>
              </div>
            )}
          </>
        )}
        {tab === "milestones" && <MilestonesTab project={project} isAdmin={isAdmin} />}
        {tab === "documents" && <DocumentsTab project={project} isAdmin={isAdmin} />}
        {tab === "payments" && <PaymentsTab project={project} isAdmin={isAdmin} />}
        {tab === "messages" && <ProjectChat project={project} clientName={client ? client.company || client.name : undefined} />}
      </section>
    </div>
  );
}

