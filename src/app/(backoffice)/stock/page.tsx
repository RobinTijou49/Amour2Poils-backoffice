import type { Metadata } from "next";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
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
  const { products, outThisWeek } = await getProducts();
  const low = products.filter((p) => p.quantity <= p.alertThreshold);
  return (
    <>
      <section aria-label="Indicateurs" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Produits suivis" value={String(products.length)} />
        <KpiCard label="Sous le seuil" value={String(low.length)} detail={low.map((p) => p.name).join(", ") || "Aucun"} />
        <KpiCard label="Sorties sur 7 jours" value={String(outThisWeek)} detail="Unités sorties du stock" />
      </section>
      <Card title="Produits">
        <DataTable
          caption="Produits en stock"
          rows={products}
          rowKey={(p) => p.id}
          columns={[
            { header: "Produit", cell: (p) => <span>{p.name} <span className="text-foreground-light">· {p.unit}</span></span> },
            { header: "Catégorie", cell: (p) => productCategory[p.category] },
            { header: "Quantité", align: "right", cell: (p) => p.quantity },
            { header: "Seuil", align: "right", cell: (p) => p.alertThreshold },
            { header: "État", cell: (p) => (p.quantity <= p.alertThreshold ? <Badge tone="danger">Stock bas</Badge> : <Badge tone="success">Suffisant</Badge>) },
          ]}
        />
      </Card>
    </>
  );
}
