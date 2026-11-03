"use client";

import { useState, type FormEvent } from "react";
import { Save } from "lucide-react";
import { ErrorBanner, Field, Modal } from "@/components/ui";
import { createClient, updateClient, type Client, type ClientInput } from "@/lib/data/clients";
import { messageOf } from "@/lib/errors";

export default function ClientForm({ client, onClose, onSaved }: { client?: Client; onClose: () => void; onSaved: (client: Client) => void }) {
  const [form, setForm] = useState<ClientInput>({
    name: client?.name ?? "", email: client?.email ?? "", phone: client?.phone ?? "", company: client?.company ?? "", notes: client?.notes ?? "", active: client?.active ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = <K extends keyof ClientInput>(key: K, value: ClientInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      onSaved(client ? await updateClient(client.id, form) : await createClient(form));
    } catch (cause) {
      setError(messageOf(cause, "No se pudo guardar el cliente."));
      setBusy(false);
    }
  }

  return (
    <Modal title={client ? "Editar cliente" : "Nuevo cliente"} eyebrow="Clientes" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre del contacto"><input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} required minLength={2} maxLength={160} autoFocus /></Field>
          <Field label="Empresa (opcional)"><input className="input" value={form.company} onChange={(e) => set("company", e.target.value)} maxLength={160} /></Field>
          <Field label="Correo" hint="Se usa para el acceso al portal."><input className="input" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required maxLength={254} /></Field>
          <Field label="Teléfono (opcional)"><input className="input" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} maxLength={40} placeholder="+52 55 1234 5678" /></Field>
        </div>
        <Field label="Notas internas (no las ve el cliente)"><textarea className="input min-h-[90px]" value={form.notes} onChange={(e) => set("notes", e.target.value)} maxLength={4000} /></Field>
        <label className="flex w-fit cursor-pointer items-center gap-3 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-[#f2a950]" checked={form.active} onChange={(e) => set("active", e.target.checked)} />
          Cliente activo <span className="text-cb-muted">(si lo desactivas, pierde acceso al portal)</span>
        </label>
        <ErrorBanner>{error || null}</ErrorBanner>
        <div className="flex justify-end gap-2 border-t border-cb-line pt-4">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" disabled={busy}><Save size={16} aria-hidden />{busy ? "Guardando…" : client ? "Guardar cambios" : "Crear cliente"}</button>
        </div>
      </form>
    </Modal>
  );
}
