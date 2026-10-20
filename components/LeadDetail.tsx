"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Briefcase, Building2, Check, Copy, ExternalLink, Loader2, Mail,
  MessageCircle, Phone, Save, Send, StickyNote, Trash2, UserCheck, Users,
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  ACTIVITY_COLUMNS, ACTIVITY_LABELS, BUDGET_LABELS, CLOSED_STATUSES, LEAD_COLUMNS, MANUAL_ACTIVITY_TYPES, PROJECT_SERVICES,
  STATUSES, contactTemplates, formatDateTime, friendlyLeadError, fromLocalInput, isOverdue, mailtoUrl, money,
  normalizeLead, statusMeta, timeAgo, toLocalInput, whatsappNumber,
  type Lead, type LeadActivity, type LeadCurrency, type LeadStatus, type ManualActivityType, type TeamMember,
} from "@/lib/leads";

type Viewer = { id: string; name: string; isAdmin: boolean };

type Draft = {
  status: LeadStatus;
  lost_reason: string;
  assigned_to: string;
  next_follow_up_at: string;
  estimated_value: string;
  currency: LeadCurrency;
};

const COUNTRY_CODE = process.env.NEXT_PUBLIC_CBDEVS_DEFAULT_PHONE_COUNTRY_CODE || "52";

function draftFrom(lead: Lead): Draft {
  return {
    status: lead.status,
    lost_reason: lead.lost_reason || "",
    assigned_to: lead.assigned_to || "",
    next_follow_up_at: toLocalInput(lead.next_follow_up_at),
    estimated_value: lead.estimated_value === null ? "" : String(lead.estimated_value),
    currency: lead.currency,
  };
}

const ACTIVITY_ICONS: Record<ManualActivityType, typeof StickyNote> = {
  note: StickyNote,
  call: Phone,
  email: Mail,
  whatsapp: MessageCircle,
  meeting: Users,
};

