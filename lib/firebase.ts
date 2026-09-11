import { initializeApp, getApp, FirebaseApp } from "firebase/app";
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

// Use a unique name for the app to avoid conflicts with other Firebase instances
// that might be initialized by the SDK or other libraries in the Next.js bundle.
const APP_NAME = "cbdevs-admin-app";

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
    // We use a named app to isolate our instance and prevent "Component not registered" errors
    app = initializeApp(firebaseConfig, APP_NAME);
    return app;
  } catch (e: any) {
    try {
      app = getApp(APP_NAME);
      return app;
    } catch (innerError) {
      console.error("[Firebase] Fatal App Initialization Error:", innerError);
      return null;
    }
  }
}

export function getAuthClient() {
  if (auth) return auth;

  const appInstance = getFirebaseApp();
  if (!appInstance) return null;

  try {
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
