import { NextRequest, NextResponse } from "next/server";
import { requireQuoteUser } from "@/lib/quote-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MODEL = process.env.OPENAI_MODEL || "gpt-6-luna";

export async function POST(req: NextRequest) {
  try {
    const user = await requireQuoteUser(req);
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Agrega OPENAI_API_KEY en Vercel." }, { status: 503 });

    const body = await req.json();
    const text = (v: unknown, n: number) => typeof v === "string" ? v.trim().slice(0, n) : "";
    const input = {
      businessType: text(body.businessType, 150),
      businessDescription: text(body.businessDescription, 1200),
      goal: text(body.goal, 1200),
      services: text(body.services, 1200),
      pages: text(body.pages, 1200),
      features: text(body.features, 1200),
      integrations: text(body.integrations, 1200),
      targetMarket: text(body.targetMarket, 300),
      deadline: text(body.deadline, 120),
      budget: text(body.budget, 120),
      currency: text(body.currency, 10) || "MXN",
      notes: text(body.notes, 1200)
    };

    if (!input.businessType || !input.businessDescription || !input.goal) {
      return NextResponse.json({ error: "Completa tipo de negocio, descripción y objetivo." }, { status: 400 });
    }

    const prompt = [
      "Eres el cotizador interno de CBDEVS, una agencia profesional de desarrollo web y software.",
      "Genera una cotización preliminar para que un vendedor la revise antes de enviarla.",
      "Usa precios realistas para una agencia mexicana y la moneda indicada.",
      "No inventes requisitos. Declara supuestos cuando falte información.",
      "Separa desarrollo inicial y mantenimiento mensual.",
      "El desglose debe sumar aproximadamente el precio recomendado.",
      "Si el presupuesto es menor, indica qué alcance reducir.",
      "No prometas fechas exactas ni resultados. Responde en español.",
      "Devuelve SOLO un objeto JSON con summary, recommendedPrice, minimumPrice, maximumPrice, currency, monthlyMaintenance, timelineWeeks, complexity, confidence, breakdown, included, assumptions, risks, scopeReduction y salesNotes.",
      "DATOS DEL CLIENTE:",
      JSON.stringify(input, null, 2)
    ].join("\n");

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
      body: JSON.stringify({
        model: MODEL,
        input: [
          { role: "system", content: "Eres especialista senior en estimación de proyectos digitales y ventas B2B para CBDEVS." },
          { role: "user", content: prompt }
        ],
        max_output_tokens: 2200
      })
    });

    if (!response.ok) {
      console.error("[AI_QUOTE_PROVIDER_ERROR]", response.status);
      return NextResponse.json({ error: "La IA rechazó la solicitud. Revisa OPENAI_MODEL y OPENAI_API_KEY." }, { status: 502 });
    }

    const data = await response.json();
    const output = typeof data.output_text === "string" ? data.output_text.trim() : "";
    if (!output) return NextResponse.json({ error: "La IA devolvió una respuesta vacía." }, { status: 502 });

    const start = output.indexOf("{");
    const end = output.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("INVALID_AI_JSON");
    const quote = JSON.parse(output.slice(start, end + 1));

    return NextResponse.json({ quote, generatedBy: user.name, model: MODEL });
  } catch (error: any) {
    const code = error?.message;
    if (code === "UNAUTHORIZED") return NextResponse.json({ error: "Sesión inválida o expirada." }, { status: 401 });
    if (code === "FORBIDDEN") return NextResponse.json({ error: "No tienes permisos para usar el cotizador." }, { status: 403 });
    if (code === "SERVER_CONFIG") return NextResponse.json({ error: "Configuración del servidor incompleta." }, { status: 500 });
    console.error("[AI_QUOTE_ERROR]", error);
    return NextResponse.json({ error: "No se pudo generar la cotización." }, { status: 500 });
  }
}
