import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

let cachedApp = null;
let cachedAuth = null;
let cachedDb = null;

export async function getAdminApp() {
  if (cachedApp) return cachedApp;

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    // During Vercel build, we return null to avoid crashing the build process.
    // The actual requests will only happen at runtime.
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

export async function getAdminAuth() {
  const app = await getAdminApp();
  if (!app) return null;
  if (!cachedAuth) cachedAuth = getAuth(app);
  return cachedAuth;
}

export async function getAdminDb() {
  const app = await getAdminApp();
  if (!app) return null;
  if (!cachedDb) cachedDb = getFirestore(app);
  return cachedDb;
}
