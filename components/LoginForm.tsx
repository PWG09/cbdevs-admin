"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { getAuthClient } from "@/lib/firebase";
import { ShieldCheck, Terminal } from "lucide-react";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const auth = getAuthClient();
      if (!auth) throw new Error("Firebase Auth not initialized. Please check environment variables.");
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.replace("/dashboard");
    } catch (err: any) {
      setError(err?.code === "auth/invalid-credential"
        ? "Correo o contraseña incorrectos."
        : err?.message || "No fue posible iniciar sesión.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center bg-cb-bg px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-cb-line bg-cb-panel">
            <Terminal className="text-cb-amber" />
          </div>
          <div className="font-mono text-2xl font-bold tracking-tight">CB<span className="text-cb-amber">|</span>DEVS</div>
          <div className="mt-2 text-sm text-cb-muted">Internal Operations</div>
        </div>

        <form onSubmit={submit} className="panel p-6">
          <div className="mb-6">
            <div className="mono-label">AUTH / INTERNAL</div>
            <h1 className="mt-2 text-2xl font-bold">Iniciar sesión</h1>
            <p className="mt-1 text-sm text-cb-muted">Acceso exclusivo para el equipo CBDEVS.</p>
          </div>

          <label className="mb-4 block text-sm">
            <span className="mb-2 block text-slate-300">Correo</span>
            <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </label>

          <label className="mb-5 block text-sm">
            <span className="mb-2 block text-slate-300">Contraseña</span>
            <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </label>

          {error && <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}

          <button className="btn-primary w-full" disabled={loading}>
            <ShieldCheck size={17} />
            {loading ? "Validando..." : "Entrar al dashboard"}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-slate-600">Sin registro público · Firebase Auth</p>
      </div>
    </main>
  );
}
