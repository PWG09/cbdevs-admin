"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Hash, Search, Users } from "lucide-react";
import ChatThread from "@/components/ChatThread";
import { ErrorBanner, PageHeader, Skeleton } from "@/components/ui";
import { listProjectChannels, type ProjectChannel } from "@/lib/data/messages";
import { messageOf } from "@/lib/errors";
import { formatDayHeading } from "@/lib/format";

const TEAM = "__team";

/** Team chat plus every project's client channel. */
export default function ChatClient() {
  const [channels, setChannels] = useState<ProjectChannel[] | null>(null);
  const [selected, setSelected] = useState<string>(TEAM);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("canal");
    if (fromUrl) setSelected(fromUrl);
    listProjectChannels().then(setChannels).catch((c) => { setError(messageOf(c, "No se pudieron cargar los canales.")); setChannels([]); });
  }, []);

  const current = channels?.find((c) => c.id === selected);
  const visible = useMemo(() => (channels ?? []).filter((c) => !query.trim() || `${c.projectName} ${c.clientName}`.toLowerCase().includes(query.trim().toLowerCase())), [channels, query]);

  function choose(id: string) {
    setSelected(id);
    window.history.replaceState(null, "", id === TEAM ? "/chat" : `/chat?canal=${id}`);
  }

  return (
    <div className="mx-auto max-w-[1300px] space-y-5">
      <PageHeader eyebrow="Mensajes" title="Chat" description="Canal interno del equipo y conversaciones con cada cliente por proyecto." />
      <ErrorBanner>{error || null}</ErrorBanner>
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <aside className="panel flex max-h-[640px] flex-col overflow-hidden">
          <button type="button" onClick={() => choose(TEAM)} aria-pressed={selected === TEAM} className={`flex items-center gap-3 border-b border-cb-line p-4 text-left transition ${selected === TEAM ? "bg-cb-amber/10" : "hover:bg-cb-panel2"}`}>
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-cb-panel2 text-cb-amber"><Users size={16} aria-hidden /></div>
            <div><div className="text-sm font-semibold">Equipo (interno)</div><div className="text-xs text-cb-muted">Solo lo ve el equipo</div></div>
          </button>
          <div className="border-b border-cb-line p-3">
            <label className="relative block"><span className="sr-only">Buscar proyecto</span><Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cb-muted" aria-hidden /><input className="input py-2 pl-8 text-xs" placeholder="Buscar proyecto…" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
          </div>
          <div className="scrollbar flex-1 overflow-y-auto">
            {channels === null ? <div className="space-y-2 p-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div> : visible.length === 0 ? <p className="p-4 text-xs text-cb-muted">Sin canales de proyecto.</p> : visible.map((c) => (
              <button key={c.id} type="button" onClick={() => choose(c.id)} aria-pressed={selected === c.id} className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${selected === c.id ? "bg-cb-amber/10" : "hover:bg-cb-panel2"}`}>
                <Hash size={15} className="shrink-0 text-cb-muted" aria-hidden />
                <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{c.projectName}</div><div className="truncate text-xs text-cb-muted">{c.clientName}</div></div>
                {c.lastAt && <span className="shrink-0 text-[10px] text-slate-500">{formatDayHeading(c.lastAt)}</span>}
              </button>
            ))}
          </div>
        </aside>
        <section className="panel p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="min-w-0"><div className="truncate font-semibold">{selected === TEAM ? "Equipo (interno)" : current?.projectName ?? "Proyecto"}</div><div className="text-xs text-cb-muted">{selected === TEAM ? "Los clientes no ven este canal." : `Conversación con ${current?.clientName ?? "el cliente"} · la ve en su portal`}</div></div>
            {current && <Link href={`/projects/${current.projectId}#messages`} className="btn-ghost shrink-0 px-3 py-1.5 text-xs">Abrir proyecto <ExternalLink size={12} aria-hidden /></Link>}
          </div>
          <ChatThread key={selected} channelId={selected === TEAM ? null : selected} externalName={current?.clientName ?? "Cliente"} emptyHint={selected === TEAM ? "Aún no hay mensajes del equipo." : "Aún no hay mensajes en este proyecto."} />
        </section>
      </div>
    </div>
  );
}
