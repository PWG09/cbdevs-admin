import { getApp, getApps, initializeApp, App } from "firebase/app";
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

let cachedApp: App | null = null;
let cachedAuth: Auth | null = null;
let cachedDb: Firestore | null = null;

export function getFirebaseApp() {
  if (cachedApp) return cachedApp;
  if (!firebaseConfig.apiKey) {
    console.warn("Firebase API Key missing. Skipping initialization.");
    return null;
  }
  cachedApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return cachedApp;
}

export function getAuthClient() {
  if (cachedAuth) return cachedAuth;
  const app = getFirebaseApp();
  if (!app) return null;
  cachedAuth = getAuth(app);
  return cachedAuth;
}

export function getDbClient() {
  if (cachedDb) return cachedDb;
  const app = getFirebaseApp();
  if (!app) return null;
  cachedDb = getFirestore(app);
  return cachedDb;
}

// For backward compatibility and simpler migration,
// we'll provide these but they might be null during build.
// Components should be updated to use the getters.
export const auth = getAuthClient();
export const db = getDbClient();
