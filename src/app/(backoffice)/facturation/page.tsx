import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ButtonLink, focusRing } from "@/components/ui/button";
import { isProvisionalNumber } from "@/lib/invoices";
import type { InvoiceStatus } from "@/generated/prisma/client";
import { Card, KpiCard, PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { formatDate, formatEuros } from "@/lib/format";
import { requireRole } from "@/lib/auth";
import { getInvoices } from "@/lib/queries";
import { invoiceStatus } from "@/lib/status";

export const metadata: Metadata = { title: "Facturation" };

export default async function InvoicesPage({ searchParams }: PageProps<"/facturation">) {
  // Rôle vérifié avant tout rendu : un employé reçoit un vrai 403, pas une page 200 « remplacée » en cours de streaming.
  await requireRole("ADMIN");
  return (
    <>
      <PageHeader title="Facturation" subtitle="Les factures de séjour se créent depuis le détail d'une réservation." />
      <Suspense fallback={<p className="text-foreground-light">Chargement des factures…</p>}>
        <Invoices searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const filters: { value: InvoiceStatus | ""; label: string }[] = [
  { value: "", label: "Toutes" },
  { value: "DRAFT", label: "Brouillons" },
  { value: "SENT", label: "Envoyées" },
  { value: "PAID", label: "Payées" },
  { value: "CANCELLED", label: "Annulées" },
];

async function Invoices({ searchParams }: { searchParams: PageProps<"/facturation">["searchParams"] }) {
  const { statut } = await searchParams;
  const current = filters.find((f) => f.value && f.value === statut)?.value || undefined;
  const [{ invoices, today }, all] = await Promise.all([getInvoices(current), getInvoices()]);
  const billed = all.invoices.filter((i) => i.status !== "DRAFT" && i.status !== "CANCELLED");
  const sum = (list: typeof all.invoices) => list.reduce((s, i) => s + i.totalCents, 0);
  const paid = billed.filter((i) => i.status === "PAID");
  const waiting = billed.filter((i) => i.status === "SENT");
  const late = waiting.filter((i) => i.dueAt && i.dueAt < today);

  return (
    <>
      <section aria-label="Indicateurs" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Facturé" value={formatEuros(sum(billed))} detail={`${billed.length} factures`} />
        <KpiCard label="Encaissé" value={formatEuros(sum(paid))} detail={`${paid.length} factures payées`} />
        <KpiCard label="En attente" value={formatEuros(sum(waiting))} detail={`${waiting.length} factures, dont ${late.length} en retard`} />
      </section>
      <Card title="Factures">
        <nav aria-label="Filtrer par statut" className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <ButtonLink
              key={f.label}
              href={f.value ? `/facturation?statut=${f.value}` : "/facturation"}
              variant={(current ?? "") === f.value ? "primary" : "secondary"}
              aria-current={(current ?? "") === f.value ? "page" : undefined}
            >
              {f.label}
            </ButtonLink>
          ))}
        </nav>
        <DataTable
          caption="Liste des factures"
          rows={invoices}
          rowKey={(i) => i.id}
          empty="Aucune facture pour ce filtre."
          columns={[
            {
              header: "Numéro",
              cell: (i) => (
                <Link href={`/facturation/${i.id}`} className={`rounded-sm font-semibold whitespace-nowrap tabular-nums underline ${focusRing}`}>
                  {isProvisionalNumber(i.number) ? "Brouillon" : i.number}
                </Link>
              ),
            },
            { header: "Client · objet", cell: (i) => `${i.owner.firstName} ${i.owner.lastName} · ${i.lines[0]?.label ?? ""}` },
            { header: "Émise le", cell: (i) => (i.status === "DRAFT" ? "—" : formatDate(i.issuedAt)) },
            { header: "Échéance", cell: (i) => (i.dueAt ? formatDate(i.dueAt) : "—") },
            { header: "Montant", align: "right", cell: (i) => <span className="whitespace-nowrap">{formatEuros(i.totalCents)}</span> },
            {
              header: "Statut",
              cell: (i) =>
                i.status === "SENT" && i.dueAt && i.dueAt < today ? (
                  <Badge tone="danger">En retard</Badge>
                ) : (
                  <Badge tone={invoiceStatus[i.status].tone}>{invoiceStatus[i.status].label}</Badge>
                ),
            },
          ]}
        />
      </Card>
    </>
  );
}
