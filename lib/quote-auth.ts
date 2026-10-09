import {createClient} from "@supabase/supabase-js";
export async function requireQuoteUser(request:Request){
 const header=request.headers.get("authorization")||"";const token=header.startsWith("Bearer ")?header.slice(7).trim():"";if(!token)throw new Error("UNAUTHORIZED");
 const url=process.env.CBDEVS_CENTRAL_SUPABASE_URL,key=process.env.CBDEVS_CENTRAL_SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error("SERVER_CONFIG");
 const supabase=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
 const {data:{user},error}=await supabase.auth.getUser(token);if(error||!user)throw new Error("UNAUTHORIZED");
 const {data:members}=await supabase.from("organization_members").select("organization_id,role,status").eq("user_id",user.id).eq("status","active");
 for(const m of members||[]){if(!["owner","admin","manager"].includes(m.role))continue;const {data:app}=await supabase.from("organization_apps").select("enabled").eq("organization_id",m.organization_id).eq("app_key","admin").maybeSingle();if(!app?.enabled)continue;const {data:profile}=await supabase.from("profiles").select("display_name,email").eq("id",user.id).maybeSingle();return{uid:user.id,name:profile?.display_name||user.email||"Usuario",role:m.role,organizationId:m.organization_id}}
 throw new Error("FORBIDDEN");
}
