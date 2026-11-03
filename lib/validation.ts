import { AppError } from "@/lib/errors";
import { safeExternalUrl } from "@/lib/safe-url";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const CURRENCIES = ["MXN", "USD", "CAD"] as const;
export const SERVICES = ["Sitio Web", "Aplicación Web", "Software Personalizado/Automatización"] as const;
export const DELIVERY_STATUSES = ["Cotizado", "En desarrollo", "En revisión", "Entregado", "En mantenimiento", "Pausado/Cancelado"] as const;
export const PAYMENT_STATUSES = ["Pendiente", "Pago inicial recibido", "Pagado parcial", "Pagado completo", "Mantenimiento al día", "Mantenimiento atrasado"] as const;
export const MILESTONE_STATUSES = ["Pendiente", "En progreso", "Completado"] as const;
export const DOCUMENT_TYPES = ["Propuesta", "Contrato", "Factura", "Entrega", "Otro"] as const;
export const PAYMENT_RECORD_STATUSES = ["pending", "paid", "failed", "refunded", "cancelled"] as const;
export const PAYMENT_LINK_STATUSES = ["active", "completed", "expired", "cancelled"] as const;

/** Collapses whitespace and enforces required/length rules. */
export function text(value: unknown, label: string, { required = false, max = 200, min = 0 } = {}): string {
  const clean = typeof value === "string" ? value.trim().replace(/[ \t]+/g, " ") : "";
  if (required && !clean) throw new AppError(`${label} es obligatorio.`);
  if (clean && clean.length < min) throw new AppError(`${label} debe tener al menos ${min} caracteres.`);
  if (clean.length > max) throw new AppError(`${label} admite como máximo ${max} caracteres.`);
  return clean;
}

/** Multi-line text: keeps line breaks, trims, bounds length. */
export function longText(value: unknown, label: string, max = 4000): string {
  const clean = typeof value === "string" ? value.replace(/\r\n/g, "\n").trim() : "";
  if (clean.length > max) throw new AppError(`${label} admite como máximo ${max} caracteres.`);
  return clean;
}

export function email(value: unknown, label = "El correo"): string {
  const clean = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!clean) throw new AppError(`${label} es obligatorio.`);
  if (clean.length > 254 || !EMAIL_RE.test(clean)) throw new AppError(`${label} no es válido.`);
  return clean;
}

export function optionalPhone(value: unknown): string | null {
  const clean = typeof value === "string" ? value.trim() : "";
  if (!clean) return null;
  if (clean.length > 40 || !/^[+\d][\d\s().-]{5,}$/.test(clean)) throw new AppError("El teléfono no es válido.");
  return clean;
}

export function money(value: unknown, label: string): number {
  const n = typeof value === "number" ? value : Number(String(value ?? "").replace(/,/g, ""));
  if (!Number.isFinite(n) || n < 0 || n > 999_999_999) throw new AppError(`${label} debe ser un número mayor o igual a 0.`);
  return Math.round(n * 100) / 100;
}

export function positiveMoney(value: unknown, label: string): number {
  const n = money(value, label);
  if (n <= 0) throw new AppError(`${label} debe ser mayor a 0.`);
  return n;
}

export function oneOf<T extends readonly string[]>(value: unknown, allowed: T, label: string): T[number] {
  if (typeof value === "string" && (allowed as readonly string[]).includes(value)) return value as T[number];
  throw new AppError(`${label} no es válido.`);
}

/** `YYYY-MM-DD` or null. */
export function optionalDate(value: unknown, label: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T12:00:00Z`))) {
    throw new AppError(`${label} no es una fecha válida.`);
  }
  return value;
}

/** https URL or null; anything else is rejected so the portal never receives unsafe links. */
export function optionalHttpsUrl(value: unknown, label: string): string | null {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  const url = safeExternalUrl(raw);
  if (!url) throw new AppError(`${label} debe ser un enlace https:// válido.`);
  return url;
}

export function requiredHttpsUrl(value: unknown, label: string): string {
  const url = optionalHttpsUrl(value, label);
  if (!url) throw new AppError(`${label} es obligatorio.`);
  return url;
}
