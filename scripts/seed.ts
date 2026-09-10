import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const app = getApps().length ? getApps()[0] : initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  })
});
const db = getFirestore(app);

const projects = [
  {
    id: "sovesoul",
    name: "SOVE|SOUL",
    client: "SOVE|SOUL",
    serviceType: "Sitio Web",
    deliveryStatus: "En desarrollo",
    paymentStatus: "Pago inicial recibido",
    currency: "MXN",
    amount: 28000,
    initialPayment: 14000,
    monthlyMaintenance: 850,
    startDate: "2026-08-01",
    estimatedDelivery: "2026-09-25",
    nextMaintenanceDate: "2026-10-05",
    responsibleIds: [],
    notes: "E-commerce premium streetwear.",
    productionUrl: "https://sovesoul.web.app/",
  },
  {
    id: "imt-portal",
    name: "IMT-PORTAL",
    client: "IMT",
    serviceType: "Aplicación Web",
    deliveryStatus: "En mantenimiento",
    paymentStatus: "Mantenimiento al día",
    currency: "MXN",
    amount: 42000,
    initialPayment: 21000,
    monthlyMaintenance: 1200,
    startDate: "2026-03-15",
    estimatedDelivery: "2026-05-30",
    actualDelivery: "2026-05-27",
    nextMaintenanceDate: "2026-09-15",
    responsibleIds: [],
    notes: "Inventario, checador y agenda.",
  }
];

async function main() {
  for (const p of projects) {
    const { id, ...data } = p;
    await db.doc(`projects/${id}`).set({ ...data, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }
  await db.doc("channels/general").set({ name: "general", type: "team", createdAt: FieldValue.serverTimestamp() }, { merge: true });
  console.log("Seed completado.");
}
main().catch(err => { console.error(err); process.exit(1); });
