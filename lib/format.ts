const LOCALE = "es-MX";

/** Formats an amount using the project's currency; unknown currency codes fall back safely. */
export function formatMoney(amount: number, currency: string): string {
  const value = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat(LOCALE, { style: "currency", currency }).format(value);
  } catch {
    return `${new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 }).format(value)} ${currency}`;
  }
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parses either a date-only value (`YYYY-MM-DD`, stored as a Postgres `date`) or a timestamp.
 * Date-only values are anchored at UTC noon so they never shift a day in any viewer time zone.
 */
export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const dateOnly = DATE_ONLY.exec(value);
  const parsed = dateOnly
    ? new Date(Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 12))
    : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDate(value: string | null | undefined, fallback = "Por definir"): string {
  const date = parseDate(value);
  if (!date) return fallback;
  const options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
  if (value && DATE_ONLY.test(value)) options.timeZone = "UTC";
  return new Intl.DateTimeFormat(LOCALE, options).format(date);
}

export function formatDateTime(value: string | null | undefined, fallback = "Sin fecha"): string {
  const date = parseDate(value);
  if (!date) return fallback;
  return new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

export function formatTime(value: string | null | undefined): string {
  const date = parseDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat(LOCALE, { hour: "2-digit", minute: "2-digit" }).format(date);
}

/** Whole days from `now` until the given date (negative when the date is in the past). */
export function daysUntil(value: string | null | undefined, now: Date = new Date()): number | null {
  const date = parseDate(value);
  if (!date) return null;
  const startOfToday = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  return Math.round((date.getTime() - startOfToday) / 86_400_000);
}

export function relativeDays(value: string | null | undefined, now: Date = new Date()): string {
  const days = daysUntil(value, now);
  if (days === null) return "";
  if (days === 0) return "Hoy";
  if (days === 1) return "Mañana";
  if (days === -1) return "Ayer";
  return days > 0 ? `En ${days} días` : `Hace ${Math.abs(days)} días`;
}

export function dayKey(value: string | null | undefined): string {
  const date = parseDate(value);
  if (!date) return "";
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function formatDayHeading(value: string | null | undefined, now: Date = new Date()): string {
  const date = parseDate(value);
  if (!date) return "";
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = Math.round((today.getTime() - target.getTime()) / 86_400_000);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Ayer";
  return new Intl.DateTimeFormat(LOCALE, { weekday: "long", day: "numeric", month: "long" }).format(date);
}

export function initialsFrom(name: string, fallback = "C"): string {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase() || fallback;
}
