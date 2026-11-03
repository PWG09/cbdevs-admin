type MaybeError = { code?: string; message?: string } | null | undefined;

/** Error whose message is safe to show in the UI. */
export class AppError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
    this.name = "AppError";
  }
}

const BY_CODE: Record<string, string> = {
  "42501": "No tienes permiso para realizar esta acción.",
  "28000": "Tu sesión expiró. Vuelve a iniciar sesión.",
  "23505": "Ya existe un registro con esos datos.",
  "23503": "El registro relacionado ya no existe.",
  "23514": "Algún dato no cumple las reglas permitidas.",
  "22P02": "Algún dato tiene un formato no válido.",
  "22023": "Algún dato no es válido.",
  "42P01": "Falta aplicar una actualización de base de datos. Avisa al administrador.",
  "42703": "Falta aplicar una actualización de base de datos. Avisa al administrador.",
  PGRST116: "No se encontró el registro.",
  PGRST202: "Falta aplicar una actualización de base de datos. Avisa al administrador.",
  PGRST204: "Falta aplicar una actualización de base de datos. Avisa al administrador.",
  PGRST205: "Falta aplicar una actualización de base de datos. Avisa al administrador.",
  PGRST301: "Tu sesión expiró. Vuelve a iniciar sesión.",
};

/** Maps Supabase/PostgREST errors to Spanish messages; raw database text is only logged by code. */
export function toAppError(error: MaybeError, fallback: string, overrides: Record<string, string> = {}): AppError {
  const code = error?.code;
  if (code) console.error("[Admin]", fallback, code);
  return new AppError((code && (overrides[code] ?? BY_CODE[code])) || fallback, code);
}

export function messageOf(error: unknown, fallback: string): string {
  if (error instanceof AppError) return error.message;
  if (error instanceof Error && error.name === "AppError") return error.message;
  return fallback;
}
