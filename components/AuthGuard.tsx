"use client";

import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getAuthClient, getDbClient } from "@/lib/firebase";
import { AlertTriangle } from "lucide-react";
import type { UserProfile } from "@/lib/types";

export default function AuthGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [configError, setConfigError] = useState(false);

  useEffect(() => {
    const auth = getAuthClient();
    if (!auth) {
      console.error("Firebase Auth not initialized. Check your environment variables in Vercel.");
      setConfigError(true);
      setReady(true);
      return;
    }
    return onAuthStateChanged(auth, async (user: User | null) => {
      if (!user) {
        setProfile(null);
        setReady(true);

        if (pathname !== "/login") {
          router.replace("/login");
        }

        return;
      }

      try {
        const db = getDbClient();
        if (!db) throw new Error("Firestore not initialized");
        const snap = await getDoc(doc(db, "users", user.uid));

        if (!snap.exists()) {
          const auth = getAuthClient();
          if (auth) await signOut(auth);
          router.replace("/login");
          return;
        }

        const p = {
          id: user.uid,
          ...snap.data(),
        } as UserProfile;

        // Usuario desactivado
        if (!p.active) {
          const auth = getAuthClient();
          if (auth) await signOut(auth);
          router.replace("/login");
          return;
        }

        // Solo administradores pueden acceder al dashboard
        if (p.role !== "admin") {
          const auth = getAuthClient();
          if (auth) await signOut(auth);
          router.replace("/login");
          return;
        }

        setProfile(p);
        setReady(true);
      } catch (error) {
        console.error("Error verificando sesión:", error);

        const auth = getAuthClient();
        if (auth) await signOut(auth);
        router.replace("/login");
      }
    });
  }, [pathname, router]);

  if (!ready) {
    return (
      <div className="min-h-screen grid place-items-center bg-cb-bg text-cb-muted">
        Cargando sesión...
      </div>
    );
  }

  if (configError) {
    return (
      <div className="min-h-screen grid place-items-center bg-cb-bg p-6 text-center">
        <div className="panel max-w-md p-8">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-red-500/10 text-red-500">
            <AlertTriangle size={24} />
          </div>
          <h1 className="text-xl font-bold text-white">Error de Configuración</h1>
          <p className="mt-2 text-sm text-slate-400">
            No se pudieron cargar las llaves de Firebase. Por favor, verifica las variables de entorno en Vercel.
          </p>
          <div className="mt-6 font-mono text-[10px] uppercase tracking-wider text-slate-600">
            Firebase Initialization Failed
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}