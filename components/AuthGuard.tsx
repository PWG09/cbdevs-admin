"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, LogOut, RefreshCw } from "lucide-react";
import { getSupabaseClient, getCurrentProfile } from "@/lib/supabase/client";
import type { UserProfile } from "@/lib/types";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [configError, setConfigError] = useState(false);
  const [accessError, setAccessError] = useState("");
  const [checking, setChecking] = useState(false);

  async function validateAccess() {
    setChecking(true);
    setAccessError("");
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.getUser();

      if (error || !data.user) {
        setProfile(null);
        setReady(true);
        router.replace("/login");
        return;
      }

      // A profile/permissions lookup failure must not silently destroy a valid
      // Supabase session. Show the actual access problem so it can be diagnosed.
      const currentProfile = await getCurrentProfile();
      setProfile(currentProfile);
      setReady(true);
    } catch (error) {
      console.error("[CBDEVS_AUTH_GUARD] Access validation failed", error);
      setProfile(null);
      setAccessError(
        error instanceof Error
          ? error.message
          : "No se pudieron verificar tus permisos. Intenta de nuevo."
      );
      setReady(true);
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    let subscription: { unsubscribe: () => void } | undefined;

    try {
      const supabase = getSupabaseClient();

      // Do not perform Supabase queries inside onAuthStateChange: doing so can
      // contend with the auth client's internal lock. The initial validation
      // below handles signed-in sessions; this listener only handles sign-out.
      const result = supabase.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_OUT" && mounted) {
          setProfile(null);
          setReady(true);
          router.replace("/login");
        }
      });
      subscription = result.data.subscription;
      void validateAccess();
    } catch (error) {
      console.error("[CBDEVS_AUTH_GUARD] Supabase client configuration failed", error);
      if (mounted) {
        setConfigError(true);
        setReady(true);
      }
    }

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  // validateAccess is intentionally run once per protected-layout mount.
  // Re-running it on every pathname change caused unnecessary auth races.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function returnToLogin() {
    try {
      await getSupabaseClient().auth.signOut();
    } finally {
      router.replace("/login");
    }
  }

  if (!ready) {
    return (
      <div className="min-h-screen grid place-items-center bg-cb-bg text-cb-muted">
        Cargando sesión...
      </div>
    );
  }

  if (configError) {
    return (
      <div className="min-h-screen grid place-items-center bg-cb-bg p-6">
        <div className="panel max-w-md p-8 text-center">
          <AlertTriangle className="mx-auto mb-4 text-red-400" />
          <h1 className="text-xl font-bold">Falta configurar Supabase</h1>
          <p className="mt-2 text-sm text-slate-400">
            Verifica las variables de conexión central en la configuración de Vercel.
          </p>
        </div>
      </div>
    );
  }

  if (accessError) {
    return (
      <div className="min-h-screen grid place-items-center bg-cb-bg p-6">
        <div className="panel w-full max-w-lg p-8">
          <AlertTriangle className="mb-4 text-amber-400" />
          <h1 className="text-xl font-bold">No se pudo verificar el acceso</h1>
          <p className="mt-2 text-sm text-slate-400">
            La sesión existe, pero no fue posible confirmar el perfil o los permisos de esta cuenta.
            No cerramos tu sesión automáticamente.
          </p>
          <div role="alert" className="mt-4 rounded-xl border border-cb-line bg-cb-bg p-3 text-sm text-slate-300">
            {accessError}
          </div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button className="btn-primary" onClick={() => void validateAccess()} disabled={checking}>
              <RefreshCw size={16} className={checking ? "animate-spin" : ""} />
              {checking ? "Verificando..." : "Reintentar"}
            </button>
            <button className="btn-ghost" onClick={() => void returnToLogin()}>
              <LogOut size={16} />
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) return null;
  return <>{children}</>;
}
