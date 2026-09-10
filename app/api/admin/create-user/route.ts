import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { idToken } = body;

    // Client must send the current Firebase ID token.
    // This endpoint verifies it server-side before creating another Auth user.
    if (!idToken) return NextResponse.json({ error: "Falta idToken." }, { status: 401 });

    const decoded = await adminAuth.verifyIdToken(idToken);
    const adminSnap = await adminDb.doc(`users/${decoded.uid}`).get();
    if (!adminSnap.exists || adminSnap.data()?.role !== "admin" || adminSnap.data()?.active !== true) {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }

    const { name, email, password, role } = body;
    if (!name || !email || !password || !["admin", "empleado"].includes(role)) {
      return NextResponse.json({ error: "Datos incompletos." }, { status: 400 });
    }

    const user = await adminAuth.createUser({ email, password, displayName: name });
    await adminDb.doc(`users/${user.uid}`).set({
      name, email, role, active: true, createdAt: FieldValue.serverTimestamp()
    });

    return NextResponse.json({ ok: true, uid: user.uid });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error?.message || "Error del servidor." }, { status: 500 });
  }
}
