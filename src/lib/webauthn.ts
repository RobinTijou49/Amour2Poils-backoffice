import "server-only";
import { prisma } from "@/lib/prisma";

// Briques serveur de la démonstration WebAuthn / passkeys (oral, thème 6). La vérification cryptographique est
// confiée à @simplewebauthn/server (bibliothèque de référence) : écrire soi-même la vérification d'une signature
// WebAuthn est un exercice risqué, et l'important ici est de montrer le PROTOCOLE, pas de réinventer la crypto.

export const RP_NAME = "Amour 2 Poils";
/** Moyens de transport d'une passkey (interne à l'appareil, USB, NFC, QR code depuis un téléphone…). */
export type Transport = "ble" | "cable" | "hybrid" | "internal" | "nfc" | "smart-card" | "usb";
/** Un défi n'est valable que quelques minutes et une seule fois (anti-rejeu). */
export const CHALLENGE_TTL_MS = 5 * 60_000;
/** Après une authentification par passkey, le paiement reste autorisé aussi peu de temps que raisonnable. */
export const PAYMENT_AUTH_WINDOW_MS = 2 * 60_000;

/**
 * Identité du site telle que le navigateur la voit : le défi est lié à ce domaine (`rpID`) et à cette origine, ce qui
 * rend une passkey inutilisable sur un faux site (hameçonnage). Derrière les reverse proxies, le nom public est dans
 * X-Forwarded-Host (voir isSameOrigin dans src/lib/api.ts, même raisonnement).
 */
export function relyingParty(request: Request) {
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host).split(",")[0].trim();
  const hostname = host.replace(/:\d+$/, "");
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
  const proto = forwardedProto ?? (isLocal ? new URL(request.url).protocol.replace(":", "") : "https");
  return { rpID: hostname, origin: `${proto}://${host}` };
}

export async function saveChallenge(userId: string, challenge: string, purpose: "register" | "authenticate") {
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);
  await prisma.passkeyChallenge.upsert({ where: { userId }, create: { userId, challenge, purpose, expiresAt }, update: { challenge, purpose, expiresAt } });
}

/**
 * Récupère ET consomme le défi en attente : la suppression conditionnelle garantit qu'un défi ne sert qu'une fois,
 * même si deux requêtes arrivent en même temps (la seconde trouve `count === 0`).
 */
export async function takeChallenge(userId: string, purpose: "register" | "authenticate") {
  const row = await prisma.passkeyChallenge.findUnique({ where: { userId } });
  if (!row || row.purpose !== purpose) return null;
  const { count } = await prisma.passkeyChallenge.deleteMany({ where: { userId, challenge: row.challenge } });
  if (count !== 1 || row.expiresAt.getTime() < Date.now()) return null;
  return row.challenge;
}

/** Vrai si l'utilisateur s'est authentifié par passkey il y a moins de PAYMENT_AUTH_WINDOW_MS. */
export async function hasRecentPasskeyAuth(userId: string, now = Date.now()) {
  const recent = await prisma.passkey.findFirst({ where: { userId, lastUsedAt: { gte: new Date(now - PAYMENT_AUTH_WINDOW_MS) } }, select: { id: true } });
  return recent !== null;
}
