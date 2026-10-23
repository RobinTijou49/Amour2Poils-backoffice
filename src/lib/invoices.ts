import type { InvoiceStatus } from "@/generated/prisma/client";

// Règles métier de la facturation. Fonctions pures, testables sans base.

export const DRAFT_PREFIX = "BROUILLON-";

/** Un brouillon n'a pas encore de numéro définitif : il en reçoit un à l'envoi,
 *  pour que la numérotation ne présente jamais de trou (obligation légale). */
export function isProvisionalNumber(number: string) {
  return number.startsWith(DRAFT_PREFIX);
}

/** Numéro suivant de l'année, à partir des numéros existants : F-2026-0007 après F-2026-0006. */
export function nextInvoiceNumber(year: number, existing: string[]) {
  const prefix = `F-${year}-`;
  const max = existing
    .filter((n) => n.startsWith(prefix))
    .map((n) => Number.parseInt(n.slice(prefix.length), 10))
    .filter(Number.isFinite)
    .reduce((a, b) => Math.max(a, b), 0);
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

export function invoiceTotal(lines: { quantity: number; unitPriceCents: number }[]) {
  return lines.reduce((sum, l) => sum + l.quantity * l.unitPriceCents, 0);
}

export const invoiceTransitions: Record<InvoiceStatus, InvoiceStatus[]> = {
  DRAFT: ["SENT", "CANCELLED"],
  SENT: ["PAID", "CANCELLED"],
  PAID: [],
  CANCELLED: [],
};

export function canSetInvoiceStatus(from: InvoiceStatus, to: InvoiceStatus) {
  return invoiceTransitions[from].includes(to);
}
