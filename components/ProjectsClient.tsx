"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ExternalLink, FolderKanban, GripVertical, LayoutGrid, List, Plus, Search } from "lucide-react";
import ProjectForm from "@/components/ProjectForm";
import { EmptyState, ErrorBanner, PageHeader, Skeleton, StatusBadge } from "@/components/ui";
import { listClients, type Client } from "@/lib/data/clients";
import { listProjects, setDeliveryStatus, type AdminProject } from "@/lib/data/projects";
import { messageOf } from "@/lib/errors";
import { formatDate, formatMoney } from "@/lib/format";
import { safeExternalUrl } from "@/lib/safe-url";
import { DELIVERY_STATUSES, SERVICES } from "@/lib/validation";

export default function ProjectsClient() {
  const router = useRouter();
  const [rows, setRows] = useState<AdminProject[] | null>(null);
  const [clients, setClients] = useState<Map<string, Client>>(new Map());
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [service, setService] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([listProjects(), listClients()]).then(([p, c]) => {
      if (!active) return;
      setRows(p);
      setClients(new Map(c.map((x) => [x.id, x])));
    }).catch((cause) => { if (active) { setError(messageOf(cause, "No se pudieron cargar los proyectos.")); setRows([]); } });
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => (rows ?? []).filter((p) => {
    if (status && p.deliveryStatus !== status) return false;
    if (service && p.serviceType !== service) return false;
    if (clientFilter === "__none" && p.clientId) return false;
    if (clientFilter && clientFilter !== "__none" && p.clientId !== clientFilter) return false;
    const q = query.trim().toLowerCase();
    return !q || p.name.toLowerCase().includes(q) || p.clientName.toLowerCase().includes(q);
  }), [rows, status, service, clientFilter, query]);

  const withoutClient = (rows ?? []).filter((p) => !p.clientId).length;

  async function move(id: string, next: string) {
    const previous = rows;
    setRows((list) => list?.map((p) => (p.id === id ? { ...p, deliveryStatus: next } : p)) ?? null);
    try { await setDeliveryStatus(id, next); } catch (cause) { setRows(previous); setError(messageOf(cause, "No se pudo actualizar el estado.")); }
  }

  function portalHint(p: AdminProject) {
    if (!p.clientId) return <span className="text-[10px] text-red-300">Sin cliente</span>;
    const c = clients.get(p.clientId);
    if (c && !c.linkedUserId) return <span className="text-[10px] text-cb-amber">Cliente sin portal</span>;
    return null;
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <PageHeader eyebrow={`Proyectos · ${rows?.length ?? 0}`} title="Proyectos" description="Tablero de entregas. Abre un proyecto para editarlo, cargar hitos, documentos, pagos y conversar con el cliente."
        actions={<button className="btn-primary" onClick={() => setCreating(true)}><Plus size={17} aria-hidden />Nuevo proyecto</button>} />
      <ErrorBanner>{error || null}</ErrorBanner>
      {withoutClient > 0 && (
        <button type="button" onClick={() => setClientFilter("__none")} className="flex w-full items-center gap-2 rounded-xl border border-cb-amber/20 bg-cb-amber/5 p-3 text-left text-sm text-cb-amber hover:bg-cb-amber/10">
          <AlertTriangle size={16} aria-hidden />{withoutClient === 1 ? "1 proyecto no tiene cliente asignado" : `${withoutClient} proyectos no tienen cliente asignado`}; no aparecen en ningún portal. Ver cuáles →
        </button>
      )}

      <div className="panel flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
        <label className="relative min-w-0 flex-1"><span className="sr-only">Buscar</span><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cb-muted" aria-hidden /><input className="input pl-9" placeholder="Buscar proyecto o cliente…" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
        <select className="input lg:max-w-[220px]" value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} aria-label="Filtrar por cliente">
          <option value="">Todos los clientes</option><option value="__none">— Sin cliente —</option>
          {[...clients.values()].map((c) => <option key={c.id} value={c.id}>{c.company || c.name}</option>)}
        </select>
        <select className="input lg:max-w-[200px]" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filtrar por estado"><option value="">Todos los estados</option>{DELIVERY_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
        <select className="input lg:max-w-[230px]" value={service} onChange={(e) => setService(e.target.value)} aria-label="Filtrar por servicio"><option value="">Todos los servicios</option>{SERVICES.map((s) => <option key={s}>{s}</option>)}</select>
        <div className="flex shrink-0 rounded-xl border border-cb-line p-1" role="group" aria-label="Vista">
          <button type="button" aria-pressed={view === "kanban"} aria-label="Tablero" className={`rounded-lg p-2 ${view === "kanban" ? "bg-cb-panel2 text-cb-amber" : "text-slate-500"}`} onClick={() => setView("kanban")}><LayoutGrid size={17} /></button>
          <button type="button" aria-pressed={view === "table"} aria-label="Tabla" className={`rounded-lg p-2 ${view === "table" ? "bg-cb-panel2 text-cb-amber" : "text-slate-500"}`} onClick={() => setView("table")}><List size={17} /></button>
        </div>
      </div>

      {rows === null ? <Skeleton className="h-96" /> : rows.length === 0 ? (
        <EmptyState icon={FolderKanban} title="Aún no hay proyectos" description="Crea el primer proyecto y asígnalo a un cliente para que lo vea en su portal." action={<button className="btn-primary" onClick={() => setCreating(true)}><Plus size={16} aria-hidden />Crear proyecto</button>} />
      ) : view === "kanban" ? (
        <div className="scrollbar flex gap-4 overflow-x-auto pb-4">
          {DELIVERY_STATUSES.map((s) => {
            const items = filtered.filter((p) => p.deliveryStatus === s);
            return (
              <div key={s} className="min-w-[290px] flex-1 rounded-2xl border border-cb-line bg-cb-panel/60 p-3" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { const id = e.dataTransfer.getData("projectId"); if (id) void move(id, s); }}>
                <div className="mb-3 flex items-center justify-between"><StatusBadge status={s} /><span className="text-xs text-slate-500">{items.length}</span></div>
                <div className="space-y-3">
                  {items.map((p) => (
                    <article key={p.id} draggable onDragStart={(e) => e.dataTransfer.setData("projectId", p.id)} className="group rounded-xl border border-cb-line bg-cb-panel transition hover:border-cb-amber/50">
                      <Link href={`/projects/${p.id}`} className="block p-4">
                        <div className="flex gap-2"><GripVertical size={16} className="mt-0.5 shrink-0 text-slate-600" aria-hidden /><div className="min-w-0"><h3 className="font-semibold group-hover:text-cb-amber">{p.name}</h3><p className="truncate text-xs text-cb-muted">{p.clientName}</p></div></div>
                        <div className="mt-3 flex flex-wrap gap-1"><span className="rounded-md bg-cb-bg px-2 py-1 text-[10px] text-slate-400">{p.serviceType}</span><StatusBadge status={p.paymentStatus} className="!py-0.5 !text-[10px]" /></div>
                        <div className="mt-3 flex items-center justify-between text-xs text-slate-500"><span>Entrega: {formatDate(p.estimatedDelivery, "Sin fecha")}</span>{portalHint(p)}</div>
                      </Link>
                      {safeExternalUrl(p.productionUrl) && <a href={safeExternalUrl(p.productionUrl)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 border-t border-cb-line px-4 py-2 text-xs text-cb-amber">Sitio en línea <ExternalLink size={12} aria-hidden /></a>}
                    </article>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <div className="scrollbar overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-cb-panel2 text-xs uppercase text-slate-500"><tr><th className="p-4">Proyecto</th><th className="p-4">Servicio</th><th className="p-4">Entrega</th><th className="p-4">Pago</th><th className="p-4 text-right">Monto</th></tr></thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="cursor-pointer border-t border-cb-line hover:bg-cb-panel2/50" onClick={() => router.push(`/projects/${p.id}`)}>
                    <td className="p-4"><Link href={`/projects/${p.id}`} className="font-semibold hover:text-cb-amber">{p.name}</Link><div className="text-xs text-slate-500">{p.clientName} {portalHint(p)}</div></td>
                    <td className="p-4">{p.serviceType}</td>
                    <td className="p-4"><StatusBadge status={p.deliveryStatus} /><div className="mt-1 text-xs text-slate-500">{formatDate(p.estimatedDelivery, "Sin fecha")}</div></td>
                    <td className="p-4"><StatusBadge status={p.paymentStatus} /></td>
                    <td className="p-4 text-right tabular-nums">{formatMoney(p.amount, p.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {creating && <ProjectForm onClose={() => setCreating(false)} onSaved={(p) => router.push(`/projects/${p.id}`)} />}
    </div>
  );
}
