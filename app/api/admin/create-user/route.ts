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

    if (!auth || !db) {
      return NextResponse.json({ error: "Error de configuración del servidor." }, { status: 500 });
    }

    const decoded = await auth.verifyIdToken(idToken);
    const adminSnap = await db.doc(`users/${decoded.uid}`).get();
    if (!adminSnap.exists || adminSnap.data()?.role !== "admin" || adminSnap.data()?.active !== true) {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }

    const { name, email, password, role } = body;
    if (!name || !email || !password || !["admin", "empleado"].includes(role)) {
      return NextResponse.json({ error: "Datos incompletos." }, { status: 400 });
    }

    const user = await auth.createUser({ email, password, displayName: name });
    await db.doc(`users/${user.uid}`).set({
      name, email, role, active: true, createdAt: FieldValue.serverTimestamp()
    });

    return NextResponse.json({ ok: true, uid: user.uid });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error?.message || "Error del servidor." }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
