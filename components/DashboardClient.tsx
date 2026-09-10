"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { mockProjects } from "@/lib/mock-data";
import type { Project } from "@/lib/types";
import { AlertTriangle, ArrowUpRight, CalendarClock, CircleDollarSign, FolderKanban, Wrench } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

const money = (n: number, c: string) => new Intl.NumberFormat("es-MX", { style: "currency", currency: c }).format(n);

export default function DashboardClient() {
  const [projects, setProjects] = useState<Project[]>(mockProjects);
  const [live, setLive] = useState(false);

  useEffect(() => {
    return onSnapshot(collection(db, "projects"), snap => {
      if (!snap.empty) {
        setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Project[]);
        setLive(true);
      }
    }, () => setLive(false));
  }, []);

  const active = projects.filter(p => ["En desarrollo", "En revisión"].includes(p.deliveryStatus)).length;
  const maintenance = projects.filter(p => p.deliveryStatus === "En mantenimiento").length;
  const pending = projects.filter(p => ["Pendiente", "Pago inicial recibido", "Pagado parcial", "Mantenimiento atrasado"].includes(p.paymentStatus))
    .reduce((s, p) => s + Math.max(p.amount - p.initialPayment, 0), 0);
  const monthIncome = projects.reduce((s, p) => s + p.initialPayment, 0) + projects.reduce((s, p) => s + p.monthlyMaintenance, 0);

  const chart = useMemo(() => [
    { month: "Abr", pagos: 16000, mantenimiento: 600 },
    { month: "May", pagos: 21000, mantenimiento: 1200 },
    { month: "Jun", pagos: 0, mantenimiento: 1800 },
    { month: "Jul", pagos: 14000, mantenimiento: 2050 },
    { month: "Ago", pagos: 14000, mantenimiento: 2650 },
    { month: "Sep", pagos: 0, mantenimiento: 2650 },
  ], []);

  const upcoming = [...projects].sort((a,b) => a.estimatedDelivery.localeCompare(b.estimatedDelivery)).slice(0, 4);

  const cards = [
    { label: "Proyectos activos", value: active, icon: FolderKanban, note: live ? "Firestore live" : "Modo demo" },
    { label: "En mantenimiento", value: maintenance, icon: Wrench, note: "Clientes recurrentes" },
    { label: "Ingresos del mes", value: money(monthIncome, "MXN"), icon: CircleDollarSign, note: "Pagos + mantenimiento" },
    { label: "Pagos pendientes", value: money(pending, "MXN"), icon: AlertTriangle, note: "Por cobrar" },
  ];

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <div>
        <div className="mono-label">OVERVIEW / 2026</div>
        <h1 className="mt-1 text-3xl font-bold">Dashboard</h1>
        <p className="mt-1 text-sm text-cb-muted">Estado operativo de CBDEVS en una sola vista.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(c => { const Icon = c.icon; return (
          <div key={c.label} className="panel p-5">
            <div className="flex items-start justify-between"><div className="rounded-xl bg-cb-panel2 p-2.5 text-cb-amber"><Icon size={19}/></div><ArrowUpRight size={16} className="text-slate-700"/></div>
            <div className="mt-5 text-2xl font-bold">{c.value}</div>
            <div className="mt-1 text-sm text-slate-300">{c.label}</div>
            <div className="mt-3 font-mono text-[10px] uppercase tracking-wider text-slate-600">{c.note}</div>
          </div>
        )})}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section className="panel p-5">
          <div className="mb-5 flex items-center justify-between">
            <div><div className="mono-label">REVENUE</div><h2 className="mt-1 text-lg font-semibold">Ingresos por mes</h2></div>
            <div className="text-xs text-slate-500">MXN</div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart}>
                <CartesianGrid stroke="#203139" strokeDasharray="3 3" />
                <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip contentStyle={{ background: "#0d181d", border: "1px solid #203139", borderRadius: 12 }} />
                <Legend />
                <Line type="monotone" dataKey="pagos" stroke="#f2a950" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="mantenimiento" stroke="#2dd4bf" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel p-5">
          <div className="mb-5"><div className="mono-label">NEXT ACTIONS</div><h2 className="mt-1 text-lg font-semibold">Próximas entregas</h2></div>
          <div className="space-y-3">
            {upcoming.map(p => (
              <div key={p.id} className="rounded-xl border border-cb-line bg-cb-bg p-3">
                <div className="flex items-start justify-between gap-3">
                  <div><div className="font-semibold">{p.name}</div><div className="mt-1 text-xs text-cb-muted">{p.client}</div></div>
                  <span className="rounded-full bg-cb-amber/10 px-2 py-1 font-mono text-[10px] text-cb-amber">{p.estimatedDelivery}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-xl border border-cb-line bg-cb-panel2 p-3 text-xs text-slate-400">
            <CalendarClock size={15} className="mb-2 text-cb-teal" />
            También revisa mantenimientos próximos y proyectos sin actividad reciente.
          </div>
        </section>
      </div>
    </div>
  );
}
