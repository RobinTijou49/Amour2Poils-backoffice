import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { z } from "zod";
import { apiError, guard, readJson } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { relyingParty, takeChallenge } from "@/lib/webauthn";

const body = z.object({ response: z.looseObject({ id: z.string().min(1).max(1500), type: z.literal("public-key") }) });

/** POST /api/demo/passkeys/inscription/verification : vérifie la réponse de l'appareil et ne garde que la CLÉ PUBLIQUE. */
export async function POST(request: Request) {
  const g = await guard(request, { write: true, admin: true });
  if (!g.ok) return g.response;
  const parsed = body.safeParse(await readJson(request));
  if (!parsed.success) return apiError("Réponse invalide.", 422);
  const expectedChallenge = await takeChallenge(g.user.id, "register");
  if (!expectedChallenge) return apiError("Défi expiré ou déjà utilisé : recommencez.", 400);
  const { rpID, origin } = relyingParty(request);
  let result;
  try {
    result = await verifyRegistrationResponse({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- la bibliothèque valide elle-même la forme complète
      response: parsed.data.response as any,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
  } catch {
    return apiError("Inscription refusée : la réponse de l'appareil n'est pas valide.", 400);
  }
  if (!result.verified) return apiError("Inscription refusée.", 400);
  const { credential } = result.registrationInfo;
  await prisma.passkey.create({
    data: { credentialId: credential.id, publicKey: Buffer.from(credential.publicKey), counter: credential.counter, transports: credential.transports ?? [], userId: g.user.id },
  });
  return Response.json({ ok: true }, { status: 201 });
}
