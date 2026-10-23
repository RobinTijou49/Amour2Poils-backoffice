import "server-only";
import type { z } from "zod";
import { getSession } from "@/lib/session";

// Utilitaires des Route Handlers : une API répond en JSON (401/403/422), jamais par une redirection.

export const apiError = (error: string, status: number, details?: Record<string, string>) => Response.json({ error, details }, { status });

/** Utilisateur connecté, ou `null` : le handler renvoie alors 401. */
export async function apiUser() {
  return (await getSession())?.user ?? null;
}

/**
 * Une écriture doit venir de notre propre site : le cookie SameSite=Lax ne protège pas tout (voir phase sécurité).
 * On compare l'hôte de `Origin` à l'hôte demandé par le navigateur. `request.url` ne convient pas en production :
 * derrière les reverse proxies (Caddy) il porte l'adresse interne, pas `amour2poils.duckdns.org`.
 * Un navigateur ne laisse pas un autre site modifier `Origin`, `Host` ni `X-Forwarded-Host`.
 */
export function isSameOrigin(request: Request) {
  // Sec-Fetch-Site est posé par le navigateur et ne peut pas être modifié par une page (ni par un autre site).
  // Quand il est présent, seules les requêtes de notre propre origine (« same-origin ») ou lancées par l'utilisateur
  // lui-même (« none ») passent : « cross-site » et « same-site » (un autre sous-domaine) sont refusés.
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return false;
  const origin = request.headers.get("origin");
  // Sans Origin ni Sec-Fetch-Site : client hors navigateur (curl, script). Il ne peut pas profiter des cookies
  // d'un utilisateur connecté, donc aucun risque de CSRF.
  if (!origin) return true;
  // Plusieurs proxys successifs peuvent produire « hôte1, hôte2 » : le premier est celui du navigateur.
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host).split(",")[0].trim();
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
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
  if (opts.write) {
    if (!isSameOrigin(request)) return { response: apiError("Origine refusée.", 403) } as const;
    // Un formulaire HTML d'un autre site ne peut envoyer que du texte brut ou multipart, pas du JSON, sans
    // déclencher une vérification CORS préalable que notre API ne passe jamais : exiger du JSON ferme cette porte.
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      return { response: apiError("Content-Type application/json requis.", 415) } as const;
    }
  }
  const user = await apiUser();
  if (!user) return { response: apiError("Authentification requise.", 401) } as const;
  if (opts.admin && user.role !== "ADMIN") return { response: apiError("Réservé à la gérance.", 403) } as const;
  return { user } as const;
}
