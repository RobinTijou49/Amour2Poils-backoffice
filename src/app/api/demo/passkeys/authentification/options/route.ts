import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { apiError, guard } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { relyingParty, saveChallenge, type Transport } from "@/lib/webauthn";

/** POST /api/demo/passkeys/authentification/options : nouveau défi, à signer par la clé privée de l'appareil. */
export async function POST(request: Request) {
  const g = await guard(request, { write: true, admin: true });
  if (!g.ok) return g.response;
  const passkeys = await prisma.passkey.findMany({ where: { userId: g.user.id }, select: { credentialId: true, transports: true } });
  if (passkeys.length === 0) return apiError("Aucune passkey enregistrée : enregistrez-en une d'abord.", 409);
  const { rpID } = relyingParty(request);
  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: passkeys.map((p) => ({ id: p.credentialId, transports: p.transports as Transport[] })),
    userVerification: "required",
  });
  await saveChallenge(g.user.id, options.challenge, "authenticate");
  return Response.json(options);
}
