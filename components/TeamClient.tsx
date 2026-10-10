"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient, getCurrentOrganization } from "@/lib/supabase/client";
import type { UserProfile } from "@/lib/types";
import { UserPlus, UserCheck, UserX } from "lucide-react";

type TeamUser = UserProfile & { organizationId?: string };

export default function TeamClient() {
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const db = getSupabaseClient();
      const org = await getCurrentOrganization("admin");
      const { data: members, error: memberError } = await db
        .from("organization_members")
        .select("user_id,role,status,created_at")
        .eq("organization_id", org)
        .order("created_at");
      if (memberError) throw memberError;
      const ids = (members || []).map((member) => member.user_id);
      const { data: profiles, error: profileError } = ids.length
        ? await db.from("profiles").select("id,display_name,email,avatar_url,created_at").in("id", ids)
        : { data: [], error: null };
      if (profileError) throw profileError;
      const profileMap = new Map((profiles || []).map((profile: any) => [profile.id, profile]));
      setUsers((members || []).map((member: any) => {
        const profile = profileMap.get(member.user_id) as any;
        return {
          id: member.user_id,
          name: profile?.display_name || "Usuario",
          email: profile?.email || "",
          role: member.role === "owner" || member.role === "admin" ? "admin" : "empleado",
          active: member.status === "active",
          createdAt: member.created_at,
          organizationId: org,
        } as TeamUser;
      }));
      setError("");
    } catch (e: any) {
      setError(e?.message || "No se pudo cargar el equipo.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function toggle(user: TeamUser) {
    try {
      const db = getSupabaseClient();
      const { data: { session } } = await db.auth.getSession();
      if (!session?.access_token) throw new Error("Inicia sesión de nuevo para continuar.");
      const organizationId = await getCurrentOrganization("admin");
      const response = await fetch("/api/admin/set-member-status", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ organizationId, userId: user.id, active: !user.active }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo actualizar el estado.");
      await load();
    } catch (e: any) {
      setError(e?.message || "No se pudo actualizar el estado.");
    }
  }

  return (
    <div className="mx-auto max-w-[1100px] space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mono-label">ACCESS / USERS</div>
          <h1 className="mt-1 text-3xl font-bold">Equipo</h1>
          <p className="mt-1 text-sm text-cb-muted">Crea y administra las cuentas del equipo interno.</p>
        </div>
        <button className="btn-primary" onClick={() => setShow(true)}><UserPlus size={17} /> Crear cuenta</button>
      </div>
      {error && <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-cb-panel2 text-xs uppercase tracking-wider text-slate-500">
              <tr><th className="p-4">Miembro</th><th className="p-4">Rol</th><th className="p-4">Estado</th><th className="p-4">Acción</th></tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={4} className="p-6 text-center text-slate-400">Cargando equipo…</td></tr> :
                users.length === 0 ? <tr><td colSpan={4} className="p-6 text-center text-slate-400">Todavía no hay miembros en esta organización.</td></tr> :
                users.map((user) => (
                  <tr key={user.id} className="border-t border-cb-line">
                    <td className="p-4"><div className="font-semibold">{user.name}</div><div className="text-xs text-slate-500">{user.email}</div></td>
                    <td className="p-4"><span className="rounded-full bg-cb-amber/10 px-2 py-1 text-xs text-cb-amber">{user.role === "admin" ? "Admin" : "Empleado"}</span></td>
                    <td className="p-4"><span className={`rounded-full px-2 py-1 text-xs ${user.active ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"}`}>{user.active ? "Activo" : "Inactivo"}</span></td>
                    <td className="p-4"><button onClick={() => void toggle(user)} className="btn-ghost px-3 py-2">{user.active ? <><UserX size={15} /> Desactivar</> : <><UserCheck size={15} /> Activar</>}</button></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      {show && <CreateMember close={() => setShow(false)} saved={load} />}
    </div>
  );
}

function CreateMember({ close, saved }: { close: () => void; saved: () => Promise<void> }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("empleado");
  const [message, setMessage] = useState("");
  const [created, setCreated] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setCreated(false);
    try {
      const db = getSupabaseClient();
      const { data: { session } } = await db.auth.getSession();
      if (!session?.access_token) throw new Error("Inicia sesión de nuevo para continuar.");
      const organizationId = await getCurrentOrganization("admin");
      const response = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ organizationId, name, email, password, role }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo crear la cuenta.");
        setCreated(true);
      setMessage(result.message || "Cuenta creada correctamente.");
      await saved();
    } catch (e: any) {
      setMessage(e?.message || "No se pudo crear la cuenta.");
    } finally {
      setLoading(false);
    }
  }


  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/70 p-4">
      <form onSubmit={submit} className="panel my-6 w-full max-w-lg p-6">
        <div className="mono-label">TEAM / CREATE ACCOUNT</div>
        <h2 className="mt-1 text-xl font-bold">{created ? "Cuenta creada" : "Crear cuenta de equipo"}</h2>
        {!created ? <>
          <p className="mt-2 text-sm text-cb-muted">Crea el perfil y el acceso de Supabase directamente. Define la contraseña inicial; no se enviará una invitación.</p>
          <div className="mt-5 grid gap-4">
            <input className="input" placeholder="Nombre completo" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={120} required />
            <input className="input" type="email" placeholder="Correo electrónico" value={email} onChange={(event) => setEmail(event.target.value)} required />
            <input className="input" type="password" placeholder="Contraseña inicial (mínimo 10 caracteres)" value={password} onChange={(event) => setPassword(event.target.value)} minLength={10} autoComplete="new-password" required />
            <select className="input" value={role} onChange={(event) => setRole(event.target.value)}>
              <option value="empleado">Empleado</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
        </> : <>
          <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-200">{message}</div>
          <p className="mt-4 text-sm text-cb-muted">La cuenta ya está creada con la contraseña inicial que definiste. Entrégale las credenciales al empleado por un canal seguro.</p>
          
        </>}
        {message && !created && <div role="alert" className="mt-4 rounded-xl border border-cb-line bg-cb-bg p-3 text-sm text-slate-300">{message}</div>}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={close}>{created ? "Terminar" : "Cerrar"}</button>
          {!created && <button className="btn-primary" disabled={loading}>{loading ? "Creando cuenta…" : "Crear cuenta"}</button>}
        </div>
      </form>
    </div>
  );
}
