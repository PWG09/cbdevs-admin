import { getApp, getApps, initializeApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;
let cachedDb: Firestore | null = null;

export function getFirebaseApp() {
  if (cachedApp) return cachedApp;
  if (!firebaseConfig.apiKey) {
    console.warn("Firebase API Key missing. Skipping initialization.");
    return null;
  }
  try {
    cachedApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
    return cachedApp;
  } catch (e) {
    console.error("Firebase App init error:", e);
    return null;
  }
}

export function getAuthClient() {
  if (cachedAuth) return cachedAuth;
  const app = getFirebaseApp();
  if (!app) return null;
  try {
    cachedAuth = getAuth(app);
    return cachedAuth;
  } catch (e) {
    console.error("Firebase Auth init error:", e);
    return null;
  }
}

export function getDbClient() {
  if (cachedDb) return cachedDb;
  const app = getFirebaseApp();
  if (!app) return null;
  try {
    cachedDb = getFirestore(app);
    return cachedDb;
  } catch (e) {
    console.error("Firebase Db init error:", e);
    return null;
  }
}

// REMOVED: export const auth = getAuthClient();
// REMOVED: export const db = getDbClient();
