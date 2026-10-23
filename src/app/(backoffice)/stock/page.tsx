import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ButtonLink, focusRing } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { Card, KpiCard, PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { getProducts } from "@/lib/queries";
import { productCategory } from "@/lib/status";

export const metadata: Metadata = { title: "Stock" };

export default function StockPage() {
  return (
    <>
      <PageHeader title="Stock" />
      <Suspense fallback={<p className="text-foreground-light">Chargement du stock…</p>}>
        <Stock />
      </Suspense>
    </>
  );
}

async function Stock() {
  const [{ products, outThisWeek }, user] = await Promise.all([getProducts(), getCurrentUser()]);
  const low = products.filter((p) => p.quantity <= p.alertThreshold);
  return (
    <>
      <section aria-label="Indicateurs" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Produits suivis" value={String(products.length)} />
        <KpiCard label="Sous le seuil" value={String(low.length)} detail={low.map((p) => p.name).join(", ") || "Aucun"} />
        <KpiCard label="Sorties sur 7 jours" value={String(outThisWeek)} detail="Unités sorties du stock" />
      </section>
      <Card
        title="Produits"
        action={
          user.role === "ADMIN" && (
            <ButtonLink href="/stock/nouveau" icon="plus" variant="secondary">
              Ajouter un produit
            </ButtonLink>
          )
        }
      >
        <DataTable
          caption="Produits en stock"
          rows={products}
          rowKey={(p) => p.id}
          columns={[
            {
              header: "Produit",
              cell: (p) => (
                <Link href={`/stock/${p.id}`} className={`rounded-sm font-semibold hover:underline ${focusRing}`}>
                  {p.name} <span className="font-normal text-foreground-light">· {p.unit}</span>
                </Link>
              ),
            },
            { header: "Catégorie", cell: (p) => productCategory[p.category] },
            { header: "Quantité", align: "right", cell: (p) => p.quantity },
            { header: "Seuil", align: "right", cell: (p) => p.alertThreshold },
            { header: "État", cell: (p) => (p.quantity <= p.alertThreshold ? <Badge tone="danger">Stock bas</Badge> : <Badge tone="success">Suffisant</Badge>) },
            {
              header: "Action",
              cell: (p) => (
                <ButtonLink href={`/stock/${p.id}`} variant="ghost" aria-label={`Enregistrer un mouvement pour ${p.name}`}>
                  Mouvement
                </ButtonLink>
              ),
            },
          ]}
        />
      </Card>
    </>
  );
}
