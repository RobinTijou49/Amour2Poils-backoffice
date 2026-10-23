"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { InvoiceStatus } from "@/generated/prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { nights } from "@/lib/bookings";
import { eurosToCents, formatDate, utcDay } from "@/lib/format";
import { fieldErrors, formValues, type FormState } from "@/lib/forms";
import { canSetInvoiceStatus, DRAFT_PREFIX, isProvisionalNumber, nextInvoiceNumber } from "@/lib/invoices";
import { prisma } from "@/lib/prisma";
import { sessionType } from "@/lib/status";

// Actions de facturation : toutes réservées à la gérance (vérifié ici, pas seulement dans l'interface).

async function requireAdmin(): Promise<FormState | null> {
  const user = await getCurrentUser();
  return user.role === "ADMIN" ? null : { error: "Seule la gérance peut gérer la facturation." };
}

const draftNumber = () => `${DRAFT_PREFIX}${crypto.randomUUID().slice(0, 8)}`;

/** Facture un séjour : une ligne « Pension {chien} (n nuits) », impossible deux fois. */
export async function invoiceBooking(_prev: FormState, formData: FormData): Promise<FormState> {
  const denied = await requireAdmin();
  if (denied) return denied;
  const booking = await prisma.booking.findUnique({
    where: { id: String(formData.get("bookingId") ?? "") },
    include: { dog: true, invoiceLines: { include: { invoice: true } } },
  });
  if (!booking) return { error: "Séjour introuvable." };
  if (booking.status === "CANCELLED" || booking.status === "PENDING") return { error: "Seul un séjour confirmé, en cours ou terminé peut être facturé." };
  if (booking.invoiceLines.some((l) => l.invoice.status !== "CANCELLED")) return { error: "Ce séjour est déjà facturé." };

  const n = nights(booking.startDate, booking.endDate);
  const invoice = await prisma.invoice.create({
    data: {
      number: draftNumber(),
      ownerId: booking.dog.ownerId,
      lines: {
        create: {
          label: `Pension ${booking.dog.name} du ${formatDate(booking.startDate, { day: "numeric", month: "short" })} au ${formatDate(booking.endDate)} (${n} nuit${n > 1 ? "s" : ""})`,
          quantity: n,
          unitPriceCents: booking.nightlyRateCents,
          bookingId: booking.id,
        },
      },
    },
  });
  redirect(`/facturation/${invoice.id}`);
}

/** Regroupe sur une facture toutes les séances non facturées des chiens d'un client (absents exclus).
 *  Attention : `attended: { not: false }` exclurait aussi les présences non notées (NULL en SQL). */
export async function invoiceEnrollments(_prev: FormState, formData: FormData): Promise<FormState> {
  const denied = await requireAdmin();
  if (denied) return denied;
  const ownerId = String(formData.get("ownerId") ?? "");
  const enrollments = await prisma.enrollment.findMany({
    where: { dog: { ownerId }, OR: [{ attended: null }, { attended: true }], invoiceLines: { none: { invoice: { status: { not: "CANCELLED" } } } } },
    include: { dog: true, session: true },
    orderBy: { session: { startsAt: "asc" } },
  });
  if (enrollments.length === 0) return { error: "Aucune séance à facturer pour ce client." };
  const invoice = await prisma.invoice.create({
    data: {
      number: draftNumber(),
      ownerId,
      lines: {
        create: enrollments.map((e) => ({
          label: `${sessionType[e.session.type]} « ${e.session.title} » · ${e.dog.name} · ${formatDate(e.session.startsAt, { day: "numeric", month: "short", timeZone: "Europe/Paris" })}`,
          quantity: 1,
          unitPriceCents: e.session.priceCents,
          enrollmentId: e.id,
        })),
      },
    },
  });
  redirect(`/facturation/${invoice.id}`);
}