export default function LeadDetail({
  lead, members, viewer, onChange, onDeleted, onClose,
}: {
  lead: Lead;
  members: TeamMember[];
  viewer: Viewer;
  onChange: (lead: Lead) => void;
  onDeleted: (id: string) => void;
  onClose: () => void;
}) {
  const db = getSupabaseClient();
  const [draft, setDraft] = useState<Draft>(() => draftFrom(lead));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [activitiesError, setActivitiesError] = useState("");
  const [composerType, setComposerType] = useState<ManualActivityType>("note");
  const [composerBody, setComposerBody] = useState("");
  const [logging, setLogging] = useState(false);
  const [logError, setLogError] = useState("");
  const [contactHint, setContactHint] = useState(false);
  const [copied, setCopied] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const memberName = useCallback(
    (id: string | null | undefined) => (id ? members.find((m) => m.id === id)?.name || "Alguien del equipo" : "Sin asignar"),
    [members],
  );

  // Reset the form when another lead is opened.
  useEffect(() => {
    setDraft(draftFrom(lead));
    setSaveError("");
    setSaved(false);
    setLogError("");
    setContactHint(false);
    setComposerBody("");
    setComposerType("note");
    headingRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id]);

  const loadActivities = useCallback(async () => {
    setActivitiesError("");
    const { data, error } = await db
      .from("cbdevs_inquiry_activities")
      .select(ACTIVITY_COLUMNS)
      .eq("inquiry_id", lead.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) setActivitiesError("No se pudo cargar el historial.");
    else setActivities((data || []) as LeadActivity[]);
    setActivitiesLoading(false);
  }, [db, lead.id]);

  useEffect(() => {
    setActivitiesLoading(true);
    setActivities([]);
    void loadActivities();
    const channel = db
      .channel(`lead-activity:${lead.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "cbdevs_inquiry_activities", filter: `inquiry_id=eq.${lead.id}` },
        (payload: { new: unknown }) => {
          const row = payload.new as LeadActivity;
          setActivities((current) => (current.some((a) => a.id === row.id) ? current : [row, ...current]));
        },
      )
      .subscribe();
    return () => {
      void db.removeChannel(channel);
    };
  }, [db, lead.id, loadActivities]);

  async function refreshLead() {
    const { data, error } = await db.from("cbdevs_inquiries").select(LEAD_COLUMNS).eq("id", lead.id).maybeSingle();
    if (!error && data) onChange(normalizeLead(data as Record<string, unknown>));
  }

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(draftFrom(lead)), [draft, lead]);
  const needsReason = draft.status === "lost" && !draft.lost_reason.trim();
  const valueInvalid = draft.estimated_value !== "" && (!Number.isFinite(Number(draft.estimated_value)) || Number(draft.estimated_value) < 0);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!dirty || needsReason || valueInvalid) return;
    setSaving(true);
    setSaveError("");
    setSaved(false);
    const original = draftFrom(lead);
    const patch: Record<string, unknown> = {};
    if (draft.status !== original.status) patch.status = draft.status;
    if (draft.status === "lost" && draft.lost_reason !== original.lost_reason) patch.lost_reason = draft.lost_reason.trim();
    if (draft.assigned_to !== original.assigned_to) patch.assigned_to = draft.assigned_to || null;
    if (draft.next_follow_up_at !== original.next_follow_up_at) patch.next_follow_up_at = fromLocalInput(draft.next_follow_up_at);
    if (draft.estimated_value !== original.estimated_value) patch.estimated_value = draft.estimated_value === "" ? null : Number(draft.estimated_value);
    if (draft.currency !== original.currency) patch.currency = draft.currency;
    try {
      const { data, error } = await db.from("cbdevs_inquiries").update(patch).eq("id", lead.id).select(LEAD_COLUMNS).single();
      if (error) throw error;
      const updated = normalizeLead(data as Record<string, unknown>);
      onChange(updated);
      setDraft(draftFrom(updated));
      setSaved(true);
      void loadActivities();
    } catch (error) {
      setSaveError(friendlyLeadError(error));
    } finally {
      setSaving(false);
    }
  }

  async function logActivity(event: React.FormEvent) {
    event.preventDefault();
    const body = composerBody.trim();
    if (composerType === "note" && !body) {
      setLogError("Escribe la nota antes de guardarla.");
      return;
    }
    setLogging(true);
    setLogError("");
    try {
      const { error } = await db.from("cbdevs_inquiry_activities").insert({ inquiry_id: lead.id, type: composerType, body });
      if (error) throw error;
      setComposerBody("");
      setContactHint(false);
      await loadActivities();
      if (composerType !== "note") await refreshLead();
    } catch (error) {
      setLogError(friendlyLeadError(error, "No se pudo registrar la actividad."));
    } finally {
      setLogging(false);
    }
  }

  function prepareLog(type: ManualActivityType) {
    setComposerType(type);
    setContactHint(true);
    // Let the link open first, then move focus to the composer for when the user returns.
    window.setTimeout(() => composerRef.current?.focus(), 300);
  }

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(lead.email);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  async function remove() {
    if (!window.confirm(`¿Eliminar definitivamente el lead de ${lead.name}? Esta acción no se puede deshacer. Si es spam, mejor márcalo como Spam.`)) return;
    setSaveError("");
    const { data, error } = await db.from("cbdevs_inquiries").delete().eq("id", lead.id).select("id");
    if (error || !data?.length) {
      setSaveError(friendlyLeadError(error, "No se pudo eliminar el lead."));
      return;
    }
    onDeleted(lead.id);
  }

  const templates = contactTemplates(lead, viewer.name);
  const wa = whatsappNumber(lead.phone, COUNTRY_CODE);
  const meta = statusMeta(lead.status);
  const attribution = Object.entries(lead.attribution || {});

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <button type="button" onClick={onClose} className="btn-ghost !px-2.5 lg:hidden" aria-label="Volver a la lista">
          <ArrowLeft size={17} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 font-mono text-[10px] uppercase ${meta.badge}`}>{meta.label}</span>
            <span className="text-xs text-cb-muted">Recibido {timeAgo(lead.created_at)} · {formatDateTime(lead.created_at)}</span>
          </div>
          <h2 ref={headingRef} tabIndex={-1} className="mt-2 break-words text-2xl font-bold outline-none">{lead.name}</h2>
          {lead.company && <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-300"><Building2 size={14} />{lead.company}</p>}
        </div>
      </div>

      {/* Contact */}
      <section className="panel p-4" aria-label="Contactar">
        <div className="flex flex-wrap gap-2">
          <a className="btn-primary" href={mailtoUrl(lead.email, templates.emailSubject, templates.emailBody)} onClick={() => prepareLog("email")}>
            <Mail size={16} /> Email
          </a>
          {wa && (
            <a className="btn-ghost" target="_blank" rel="noopener noreferrer"
              href={`https://wa.me/${wa}?text=${encodeURIComponent(templates.whatsapp)}`} onClick={() => prepareLog("whatsapp")}>
              <MessageCircle size={16} /> WhatsApp
            </a>
          )}
          {lead.phone && (
            <a className="btn-ghost" href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`} onClick={() => prepareLog("call")}>
              <Phone size={16} /> Llamar
            </a>
          )}
          <button type="button" className="btn-ghost" onClick={() => void copyEmail()} aria-live="polite">
            {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Copiado" : "Copiar email"}
          </button>
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-slate-500">Email</dt><dd className="break-all">{lead.email}</dd></div>
          <div><dt className="text-xs text-slate-500">Teléfono</dt><dd>{lead.phone || "—"}</dd></div>
          <div><dt className="text-xs text-slate-500">Servicio</dt><dd>{lead.service_interest || "—"}</dd></div>
          <div><dt className="text-xs text-slate-500">Presupuesto</dt><dd>{lead.budget_range ? BUDGET_LABELS[lead.budget_range] || lead.budget_range : "—"}</dd></div>
          <div><dt className="text-xs text-slate-500">Último contacto</dt><dd>{lead.last_contacted_at ? timeAgo(lead.last_contacted_at) : "Aún no"}</dd></div>
          <div><dt className="text-xs text-slate-500">Origen</dt><dd>{attribution.length ? attribution.map(([k, v]) => `${k.replace("utm_", "")}: ${v}`).join(" · ") : "Formulario web"}</dd></div>
        </dl>
        <div className="mt-4">
          <div className="text-xs text-slate-500">Mensaje</div>
          <p className="mt-1 whitespace-pre-wrap break-words rounded-xl border border-cb-line bg-cb-bg p-3 text-sm leading-relaxed text-slate-200">{lead.message}</p>
        </div>
      </section>

      {/* Pipeline */}
      <form onSubmit={save} className="panel space-y-4 p-4" aria-label="Seguimiento del lead">
        <div className="mono-label">PIPELINE</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-slate-400">
            Estado
            <select className="input mt-1" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as LeadStatus })}>
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
          <label className="block text-xs text-slate-400">
            Responsable
            <select className="input mt-1" value={draft.assigned_to} onChange={(e) => setDraft({ ...draft, assigned_to: e.target.value })}>
              <option value="">Sin asignar</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.id === viewer.id ? `${m.name} (yo)` : m.name}</option>)}
            </select>
          </label>
          {draft.status === "lost" && (
            <label className="block text-xs text-slate-400 sm:col-span-2">
              Motivo de pérdida *
              <input className="input mt-1" value={draft.lost_reason} maxLength={500} required
                placeholder="Ej. Eligió otro proveedor, sin presupuesto…"
                aria-invalid={needsReason} onChange={(e) => setDraft({ ...draft, lost_reason: e.target.value })} />
            </label>
          )}
          <label className="block text-xs text-slate-400">
            Próximo seguimiento
            <input type="datetime-local" className="input mt-1" value={draft.next_follow_up_at}
              disabled={CLOSED_STATUSES.includes(draft.status)}
              onChange={(e) => setDraft({ ...draft, next_follow_up_at: e.target.value })} />
            {isOverdue(lead) && <span className="mt-1 block text-red-300">Seguimiento vencido</span>}
          </label>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <label className="block text-xs text-slate-400">
              Valor estimado
              <input type="number" min="0" step="100" inputMode="decimal" className="input mt-1" value={draft.estimated_value}
                aria-invalid={valueInvalid} onChange={(e) => setDraft({ ...draft, estimated_value: e.target.value })} />
            </label>
            <label className="block text-xs text-slate-400">
              Moneda
              <select className="input mt-1" value={draft.currency} onChange={(e) => setDraft({ ...draft, currency: e.target.value as LeadCurrency })}>
                <option>MXN</option><option>USD</option><option>CAD</option>
              </select>
            </label>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn-primary" disabled={!dirty || saving || needsReason || valueInvalid}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
          {dirty && !saving && <button type="button" className="btn-ghost" onClick={() => setDraft(draftFrom(lead))}>Descartar</button>}
          {saved && !dirty && <span className="text-sm text-emerald-300" role="status">Guardado</span>}
          {lead.assigned_to !== viewer.id && !dirty && (
            <button type="button" className="btn-ghost" onClick={() => setDraft({ ...draft, assigned_to: viewer.id })}>
              <UserCheck size={16} /> Asignarme
            </button>
          )}
        </div>
        {saveError && <p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">{saveError}</p>}
      </form>

      <ConvertPanel lead={lead} onConverted={async () => { await refreshLead(); await loadActivities(); }} />

      {/* Timeline */}
      <section className="panel p-4" aria-label="Historial">
        <div className="mono-label">HISTORIAL</div>
        <form onSubmit={logActivity} className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Tipo de actividad">
            {MANUAL_ACTIVITY_TYPES.map((type) => {
              const Icon = ACTIVITY_ICONS[type];
              const active = composerType === type;
              return (
                <button key={type} type="button" role="radio" aria-checked={active} onClick={() => setComposerType(type)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition ${active ? "border-cb-amber bg-cb-amber/10 text-cb-amber" : "border-cb-line text-slate-400 hover:text-white"}`}>
                  <Icon size={13} /> {ACTIVITY_LABELS[type]}
                </button>
              );
            })}
          </div>
          {contactHint && <p className="text-xs text-cb-teal">¿Ya lo contactaste? Registra el contacto para mantener el historial al día.</p>}
          <label className="sr-only" htmlFor={`composer-${lead.id}`}>Detalle de la actividad</label>
          <textarea id={`composer-${lead.id}`} ref={composerRef} className="input min-h-[84px] resize-y" maxLength={5000}
            placeholder={composerType === "note" ? "Escribe una nota interna…" : "Resultado del contacto (opcional)…"}
            value={composerBody} onChange={(e) => setComposerBody(e.target.value)} />
          <div className="flex items-center gap-3">
            <button className="btn-primary" disabled={logging}>
              {logging ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Registrar {ACTIVITY_LABELS[composerType].toLowerCase()}
            </button>
            {logError && <span role="alert" className="text-sm text-red-300">{logError}</span>}
          </div>
        </form>
        <ol className="mt-5 space-y-3">
          {activitiesLoading && <li className="text-sm text-slate-500">Cargando historial…</li>}
          {activitiesError && <li role="alert" className="text-sm text-red-300">{activitiesError}</li>}
          {!activitiesLoading && !activitiesError && !activities.length && <li className="text-sm text-slate-500">Sin actividad todavía.</li>}
          {activities.map((a) => (
            <li key={a.id} className="rounded-xl border border-cb-line bg-cb-bg p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-semibold">{ACTIVITY_LABELS[a.type] || a.type}</span>
                <time className="text-xs text-slate-500" dateTime={a.created_at} title={formatDateTime(a.created_at)}>{timeAgo(a.created_at)}</time>
              </div>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-300">{describeActivity(a, memberName)}</p>
              <div className="mt-1 text-xs text-slate-500">{a.actor_id ? memberName(a.actor_id) : "Sitio web"}</div>
            </li>
          ))}
        </ol>
      </section>

      {viewer.isAdmin && (
        <div className="flex justify-end">
          <button type="button" className="btn-ghost !border-red-500/30 !text-red-300" onClick={() => void remove()}>
            <Trash2 size={16} /> Eliminar lead
          </button>
        </div>
      )}
    </div>
  );
}

