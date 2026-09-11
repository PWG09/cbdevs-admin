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
    console.error("[Firebase] API Key is missing! Check your environment variables.");
    return null;
  }

  try {
    // Ensure we only initialize once and get a valid instance
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    cachedApp = app;
    return app;
  } catch (e) {
    console.error("[Firebase] Critical initialization error:", e);
    return null;
  }
}

export function getAuthClient() {
  // If we have a cached auth client, return it
  if (cachedAuth) return cachedAuth;

  // Force app initialization first
  const app = getFirebaseApp();
  if (!app) return null;

  try {
    // The error "Component auth has not been registered yet" happens when
    // getAuth is called before the Firebase app is fully ready or if
    // multiple versions of the SDK are fighting.
    cachedAuth = getAuth(app);
    return cachedAuth;
  } catch (e) {
    console.error("[Firebase] Auth client initialization error:", e);
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
    console.error("[Firebase] Firestore client initialization error:", e);
    return null;
  }
}
