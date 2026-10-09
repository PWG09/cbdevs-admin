import {NextResponse} from "next/server";import {createClient} from "@supabase/supabase-js";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function POST(req:Request){try{
 const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"").trim();if(!token)return NextResponse.json({error:"Sesión requerida."},{status:401});
 const body=await req.json().catch(()=>null);const organizationId=typeof body?.organizationId==="string"?body.organizationId:"";const name=typeof body?.name==="string"?body.name.trim():"";const email=typeof body?.email==="string"?body.email.trim().toLowerCase():"";const role=body?.role;
 if(!organizationId||name.length<2||name.length>120||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!["admin","empleado"].includes(role))return NextResponse.json({error:"Datos no válidos."},{status:400});
 const url=process.env.CBDEVS_CENTRAL_SUPABASE_URL,key=process.env.CBDEVS_CENTRAL_SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)return NextResponse.json({error:"Backend central no configurado."},{status:503});
 const db=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});const {data:{user},error:authError}=await db.auth.getUser(token);if(authError||!user)return NextResponse.json({error:"Sesión inválida."},{status:401});
 const {data:membership}=await db.from("organization_members").select("role,status").eq("organization_id",organizationId).eq("user_id",user.id).eq("status","active").maybeSingle();
 if(!membership||!["owner","admin"].includes(membership.role))return NextResponse.json({error:"Solo un propietario o administrador puede invitar miembros."},{status:403});
 const {data:app}=await db.from("organization_apps").select("enabled").eq("organization_id",organizationId).eq("app_key","admin").maybeSingle();if(!app?.enabled)return NextResponse.json({error:"Admin no está habilitado para esta organización."},{status:403});
 const {data:invite,error:inviteError}=await db.auth.admin.inviteUserByEmail(email,{data:{display_name:name,name}});if(inviteError||!invite.user)return NextResponse.json({error:"No se pudo enviar la invitación. Verifica el correo y la configuración de email."},{status:400});
 const {error:memberError}=await db.from("organization_members").insert({organization_id:organizationId,user_id:invite.user.id,role:role==="admin"?"admin":"manager",status:"active"});if(memberError){console.error("[ADMIN_INVITE_MEMBERSHIP_FAILED]",memberError.message);return NextResponse.json({error:"Se envió la invitación, pero no se pudo asignar el acceso. Contacta al administrador."},{status:500})}
 return NextResponse.json({ok:true},{status:201});
}catch(e){console.error("[ADMIN_INVITE_FAILED]",e);return NextResponse.json({error:"No se pudo completar la invitación."},{status:500})}}
