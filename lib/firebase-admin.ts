import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { App } from "firebase-admin/app";

function getAdminApp(): App {
  if (getApps().length) return getApps()[0];

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    // During build time, Vercel might not have these variables.
    // We throw a descriptive error or return a dummy if we can't initialize.
    // But for the build to pass, we must not crash the module evaluation.
    console.warn("Firebase Admin environment variables are missing. App will fail at runtime if not provided.");

    // To prevent the build from crashing, we can't call cert() with missing values.
    // We initialize with a dummy config if necessary, but the best way is to
    // only call this when the request comes in.
    return initializeApp({
      credential: cert({
        projectId: projectId || "dummy",
        clientEmail: clientEmail || "dummy",
        privateKey: privateKey || "dummy",
      }),
    });
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

// We use a getter to avoid initializing at the top level during build
export const adminApp = {
  get instance() {
    return getAdminApp();
  }
};

export const adminAuth = {
  get instance() {
    return getAuth(adminApp.instance);
  }
};

export const adminDb = {
  get instance() {
    return getFirestore(adminApp.instance);
  }
};
