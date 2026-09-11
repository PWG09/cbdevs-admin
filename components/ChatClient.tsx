"use client";

import { useEffect, useRef, useState } from "react";
import { addDoc, collection, limit, onSnapshot, orderBy, query, serverTimestamp } from "firebase/firestore";
import { getAuthClient, getDbClient } from "@/lib/firebase";
import type { ChatMessage } from "@/lib/types";
import { Hash, Send, MessageSquare } from "lucide-react";

export default function ChatClient() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    try {
      const db = getDbClient();
      if (!db) {
        console.error("[Chat] Firestore database client not available.");
        return;
      }

      const q = query(collection(db, "messages"), orderBy("createdAt", "asc"), limit(150));

      unsubscribe = onSnapshot(
        q,
        (snap) => {
          try {
            const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() })) as ChatMessage[];
            setMessages(msgs);
          } catch (renderError) {
            console.error("[Chat] Error processing snapshot data:", renderError);
          }
        },
        (error) => {
          console.error("[Chat] Firestore Subscription Error:", error);
          if (error.code === 'permission-denied') {
            console.error("[Chat] Permission Denied: Please check your Firestore Rules in the Firebase Console.");
          }
        }
      );
    } catch (setupError) {
      console.error("[Chat] CRITICAL Error setting up chat query:", setupError);
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  useEffect(() => bottom.current?.scrollIntoView({ behavior: "smooth" }), [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const value = text.trim();
    const auth = getAuthClient();
    const db = getDbClient();
    if (!value || !auth?.currentUser || !db) return;
    try {
      await addDoc(collection(db, "messages"), {
        channelId: "general",
        senderId: auth.currentUser.uid,
        senderName: auth.currentUser.displayName || auth.currentUser.email?.split("@")[0] || "Usuario",
        text: value,
        createdAt: serverTimestamp(),
      });
      setText("");
    } catch (err) {
      console.error("[Chat] Error sending message:", err);
    }
  }

  return (
    <div className="mx-auto max-w-[1100px] space-y-5">
      <div><div className="mono-label">TEAM / REALTIME</div><h1 className="mt-1 text-3xl font-bold">Chat</h1><p className="mt-1 text-sm text-cb-muted">Comunicación interna en tiempo real con Firestore.</p></div>
      <div className="panel flex h-[calc(100vh-210px)] min-h-[520px] flex-col overflow-hidden">
        <div className="flex items-center gap-3 border-b border-cb-line bg-cb-panel2 px-5 py-4"><div className="rounded-lg bg-cb-amber/10 p-2 text-cb-amber"><Hash size={17}/></div><div><div className="font-semibold">general</div><div className="text-xs text-slate-500">Equipo CBDEVS</div></div></div>
        <div className="scrollbar flex-1 space-y-4 overflow-y-auto p-5">
          {messages.length === 0 && <div className="grid h-full place-items-center text-center text-slate-600"><MessageSquare className="mx-auto mb-3"/><p>Aún no hay mensajes.</p><p className="text-xs">Sé el primero en escribir.</p></div>}
          {messages.map(m => {
            try {
              if (!m || typeof m !== 'object') return null;

              const senderName = (typeof m.senderName === 'string') ? m.senderName : "Usuario";
              const messageText = (typeof m.text === 'string') ? m.text : "";

              const timestamp = (() => {
                const value = m.createdAt;
                if (!value) return "ahora";

                if (typeof value === 'object' && 'toDate' in value && typeof (value as any).toDate === 'function') {
                  return (value as any).toDate().toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                }
                if (value instanceof Date) {
                  return value.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                }
                return "ahora";
              })();

              return (
                <div key={m.id} className="flex gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-cb-panel2 font-mono text-xs text-cb-amber">
                    {senderName.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-semibold">{senderName}</span>
                      <span className="text-[10px] text-slate-600">{timestamp}</span>
                    </div>
                    <div className="mt-1 rounded-2xl rounded-tl-sm border border-cb-line bg-cb-panel2 px-3 py-2 text-sm text-slate-200">
                      {messageText}
                    </div>
                  </div>
                </div>
              );
            } catch (e) {
              console.error("Error renderizando mensaje:", e);
              return null;
            }
          })}
          <div ref={bottom}/>
        </div>
        <form onSubmit={send} className="border-t border-cb-line bg-cb-panel2 p-3"><div className="flex gap-2"><input className="input" value={text} onChange={e=>setText(e.target.value)} placeholder="Escribe un mensaje..." /><button className="btn-primary px-3"><Send size={17}/></button></div></form>
      </div>
    </div>
  );
}
