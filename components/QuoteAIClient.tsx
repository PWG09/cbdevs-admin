"use client";

import { useMemo, useState } from "react";
import { getAuthClient } from "@/lib/firebase";
import { Bot, Calculator, Check, Clipboard, Copy, DollarSign, Loader2, RefreshCw, Sparkles, Target, Clock3 } from "lucide-react";

type Quote = {
  summary: string;
  recommendedPrice: number;
  minimumPrice: number;
  maximumPrice: number;
  currency: string;
  monthlyMaintenance: number;
  timelineWeeks: number;
  complexity: string;
  confidence: number;
  breakdown: { item: string; description: string; price: number }[];
  included: string[];
  assumptions: string[];
  risks: string[];
  scopeReduction: string[];
  salesNotes: string[];
};

const blank = {
  businessType: "", businessDescription: "", goal: "", services: "", pages: "",
  features: "", integrations: "", targetMarket: "", deadline: "", budget: "",
  currency: "MXN", notes: ""
};

const money = (n: number, c: string) => new Intl.NumberFormat("es-MX", {
  style: "currency", currency: c || "MXN", maximumFractionDigits: 0
}).format(Number(n) || 0);

export default function QuoteAIClient() {
  const [form, setForm] = useState(blank);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const set = (key: keyof typeof blank, value: string) => setForm(p => ({ ...p, [key]: value }));

  const quoteText = useMemo(() => {
    if (!quote) return "";
    return [
      "COTIZACIÓN PRELIMINAR — CBDEVS",
      "",
      quote.summary,
      "",
      "Desarrollo: " + money(quote.recommendedPrice, quote.currency),
      "Rango: " + money(quote.minimumPrice, quote.currency) + " - " + money(quote.maximumPrice, quote.currency),
      "Mantenimiento mensual: " + money(quote.monthlyMaintenance, quote.currency),
      "Tiempo estimado: " + quote.timelineWeeks + " semanas",
      "",
      "DESGLOSE",
      ...quote.breakdown.map(x => "• " + x.item + ": " + money(x.price, quote.currency) + " — " + x.description),
      "",
      "INCLUYE",
      ...quote.included.map(x => "• " + x)
    ].join("
");
  }, [quote]);

  async function generate() {
    setLoading(true); setError(""); setQuote(null);
    try {
      const auth = getAuthClient();
      if (!auth?.currentUser) throw new Error("Tu sesión expiró. Vuelve a iniciar sesión.");
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/quotes/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo generar la cotización.");
      setQuote(data.quote);
    } catch (e: any) {
      setError(e?.message || "Ocurrió un error.");
    } finally { setLoading(false); }
  }

  async function copy() {
    if (!quoteText) return;
    await navigator.clipboard.writeText(quoteText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  const Field = ({ label, k, placeholder, area = false, required = false }: any) => (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-300">{label}{required ? " *" : ""}</span>
      {area
        ? <textarea required={required} rows={3} className="input w-full resize-y" value={form[k as keyof typeof form]} onChange={e => set(k, e.target.value)} placeholder={placeholder} />
        : <input required={required} className="input w-full" value={form[k as keyof typeof form]} onChange={e => set(k, e.target.value)} placeholder={placeholder} />}
    </label>
  );

  return (
    <div className="mx-auto max-w-[1450px] space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mono-label">SALES / AI ESTIMATOR</div>
          <h1 className="mt-1 flex items-center gap-3 text-3xl font-bold">Cotizador IA <Sparkles size={23} className="text-cb-amber" /></h1>
          <p className="mt-1 text-sm text-cb-muted">Convierte la información de un prospecto en precio, alcance, mantenimiento y tiempo estimado.</p>
        </div>
        <button className="btn-ghost" onClick={() => { setForm(blank); setQuote(null); setError(""); }}><RefreshCw size={15}/> Nueva cotización</button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_.95fr]">
        <section className="panel p-5">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-xl bg-cb-amber/10 p-2.5 text-cb-amber"><Calculator size={19}/></div>
            <div><div className="font-semibold">Información del negocio</div><div className="text-xs text-slate-500">Completa lo que el prospecto pidió.</div></div>
          </div>

          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Tipo de negocio" k="businessType" placeholder="Restaurante, taller, clínica..." required />
              <label className="block"><span className="mb-1.5 block text-xs font-medium text-slate-300">Moneda</span>
                <select className="input w-full" value={form.currency} onChange={e => set("currency", e.target.value)}>
                  <option value="MXN">MXN — Pesos mexicanos</option><option value="CAD">CAD — Dólar canadiense</option><option value="USD">USD — Dólar estadounidense</option>
                </select>
              </label>
            </div>
            <Field label="¿Qué hace el negocio?" k="businessDescription" placeholder="Qué vende, quiénes son sus clientes y cómo trabajan." area required />
            <Field label="Objetivo del proyecto" k="goal" placeholder="Vender en línea, conseguir clientes, reservas, automatizar..." area required />
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Servicios / productos" k="services" placeholder="Paquetes, productos, membresías..." area />
              <Field label="Páginas / secciones" k="pages" placeholder="Inicio, servicios, contacto, blog..." area />
              <Field label="Funciones especiales" k="features" placeholder="Login, reservas, panel, pagos..." area />
              <Field label="Integraciones" k="integrations" placeholder="Stripe, WhatsApp, Maps, CRM..." area />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Mercado objetivo" k="targetMarket" placeholder="Local, México, Canadá..." />
              <Field label="Plazo deseado" k="deadline" placeholder="Ej. 4-6 semanas" />
              <Field label="Presupuesto del cliente" k="budget" placeholder="Opcional" />
            </div>
            <Field label="Notas del vendedor" k="notes" placeholder="Urgencia, objeciones, referencias, competencia..." area />
          </div>

          {error && <div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
          <button disabled={loading} onClick={generate} className="btn-primary mt-5 w-full justify-center py-3">
            {loading ? <><Loader2 size={17} className="animate-spin"/> Analizando...</> : <><Sparkles size={17}/> Generar cotización con IA</>}
          </button>
          <p className="mt-3 text-center text-[11px] text-slate-600">La IA genera una recomendación interna. Revisen alcance y precio antes de enviarla.</p>
        </section>

        <section>
          {!quote && !loading && <div className="panel flex min-h-[600px] flex-col items-center justify-center p-8 text-center">
            <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl border border-cb-line bg-cb-panel2 text-cb-amber"><Bot size={30}/></div>
            <h2 className="text-xl font-semibold">Tu cotización aparecerá aquí</h2>
            <p className="mt-2 max-w-md text-sm text-slate-500">La IA analizará el alcance y preparará una recomendación comercial.</p>
          </div>}

          {loading && <div className="panel flex min-h-[600px] flex-col items-center justify-center p-8 text-center">
            <Loader2 size={34} className="animate-spin text-cb-amber"/><h2 className="mt-4 text-xl font-semibold">Calculando...</h2><p className="mt-2 text-sm text-slate-500">Evaluando complejidad, esfuerzo y precio.</p>
          </div>}

          {quote && <div className="space-y-4">
            <div className="panel overflow-hidden">
              <div className="border-b border-cb-line bg-cb-panel2 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><div className="mono-label">RECOMMENDED QUOTE</div><div className="mt-2 text-4xl font-bold text-cb-amber">{money(quote.recommendedPrice, quote.currency)}</div><div className="text-xs text-slate-500">Rango: {money(quote.minimumPrice, quote.currency)} — {money(quote.maximumPrice, quote.currency)}</div></div>
                  <button className="btn-ghost" onClick={copy}>{copied ? <Check size={15}/> : <Copy size={15}/>} {copied ? "Copiado" : "Copiar"}</button>
                </div>
                <p className="mt-5 text-sm leading-6 text-slate-300">{quote.summary}</p>
              </div>
              <div className="grid grid-cols-2 divide-x divide-cb-line border-b border-cb-line md:grid-cols-4">
                <Metric icon={DollarSign} label="Mantenimiento" value={money(quote.monthlyMaintenance, quote.currency)}/>
                <Metric icon={Clock3} label="Tiempo" value={quote.timelineWeeks + " semanas"}/>
                <Metric icon={Target} label="Complejidad" value={quote.complexity}/>
                <Metric icon={Sparkles} label="Confianza" value={quote.confidence + "%"}/>
              </div>
              <div className="p-5"><h3 className="mb-3 font-semibold">Desglose</h3><div className="space-y-2">{(quote.breakdown || []).map((x,i) =>
                <div key={i} className="flex items-start justify-between gap-3 rounded-xl border border-cb-line bg-cb-bg p-3"><div><div className="text-sm font-medium">{x.item}</div><div className="mt-1 text-xs text-slate-500">{x.description}</div></div><div className="shrink-0 font-mono text-sm text-cb-amber">{money(x.price, quote.currency)}</div></div>
              )}</div></div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <List title="Incluye" items={quote.included} icon={Check}/>
              <List title="Supuestos" items={quote.assumptions} icon={Clipboard}/>
              <List title="Riesgos" items={quote.risks} icon={Target}/>
              <List title="Para bajar precio" items={quote.scopeReduction} icon={DollarSign}/>
            </div>

            <div className="panel p-5"><div className="flex items-center gap-2 text-sm font-semibold"><Clipboard size={15} className="text-cb-teal"/> Notas para ventas</div>
              <ul className="mt-3 space-y-2 text-xs text-slate-400">{(quote.salesNotes || []).map((x,i) => <li key={i}>• {x}</li>)}</ul>
            </div>
            <button className="btn-primary w-full justify-center" onClick={copy}>{copied ? <Check size={16}/> : <Copy size={16}/>} Copiar cotización comercial</button>
          </div>}
        </section>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: any) {
  return <div className="p-4"><div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-600"><Icon size={13}/>{label}</div><div className="mt-2 text-sm font-semibold">{value}</div></div>;
}

function List({ title, items, icon: Icon }: any) {
  return <div className="panel p-5"><div className="flex items-center gap-2 text-sm font-semibold"><Icon size={15} className="text-cb-amber"/>{title}</div><ul className="mt-3 space-y-2 text-xs leading-5 text-slate-400">{(items || []).map((x:string,i:number)=><li key={i}>• {x}</li>)}</ul></div>;
}
