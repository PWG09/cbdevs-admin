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
    console.error("Firebase Admin missing environment variables:", {
      projectId: !!projectId,
      clientEmail: !!clientEmail,
      privateKey: !!privateKey,
    });
    return null;
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
  } catch (e) {
    console.error("Firebase Admin init error:", e);
    return null;
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
