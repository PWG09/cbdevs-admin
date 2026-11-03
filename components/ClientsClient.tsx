"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, ChevronRight, KeyRound, Plus, Search, Users } from "lucide-react";
import ClientForm from "@/components/ClientForm";
import { EmptyState, ErrorBanner, PageHeader, Skeleton } from "@/components/ui";
import { listClients, type Client } from "@/lib/data/clients";
import { messageOf } from "@/lib/errors";
import { initialsFrom } from "@/lib/format";

type Filter = "all" | "active" | "portal" | "no-portal" | "inactive";

export default function ClientsClient() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("active");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let active = true;
    listClients().then((list) => { if (active) setClients(list); }).catch((cause) => { if (active) { setError(messageOf(cause, "No se pudieron cargar los clientes.")); setClients([]); } });
    return () => { active = false; };
  }, []);

  const visible = useMemo(() => (clients ?? []).filter((c) => {
    if (filter === "active" && !c.active) return false;
    if (filter === "inactive" && c.active) return false;
    if (filter === "portal" && (!c.linkedUserId || !c.active)) return false;
    if (filter === "no-portal" && (c.linkedUserId || !c.active)) return false;
    const q = query.trim().toLowerCase();
    return !q || [c.name, c.email, c.company].some((v) => v.toLowerCase().includes(q));
  }), [clients, query, filter]);

  const stats = {
    total: clients?.filter((c) => c.active).length ?? 0,
    portal: clients?.filter((c) => c.active && c.linkedUserId).length ?? 0,
    pending: clients?.filter((c) => c.active && !c.linkedUserId).length ?? 0,
  };

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <PageHeader eyebrow="Clientes" title="Clientes" description="Contactos de tus clientes, su acceso al portal y sus proyectos." actions={<button className="btn-primary" onClick={() => setCreating(true)}><Plus size={16} aria-hidden />Nuevo cliente</button>} />

      {clients && clients.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          {[{ icon: Users, label: "Clientes activos", value: stats.total }, { icon: KeyRound, label: "Con acceso al portal", value: stats.portal }, { icon: Building2, label: "Sin acceso al portal", value: stats.pending }].map(({ icon: Icon, label, value }) => (
            <div key={label} className="panel flex items-center gap-4 p-5">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-cb-panel2 text-cb-amber"><Icon size={19} aria-hidden /></div>
              <div><div className="text-2xl font-bold">{value}</div><div className="text-sm text-cb-muted">{label}</div></div>
            </div>
          ))}
        </div>
      )}

      <ErrorBanner>{error || null}</ErrorBanner>

      {clients === null ? <Skeleton className="h-80" /> : clients.length === 0 && !error ? (
        <EmptyState icon={Users} title="Aún no hay clientes" description="Crea un cliente para asignarle proyectos y darle acceso al portal. También puedes convertir un lead en cliente desde Leads." action={<button className="btn-primary" onClick={() => setCreating(true)}><Plus size={16} aria-hidden />Crear cliente</button>} />
      ) : (
        <section className="panel overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-cb-line p-4 md:flex-row md:items-center">
            <label className="relative flex-1">
              <span className="sr-only">Buscar cliente</span>
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cb-muted" aria-hidden />
              <input className="input pl-9" placeholder="Buscar por nombre, empresa o correo…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <div className="flex flex-wrap gap-1 rounded-xl border border-cb-line bg-cb-bg p-1" role="group" aria-label="Filtrar clientes">
              {([["active", "Activos"], ["portal", "Con portal"], ["no-portal", "Sin portal"], ["inactive", "Inactivos"], ["all", "Todos"]] as const).map(([value, label]) => (
                <button key={value} type="button" onClick={() => setFilter(value)} aria-pressed={filter === value} className={`rounded-lg px-3 py-1.5 text-sm transition ${filter === value ? "bg-cb-panel2 text-white" : "text-cb-muted hover:text-white"}`}>{label}</button>
              ))}
            </div>
          </div>
          {visible.length === 0 ? <p className="p-5 text-sm text-cb-muted">Ningún cliente coincide con el filtro.</p> : (
            <ul className="divide-y divide-cb-line">
              {visible.map((c) => (
                <li key={c.id}>
                  <Link href={`/clients/${c.id}`} className="grid gap-3 p-4 transition hover:bg-cb-panel2/50 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto] sm:items-center">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-cb-panel2 font-mono text-xs text-cb-amber" aria-hidden>{initialsFrom(c.company || c.name)}</div>
                      <div className="min-w-0"><div className="truncate font-semibold">{c.company || c.name}</div><div className="truncate text-xs text-cb-muted">{c.company ? `${c.name} · ` : ""}{c.email}</div></div>
                    </div>
                    <div className="text-sm text-cb-muted">{c.projectCount === 1 ? "1 proyecto" : `${c.projectCount ?? 0} proyectos`}</div>
                    <div>
                      {!c.active ? <span className="rounded-full border border-cb-line bg-cb-panel2 px-2.5 py-1 text-[11px] text-cb-muted">Inactivo</span>
                        : c.linkedUserId ? <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">Portal activo</span>
                        : <span className="rounded-full border border-cb-amber/20 bg-cb-amber/10 px-2.5 py-1 text-[11px] font-semibold text-cb-amber">Sin acceso al portal</span>}
                    </div>
                    <ChevronRight size={16} className="hidden text-cb-muted sm:block" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {creating && <ClientForm onClose={() => setCreating(false)} onSaved={(c) => router.push(`/clients/${c.id}`)} />}
    </div>
  );
}
