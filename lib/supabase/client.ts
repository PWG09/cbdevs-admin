import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;
export function getSupabaseClient(): SupabaseClient {
  if (browserClient) return browserClient;
  const url=process.env.NEXT_PUBLIC_CBDEVS_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_CBDEVS_SUPABASE_ANON_KEY;
  if(!url||!key) throw new Error("Falta configurar la conexión central de Supabase.");
  browserClient=createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  return browserClient;
}
export async function getCurrentOrganization(appKey="admin"):Promise<string>{
 const supabase=getSupabaseClient();
 const {data:{user},error:authError}=await supabase.auth.getUser();
 if(authError||!user)throw new Error("Inicia sesión para continuar.");
 const {data:members,error}=await supabase.from("organization_members").select("organization_id,status").eq("user_id",user.id).eq("status","active");
 if(error)throw new Error("No se pudieron verificar tus permisos.");
 for(const m of members||[]){
  const {data:app}=await supabase.from("organization_apps").select("enabled").eq("organization_id",m.organization_id).eq("app_key",appKey).maybeSingle();
  if(app?.enabled)return m.organization_id;
 }
 throw new Error("Tu cuenta no tiene acceso activo a esta aplicación.");
}
export async function getCurrentProfile(){
 const supabase=getSupabaseClient();
 const {data:{user},error:authError}=await supabase.auth.getUser();
 if(authError||!user)throw new Error("Inicia sesión.");
 const {data:profile,error}=await supabase.from("profiles").select("id,display_name,email,avatar_url,created_at").eq("id",user.id).single();
 if(error)throw error;
 const {data:members,error:memberError}=await supabase.from("organization_members").select("organization_id,role,status").eq("user_id",user.id).eq("status","active");
 if(memberError)throw memberError;
 for(const m of members||[]){
  const {data:app}=await supabase.from("organization_apps").select("enabled").eq("organization_id",m.organization_id).eq("app_key","admin").maybeSingle();
  if(app?.enabled)return {id:user.id,name:profile.display_name||user.email||"Usuario",email:profile.email||user.email||"",role:m.role==="owner"||m.role==="admin"?"admin":"empleado",active:true,createdAt:profile.created_at,organizationId:m.organization_id};
 }
 throw new Error("Tu cuenta no tiene permisos para CBDEVS Admin.");
}
