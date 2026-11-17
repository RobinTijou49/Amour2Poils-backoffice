import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { invoiceTotal } from "@/lib/invoices";
import { prisma } from "@/lib/prisma";
import { DemoPaiement } from "./demo-paiement";

export const metadata: Metadata = { title: "Démonstration : paiement sécurisé" };

export default async function PaymentDemoPage() {
  // Réservé à la gérance, comme la facturation : rôle vérifié avant tout rendu (vrai 403).
  const user = await requireRole("ADMIN");
  return (
    <>
      <PageHeader
        title="Démonstration : paiement sécurisé"
        subtitle="Passkey (empreinte, visage ou code) puis Payment Request. Aucun débit : les factures ne sont jamais modifiées."
      />
      <Suspense fallback={<p className="text-foreground-light">Chargement…</p>}>
        <Content userId={user.id} />
      </Suspense>
    </>
  );
}

async function Content({ userId }: { userId: string }) {
  const [passkeys, invoices] = await Promise.all([
    prisma.passkey.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { id: true, createdAt: true, lastUsedAt: true } }),
    prisma.invoice.findMany({ where: { status: "SENT" }, orderBy: { issuedAt: "desc" }, take: 10, include: { lines: true, owner: true } }),
  ]);
  return (
    <DemoPaiement
      passkeys={passkeys.map((p) => ({ id: p.id, createdAt: formatDate(p.createdAt), lastUsedAt: p.lastUsedAt ? formatDate(p.lastUsedAt) : null }))}
      invoices={invoices.map((i) => ({ id: i.id, number: i.number, owner: `${i.owner.firstName} ${i.owner.lastName}`, totalCents: invoiceTotal(i.lines) }))}
    />
  );
}
