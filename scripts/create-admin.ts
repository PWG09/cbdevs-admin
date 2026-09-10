import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

// --- CONFIGURACIÓN DEL NUEVO ADMIN ---
const NEW_ADMIN = {
  email: "admin@cbdevs.com", // Cambia esto por el correo que quieras
  password: "Password123!",   // Cambia esto por una contraseña segura
  name: "Super Administrador",
};
// ------------------------------------

const app = getApps().length ? getApps()[0] : initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  })
});

const db = getFirestore(app);
const auth = getAuth(app);

async function createAdmin() {
  try {
    console.log(`🚀 Iniciando creación de admin: ${NEW_ADMIN.email}...`);

    let userRecord;

    try {
      // 1. Intentar crear el usuario en Firebase Authentication
      userRecord = await auth.createUser({
        email: NEW_ADMIN.email,
        password: NEW_ADMIN.password,
        displayName: NEW_ADMIN.name,
      });
      console.log(`✅ Usuario creado en Auth. UID: ${userRecord.uid}`);
    } catch (error: any) {
      if (error.code === 'auth/email-already-exists') {
        console.log(`ℹ️ El usuario ya existe en Auth. Recuperando UID...`);
        userRecord = await auth.getUserByEmail(NEW_ADMIN.email);
        console.log(`✅ UID recuperado: ${userRecord.uid}`);
      } else {
        throw error;
      }
    }

    // 2. Crear el documento de perfil en Firestore (siempre lo hace para asegurar el rol de admin)
    await db.doc(`users/${userRecord.uid}`).set({
      name: NEW_ADMIN.name,
      email: NEW_ADMIN.email,
      role: "admin",
      active: true,
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    console.log(`✅ Perfil de Administrador creado/actualizado en Firestore.`);
    console.log(`\n🎉 ¡Éxito! Ya puedes iniciar sesión con:`);
    console.log(`📧 Email: ${NEW_ADMIN.email}`);
    console.log(`🔑 Pass: ${NEW_ADMIN.password}`);

  } catch (error: any) {
    console.error("❌ Error inesperado:", error);
    process.exit(1);
  }
}

createAdmin();
