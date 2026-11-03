"use client";

import { Fragment, useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { MessageSquare, Send } from "lucide-react";
import { ErrorBanner, Skeleton } from "@/components/ui";
import { getSupabaseClient } from "@/lib/supabase/client";
import { listMessages, mapMessage, sendMessage, teamNames, MAX_MESSAGE, type Message } from "@/lib/data/messages";
import { getWorkspace } from "@/lib/data/workspace";
import { messageOf } from "@/lib/errors";
import { dayKey, formatDayHeading, formatTime, initialsFrom } from "@/lib/format";

function merge(current: Message[], incoming: Message[]) {
  const map = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) map.set(m.id, m);
  return [...map.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/**
 * Message thread for one channel. `channelId = null` is the internal team channel.
 * Messages from people who are not team members are shown with `externalName` (the client).
 */
export default function ChatThread({ channelId, externalName = "Cliente", emptyHint, height = "h-[560px]" }: { channelId: string | null; externalName?: string; emptyHint: string; height?: string }) {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [me, setMe] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);

  const load = useCallback(async () => {
    const list = await listMessages(channelId);
    setMessages((cur) => merge(cur ?? [], list));
  }, [channelId]);

  useEffect(() => {
    let active = true;
    setMessages(null);
    Promise.all([getWorkspace(), teamNames()]).then(([ws, n]) => { if (active) { setMe(ws.userId); setNames(n); } }).catch(() => undefined);
    load().catch((c) => { if (active) { setError(messageOf(c, "No se pudieron cargar los mensajes.")); setMessages([]); } });

    const db = getSupabaseClient();
    const filter = channelId ? `channel_id=eq.${channelId}` : undefined;
    const sub = db.channel(`admin-chat-${channelId ?? "team"}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "cbdevs_messages", ...(filter ? { filter } : {}) }, (payload) => {
        const row = payload.new as { id: string; channel_id: string | null; sender_id: string; text: string; created_at: string };
        if ((row.channel_id ?? null) !== channelId) return;
        setMessages((cur) => merge(cur ?? [], [mapMessage(row)]));
      })
      .subscribe();
    const poll = window.setInterval(() => { if (document.visibilityState === "visible") void load().catch(() => undefined); }, 30_000);
    return () => { active = false; window.clearInterval(poll); void db.removeChannel(sub); };
  }, [channelId, load]);

  useEffect(() => {
    const el = scroller.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function send(e?: FormEvent) {
    e?.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true); setError("");
    try {
      const sent = await sendMessage(channelId, text);
      setText("");
      pinned.current = true;
      setMessages((cur) => merge(cur ?? [], [sent]));
    } catch (c) {
      setError(messageOf(c, "No se pudo enviar el mensaje."));
    } finally { setSending(false); }
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); }
  }

  return (
    <div className={`flex ${height} min-h-[420px] flex-col overflow-hidden rounded-xl border border-cb-line bg-cb-bg`}>
      <div ref={scroller} onScroll={() => { const el = scroller.current; if (el) pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }} className="scrollbar flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
        {messages === null ? <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div> : messages.length === 0 ? (
          <div className="grid h-full place-items-center text-center text-cb-muted"><div><MessageSquare className="mx-auto mb-2 text-cb-amber" aria-hidden /><p className="text-sm">{emptyHint}</p></div></div>
        ) : messages.map((m, i) => {
          const mine = m.senderId === me;
          const staffName = names.get(m.senderId);
          const name = mine ? "Tú" : staffName ?? externalName;
          const fromClient = !staffName && !mine;
          return (
            <Fragment key={m.id}>
              {(i === 0 || dayKey(messages[i - 1].createdAt) !== dayKey(m.createdAt)) && (
                <div className="flex items-center gap-3 text-[11px] uppercase tracking-wider text-slate-500"><span className="h-px flex-1 bg-cb-line" />{formatDayHeading(m.createdAt)}<span className="h-px flex-1 bg-cb-line" /></div>
              )}
              <div className={`flex gap-3 ${mine ? "flex-row-reverse" : ""}`}>
                <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full font-mono text-[10px] ${fromClient ? "bg-cb-teal/15 text-cb-teal" : "bg-cb-amber/15 text-cb-amber"}`} aria-hidden>{initialsFrom(name)}</div>
                <div className={`min-w-0 max-w-[80%] ${mine ? "text-right" : ""}`}>
                  <div className={`flex items-baseline gap-2 text-xs ${mine ? "justify-end" : ""}`}><span className="font-semibold">{name}</span>{fromClient && <span className="rounded bg-cb-teal/10 px-1.5 text-[10px] text-cb-teal">cliente</span>}<time className="text-[10px] text-slate-500" dateTime={m.createdAt}>{formatTime(m.createdAt)}</time></div>
                  <div className={`mt-1 whitespace-pre-wrap break-words rounded-2xl border px-3.5 py-2 text-left text-sm ${mine ? "rounded-tr-sm border-cb-amber/20 bg-cb-amber/10" : fromClient ? "rounded-tl-sm border-cb-teal/20 bg-cb-teal/5" : "rounded-tl-sm border-cb-line bg-cb-panel2"}`}>{m.text}</div>
                </div>
              </div>
            </Fragment>
          );
        })}
      </div>
      {error && <div className="border-t border-cb-line p-3"><ErrorBanner>{error}</ErrorBanner></div>}
      <form onSubmit={send} className="flex items-end gap-2 border-t border-cb-line bg-cb-panel2 p-3">
        <label className="sr-only" htmlFor={`msg-${channelId ?? "team"}`}>Mensaje</label>
        <textarea id={`msg-${channelId ?? "team"}`} rows={2} className="input max-h-40 resize-y" value={text} onChange={(e) => setText(e.target.value.slice(0, MAX_MESSAGE))} onKeyDown={onKey} placeholder="Escribe un mensaje… (Enter envía, Shift+Enter nueva línea)" maxLength={MAX_MESSAGE} disabled={sending} />
        <button className="btn-primary h-11 shrink-0 px-3.5" disabled={!text.trim() || sending} aria-label="Enviar mensaje"><Send size={17} aria-hidden /></button>
      </form>
    </div>
  );
}