const lineInput = z.object({
  invoiceId: z.string().min(1),
  label: z.string().trim().min(1, "Saisissez un libellé.").max(200),
  quantity: z.coerce.number({ message: "Saisissez une quantité." }).int("Nombre entier attendu.").min(1, "Au moins 1.").max(1000),
  unitPrice: z.coerce.number({ message: "Saisissez un prix." }).min(0, "Le prix ne peut pas être négatif.").max(100_000),
});

/** Ligne libre (supplément, remise…) : uniquement sur un brouillon. */
export async function addLine(_prev: FormState, formData: FormData): Promise<FormState> {
  const denied = await requireAdmin();
  if (denied) return denied;
  const values = formValues(formData);
  const parsed = lineInput.safeParse(values);
  if (!parsed.success) return { error: "Corrigez les champs signalés.", fieldErrors: fieldErrors(parsed.error), values };
  const l = parsed.data;
  const invoice = await prisma.invoice.findUnique({ where: { id: l.invoiceId } });
  if (invoice?.status !== "DRAFT") return { error: "Seul un brouillon peut être modifié." };
  await prisma.invoiceLine.create({ data: { invoiceId: l.invoiceId, label: l.label, quantity: l.quantity, unitPriceCents: eurosToCents(l.unitPrice) } });
  refresh();
  return { success: "Ligne ajoutée." };
}

export async function removeLine(_prev: FormState, formData: FormData): Promise<FormState> {
  const denied = await requireAdmin();
  if (denied) return denied;
  const line = await prisma.invoiceLine.findUnique({ where: { id: String(formData.get("id") ?? "") }, include: { invoice: true } });
  if (!line || line.invoice.status !== "DRAFT") return { error: "Seul un brouillon peut être modifié." };
  await prisma.invoiceLine.delete({ where: { id: line.id } });
  refresh();
  return { success: "Ligne supprimée." };
}

const statusLabel: Partial<Record<InvoiceStatus, string>> = { SENT: "envoyée", PAID: "marquée payée", CANCELLED: "annulée" };

/** Envoi (numéro définitif + échéance à 14 jours), paiement ou annulation. */
export async function setInvoiceStatus(_prev: FormState, formData: FormData): Promise<FormState> {
  const denied = await requireAdmin();
  if (denied) return denied;
  const to = z.enum(["SENT", "PAID", "CANCELLED"]).safeParse(formData.get("status"));
  if (!to.success) return { error: "Action inconnue." };
  const id = String(formData.get("id") ?? "");

  // Transaction : lecture du dernier numéro et attribution du suivant sans qu'un autre envoi s'intercale.
  const result = await prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({ where: { id }, include: { lines: true } });
    if (!invoice) return { error: "Facture introuvable." };
    if (!canSetInvoiceStatus(invoice.status, to.data)) return { error: "Cette action n'est plus possible pour cette facture." };
    if (to.data === "SENT" && invoice.lines.length === 0) return { error: "Ajoutez au moins une ligne avant d'envoyer." };

    const today = utcDay(new Date());
    const data: { status: InvoiceStatus; number?: string; issuedAt?: Date; dueAt?: Date; paidAt?: Date } = { status: to.data };
    if (to.data === "SENT") {
      if (isProvisionalNumber(invoice.number)) {
        const year = today.getUTCFullYear();
        const existing = await tx.invoice.findMany({ where: { number: { startsWith: `F-${year}-` } }, select: { number: true } });
        data.number = nextInvoiceNumber(year, existing.map((i) => i.number));
      }
      data.issuedAt = today;
      data.dueAt = utcDay(today, 14);
    }
    if (to.data === "PAID") data.paidAt = new Date();
    const updated = await tx.invoice.update({ where: { id }, data });
    return { number: updated.number };
  });
  if ("error" in result) return { error: result.error };
  refresh();
  return { success: `Facture ${isProvisionalNumber(result.number) ? "" : `${result.number} `}${statusLabel[to.data]}.` };
}
