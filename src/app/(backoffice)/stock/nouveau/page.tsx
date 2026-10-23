import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, PageHeader } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { ProductForm } from "../stock-forms";

export const metadata: Metadata = { title: "Nouveau produit" };

export default async function NewProductPage() {
  await requireRole("ADMIN"); // 403 avant tout rendu
  return (
    <>
      <PageHeader title="Nouveau produit" />
      <Card>
        <Suspense fallback={<p className="text-foreground-light">Chargement…</p>}>
          <AdminOnly />
        </Suspense>
      </Card>
    </>
  );
}

// La page est réservée à la gérance ; l'action createProduct revérifie le rôle de toute façon.
async function AdminOnly() {
  await requireRole("ADMIN");
  return <ProductForm />;
}
