import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, PageHeader } from "@/components/ui/card";
import { utcDay } from "@/lib/format";
import { getOwners } from "@/lib/queries";
import { DogForm } from "../dog-form";

export const metadata: Metadata = { title: "Nouveau chien" };

export default function NewDogPage() {
  return (
    <>
      <PageHeader title="Nouveau chien" subtitle="Fiche du chien et de son propriétaire" />
      <Card>
        <Suspense fallback={<p className="text-foreground-light">Chargement du formulaire…</p>}>
          <Form />
        </Suspense>
      </Card>
    </>
  );
}

async function Form() {
  const owners = await getOwners();
  return <DogForm owners={owners} today={utcDay(new Date()).toISOString().slice(0, 10)} cancelHref="/chiens" />;
}