function describeActivity(a: LeadActivity, memberName: (id: string | null | undefined) => string): string {
  const m = a.metadata || {};
  switch (a.type) {
    case "created":
      return "Llegó desde el formulario de contacto del sitio web.";
    case "status_change": {
      const from = statusMeta(String(m.from) as LeadStatus).label;
      const to = statusMeta(String(m.to) as LeadStatus).label;
      return `${from} → ${to}${m.lost_reason ? ` · Motivo: ${String(m.lost_reason)}` : ""}`;
    }
    case "assignment":
      return m.to ? `Asignado a ${memberName(String(m.to))}` : "Se quitó el responsable";
    case "conversion":
      return m.project_id ? "Convertido en cliente con proyecto cotizado." : "Convertido en cliente.";
    default:
      return a.body || "Sin detalle.";
  }
}

function ConvertPanel({ lead, onConverted }: { lead: Lead; onConverted: () => Promise<void> }) {
  const db = getSupabaseClient();
  const defaultService = (PROJECT_SERVICES as readonly string[]).includes(lead.service_interest || "") ? (lead.service_interest as string) : "Sitio Web";
  const [open, setOpen] = useState(false);
  const [withProject, setWithProject] = useState(true);
  const [projectName, setProjectName] = useState("");
  const [service, setService] = useState(defaultService);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<LeadCurrency>(lead.currency);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setOpen(false);
    setError("");
    setProjectName(`${lead.company || lead.name} — ${defaultService}`);
    setService(defaultService);
    setAmount(lead.estimated_value === null ? "" : String(lead.estimated_value));
    setCurrency(lead.currency);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id]);

  if (lead.status === "spam") return null;

  if (lead.client_id) {
    return (
      <section className="panel flex flex-wrap items-center gap-3 p-4 text-sm" aria-label="Conversión">
        <Briefcase size={17} className="text-emerald-300" />
        <span>Este lead ya es cliente{lead.project_id ? " y tiene un proyecto cotizado" : ""}.</span>
        {lead.project_id && <Link href="/projects" className="inline-flex items-center gap-1 text-cb-amber">Ver proyectos <ExternalLink size={13} /></Link>}
      </section>
    );
  }

  const amountInvalid = amount !== "" && (!Number.isFinite(Number(amount)) || Number(amount) < 0);

  async function convert(event: React.FormEvent) {
    event.preventDefault();
    if (amountInvalid) return;
    setBusy(true);
    setError("");
    try {
      const { error: rpcError } = await db.rpc("cbdevs_convert_inquiry", {
        p_inquiry_id: lead.id,
        p_create_project: withProject,
        p_project_name: withProject ? projectName.trim() || null : null,
        p_service_type: withProject ? service : null,
        p_amount: withProject && amount !== "" ? Number(amount) : null,
        p_currency: withProject ? currency : null,
      });
      if (rpcError) throw rpcError;
      setOpen(false);
      await onConverted();
    } catch (e) {
      setError(friendlyLeadError(e, "No se pudo convertir el lead."));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <section className="panel flex flex-wrap items-center justify-between gap-3 p-4" aria-label="Conversión">
        <div>
          <div className="mono-label">CIERRE</div>
          <p className="mt-1 text-sm text-slate-300">¿Ya acordaron trabajar juntos? Crea el cliente y su proyecto en un paso.</p>
        </div>
        <button type="button" className="btn-ghost" onClick={() => setOpen(true)}><Briefcase size={16} /> Convertir en cliente</button>
      </section>
    );
  }

  return (
    <form onSubmit={convert} className="panel space-y-3 p-4" aria-label="Convertir en cliente">
      <div className="mono-label">CONVERTIR EN CLIENTE</div>
      <p className="text-sm text-slate-400">Se creará (o reutilizará) el cliente con el email {lead.email}.</p>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={withProject} onChange={(e) => setWithProject(e.target.checked)} className="h-4 w-4 accent-[#f2a950]" />
        Crear también un proyecto en estado “Cotizado” (el lead pasará a Ganado)
      </label>
      {withProject && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-slate-400 sm:col-span-2">
            Nombre del proyecto
            <input className="input mt-1" value={projectName} maxLength={200} onChange={(e) => setProjectName(e.target.value)} />
          </label>
          <label className="block text-xs text-slate-400">
            Servicio
            <select className="input mt-1" value={service} onChange={(e) => setService(e.target.value)}>
              {PROJECT_SERVICES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <label className="block text-xs text-slate-400">
              Monto
              <input type="number" min="0" step="100" className="input mt-1" value={amount} aria-invalid={amountInvalid}
                onChange={(e) => setAmount(e.target.value)} />
            </label>
            <label className="block text-xs text-slate-400">
              Moneda
              <select className="input mt-1" value={currency} onChange={(e) => setCurrency(e.target.value as LeadCurrency)}>
                <option>MXN</option><option>USD</option><option>CAD</option>
              </select>
            </label>
          </div>
          {amount !== "" && !amountInvalid && <p className="text-xs text-slate-500 sm:col-span-2">Monto: {money(Number(amount), currency)}</p>}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" disabled={busy || amountInvalid}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Briefcase size={16} />} Convertir
        </button>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)} disabled={busy}>Cancelar</button>
      </div>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    </form>
  );
}

