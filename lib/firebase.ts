import { initializeApp, getApp, getApps, FirebaseApp } from "firebase/app";
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

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

export function getFirebaseApp() {
  if (app) return app;
  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    return app;
  } catch (e) {
    console.error("[Firebase] App init error:", e);
    return null;
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
    console.error("[Firebase] Auth init error:", e);
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
    console.error("[Firebase] DB init error:", e);
    return null;
  }
}