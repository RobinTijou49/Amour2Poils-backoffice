import type { Metadata } from "next";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, KpiCard, PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { formatDate, formatEuros } from "@/lib/format";
import { getInvoices } from "@/lib/queries";
import { invoiceStatus } from "@/lib/status";

export const metadata: Metadata = { title: "Facturation" };

export default function InvoicesPage() {
  return (
    <>
      <PageHeader title="Facturation" />
      <Suspense fallback={<p className="text-foreground-light">Chargement des factures…</p>}>
        <Invoices />
      </Suspense>
    </>
  );
}

async function Invoices() {
  const { invoices, today } = await getInvoices();
  const billed = invoices.filter((i) => i.status !== "DRAFT" && i.status !== "CANCELLED");
  const sum = (list: typeof invoices) => list.reduce((s, i) => s + i.totalCents, 0);
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
        <DataTable
          caption="Liste des factures"
          rows={invoices}
          rowKey={(i) => i.id}
          empty="Aucune facture."
          columns={[
            { header: "Numéro", cell: (i) => <span className="whitespace-nowrap tabular-nums">{i.number}</span> },
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
