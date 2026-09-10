"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { getAuthClient, getDbClient } from "@/lib/firebase";
import { BarChart3, FolderKanban, MessageSquare, Users, Settings, LogOut, Menu, X, Terminal } from "lucide-react";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import type { UserProfile } from "@/lib/types";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/projects", label: "Proyectos", icon: FolderKanban },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/team", label: "Equipo", icon: Users, admin: true },
  { href: "/settings", label: "Perfil / Config.", icon: Settings },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const auth = getAuthClient();
    const db = getDbClient();
    if (!auth || !db || !auth.currentUser) return;
    getDoc(doc(db, "users", auth.currentUser.uid)).then(s => {
      if (s.exists()) setProfile({ id: s.id, ...s.data() } as UserProfile);
    });
  }, []);

  async function logout() {
    const auth = getAuthClient();
    if (!auth) return;
    await signOut(auth);
    router.replace("/login");
  }

  const currentAuth = getAuthClient();
  const initials = (profile?.name || currentAuth?.currentUser?.email || "U")
    .split(" ").map(x => x[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="min-h-screen bg-cb-bg">
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-cb-line bg-cb-panel p-4 transition-transform lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between px-2 py-3">
          <Link href="/dashboard" className="font-mono text-lg font-bold">CB<span className="text-cb-amber">|</span>DEVS</Link>
          <button className="lg:hidden" onClick={() => setOpen(false)}><X size={18}/></button>
        </div>
        <div className="my-5 h-px bg-cb-line" />
        <div className="px-2 pb-2 font-mono text-[10px] uppercase tracking-[.2em] text-slate-600">Workspace</div>
        <nav className="space-y-1">
          {items.filter(i => !i.admin || profile?.role === "admin").map(i => {
            const Icon = i.icon;
            const active = path === i.href || (i.href !== "/dashboard" && path.startsWith(i.href));
            return (
              <Link key={i.href} href={i.href} onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${active ? "bg-cb-amber/10 text-cb-amber" : "text-slate-400 hover:bg-cb-panel2 hover:text-white"}`}>
                <Icon size={18}/>{i.label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-cb-line bg-cb-bg p-3">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-cb-amber/15 font-mono text-xs text-cb-amber">{initials}</div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{profile?.name || "Usuario"}</div>
              <div className="text-xs text-cb-muted">{profile?.role || "..."}</div>
            </div>
            <button onClick={logout} title="Cerrar sesión" className="ml-auto text-slate-500 hover:text-white"><LogOut size={16}/></button>
          </div>
        </div>
      </aside>

      {open && <button className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setOpen(false)} aria-label="Cerrar menú" />}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-cb-line bg-cb-bg/90 px-4 backdrop-blur lg:px-8">
          <button className="lg:hidden" onClick={() => setOpen(true)}><Menu /></button>
          <div className="hidden font-mono text-xs text-slate-600 sm:block">CBDEVS / INTERNAL / {path.replace("/", "") || "dashboard"}</div>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-slate-300 sm:block">{profile?.name}</span>
            <div className="grid h-8 w-8 place-items-center rounded-full border border-cb-line bg-cb-panel font-mono text-xs text-cb-amber">{initials}</div>
          </div>
        </header>
        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
