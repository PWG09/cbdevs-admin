"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";

export default function InitialSetupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const supabase = getSupabaseClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (signInError || !data.user) throw new Error("No se pudo validar la cuenta. Verifica el correo y la contraseña.");
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("No se pudo obtener una sesión segura. Inicia sesión de nuevo.");

      const response = await fetch("/api/bootstrap", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ displayName: displayName.trim() }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "No se pudo inicializar CBDEVS.");
      router.replace("/dashboard");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo completar la inicialización.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center bg-cb-bg px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="font-mono text-2xl font-bold tracking-tight">CB<span className="text-cb-amber">|</span>DEVS</div>
          <p className="mt-2 text-sm text-cb-muted">Configuración inicial segura</p>
        </div>
        <form onSubmit={submit} className="panel p-6">
          <h1 className="text-xl font-bold">Inicializar propietario</h1>
          <p className="mt-2 mb-6 text-sm text-cb-muted">
            Disponible únicamente para el correo inicial autorizado en la configuración privada de Vercel.
          </p>
          <label className="mb-4 block text-sm">
            <span className="mb-2 block text-slate-300">Nombre</span>
            <input className="input" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={120} autoComplete="name" />
          </label>
          <label className="mb-4 block text-sm">
            <span className="mb-2 block text-slate-300">Correo autorizado</span>
            <input className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="username" />
          </label>
          <label className="mb-5 block text-sm">
            <span className="mb-2 block text-slate-300">Contraseña de Supabase Auth</span>
            <input className="input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" />
          </label>
          {error && <div role="alert" className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? "Validando e inicializando…" : "Inicializar CBDEVS"}
          </button>
        </form>
      </div>
    </main>
  );
}
