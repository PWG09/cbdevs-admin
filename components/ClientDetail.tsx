"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Check, CheckCircle2, Clock, Copy, FolderKanban, KeyRound, Link2, Mail, Pencil, Phone, Plus, Send, Trash2, Unlink, Users } from "lucide-react";
import ClientForm from "@/components/ClientForm";
import ConfirmButton from "@/components/ConfirmButton";
import ProjectForm from "@/components/ProjectForm";
import { EmptyState, ErrorBanner, PageHeader, Skeleton, StatusBadge, SuccessBanner } from "@/components/ui";
import { deleteClient, getClient, portalAccess, type Client, type PortalAccess } from "@/lib/data/clients";
import { listClientProjects, type AdminProject } from "@/lib/data/projects";
import { getWorkspace } from "@/lib/data/workspace";
import { messageOf } from "@/lib/errors";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { EMAIL_RE } from "@/lib/validation";

function PortalAccessCard({ client, onChanged }: { client: Client; onChanged: (linkedUserId: string | null) => void }) {
  const [access, setAccess] = useState<PortalAccess | null>(null);
  const [email, setEmail] = useState(client.email);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);

  const initiallyLinked = Boolean(client.linkedUserId);
  // Load the account status once per client; later changes come back from the actions themselves.
  useEffect(() => {
    let active = true;
    if (!initiallyLinked) { setAccess({ linked: false }); return; }
    portalAccess(client.id, "status").then((a) => { if (active) setAccess(a); }).catch((cause) => { if (active) { setAccess({ linked: true }); setError(messageOf(cause, "No se pudo consultar el acceso.")); } });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id]);

  async function run(action: "link" | "invite" | "invite_link" | "unlink") {
    setBusy(true); setError(""); setNotice(""); setInviteLink(""); setCopied(false);
    try {
      const result = await portalAccess(client.id, action, action === "unlink" ? undefined : (access?.linked ? access.email || email : email).trim().toLowerCase());
      const { inviteLink: link, ...rest } = result;
      setAccess(rest);
      setInviteLink(link ?? "");
      setNotice(result.message ?? "");
      onChanged(result.linked ? "linked" : null);
    } catch (cause) {
      setError(messageOf(cause, "No se pudo completar la operación."));
    } finally { setBusy(false); }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
    } catch {
      setError("No se pudo copiar automáticamente. Selecciona el enlace y cópialo manualmente.");
    }
  }

  const validEmail = EMAIL_RE.test(email.trim());
  const pendingInvite = access?.linked && access.confirmed === false;

  return (
    <section className="panel p-5 sm:p-6">
      <div className="flex items-center gap-2"><KeyRound size={18} className="text-cb-amber" aria-hidden /><h2 className="text-lg font-semibold">Acceso al portal de cliente</h2></div>
      <p className="mt-1 text-sm text-cb-muted">Con acceso, el cliente ve en el portal el avance, hitos, documentos, pagos y mensajes de sus proyectos.</p>

      {!client.active ? (
        <p className="mt-4 rounded-xl border border-cb-line bg-cb-bg p-3 text-sm text-cb-muted">El cliente está inactivo. Actívalo para darle acceso al portal.</p>
      ) : access === null ? <Skeleton className="mt-4 h-24" /> : access.linked ? (
        <div className="mt-4 space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-emerald-400/20 bg-emerald-500/5 p-4">
            {pendingInvite ? <Clock className="mt-0.5 shrink-0 text-cb-amber" size={18} aria-hidden /> : <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-300" size={18} aria-hidden />}
            <div className="min-w-0 text-sm">
              <div className="font-semibold">{pendingInvite ? "Invitación pendiente" : "Acceso activo"}</div>
              {access.email && <div className="truncate text-cb-muted">{access.email}</div>}
              <div className="mt-1 text-xs text-cb-muted">
                {pendingInvite ? `Invitado el ${formatDateTime(access.invitedAt, "")} · aún no crea su contraseña.` : access.lastSignInAt ? `Último acceso: ${formatDateTime(access.lastSignInAt)}` : "Todavía no ha iniciado sesión."}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {pendingInvite && <button type="button" className="btn-ghost" disabled={busy} onClick={() => void run("invite")}><Send size={15} aria-hidden />Reenviar por correo</button>}
            {pendingInvite && <button type="button" className="btn-ghost" disabled={busy} onClick={() => void run("invite_link")}><Link2 size={15} aria-hidden />Generar enlace</button>}
            <ConfirmButton className="btn-ghost" confirmLabel="¿Quitar acceso?" onConfirm={() => run("unlink")} disabled={busy}><Unlink size={15} aria-hidden />Quitar acceso</ConfirmButton>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-slate-300">Correo de acceso</span>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" disabled={busy || !validEmail} onClick={() => void run("invite")}><Mail size={15} aria-hidden />{busy ? "Enviando…" : "Invitar por correo"}</button>
            <button type="button" className="btn-ghost" disabled={busy || !validEmail} onClick={() => void run("invite_link")}><Copy size={15} aria-hidden />Generar enlace de invitación</button>
            <button type="button" className="btn-ghost" disabled={busy || !validEmail} onClick={() => void run("link")}><Link2 size={15} aria-hidden />Vincular cuenta existente</button>
          </div>
          <p className="text-xs text-cb-muted">“Invitar” crea la cuenta y envía un correo para que el cliente defina su contraseña. “Generar enlace” hace lo mismo sin enviar correo: tú le compartes el enlace. Si el correo ya tiene cuenta, solo se vincula.</p>
        </div>
      )}
      <div className="mt-4 space-y-2"><ErrorBanner>{error || null}</ErrorBanner><SuccessBanner>{notice || null}</SuccessBanner></div>
      {inviteLink && (
        <div className="mt-3 space-y-2 rounded-xl border border-cb-amber/25 bg-cb-amber/5 p-3">
          <label htmlFor={`invite-link-${client.id}`} className="block text-xs font-semibold text-cb-amber">Enlace de invitación (un solo uso)</label>
          <div className="flex gap-2">
            <input id={`invite-link-${client.id}`} className="input min-w-0 flex-1 font-mono text-xs" readOnly value={inviteLink} onFocus={(e) => e.currentTarget.select()} />
            <button type="button" className="btn-primary shrink-0 px-3" onClick={() => void copyLink()}>{copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}{copied ? "Copiado" : "Copiar"}</button>
          </div>
          <p className="text-[11px] text-cb-muted">Quien tenga este enlace puede entrar como el cliente y crear su contraseña. No lo publiques.</p>
        </div>
      )}
    </section>
  );
}

