import { cert, getApps, initializeApp, App } from "firebase-admin/app";
import { getAuth, Auth } from "firebase-admin/auth";
import { getFirestore, Firestore } from "firebase-admin/firestore";

let cachedApp: App | null = null;
let cachedAuth: Auth | null = null;
let cachedDb: Firestore | null = null;

export async function getAdminApp(): Promise<App | null> {
  if (cachedApp) return cachedApp;
  if (getApps().length > 0) {
    cachedApp = getApps()[0];
    return cachedApp;
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    const missing = [];
    if (!projectId) missing.push("FIREBASE_ADMIN_PROJECT_ID");
    if (!clientEmail) missing.push("FIREBASE_ADMIN_CLIENT_EMAIL");
    if (!privateKey) missing.push("FIREBASE_ADMIN_PRIVATE_KEY");

    throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  }

  try {
    cachedApp = initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
    return cachedApp;
  } catch (e: any) {
    console.error("Firebase Admin init error:", e);
    throw new Error(`Firebase Admin init failed: ${e.message}`);
  }
}

export async function getAdminAuth(): Promise<Auth | null> {
  const app = await getAdminApp();
  if (!app) return null;
  if (!cachedAuth) cachedAuth = getAuth(app);
  return cachedAuth;
}

export async function getAdminDb(): Promise<Firestore | null> {
  const app = await getAdminApp();
  if (!app) return null;
  if (!cachedDb) cachedDb = getFirestore(app);
  return cachedDb;
}
