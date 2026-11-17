import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { z } from "zod";
import { apiError, guard, readJson } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { relyingParty, takeChallenge, type Transport } from "@/lib/webauthn";

const body = z.object({ response: z.looseObject({ id: z.string().min(1).max(1500), type: z.literal("public-key") }) });

/** POST /api/demo/passkeys/authentification/verification : vérifie la SIGNATURE du défi avec la clé publique enregistrée. */
export async function POST(request: Request) {
  const g = await guard(request, { write: true, admin: true });
  if (!g.ok) return g.response;
  const parsed = body.safeParse(await readJson(request));
  if (!parsed.success) return apiError("Réponse invalide.", 422);
  // Seule une passkey de CET utilisateur est acceptée : l'identifiant d'une clé d'un autre compte ne passe pas.
  const passkey = await prisma.passkey.findFirst({ where: { credentialId: parsed.data.response.id, userId: g.user.id } });
  if (!passkey) return apiError("Passkey inconnue pour ce compte.", 400);
  const expectedChallenge = await takeChallenge(g.user.id, "authenticate");
  if (!expectedChallenge) return apiError("Défi expiré ou déjà utilisé : recommencez.", 400);
  const { rpID, origin } = relyingParty(request);
  let result;
  try {
    result = await verifyAuthenticationResponse({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- la bibliothèque valide elle-même la forme complète
      response: parsed.data.response as any,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: { id: passkey.credentialId, publicKey: new Uint8Array(passkey.publicKey), counter: passkey.counter, transports: passkey.transports as Transport[] },
      requireUserVerification: true,
    });
  } catch (error) {
    return apiError(`Vérification refusée : ${error instanceof Error ? error.message : "la signature n'est pas valide."}`, 400);
  }
  if (!result.verified) return apiError("Vérification refusée.", 400);
  // Le compteur ne fait que croître : un compteur qui recule trahit une clé clonée (la bibliothèque le contrôle).
  await prisma.passkey.update({ where: { id: passkey.id }, data: { counter: result.authenticationInfo.newCounter, lastUsedAt: new Date() } });
  return Response.json({ ok: true });
}
