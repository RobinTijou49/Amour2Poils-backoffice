import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Card, PageHeader } from "@/components/ui/card";
import { utcDay } from "@/lib/format";
import { getDog, getOwners } from "@/lib/queries";
import { DogForm } from "../../dog-form";

export const metadata: Metadata = { title: "Modifier un chien" };

export default function EditDogPage({ params }: PageProps<"/chiens/[id]/modifier">) {
  return (
    <Suspense fallback={<p className="text-foreground-light">Chargement de la fiche…</p>}>
      <Edit params={params} />
    </Suspense>
  );
}

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : undefined);
const text = (s: string | null) => s ?? undefined;

async function Edit({ params }: { params: PageProps<"/chiens/[id]/modifier">["params"] }) {
  const { id } = await params;
  const [dog, owners] = await Promise.all([getDog(id), getOwners()]);
  if (!dog) notFound();
  return (
    <>
      <PageHeader title={`Modifier ${dog.name}`} />
      <Card>
        <DogForm
          owners={owners}
          today={utcDay(new Date()).toISOString().slice(0, 10)}
          cancelHref={`/chiens/${dog.id}`}
          dog={{
            id: dog.id,
            ownerId: dog.ownerId,
            name: dog.name,
            breed: text(dog.breed),
            sex: dog.sex,
            birthDate: day(dog.birthDate),
            weightKg: dog.weightKg?.toString(),
            sterilized: dog.sterilized,
            chipNumber: text(dog.chipNumber),
            allergies: text(dog.allergies),
            diet: text(dog.diet),
            behaviorNotes: text(dog.behaviorNotes),
            vetName: text(dog.vetName),
            vetPhone: text(dog.vetPhone),
          }}
        />
      </Card>
    </>
  );
}
