"use client";

import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getAuthClient, getDbClient } from "@/lib/firebase";
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

  useEffect(() => {
    return onAuthStateChanged(getAuthClient()!, async (user: User | null) => {
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
          await signOut(auth);
          router.replace("/login");
          return;
        }

        const p = {
          id: user.uid,
          ...snap.data(),
        } as UserProfile;

        // Usuario desactivado
        if (!p.active) {
          await signOut(auth);
          router.replace("/login");
          return;
        }

        // Solo administradores pueden acceder al dashboard
        if (p.role !== "admin") {
          await signOut(auth);
          router.replace("/login");
          return;
        }

        setProfile(p);
        setReady(true);
      } catch (error) {
        console.error("Error verificando sesión:", error);

        await signOut(auth);
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

  return <>{children}</>;
}