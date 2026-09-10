"use client";

import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, onSnapshot, serverTimestamp, updateDoc, doc } from "firebase/firestore";
import { getDbClient } from "@/lib/firebase";
import { mockProjects } from "@/lib/mock-data";
import type { DeliveryStatus, Project, ServiceType } from "@/lib/types";
import { ExternalLink, GripVertical, List, Plus, Search, LayoutGrid } from "lucide-react";

const statuses: DeliveryStatus[] = ["Cotizado", "En desarrollo", "En revisión", "Entregado", "En mantenimiento", "Pausado/Cancelado"];
const serviceTypes: ServiceType[] = ["Sitio Web", "Aplicación Web", "Software Personalizado/Automatización"];

function badge(status: string) {
  if (status.includes("mantenimiento")) return "bg-cb-teal/10 text-cb-teal";
  if (status === "Entregado" || status === "Pagado completo" || status === "Mantenimiento al día") return "bg-emerald-500/10 text-emerald-300";
  if (status.includes("Pendiente") || status.includes("atrasado")) return "bg-red-500/10 text-red-300";
  return "bg-cb-amber/10 text-cb-amber";
}

export default function ProjectsClient() {
  const [projects, setProjects] = useState<Project[]>(mockProjects);
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [filter, setFilter] = useState("");
  const [service, setService] = useState("");
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    const db = getDbClient();
    if(!db) return;
    return onSnapshot(collection(db, "projects"), snap => {
      if (!snap.empty) setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Project[]);
    });
  }, []);

  const filtered = useMemo(() => projects.filter(p =>
    (!filter || p.deliveryStatus === filter) &&
    (!service || p.serviceType === service)
  ), [projects, filter, service]);

  async function move(id: string, status: DeliveryStatus) {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, deliveryStatus: status } : p));
    const db = getDbClient();
    if (!db) return;
    if (!id.startsWith("p-")) await updateDoc(doc(db, "projects", id), { deliveryStatus: status, updatedAt: serverTimestamp() });
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div><div className="mono-label">CLIENT WORK / {projects.length}</div><h1 className="mt-1 text-3xl font-bold">Proyectos</h1><p className="mt-1 text-sm text-cb-muted">Tablero operativo de clientes y entregas.</p></div>
        <button className="btn-primary" onClick={() => setShowNew(true)}><Plus size={17}/> Nuevo proyecto</button>
      </div>

      <div className="panel flex flex-col gap-3 p-3 md:flex-row md:items-center">
        <div className="flex items-center gap-2 rounded-xl border border-cb-line bg-cb-bg px-3 py-2 text-sm"><Search size={16} className="text-slate-500"/><input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filtrar por estado..." className="bg-transparent outline-none placeholder:text-slate-600" /></div>
        <select className="input md:max-w-xs" value={service} onChange={e => setService(e.target.value)}><option value="">Todos los servicios</option>{serviceTypes.map(s => <option key={s}>{s}</option>)}</select>
        <div className="ml-auto flex rounded-xl border border-cb-line p-1"><button className={`rounded-lg p-2 ${view==="kanban"?"bg-cb-panel2 text-cb-amber": "text-slate-500"}`} onClick={() => setView("kanban")}><LayoutGrid size={17}/></button><button className={`rounded-lg p-2 ${view==="table"?"bg-cb-panel2 text-cb-amber": "text-slate-500"}`} onClick={() => setView("table")}><List size={17}/></button></div>
      </div>

      {view === "kanban" ? (
        <div className="scrollbar flex gap-4 overflow-x-auto pb-4">
          {statuses.map(status => (
            <div key={status} className="min-w-[290px] flex-1 rounded-2xl border border-cb-line bg-cb-panel/60 p-3" onDragOver={e => e.preventDefault()} onDrop={e => { const id = e.dataTransfer.getData("projectId"); if(id) move(id, status); }}>
              <div className="mb-3 flex items-center justify-between"><span className={`rounded-full px-2.5 py-1 font-mono text-[10px] ${badge(status)}`}>{status}</span><span className="text-xs text-slate-600">{filtered.filter(p=>p.deliveryStatus===status).length}</span></div>
              <div className="space-y-3">
                {filtered.filter(p => p.deliveryStatus === status).map(p => (
                  <article key={p.id} draggable onDragStart={e => e.dataTransfer.setData("projectId", p.id)} className="rounded-xl border border-cb-line bg-cb-panel p-4 hover:border-slate-600">
                    <div className="mb-3 flex items-start gap-2"><GripVertical size={16} className="mt-0.5 text-slate-700"/><div className="min-w-0"><h3 className="font-semibold">{p.name}</h3><p className="text-xs text-cb-muted">{p.client}</p></div></div>
                    <div className="flex flex-wrap gap-1.5"><span className="rounded-md bg-cb-bg px-2 py-1 text-[10px] text-slate-400">{p.serviceType}</span><span className={`rounded-md px-2 py-1 text-[10px] ${badge(p.paymentStatus)}`}>{p.paymentStatus}</span></div>
                    <div className="mt-4 flex items-center justify-between text-xs"><span className="text-slate-500">Entrega</span><span>{p.estimatedDelivery}</span></div>
                    {p.productionUrl && <a href={p.productionUrl} target="_blank" className="mt-3 inline-flex items-center gap-1 text-xs text-cb-amber hover:underline">Producción <ExternalLink size={12}/></a>}
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="panel overflow-hidden"><div className="scrollbar overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-cb-panel2 text-xs uppercase tracking-wider text-slate-500"><tr><th className="p-4">Proyecto</th><th className="p-4">Servicio</th><th className="p-4">Entrega</th><th className="p-4">Pago</th><th className="p-4">Monto</th></tr></thead><tbody>{filtered.map(p => <tr key={p.id} className="border-t border-cb-line"><td className="p-4"><div className="font-semibold">{p.name}</div><div className="text-xs text-slate-500">{p.client}</div></td><td className="p-4 text-slate-400">{p.serviceType}</td><td className="p-4"><span className={`rounded-full px-2 py-1 text-xs ${badge(p.deliveryStatus)}`}>{p.deliveryStatus}</span></td><td className="p-4"><span className={`rounded-full px-2 py-1 text-xs ${badge(p.paymentStatus)}`}>{p.paymentStatus}</span></td><td className="p-4">{new Intl.NumberFormat("es-MX",{style:"currency",currency:p.currency}).format(p.amount)}</td></tr>)}</tbody></table></div></div>
      )}

      {showNew && <NewProject onClose={() => setShowNew(false)} />}
    </div>
  );
}

function NewProject({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [serviceType, setServiceType] = useState<ServiceType>("Sitio Web");
  const [amount, setAmount] = useState("0");
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      const db = getDbClient();
      if(!db) throw new Error("DB not initialized");
      await addDoc(collection(db, "projects"), {
        name, client, serviceType, deliveryStatus: "Cotizado", paymentStatus: "Pendiente",
        currency: "MXN", amount: Number(amount), initialPayment: 0, monthlyMaintenance: 0,
        startDate: new Date().toISOString().slice(0,10), estimatedDelivery: new Date(Date.now()+30*86400000).toISOString().slice(0,10),
        responsibleIds: [], notes: "", updatedAt: serverTimestamp()
      });
      onClose();
    } finally { setSaving(false); }
  }

  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"><form onSubmit={save} className="panel w-full max-w-lg p-6"><div className="mono-label">PROJECT / CREATE</div><h2 className="mt-1 text-xl font-bold">Nuevo proyecto</h2><div className="mt-5 grid gap-4"><input className="input" placeholder="Nombre del proyecto" value={name} onChange={e=>setName(e.target.value)} required/><input className="input" placeholder="Cliente" value={client} onChange={e=>setClient(e.target.value)} required/><select className="input" value={serviceType} onChange={e=>setServiceType(e.target.value as ServiceType)}>{serviceTypes.map(s=><option key={s}>{s}</option>)}</select><input className="input" type="number" min="0" placeholder="Monto" value={amount} onChange={e=>setAmount(e.target.value)}/></div><div className="mt-6 flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={saving}>{saving?"Guardando...":"Crear proyecto"}</button></div></form></div>;
}
