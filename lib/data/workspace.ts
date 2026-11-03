import { getCurrentProfile, getSupabaseClient } from "@/lib/supabase/client";
import { AppError } from "@/lib/errors";

export const db = () => getSupabaseClient();

export interface Workspace {
  userId: string;
  organizationId: string;
  /** UI role: owner/admin → admin, manager → empleado. RLS decides real permissions. */
  role: "admin" | "empleado";
  name: string;
}

let cached: Promise<Workspace> | null = null;

/** Current user's organization and role, cached for the page session. */
export function getWorkspace(): Promise<Workspace> {
  if (!cached) {
    cached = getCurrentProfile()
      .then((p) => ({ userId: p.id, organizationId: p.organizationId, role: p.role, name: p.name }))
      .catch((error) => {
        cached = null;
        throw error instanceof Error ? new AppError(error.message) : new AppError("No se pudieron verificar tus permisos.");
      });
  }
  return cached;
}

export function resetWorkspace() {
  cached = null;
}

/** Calls a protected Admin API route with the current session token. */
export async function callAdminApi<T>(path: string, body: unknown): Promise<T> {
  const { data: { session } } = await db().auth.getSession();
  if (!session?.access_token) throw new AppError("Tu sesión expiró. Vuelve a iniciar sesión.");
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(body),
  });
  const result = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok) throw new AppError(result.error || "No se pudo completar la operación.");
  return result;
}
