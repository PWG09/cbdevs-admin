"use client";

import { useEffect, useState } from "react";
import ChatThread from "@/components/ChatThread";
import { ErrorBanner, Skeleton } from "@/components/ui";
import { ensureProjectChannel, type AdminProject } from "@/lib/data/projects";
import { messageOf } from "@/lib/errors";

/** The project's private channel, shared with the client in the Client Portal. */
export default function ProjectChat({ project, clientName }: { project: AdminProject; clientName?: string }) {
  const [channelId, setChannelId] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    ensureProjectChannel(project).then((id) => { if (active) setChannelId(id); }).catch((c) => { if (active) { setError(messageOf(c, "No se pudo abrir el canal.")); setChannelId(null); } });
    return () => { active = false; };
  }, [project]);

  if (channelId === undefined) return <Skeleton className="h-96" />;
  if (!channelId) return <ErrorBanner>{error}</ErrorBanner>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-cb-muted">{project.clientId ? "Canal privado con el cliente: todo lo que escribas aquí lo ve en su portal." : "Asigna un cliente al proyecto para que pueda leer y responder estos mensajes."}</p>
      <ChatThread channelId={channelId} externalName={clientName ?? "Cliente"} emptyHint="Aún no hay mensajes en este proyecto." />
    </div>
  );
}
