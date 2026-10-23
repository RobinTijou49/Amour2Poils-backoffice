import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireRole } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { formatDate, formatEuros, utcDay } from "@/lib/format";
import { invoiceTotal, isProvisionalNumber } from "@/lib/invoices";
import { getInvoice } from "@/lib/queries";
import { invoiceStatus } from "@/lib/status";
import { AddLineForm, InvoiceSessionsButton, RemoveLineButton, StatusActions } from "./invoice-actions";

export async function generateMetadata({ params }: PageProps<"/facturation/[id]">): Promise<Metadata> {
  const { invoice } = await getInvoice((await params).id);
  if (!invoice) return { title: "Facture introuvable" };
  return { title: isProvisionalNumber(invoice.number) ? "Brouillon de facture" : `Facture ${invoice.number}` };
}

export default async function InvoicePage({ params }: PageProps<"/facturation/[id]">) {
  await requireRole("ADMIN"); // 403 avant tout rendu, voir facturation/page.tsx
  return (
    <Suspense fallback={<p className="text-foreground-light">Chargement de la facture…</p>}>
      <Invoice params={params} />
    </Suspense>
  );
}

async function Invoice({ params }: { params: PageProps<"/facturation/[id]">["params"] }) {
  const { id } = await params;
  const { invoice, uninvoicedSessions } = await getInvoice(id);
  if (!invoice) notFound();
  const draft = invoice.status === "DRAFT";
  const late = invoice.status === "SENT" && invoice.dueAt && invoice.dueAt < utcDay(new Date());
  const status = late ? { label: "En retard", tone: "danger" as const } : invoiceStatus[invoice.status];
  const total = invoiceTotal(invoice.lines);

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title={draft ? "Brouillon de facture" : `Facture ${invoice.number}`}
          subtitle={`${invoice.owner.firstName} ${invoice.owner.lastName}`}
          actions={
            <ButtonLink href="/facturation" variant="secondary" icon="chevronGauche">
              Toutes les factures
            </ButtonLink>
          }
        />
      </div>

      <Card className="print:border-0 print:p-0">
        {/* Bloc imprimable : c'est ce que le navigateur enregistre en PDF. */}
        <div className="flex flex-wrap justify-between gap-6">
          <div className="flex flex-col gap-1">
            <p className="font-heading text-xl font-bold">Amour 2 Poils</p>
            <p className="text-sm text-foreground-light">Pension canine, éducation positive et petsitting</p>
          </div>
          <div className="flex flex-col gap-1 text-right">
            <p className="font-heading text-xl font-bold">{draft ? "Brouillon" : `Facture ${invoice.number}`}</p>
            {!draft && <p className="text-sm">Émise le {formatDate(invoice.issuedAt, { day: "numeric", month: "long", year: "numeric" })}</p>}
            {invoice.dueAt && <p className="text-sm">Échéance : {formatDate(invoice.dueAt, { day: "numeric", month: "long", year: "numeric" })}</p>}
            <p>
              <Badge tone={status.tone}>{status.label}</Badge>
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-xs font-bold tracking-wider text-foreground-light uppercase">Client</p>
          <p className="font-semibold">{`${invoice.owner.firstName} ${invoice.owner.lastName}`}</p>
          {invoice.owner.address && <p>{invoice.owner.address}</p>}
          <p className="text-sm text-foreground-light">{[invoice.owner.phone, invoice.owner.email].filter(Boolean).join(" · ")}</p>
        </div>
        <DataTable
          caption="Lignes de la facture"
          rows={invoice.lines}
          rowKey={(l) => l.id}
          empty="Aucune ligne : ajoutez-en une ci-dessous."
          columns={[
            { header: "Désignation", cell: (l) => l.label },
            { header: "Qté", align: "right", cell: (l) => l.quantity },
            { header: "Prix unitaire", align: "right", cell: (l) => <span className="whitespace-nowrap">{formatEuros(l.unitPriceCents)}</span> },
            { header: "Montant", align: "right", cell: (l) => <span className="whitespace-nowrap font-semibold">{formatEuros(l.quantity * l.unitPriceCents)}</span> },
            ...(draft ? [{ header: "Action", cell: (l: (typeof invoice.lines)[number]) => <RemoveLineButton id={l.id} label={l.label} /> }] : []),
          ]}
        />
        <p className="text-right font-heading text-2xl font-bold tabular-nums">Total : {formatEuros(total)}</p>
        <p className="text-sm text-foreground-light">TVA non applicable, article 293 B du CGI.</p>
        {invoice.paidAt && <p className="font-semibold text-success-fg">Payée le {formatDate(invoice.paidAt, { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" })}.</p>}
      </Card>

      <Card title="Actions" className="print:hidden">
        <StatusActions id={invoice.id} status={invoice.status} />
        {draft && <AddLineForm invoiceId={invoice.id} />}
        {uninvoicedSessions > 0 && <InvoiceSessionsButton ownerId={invoice.ownerId} count={uninvoicedSessions} />}
      </Card>
    </>
  );
}
