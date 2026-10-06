import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

export async function requireQuoteUser(request: Request) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw new Error("UNAUTHORIZED");

  const auth = await getAdminAuth();
  const db = await getAdminDb();
  if (!auth || !db) throw new Error("SERVER_CONFIG");

  let decoded;
  try { decoded = await auth.verifyIdToken(token); }
  catch { throw new Error("UNAUTHORIZED"); }

  const snap = await db.doc("users/" + decoded.uid).get();
  const profile = snap.exists ? snap.data() : null;
  if (!profile?.active || !["admin", "empleado"].includes(profile.role)) throw new Error("FORBIDDEN");

  return { uid: decoded.uid, name: profile.name || decoded.name || decoded.email || "Usuario", role: profile.role };
}
