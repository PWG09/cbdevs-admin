"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, Inbox, RefreshCw, Search, X } from "lucide-react";
import { getCurrentProfile, getSupabaseClient } from "@/lib/supabase/client";
import LeadDetail from "@/components/LeadDetail";
import {
  LEAD_COLUMNS, OPEN_STATUSES, STATUSES, isOverdue, money, normalizeLead, statusMeta, timeAgo,
  type Lead, type LeadStatus, type TeamMember,
} from "@/lib/leads";

type View = "open" | "all" | LeadStatus;
type Owner = "all" | "mine" | "unassigned" | string;
type Sort = "recent" | "followup";
type Viewer = { id: string; name: string; isAdmin: boolean; organizationId: string };
type ChangePayload = { eventType: string; new: unknown; old: unknown };

const MAX_LEADS = 500;

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?";
}

export default function LeadsClient() {
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [live, setLive] = useState(false);
  const [toast, setToast] = useState("");
  const [view, setView] = useState<View>("open");
  const [owner, setOwner] = useState<Owner>("all");
  const [sort, setSort] = useState<Sort>("recent");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const db = getSupabaseClient();
      const profile = await getCurrentProfile();
      const org = profile.organizationId;
      setViewer({ id: profile.id, name: profile.name, isAdmin: profile.role === "admin", organizationId: org });

      const [{ data: rows, error: leadsError }, { data: memberRows, error: membersError }] = await Promise.all([
        db.from("cbdevs_inquiries").select(LEAD_COLUMNS).eq("organization_id", org).order("created_at", { ascending: false }).limit(MAX_LEADS),
        db.from("organization_members").select("user_id,role").eq("organization_id", org).eq("status", "active").in("role", ["owner", "admin", "manager", "member"]),
      ]);
      if (leadsError) throw leadsError;
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
      setError(e instanceof Error ? e.message : "No se pudieron cargar los leads.");
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
    if (!viewer) return;
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
  }, [viewer]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 6000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // Escape closes the detail sheet on small screens.
  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSelectedId(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = leads.filter((l) => {
      if (view === "open" && !OPEN_STATUSES.includes(l.status)) return false;
      if (view !== "open" && view !== "all" && l.status !== view) return false;
      if (owner === "mine" && l.assigned_to !== viewer?.id) return false;
      if (owner === "unassigned" && l.assigned_to) return false;
      if (owner !== "all" && owner !== "mine" && owner !== "unassigned" && l.assigned_to !== owner) return false;
      if (q && ![l.name, l.email, l.company || "", l.phone || "", l.message].some((v) => v.toLowerCase().includes(q))) return false;
      return true;
    });
    if (sort === "followup") {
      return [...list].sort((a, b) => {
        const fa = a.next_follow_up_at ? new Date(a.next_follow_up_at).getTime() : Infinity;
        const fb = b.next_follow_up_at ? new Date(b.next_follow_up_at).getTime() : Infinity;
        return fa - fb || b.created_at.localeCompare(a.created_at);
      });
    }
    return list;
  }, [leads, view, owner, query, sort, viewer]);

  const selected = leads.find((l) => l.id === selectedId) || null;
  const memberName = (id: string | null) => (id ? members.find((m) => m.id === id)?.name || "Equipo" : "");

  function updateLead(updated: Lead) {
    setLeads((current) => current.map((l) => (l.id === updated.id ? updated : l)));
  }

  function removeLead(id: string) {
    setLeads((current) => current.filter((l) => l.id !== id));
    setSelectedId(null);
    setToast("Lead eliminado.");
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mono-label">SALES / LEADS</div>
          <h1 className="mt-1 text-3xl font-bold">Leads</h1>
          <p className="mt-1 text-sm text-cb-muted">Solicitudes del sitio web: revisa, contacta y da seguimiento hasta cerrar la venta.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider ${live ? "text-emerald-300" : "text-slate-500"}`}>
            <span className={`h-2 w-2 rounded-full ${live ? "bg-emerald-400" : "bg-slate-600"}`} aria-hidden="true" />
            {live ? "En vivo" : "Sin tiempo real"}
          </span>
          <button type="button" className="btn-ghost" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Actualizar
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {/* Pipeline summary */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Nuevos sin contactar" value={counts.get("new") || 0} tone="text-cb-amber" onClick={() => { setView("new"); setOwner("all"); }} />
        <SummaryCard label="En seguimiento" value={(counts.get("contacted") || 0) + (counts.get("qualified") || 0) + (counts.get("proposal") || 0)} tone="text-cb-teal" onClick={() => setView("open")} />
        <SummaryCard label="Seguimientos vencidos" value={overdueCount} tone={overdueCount ? "text-red-300" : "text-slate-300"} onClick={() => { setView("open"); setSort("followup"); }} />
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
          <input className="w-full bg-transparent outline-none placeholder:text-slate-600" placeholder="Buscar por nombre, email, empresa o mensaje"
            value={query} onChange={(e) => setQuery(e.target.value)} />
          {query && <button type="button" onClick={() => setQuery("")} aria-label="Limpiar búsqueda"><X size={14} /></button>}
        </label>
        <div className="grid grid-cols-3 gap-2 lg:flex">
          <select className="input lg:w-44" value={view} onChange={(e) => setView(e.target.value as View)} aria-label="Estado">
            <option value="open">Abiertos ({OPEN_STATUSES.reduce((s, st) => s + (counts.get(st) || 0), 0)})</option>
            <option value="all">Todos ({leads.length})</option>
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label} ({counts.get(s.value) || 0})</option>)}
          </select>
          <select className="input lg:w-44" value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Responsable">
            <option value="all">Todo el equipo</option>
            <option value="mine">Asignados a mí</option>
            <option value="unassigned">Sin asignar</option>
            {members.filter((m) => m.id !== viewer?.id).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <select className="input lg:w-48" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Ordenar">
            <option value="recent">Más recientes</option>
            <option value="followup">Próximo seguimiento</option>
          </select>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(320px,420px)_1fr]">
        {/* List */}
        <div className={`${selected ? "hidden lg:block" : ""}`}>
          <div className="panel overflow-hidden">
            {loading && !leads.length ? (
              <ul aria-busy="true" className="divide-y divide-cb-line">
                {[0, 1, 2, 3].map((i) => <li key={i} className="h-[84px] animate-pulse bg-cb-panel2/40" />)}
              </ul>
            ) : !filtered.length ? (
              <div className="grid place-items-center gap-2 p-10 text-center">
                <Inbox className="text-slate-600" />
                <p className="text-sm text-slate-400">{leads.length ? "Ningún lead coincide con los filtros." : "Aún no hay leads. Las solicitudes del sitio web aparecerán aquí en tiempo real."}</p>
              </div>
            ) : (
              <ul className="scrollbar max-h-[calc(100vh-330px)] min-h-[200px] divide-y divide-cb-line overflow-y-auto">
                {filtered.map((l) => {
                  const meta = statusMeta(l.status);
                  const overdue = isOverdue(l, now);
                  const active = l.id === selectedId;
                  return (
                    <li key={l.id}>
                      <button type="button" onClick={() => setSelectedId(l.id)} aria-current={active ? "true" : undefined}
                        className={`flex w-full gap-3 p-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-cb-amber ${active ? "bg-cb-amber/5" : "hover:bg-cb-panel2"}`}>
                        <span className="relative mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-cb-panel2 font-mono text-xs text-slate-300">
                          {initials(l.name)}
                          {l.status === "new" && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-cb-amber ring-2 ring-cb-panel" aria-label="Sin contactar" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="truncate font-semibold">{l.name}</span>
                            <span className="shrink-0 text-[11px] text-slate-500">{timeAgo(l.created_at, now)}</span>
                          </span>
                          <span className="block truncate text-xs text-cb-muted">{l.company || l.email}</span>
                          <span className="mt-2 flex flex-wrap items-center gap-1.5">
                            <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase ${meta.badge}`}>{meta.label}</span>
                            {l.service_interest && <span className="rounded-md bg-cb-bg px-2 py-0.5 text-[10px] text-slate-400">{l.service_interest}</span>}
                            {overdue && <span className="inline-flex items-center gap-1 rounded-md bg-red-500/10 px-2 py-0.5 text-[10px] text-red-300"><CalendarClock size={11} /> Vencido</span>}
                            {l.assigned_to && <span className="ml-auto text-[10px] text-slate-500">{memberName(l.assigned_to)}</span>}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {leads.length >= MAX_LEADS && <p className="mt-2 text-xs text-slate-500">Mostrando los {MAX_LEADS} leads más recientes.</p>}
        </div>

        {/* Detail: side panel on desktop, full-screen sheet on mobile */}
        {selected && viewer ? (
          <div role="region" aria-label={`Lead de ${selected.name}`}
            className="fixed inset-0 z-40 overflow-y-auto bg-cb-bg p-4 lg:static lg:z-auto lg:overflow-visible lg:bg-transparent lg:p-0">
            <LeadDetail lead={selected} members={members} viewer={viewer}
              onChange={updateLead} onDeleted={removeLead} onClose={() => setSelectedId(null)} />
          </div>
        ) : (
          <div className="panel hidden place-items-center p-10 text-center text-sm text-slate-500 lg:grid">
            {selectedId && !loading ? "Ese lead ya no existe o no tienes acceso." : "Selecciona un lead para ver sus datos y contactarlo."}
          </div>
        )}
      </div>

      <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-50">
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
