"use client";

import { useEffect, useState } from "react";
import { getAuthClient, getDbClient } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { Save } from "lucide-react";

export default function SettingsClient() {
  const [name,setName]=useState(""); const [role,setRole]=useState(""); const [email,setEmail]=useState(""); const [saved,setSaved]=useState(false);
  useEffect(()=>{
    const auth = getAuthClient();
    const db = getDbClient();
    if(!auth || !db) return;
    if(!auth.currentUser)return;
    setEmail(auth.currentUser.email||"");
    getDoc(doc(db,"users",auth.currentUser.uid)).then(s=>{if(s.exists()){const d=s.data();setName(d.name||"");setRole(d.role||")}})
  },[]);
  async function save(){
    const auth = getAuthClient();
    const db = getDbClient();
    if(!auth || !db || !auth.currentUser)return;
    await updateDoc(doc(db,"users",auth.currentUser.uid),{name});
    await updateProfile(auth.currentUser,{displayName:name});
    setSaved(true);
    setTimeout(()=>setSaved(false),1800)
  }
  return <div className="mx-auto max-w-[800px] space-y-5"><div><div className="mono-label">ACCOUNT / SETTINGS</div><h1 className="mt-1 text-3xl font-bold">Perfil y configuración</h1></div><section className="panel p-6"><div className="grid gap-5 md:grid-cols-2"><label className="text-sm"><span className="mb-2 block text-slate-300">Nombre</span><input className="input" value={name} onChange={e=>setName(e.target.value)}/></label><label className="text-sm"><span className="mb-2 block text-slate-300">Correo</span><input className="input opacity-60" value={email} readOnly/></label><label className="text-sm"><span className="mb-2 block text-slate-300">Rol</span><input className="input opacity-60" value={role} readOnly/></label></div><div className="mt-6 flex items-center gap-3"><button className="btn-primary" onClick={save}><Save size={16}/> Guardar</button>{saved&&<span className="text-sm text-cb-teal">Guardado.</span>}</div></section></div>;
}
