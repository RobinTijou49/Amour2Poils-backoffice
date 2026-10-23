import "server-only";
import type { z } from "zod";
import { getSession } from "@/lib/session";

// Utilitaires des Route Handlers : une API répond en JSON (401/403/422), jamais par une redirection.

export const apiError = (error: string, status: number, details?: Record<string, string>) => Response.json({ error, details }, { status });

/** Utilisateur connecté, ou `null` : le handler renvoie alors 401. */
export async function apiUser() {
  return (await getSession())?.user ?? null;
}

/** Une écriture doit venir de notre propre site : le cookie SameSite=Lax ne protège pas tout (voir phase sécurité). */
export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

/** Corps JSON, ou `null` s'il est illisible. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function zodDetails(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) out[String(issue.path[0] ?? "body")] ??= issue.message;
  return out;
}

/** Contrôles communs : origine (écritures), session, rôle facultatif. */
export async function guard(request: Request, opts: { write?: boolean; admin?: boolean } = {}) {
  if (opts.write && !isSameOrigin(request)) return { response: apiError("Origine refusée.", 403) } as const;
  const user = await apiUser();
  if (!user) return { response: apiError("Authentification requise.", 401) } as const;
  if (opts.admin && user.role !== "ADMIN") return { response: apiError("Réservé à la gérance.", 403) } as const;
  return { user } as const;
}
