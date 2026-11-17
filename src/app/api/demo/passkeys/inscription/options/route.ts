import { generateRegistrationOptions } from "@simplewebauthn/server";
import { guard } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { RP_NAME, relyingParty, saveChallenge, type Transport } from "@/lib/webauthn";

/** POST /api/demo/passkeys/inscription/options : le serveur propose un défi pour créer une passkey (gérance seulement). */
export async function POST(request: Request) {
  const g = await guard(request, { write: true, admin: true });
  if (!g.ok) return g.response;
  const { rpID } = relyingParty(request);
  const existing = await prisma.passkey.findMany({ where: { userId: g.user.id }, select: { credentialId: true, transports: true } });
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userName: g.user.email,
    userDisplayName: g.user.name,
    userID: new TextEncoder().encode(g.user.id),
    // Pas de certificat d'appareil demandé : on veut prouver « c'est la même personne », pas « c'est tel modèle de téléphone ».
    attestationType: "none",
    // Une même clé ne s'enregistre pas deux fois sur le même appareil.
    excludeCredentials: existing.map((p) => ({ id: p.credentialId, transports: p.transports as Transport[] })),
    // « required » : l'appareil doit vérifier l'utilisateur (empreinte, visage ou code), pas seulement détecter sa présence.
    authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
  });
  await saveChallenge(g.user.id, options.challenge, "register");
  return Response.json(options);
}
