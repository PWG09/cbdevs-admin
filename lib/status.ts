export type StatusTone = "success" | "progress" | "danger" | "neutral";

/** Lowercases and strips accents so "Mantenimiento al día" and "al dia" are treated the same. */
export function normalizeStatus(status: string | null | undefined): string {
  return (status ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

const SUCCESS = new Set(["completado", "entregado", "en mantenimiento", "pagado completo", "mantenimiento al dia", "paid", "completed"]);
const PROGRESS = new Set(["en progreso", "en desarrollo", "en revision", "pago inicial recibido", "pagado parcial", "pending", "active"]);
const DANGER = new Set(["pausado/cancelado", "mantenimiento atrasado", "failed", "refunded", "cancelled", "expired"]);

export function statusTone(status: string | null | undefined): StatusTone {
  const value = normalizeStatus(status);
  if (SUCCESS.has(value)) return "success";
  if (PROGRESS.has(value)) return "progress";
  if (DANGER.has(value) || value.includes("atrasado") || value.includes("pausado") || value.includes("cancelado")) return "danger";
  return "neutral";
}

export const toneClasses: Record<StatusTone, string> = {
  success: "border-emerald-400/20 bg-emerald-500/10 text-emerald-300",
  progress: "border-cb-amber/20 bg-cb-amber/10 text-cb-amber",
  danger: "border-red-400/20 bg-red-500/10 text-red-300",
  neutral: "border-cb-line bg-cb-panel2 text-cb-muted",
};

const PAYMENT_LABELS: Record<string, string> = {
  pending: "Pendiente",
  paid: "Pagado",
  failed: "Fallido",
  refunded: "Reembolsado",
  cancelled: "Cancelado",
  active: "Activo",
  completed: "Completado",
  expired: "Vencido",
};

/** Translates database payment / payment-link status codes into client-facing Spanish labels. */
export function paymentStatusLabel(status: string | null | undefined): string {
  const key = normalizeStatus(status);
  return PAYMENT_LABELS[key] ?? (status || "Sin estado");
}

export function isCompletedMilestone(status: string | null | undefined): boolean {
  return normalizeStatus(status) === "completado";
}
