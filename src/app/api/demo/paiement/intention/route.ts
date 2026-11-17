import { z } from "zod";
import { apiError, guard, readJson, zodDetails } from "@/lib/api";
import { invoiceTotal } from "@/lib/invoices";
import { prisma } from "@/lib/prisma";
import { hasRecentPasskeyAuth } from "@/lib/webauthn";

/**
 * POST /api/demo/paiement/intention { invoiceId } : le SERVEUR dit combien payer. Le navigateur n'envoie jamais un montant :
 * il reçoit celui-ci, calculé en centimes depuis les lignes de la facture. Et seulement après une vérification biométrique
 * récente (passkey), comme le ferait une application bancaire avant un paiement.
 */
export async function POST(request: Request) {
  const g = await guard(request, { write: true, admin: true });
  if (!g.ok) return g.response;
  const parsed = z.object({ invoiceId: z.string().min(1).max(100) }).safeParse(await readJson(request));
  if (!parsed.success) return apiError("Facture invalide.", 422, zodDetails(parsed.error));
  if (!(await hasRecentPasskeyAuth(g.user.id))) {
    return apiError("Confirmez d'abord par empreinte, visage ou code (passkey) : la vérification date de plus de 2 minutes.", 403);
  }
  const invoice = await prisma.invoice.findUnique({ where: { id: parsed.data.invoiceId }, include: { lines: true } });
  // Seule une facture envoyée se paie : un brouillon, une facture déjà payée ou annulée ne donne aucun montant.
  if (!invoice || invoice.status !== "SENT") return apiError("Cette facture n'est pas à payer.", 409);
  return Response.json({ invoiceId: invoice.id, number: invoice.number, amountCents: invoiceTotal(invoice.lines), currency: "EUR" });
}
