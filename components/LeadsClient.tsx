"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, CalendarClock, Download, Inbox, Mail, MessageCircle, Phone, RefreshCw, Search, X,
} from "lucide-react";
import { getCurrentProfile, getSupabaseClient } from "@/lib/supabase/client";
import LeadDetail from "@/components/LeadDetail";
import {
  BUDGET_LABELS, LEAD_COLUMNS, OPEN_STATUSES, STATUSES, formatDateTime, isOverdue, money, normalizeLead, statusMeta,
  timeAgo, whatsappNumber,
  type Lead, type LeadStatus, type TeamMember,
} from "@/lib/leads";

type View = "open" | "all" | LeadStatus;
type Owner = "all" | "mine" | "unassigned" | string;
type SortKey = "created_at" | "name" | "status" | "next_follow_up_at" | "estimated_value";
type Sort = { key: SortKey; dir: "asc" | "desc" };
type Viewer = { id: string; name: string; isAdmin: boolean; organizationId: string };
type ChangePayload = { eventType: string; new: unknown; old: unknown };
type LoadError = { kind: "setup" | "other"; message: string };

const MAX_LEADS = 500;
const COUNTRY_CODE = process.env.NEXT_PUBLIC_CBDEVS_DEFAULT_PHONE_COUNTRY_CODE || "52";
const STATUS_ORDER: Record<LeadStatus, number> = { new: 0, contacted: 1, qualified: 2, proposal: 3, won: 4, lost: 5, spam: 6 };

// Undefined column / relation: the leads CRM migration is not applied to this database yet.
const SETUP_CODES = new Set(["42703", "42P01", "PGRST204", "PGRST205"]);

function compareLeads(a: Lead, b: Lead, sort: Sort): number {
  const dir = sort.dir === "asc" ? 1 : -1;
  switch (sort.key) {
    case "name":
      return dir * a.name.localeCompare(b.name, "es", { sensitivity: "base" });
    case "status":
      return dir * (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) || b.created_at.localeCompare(a.created_at);
    case "estimated_value": {
      // Leads without a value always go last.
      if (a.estimated_value === null || b.estimated_value === null) return a.estimated_value === null ? (b.estimated_value === null ? 0 : 1) : -1;
      return dir * (a.estimated_value - b.estimated_value);
    }
    case "next_follow_up_at": {
      if (!a.next_follow_up_at || !b.next_follow_up_at) return !a.next_follow_up_at ? (!b.next_follow_up_at ? 0 : 1) : -1;
      return dir * a.next_follow_up_at.localeCompare(b.next_follow_up_at);
    }
    default:
      return dir * a.created_at.localeCompare(b.created_at);
  }
}

function csvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  // Neutralize spreadsheet formulas in user-submitted text.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export default function LeadsClient() {
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<LoadError | null>(null);
  const [live, setLive] = useState(false);
  const [toast, setToast] = useState("");
  const [view, setView] = useState<View>("open");
  const [owner, setOwner] = useState<Owner>("all");
  const [sort, setSort] = useState<Sort>({ key: "created_at", dir: "desc" });
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const lastFocused = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const db = getSupabaseClient();
      const profile = await getCurrentProfile();
      const org = profile.organizationId;
      setViewer({ id: profile.id, name: profile.name, isAdmin: profile.role === "admin", organizationId: org });

      const [{ data: rows, error: leadsError }, { data: memberRows, error: membersError }] = await Promise.all([
        db.from("cbdevs_inquiries").select(LEAD_COLUMNS).eq("organization_id", org).order("created_at", { ascending: false }).limit(MAX_LEADS),
        db.from("organization_members").select("user_id,role").eq("organization_id", org).eq("status", "active").in("role", ["owner", "admin", "manager", "member"]),
      ]);
      if (leadsError) {
        if (SETUP_CODES.has(String(leadsError.code))) {
          setError({ kind: "setup", message: "La base de datos todavía no tiene la actualización de leads. Los mensajes del sitio web se siguen guardando y aparecerán aquí cuando se aplique." });
          setLeads([]);
          return;
        }
        throw leadsError;
      }
      setLeads(((rows || []) as Record<string, unknown>[]).map((r) => normalizeLead(r)));

      if (membersError) {
        setMembers([{ id: profile.id, name: profile.name, email: profile.email }]);
      } else {
        const ids: string[] = ((memberRows || []) as { user_id: string }[]).map((m) => m.user_id);
        type ProfileRow = { id: string; display_name: string | null; email: string | null };
        const { data: profileRows } = ids.length
          ? await db.from("profiles").select("id,display_name,email").in("id", ids)
          : { data: [] };
        const byId = new Map(((profileRows || []) as ProfileRow[]).map((p) => [p.id, p] as const));
        setMembers(ids.map((id): TeamMember => {
          const p = byId.get(id);
          return { id, name: p?.display_name || p?.email || "Miembro del equipo", email: p?.email || "" };
        }).sort((a: TeamMember, b: TeamMember) => a.name.localeCompare(b.name, "es")));
      }

      const deepLink = new URLSearchParams(window.location.search).get("lead");
      if (deepLink) setSelectedId(deepLink);
    } catch (e) {
      const message = e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "";
      setError({ kind: "other", message: message || "No se pudieron cargar los leads." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Keep relative times and overdue flags fresh.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  // Live updates: new leads appear without reloading. RLS still applies to the stream.
  useEffect(() => {
    if (!viewer || error?.kind === "setup") return;
    const db = getSupabaseClient();
    const channel = db
      .channel(`leads:${viewer.organizationId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cbdevs_inquiries", filter: `organization_id=eq.${viewer.organizationId}` },
        (payload: ChangePayload) => {
          if (payload.eventType === "DELETE") {
            const id = (payload.old as { id?: string }).id;
            if (id) setLeads((current) => current.filter((l) => l.id !== id));
            return;
          }
          const row = normalizeLead(payload.new as Record<string, unknown>);
          setLeads((current) => {
            const exists = current.some((l) => l.id === row.id);
            if (!exists && payload.eventType === "INSERT") {
              setToast(`Nuevo lead: ${row.name}${row.company ? ` (${row.company})` : ""}`);
              return [row, ...current];
            }
            return exists ? current.map((l) => (l.id === row.id ? row : l)) : current;
          });
        },
      )
      .subscribe((status: string) => setLive(status === "SUBSCRIBED"));
    return () => {
      void db.removeChannel(channel);
    };
  }, [viewer, error?.kind]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 6000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const closeDetail = useCallback(() => {
    setSelectedId(null);
    // Return focus to the row that opened the panel.
    window.setTimeout(() => lastFocused.current?.focus(), 0);
  }, []);

  // Escape closes the detail panel; the page behind it does not scroll while open.
  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { closeDetail(); return; }
      if (e.key !== "Tab" || !dialogRef.current) return;
      // Keep keyboard focus inside the open panel.
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const inside = dialogRef.current.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === first || !inside)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !inside)) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedId, closeDetail]);

  function openLead(id: string, origin: HTMLElement | null) {
    lastFocused.current = origin;
    setSelectedId(id);
  }

  const counts = useMemo(() => {
    const map = new Map<LeadStatus, number>();
    for (const l of leads) map.set(l.status, (map.get(l.status) || 0) + 1);
    return map;
  }, [leads]);

  const pipelineValue = useMemo(() => {
    const totals = new Map<string, number>();
    for (const l of leads) {
      if (!OPEN_STATUSES.includes(l.status) || l.estimated_value === null) continue;
      totals.set(l.currency, (totals.get(l.currency) || 0) + l.estimated_value);
    }
    return [...totals.entries()];
  }, [leads]);

  const overdueCount = useMemo(() => leads.filter((l) => isOverdue(l, now)).length, [leads, now]);
  const memberName = useCallback((id: string | null) => (id ? members.find((m) => m.id === id)?.name || "Equipo" : ""), [members]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads
      .filter((l) => {
        if (view === "open" && !OPEN_STATUSES.includes(l.status)) return false;
        if (view !== "open" && view !== "all" && l.status !== view) return false;
        if (owner === "mine" && l.assigned_to !== viewer?.id) return false;
        if (owner === "unassigned" && l.assigned_to) return false;
        if (owner !== "all" && owner !== "mine" && owner !== "unassigned" && l.assigned_to !== owner) return false;
        if (q && ![l.name, l.email, l.company || "", l.phone || "", l.message].some((v) => v.toLowerCase().includes(q))) return false;
        return true;
      })
      .sort((a, b) => compareLeads(a, b, sort));
  }, [leads, view, owner, query, sort, viewer]);

  const selected = leads.find((l) => l.id === selectedId) || null;

  function toggleSort(key: SortKey) {
    setSort((current) =>
      current.key === key ? { key, dir: current.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "name" || key === "status" || key === "next_follow_up_at" ? "asc" : "desc" },
    );
  }

  function exportCsv() {
    const header = ["Recibido", "Nombre", "Empresa", "Email", "Teléfono", "Servicio", "Presupuesto", "Estado", "Responsable", "Próximo seguimiento", "Último contacto", "Valor estimado", "Moneda", "Mensaje"];
    const rows = filtered.map((l) => [
      formatDateTime(l.created_at), l.name, l.company, l.email, l.phone, l.service_interest,
      l.budget_range ? BUDGET_LABELS[l.budget_range] || l.budget_range : "", statusMeta(l.status).label, memberName(l.assigned_to),
      l.next_follow_up_at ? formatDateTime(l.next_follow_up_at) : "", l.last_contacted_at ? formatDateTime(l.last_contacted_at) : "",
      l.estimated_value, l.currency, l.message,
    ]);
    const csv = "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `leads-cbdevs-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function updateLead(updated: Lead) {
    setLeads((current) => current.map((l) => (l.id === updated.id ? updated : l)));
  }

  function removeLead(id: string) {
    setLeads((current) => current.filter((l) => l.id !== id));
    closeDetail();
    setToast("Lead eliminado.");
  }

  const SortHeader = ({ label, sortKey, className = "" }: { label: string; sortKey: SortKey; className?: string }) => {
    const active = sort.key === sortKey;
    const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
    return (
      <th scope="col" className={`p-3 font-medium ${className}`} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
        <button type="button" onClick={() => toggleSort(sortKey)} className={`inline-flex items-center gap-1 uppercase tracking-wider hover:text-white ${active ? "text-cb-amber" : ""}`}>
          {label} <Icon size={12} aria-hidden="true" />
        </button>
      </th>
    );
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mono-label">SALES / LEADS</div>
          <h1 className="mt-1 text-3xl font-bold">Leads</h1>
          <p className="mt-1 text-sm text-cb-muted">Solicitudes del sitio web: revisa, contacta y da seguimiento hasta cerrar la venta.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className={`inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider ${live ? "text-emerald-300" : "text-slate-500"}`}>
            <span className={`h-2 w-2 rounded-full ${live ? "bg-emerald-400" : "bg-slate-600"}`} aria-hidden="true" />
            {live ? "En vivo" : "Sin tiempo real"}
          </span>
          <button type="button" className="btn-ghost" onClick={exportCsv} disabled={!filtered.length}>
            <Download size={16} /> Exportar CSV
          </button>
          <button type="button" className="btn-ghost" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Actualizar
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${error.kind === "setup" ? "border-cb-amber/30 bg-cb-amber/10 text-cb-amber" : "border-red-500/20 bg-red-500/10 text-red-300"}`}>
          <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error.message}
        </div>
      )}

      {/* Pipeline summary */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Nuevos sin contactar" value={counts.get("new") || 0} tone="text-cb-amber" onClick={() => { setView("new"); setOwner("all"); }} />
        <SummaryCard label="En seguimiento" value={(counts.get("contacted") || 0) + (counts.get("qualified") || 0) + (counts.get("proposal") || 0)} tone="text-cb-teal" onClick={() => setView("open")} />
        <SummaryCard label="Seguimientos vencidos" value={overdueCount} tone={overdueCount ? "text-red-300" : "text-slate-300"} onClick={() => { setView("open"); setSort({ key: "next_follow_up_at", dir: "asc" }); }} />
        <div className="panel p-4">
          <div className="text-xs text-slate-400">Valor en pipeline</div>
          <div className="mt-2 text-xl font-bold">{pipelineValue.length ? pipelineValue.map(([c, v]) => money(v, c as Lead["currency"])).join(" · ") : "—"}</div>
          <div className="mt-1 text-xs text-slate-500">Ganados: {counts.get("won") || 0}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="panel flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
        <label className="flex flex-1 items-center gap-2 rounded-xl border border-cb-line bg-cb-bg px-3 py-2 text-sm focus-within:border-cb-amber">
          <Search size={16} className="text-slate-500" aria-hidden="true" />
          <span className="sr-only">Buscar</span>
          <input className="w-full bg-transparent outline-none placeholder:text-slate-600" placeholder="Buscar por nombre, email, teléfono, empresa o mensaje"
            value={query} onChange={(e) => setQuery(e.target.value)} />
          {query && <button type="button" onClick={() => setQuery("")} aria-label="Limpiar búsqueda"><X size={14} /></button>}
        </label>
        <div className="grid grid-cols-2 gap-2 lg:flex">
          <select className="input lg:w-48" value={view} onChange={(e) => setView(e.target.value as View)} aria-label="Estado">
            <option value="open">Abiertos ({OPEN_STATUSES.reduce((s, st) => s + (counts.get(st) || 0), 0)})</option>
            <option value="all">Todos ({leads.length})</option>
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label} ({counts.get(s.value) || 0})</option>)}
          </select>
          <select className="input lg:w-48" value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Responsable">
            <option value="all">Todo el equipo</option>
            <option value="mine">Asignados a mí</option>
            <option value="unassigned">Sin asignar</option>
            {members.filter((m) => m.id !== viewer?.id).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="panel overflow-hidden">
        <div className="scrollbar overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <caption className="sr-only">Leads del sitio web. Selecciona un nombre para ver el detalle y contactar.</caption>
            <thead className="bg-cb-panel2 text-[11px] text-slate-500">
              <tr>
                <SortHeader label="Lead" sortKey="name" className="sticky left-0 z-10 bg-cb-panel2" />
                <th scope="col" className="p-3 font-medium uppercase tracking-wider">Contacto</th>
                <th scope="col" className="p-3 font-medium uppercase tracking-wider">Servicio</th>
                <th scope="col" className="p-3 font-medium uppercase tracking-wider">Presupuesto</th>
                <SortHeader label="Estado" sortKey="status" />
                <th scope="col" className="p-3 font-medium uppercase tracking-wider">Responsable</th>
                <SortHeader label="Seguimiento" sortKey="next_follow_up_at" />
                <SortHeader label="Valor" sortKey="estimated_value" className="text-right" />
                <SortHeader label="Recibido" sortKey="created_at" />
              </tr>
            </thead>
            <tbody>
              {loading && !leads.length ? (
                [0, 1, 2, 3, 4].map((i) => (
                  <tr key={i} className="border-t border-cb-line" aria-hidden="true">
                    <td colSpan={9} className="p-3"><div className="h-9 animate-pulse rounded-lg bg-cb-panel2/50" /></td>
                  </tr>
                ))
              ) : !filtered.length ? (
                <tr>
                  <td colSpan={9} className="p-10 text-center">
                    <Inbox className="mx-auto text-slate-600" />
                    <p className="mt-2 text-sm text-slate-400">
                      {leads.length ? "Ningún lead coincide con los filtros." : error ? "No hay leads para mostrar." : "Aún no hay leads. Las solicitudes del sitio web aparecerán aquí en tiempo real."}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((l) => {
                  const meta = statusMeta(l.status);
                  const overdue = isOverdue(l, now);
                  const wa = whatsappNumber(l.phone, COUNTRY_CODE);
                  const active = l.id === selectedId;
                  return (
                    <tr key={l.id} onClick={(e) => openLead(l.id, (e.currentTarget.querySelector("button[data-open]") as HTMLElement) || null)}
                      className={`cursor-pointer border-t border-cb-line align-top transition ${active ? "bg-cb-amber/5" : "hover:bg-cb-panel2/60"}`}>
                      <td className={`sticky left-0 z-[1] max-w-[240px] p-3 ${active ? "bg-[#14201f]" : "bg-cb-panel"}`}>
                        <button type="button" data-open onClick={(e) => { e.stopPropagation(); openLead(l.id, e.currentTarget); }}
                          className="flex items-start gap-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cb-amber">
                          {l.status === "new" && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-cb-amber" aria-label="Sin contactar" />}
                          <span className="min-w-0">
                            <span className="block truncate font-semibold text-white hover:underline">{l.name}</span>
                            {l.company && <span className="block truncate text-xs text-cb-muted">{l.company}</span>}
                          </span>
                        </button>
                      </td>
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex max-w-[230px] flex-col gap-1 text-xs">
                          <a href={`mailto:${l.email}`} className="inline-flex items-center gap-1.5 truncate text-slate-300 hover:text-cb-amber">
                            <Mail size={12} className="shrink-0" aria-hidden="true" /><span className="truncate">{l.email}</span>
                          </a>
                          {l.phone && (
                            <span className="inline-flex items-center gap-2 text-slate-400">
                              <a href={`tel:${l.phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1.5 hover:text-cb-amber">
                                <Phone size={12} aria-hidden="true" />{l.phone}
                              </a>
                              {wa && (
                                <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300" aria-label={`WhatsApp a ${l.name}`}>
                                  <MessageCircle size={13} />
                                </a>
                              )}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-xs text-slate-300">{l.service_interest || <span className="text-slate-600">—</span>}</td>
                      <td className="p-3 text-xs text-slate-300">{l.budget_range ? BUDGET_LABELS[l.budget_range] || l.budget_range : <span className="text-slate-600">—</span>}</td>
                      <td className="p-3"><span className={`whitespace-nowrap rounded-full px-2.5 py-1 font-mono text-[10px] uppercase ${meta.badge}`}>{meta.label}</span></td>
                      <td className="p-3 text-xs">{l.assigned_to ? <span className="text-slate-300">{memberName(l.assigned_to)}</span> : <span className="text-slate-600">Sin asignar</span>}</td>
                      <td className="whitespace-nowrap p-3 text-xs">
                        {l.next_follow_up_at && OPEN_STATUSES.includes(l.status) ? (
                          <span className={`inline-flex items-center gap-1 ${overdue ? "text-red-300" : "text-slate-300"}`} title={formatDateTime(l.next_follow_up_at)}>
                            <CalendarClock size={12} aria-hidden="true" />{overdue ? "Vencido · " : ""}{timeAgo(l.next_follow_up_at, now)}
                          </span>
                        ) : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="whitespace-nowrap p-3 text-right text-xs text-slate-300">{l.estimated_value !== null ? money(l.estimated_value, l.currency) : <span className="text-slate-600">—</span>}</td>
                      <td className="whitespace-nowrap p-3 text-xs text-slate-400" title={formatDateTime(l.created_at)}>{timeAgo(l.created_at, now)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap justify-between gap-2 border-t border-cb-line px-4 py-2.5 text-xs text-slate-500">
          <span>{filtered.length} de {leads.length} leads</span>
          {leads.length >= MAX_LEADS && <span>Mostrando los {MAX_LEADS} más recientes.</span>}
        </div>
      </div>

      {/* Detail drawer */}
      {selectedId && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button type="button" className="absolute inset-0 bg-black/60" aria-label="Cerrar detalle" tabIndex={-1} onClick={closeDetail} />
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={selected ? `Lead de ${selected.name}` : "Lead"}
            className="scrollbar relative h-full w-full max-w-2xl overflow-y-auto border-l border-cb-line bg-cb-bg p-4 shadow-2xl sm:p-6">
            {selected && viewer ? (
              <LeadDetail lead={selected} members={members} viewer={viewer} onChange={updateLead} onDeleted={removeLead} onClose={closeDetail} />
            ) : (
              <div className="space-y-4">
                <button type="button" className="btn-ghost" onClick={closeDetail}><X size={16} /> Cerrar</button>
                <p className="text-sm text-slate-400">{loading ? "Cargando…" : "Ese lead ya no existe o no tienes acceso."}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[60]">
        {toast && <div className="pointer-events-auto rounded-xl border border-cb-amber/30 bg-cb-panel px-4 py-3 text-sm shadow-glow">{toast}</div>}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, tone, onClick }: { label: string; value: number; tone: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="panel p-4 text-left transition hover:border-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cb-amber">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`mt-2 text-2xl font-bold ${tone}`}>{value}</div>
    </button>
  );
}
