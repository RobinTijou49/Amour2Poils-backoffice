import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, KpiCard, PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { de, formatDate, formatTime } from "@/lib/format";
import { getProduct } from "@/lib/queries";
import { productCategory } from "@/lib/status";
import { MovementForm } from "../stock-forms";

export async function generateMetadata({ params }: PageProps<"/stock/[id]">): Promise<Metadata> {
  const { product } = await getProduct((await params).id);
  return { title: product ? product.name : "Produit introuvable" };
}

export default function ProductPage({ params }: PageProps<"/stock/[id]">) {
  return (
    <Suspense fallback={<p className="text-foreground-light">Chargement du produit…</p>}>
      <Product params={params} />
    </Suspense>
  );
}

const movementLabel = { IN: { label: "Entrée", tone: "success" }, OUT: { label: "Sortie", tone: "info" }, ADJUSTMENT: { label: "Inventaire", tone: "neutral" } } as const;

async function Product({ params }: { params: PageProps<"/stock/[id]">["params"] }) {
  const { id } = await params;
  const { product } = await getProduct(id);
  if (!product) notFound();
  const low = product.quantity <= product.alertThreshold;

  return (
    <>
      <PageHeader
        title={product.name}
        subtitle={`${productCategory[product.category]} · ${product.unit}`}
        actions={
          <ButtonLink href="/stock" variant="secondary" icon="chevronGauche">
            Tout le stock
          </ButtonLink>
        }
      />
      <section aria-label="Indicateurs" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <KpiCard label="En stock" value={`${product.quantity}`} detail={product.unit} />
        <KpiCard label="Seuil d'alerte" value={`${product.alertThreshold}`} detail={low ? "Stock bas : prévoir une commande" : "Stock suffisant"} />
      </section>
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <Card title="Nouveau mouvement">
          <MovementForm productId={product.id} unit={product.unit} />
        </Card>
        <Card title="Derniers mouvements">
          <DataTable
            caption={`Derniers mouvements ${de(product.name)}`}
            rows={product.movements}
            rowKey={(m) => m.id}
            empty="Aucun mouvement enregistré."
            columns={[
              { header: "Date", cell: (m) => <span className="whitespace-nowrap">{`${formatDate(m.createdAt, { day: "numeric", month: "short", timeZone: "Europe/Paris" })} ${formatTime(m.createdAt)}`}</span> },
              { header: "Type", cell: (m) => <Badge tone={movementLabel[m.type].tone}>{movementLabel[m.type].label}</Badge> },
              { header: "Qté", align: "right", cell: (m) => m.quantity },
              { header: "Par", cell: (m) => m.user?.name ?? "—" },
              { header: "Motif", cell: (m) => m.reason ?? "—" },
            ]}
          />
        </Card>
      </div>
    </>
  );
}
