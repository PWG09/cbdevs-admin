"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import type { UserProfile } from "@/lib/types";
import { UserPlus, UserCheck, UserX } from "lucide-react";

export default function TeamClient() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [show, setShow] = useState(false);

  useEffect(() => onSnapshot(collection(db, "users"), s => setUsers(s.docs.map(d => ({id:d.id,...d.data()})) as UserProfile[])), []);

  async function toggle(u: UserProfile) {
    await updateDoc(doc(db, "users", u.id), { active: !u.active });
  }

  return <div className="mx-auto max-w-[1100px] space-y-5">
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><div className="mono-label">ACCESS / USERS</div><h1 className="mt-1 text-3xl font-bold">Equipo</h1><p className="mt-1 text-sm text-cb-muted">Administra accesos y roles del equipo interno.</p></div><button className="btn-primary" onClick={()=>setShow(true)}><UserPlus size={17}/> Crear miembro</button></div>
    <div className="panel overflow-hidden"><div className="scrollbar overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-cb-panel2 text-xs uppercase tracking-wider text-slate-500"><tr><th className="p-4">Miembro</th><th className="p-4">Rol</th><th className="p-4">Estado</th><th className="p-4">Acción</th></tr></thead><tbody>{users.map(u=><tr key={u.id} className="border-t border-cb-line"><td className="p-4"><div className="font-semibold">{u.name}</div><div className="text-xs text-slate-500">{u.email}</div></td><td className="p-4"><span className="rounded-full bg-cb-amber/10 px-2 py-1 text-xs text-cb-amber">{u.role}</span></td><td className="p-4"><span className={`rounded-full px-2 py-1 text-xs ${u.active?"bg-emerald-500/10 text-emerald-300":"bg-red-500/10 text-red-300"}`}>{u.active?"Activo":"Inactivo"}</span></td><td className="p-4"><button onClick={()=>toggle(u)} className="btn-ghost px-3 py-2">{u.active?<><UserX size={15}/> Desactivar</>:<><UserCheck size={15}/> Activar</>}</button></td></tr>)}</tbody></table></div></div>
    {show && <CreateMember onClose={()=>setShow(false)}/>}
  </div>;
}

function CreateMember({onClose}:{onClose:()=>void}) {
  const [name,setName]=useState(""); const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [role,setRole]=useState("empleado"); const [msg,setMsg]=useState(""); const [loading,setLoading]=useState(false);
  async function submit(e:React.FormEvent){e.preventDefault();setLoading(true);setMsg("");try{const r=await fetch("/api/admin/create-user",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,email,password,role,idToken:await auth.currentUser?.getIdToken()})});const data=await r.json();if(!r.ok)throw new Error(data.error||"Error");setMsg("Usuario creado correctamente.");setTimeout(onClose,700);}catch(e:any){setMsg(e.message)}finally{setLoading(false)}}
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"><form onSubmit={submit} className="panel w-full max-w-lg p-6"><div className="mono-label">TEAM / CREATE</div><h2 className="mt-1 text-xl font-bold">Nuevo miembro</h2><div className="mt-5 grid gap-4"><input className="input" placeholder="Nombre" value={name} onChange={e=>setName(e.target.value)} required/><input className="input" type="email" placeholder="Correo" value={email} onChange={e=>setEmail(e.target.value)} required/><input className="input" type="password" minLength={6} placeholder="Contraseña temporal" value={password} onChange={e=>setPassword(e.target.value)} required/><select className="input" value={role} onChange={e=>setRole(e.target.value)}><option value="empleado">Empleado</option><option value="admin">Admin</option></select></div>{msg&&<div className="mt-4 rounded-xl border border-cb-line bg-cb-bg p-3 text-sm text-slate-300">{msg}</div>}<div className="mt-6 flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={loading}>{loading?"Creando...":"Crear cuenta"}</button></div></form></div>
}
