import { z } from "zod";
import { apiError, guard, readJson, zodDetails } from "@/lib/api";
import { invoiceTotal } from "@/lib/invoices";
import { prisma } from "@/lib/prisma";
import { hasRecentPasskeyAuth } from "@/lib/webauthn";

const body = z.object({
  invoiceId: z.string().min(1).max(100),
  // Le montant que le navigateur dit avoir payé : il est comparé à celui du serveur, jamais cru.
  amountCents: z.number().int().positive(),
  // Jeton à usage unique rendu par le portefeuille (Google Pay…). Opaque : le serveur ne voit jamais de numéro de carte.
  token: z.string().min(1).max(20_000),
});

/**
 * POST /api/demo/paiement/confirmation : reçoit le jeton du portefeuille. En production, il partirait vers le prestataire de
 * paiement, qui débite, puis la facture passerait à « payée » (action setInvoiceStatus). Ici c'est une DÉMONSTRATION :
 * on revérifie tout ce que le serveur peut vérifier, mais on ne débite personne et la facture reste inchangée.
 */
export async function POST(request: Request) {
  const g = await guard(request, { write: true, admin: true });
  if (!g.ok) return g.response;
  const parsed = body.safeParse(await readJson(request));
  if (!parsed.success) return apiError("Paiement invalide.", 422, zodDetails(parsed.error));
  if (!(await hasRecentPasskeyAuth(g.user.id))) return apiError("Confirmation biométrique expirée : recommencez.", 403);
  const invoice = await prisma.invoice.findUnique({ where: { id: parsed.data.invoiceId }, include: { lines: true } });
  if (!invoice || invoice.status !== "SENT") return apiError("Cette facture n'est pas à payer.", 409);
  const expected = invoiceTotal(invoice.lines);
  if (parsed.data.amountCents !== expected) return apiError("Le montant ne correspond pas à la facture.", 409);
  return Response.json({ ok: true, demo: true, invoiceNumber: invoice.number, amountCents: expected, message: "Démonstration : aucun débit, facture inchangée." });
}
