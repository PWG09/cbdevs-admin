"use client";
import { useEffect,useState } from "react";
import { usePathname,useRouter } from "next/navigation";
import { getSupabaseClient,getCurrentProfile } from "@/lib/supabase/client";
import { AlertTriangle } from "lucide-react";
import type { UserProfile } from "@/lib/types";
export default function AuthGuard({children}:{children:React.ReactNode}){
 const router=useRouter(),pathname=usePathname();const [ready,setReady]=useState(false);const [profile,setProfile]=useState<UserProfile|null>(null);const [configError,setConfigError]=useState(false);
 useEffect(()=>{let mounted=true;let subscription:{unsubscribe:()=>void}|undefined;
 try{const supabase=getSupabaseClient();const load=async()=>{try{const {data:{user}}=await supabase.auth.getUser();if(!user){if(mounted){setProfile(null);setReady(true);router.replace("/login")}return;}const p=await getCurrentProfile();if(mounted){setProfile(p);setReady(true)}}catch{if(mounted){setProfile(null);setReady(true);await supabase.auth.signOut();router.replace("/login")}}};
 const result=supabase.auth.onAuthStateChange((_event,session)=>{if(!session?.user){if(mounted){setProfile(null);setReady(true);router.replace("/login")}}else void load()});subscription=result.data.subscription;void load();
 }catch{if(mounted){setConfigError(true);setReady(true)}}return()=>{mounted=false;subscription?.unsubscribe()}},[router,pathname]);
 if(!ready)return <div className="min-h-screen grid place-items-center bg-cb-bg text-cb-muted">Cargando sesión...</div>;
 if(configError)return <div className="min-h-screen grid place-items-center bg-cb-bg p-6"><div className="panel max-w-md p-8 text-center"><AlertTriangle className="mx-auto mb-4 text-red-400"/><h1 className="text-xl font-bold">Falta configurar Supabase</h1><p className="mt-2 text-sm text-slate-400">Configura las variables de conexión central en Vercel.</p></div></div>;
 if(!profile)return null;return <>{children}</>;
}
