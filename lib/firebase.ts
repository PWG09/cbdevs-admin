import { initializeApp, getApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

const firebaseConfig = Object.freeze({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
});

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

export function getFirebaseApp() {
  if (app) return app;

  if (!firebaseConfig.apiKey) {
    console.error("[Firebase] Missing API Key! Check NEXT_PUBLIC_FIREBASE_API_KEY in Vercel.");
    return null;
  }

  try {
    // In Next.js App Router, the most stable way to handle Firebase initialization
    // is to check getApps() and only initialize if the list is empty.
    // We use the default app because named apps can sometimes cause issues
    // with internal SDK component registration.
    const apps = getApps();
    if (apps.length > 0) {
      app = apps[0];
    } else {
      app = initializeApp(firebaseConfig);
    }
    return app;
  } catch (e) {
    console.error("[Firebase] Fatal App Initialization Error:", e);
    return null;
  }
}

export function getAuthClient() {
  if (auth) return auth;

  const appInstance = getFirebaseApp();
  if (!appInstance) return null;

  try {
    // IMPORTANT: We pass the appInstance explicitly.
    // If this still fails with "not registered", it means the firebase/auth
    // package is being loaded from a different location than firebase/app.
    auth = getAuth(appInstance);
    return auth;
  } catch (e) {
    console.error("[Firebase] Auth Registration Error:", e);
    return null;
  }
}

export function getDbClient() {
  if (db) return db;

  const appInstance = getFirebaseApp();
  if (!appInstance) return null;

  try {
    db = getFirestore(appInstance);
    return db;
  } catch (e) {
    console.error("[Firebase] Firestore Registration Error:", e);
    return null;
  }
}
