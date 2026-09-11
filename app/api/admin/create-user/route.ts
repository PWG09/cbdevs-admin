import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { idToken } = body;

    // Client must send the current Firebase ID token.
    if (!idToken) return NextResponse.json({ error: "Falta idToken." }, { status: 401 });

    const auth = await getAdminAuth();
    const db = await getAdminDb();

    let decoded;
    try {
      decoded = await auth.verifyIdToken(idToken);
    } catch (e: any) {
      return NextResponse.json({ error: "Token de sesión inválido o expirado." }, { status: 401 });
    }

    const adminSnap = await db.doc(`users/${decoded.uid}`).get();
    if (!adminSnap.exists || adminSnap.data()?.role !== "admin" || adminSnap.data()?.active !== true) {
      return NextResponse.json({ error: "No tienes permisos de administrador activo." }, { status: 403 });
    }

    const { name, email, password, role } = body;
    if (!name || !email || !password || !["admin", "empleado"].includes(role)) {
      return NextResponse.json({ error: "Datos incompletos o rol no válido." }, { status: 400 });
    }

    try {
      const user = await auth.createUser({ email, password, displayName: name });
      await db.doc(`users/${user.uid}`).set({
        name, email, role, active: true, createdAt: FieldValue.serverTimestamp()
      });

      return NextResponse.json({ ok: true, uid: user.uid });
    } catch (e: any) {
      if (e.code === 'auth/email-already-exists') {
        return NextResponse.json({ error: "El correo electrónico ya está registrado." }, { status: 400 });
      }
      throw e;
    }
  } catch (error: any) {
    console.error("[CREATE_USER_ERROR]:", error);
    return NextResponse.json({ error: error?.message || "Error interno del servidor." }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