export default function ClientDetail() {
  const { clientId } = useParams<{ clientId: string }>();
  const router = useRouter();
  const [client, setClient] = useState<Client | null | undefined>(undefined);
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editing, setEditing] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [c, p, ws] = await Promise.all([getClient(clientId), listClientProjects(clientId), getWorkspace()]);
    setClient(c);
    setProjects(p);
    setIsAdmin(ws.role === "admin");
  }, [clientId]);

  useEffect(() => { load().catch((cause) => { setError(messageOf(cause, "No se pudo cargar el cliente.")); setClient(null); }); }, [load]);

  const back = <Link className="inline-flex items-center gap-1.5 text-sm text-cb-muted hover:text-white" href="/clients"><ArrowLeft size={15} aria-hidden />Clientes</Link>;
  if (client === undefined) return <div className="mx-auto max-w-[1200px] space-y-5"><Skeleton className="h-24" /><Skeleton className="h-80" /></div>;
  if (!client) return <div className="mx-auto max-w-3xl space-y-5">{back}<EmptyState icon={Users} title="Cliente no encontrado" description={error || "El cliente no existe o pertenece a otra organización."} /></div>;

  const totals = projects.reduce((acc, p) => { acc[p.currency] = (acc[p.currency] ?? 0) + p.amount; return acc; }, {} as Record<string, number>);

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      {back}
      <PageHeader eyebrow={client.active ? "Cliente activo" : "Cliente inactivo"} title={client.company || client.name} description={client.company ? `Contacto: ${client.name}` : undefined}
        actions={<button className="btn-ghost" onClick={() => setEditing(true)}><Pencil size={15} aria-hidden />Editar</button>} />
      <ErrorBanner>{error || null}</ErrorBanner>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
        <div className="space-y-6">
          <section className="panel p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2"><FolderKanban size={18} className="text-cb-amber" aria-hidden /><h2 className="text-lg font-semibold">Proyectos</h2></div>
              <button className="btn-primary" onClick={() => setCreatingProject(true)}><Plus size={15} aria-hidden />Nuevo proyecto</button>
            </div>
            {projects.length === 0 ? (
              <div className="mt-4"><EmptyState icon={FolderKanban} title="Sin proyectos" description="Crea un proyecto para este cliente; aparecerá en su portal." /></div>
            ) : (
              <ul className="mt-4 divide-y divide-cb-line rounded-xl border border-cb-line">
                {projects.map((p) => (
                  <li key={p.id}>
                    <Link href={`/projects/${p.id}`} className="flex flex-col gap-2 p-4 transition hover:bg-cb-panel2/50 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1"><div className="truncate font-semibold">{p.name}</div><div className="text-xs text-cb-muted">{p.serviceType} · Entrega {formatDate(p.estimatedDelivery)}</div></div>
                      <div className="flex flex-wrap items-center gap-2"><StatusBadge status={p.deliveryStatus} /><span className="text-sm font-semibold tabular-nums">{formatMoney(p.amount, p.currency)}</span></div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {Object.keys(totals).length > 0 && <p className="mt-3 text-right text-xs text-cb-muted">Total contratado: {Object.entries(totals).map(([cur, amt]) => formatMoney(amt, cur)).join(" + ")}</p>}
          </section>

          {client.notes && (
            <section className="panel p-5 sm:p-6">
              <h2 className="text-sm font-semibold text-cb-muted">Notas internas</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-300">{client.notes}</p>
            </section>
          )}
        </div>

        <div className="space-y-6">
          <PortalAccessCard client={client} onChanged={(linked) => setClient((c) => (c ? { ...c, linkedUserId: linked } : c))} />
          <section className="panel space-y-3 p-5 text-sm sm:p-6">
            <h2 className="text-lg font-semibold">Contacto</h2>
            <a className="flex items-center gap-2 text-slate-300 hover:text-cb-amber" href={`mailto:${client.email}`}><Mail size={15} aria-hidden />{client.email}</a>
            {client.phone && <a className="flex items-center gap-2 text-slate-300 hover:text-cb-amber" href={`tel:${client.phone.replace(/[^\d+]/g, "")}`}><Phone size={15} aria-hidden />{client.phone}</a>}
            <p className="text-xs text-cb-muted">Cliente desde {formatDate(client.createdAt)}</p>
          </section>
          {isAdmin && (
            <section className="panel border-red-500/20 p-5 sm:p-6">
              <h2 className="font-semibold text-red-200">Eliminar cliente</h2>
              <p className="mt-1 text-sm text-cb-muted">Solo es posible si no tiene proyectos. Para conservar el historial, mejor desactívalo.</p>
              <ConfirmButton className="btn-ghost mt-4" confirmLabel="Confirmar: eliminar" disabled={projects.length > 0}
                onConfirm={async () => { try { await deleteClient(client.id); router.replace("/clients"); } catch (cause) { setError(messageOf(cause, "No se pudo eliminar el cliente.")); } }}>
                <Trash2 size={15} aria-hidden />Eliminar cliente
              </ConfirmButton>
            </section>
          )}
        </div>
      </div>

      {editing && <ClientForm client={client} onClose={() => setEditing(false)} onSaved={(c) => { setClient(c); setEditing(false); void load(); }} />}
      {creatingProject && <ProjectForm defaultClientId={client.id} onClose={() => setCreatingProject(false)} onSaved={(p) => router.push(`/projects/${p.id}`)} />}
    </div>
  );
}

