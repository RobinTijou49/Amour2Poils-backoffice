import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ButtonLink, focusRing } from "@/components/ui/button";
import { Avatar, Card, PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { ageInYears, daysBetween, formatDate, utcDay } from "@/lib/format";
import { getCurrentUser } from "@/lib/auth";
import { getDog } from "@/lib/queries";
import { bookingStatus } from "@/lib/status";
import { DeleteDog, DeleteVaccineButton, VaccineForm } from "./dog-forms";

export async function generateMetadata({ params }: PageProps<"/chiens/[id]">): Promise<Metadata> {
  const dog = await getDog((await params).id);
  return { title: dog ? dog.name : "Chien introuvable" };
}

export default function DogPage({ params }: PageProps<"/chiens/[id]">) {
  return (
    <Suspense fallback={<p className="text-foreground-light">Chargement de la fiche…</p>}>
      <DogSheet params={params} />
    </Suspense>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-[160px_1fr] sm:gap-3">
      <dt className="text-sm text-foreground-light">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

async function DogSheet({ params }: { params: PageProps<"/chiens/[id]">["params"] }) {
  const { id } = await params;
  const [dog, user] = await Promise.all([getDog(id), getCurrentUser()]);
  if (!dog) notFound();
  const today = utcDay(new Date());
  const todayIso = today.toISOString().slice(0, 10);
  const current = dog.bookings.find((b) => b.status === "CHECKED_IN");
  const facts = [
    dog.breed,
    dog.sex === "MALE" ? "Mâle" : "Femelle",
    dog.birthDate && `${ageInYears(dog.birthDate, today)} ans`,
    dog.weightKg && `${dog.weightKg.toString().replace(".", ",")} kg`,
  ].filter(Boolean);
  const vaccineStatus = (expires: Date) => {
    const days = daysBetween(today, expires);
    if (days < 0) return <Badge tone="danger">Expiré</Badge>;
    if (days <= 30) return <Badge tone="warning">Expire dans {days} jours</Badge>;
    return <Badge tone="success">À jour</Badge>;
  };

  return (
    <>
      <PageHeader
        leading={<Avatar name={dog.name} size={64} />}
        title={dog.name}
        subtitle={facts.join(" · ")}
        actions={
          <>
            <ButtonLink href="/chiens" variant="secondary" icon="chevronGauche">
              Tous les chiens
            </ButtonLink>
            <ButtonLink href={`/chiens/${dog.id}/modifier`} variant="secondary">
              Modifier
            </ButtonLink>
            <ButtonLink href={`/reservations/nouvelle?chien=${dog.id}`} icon="plus">
              Réserver un séjour
            </ButtonLink>
          </>
        }
      />
      <div className="flex flex-wrap gap-2">
        {current && <Badge tone="info">En pension · {current.kennel?.name}</Badge>}
        {dog.sterilized && <Badge tone="neutral">Stérilisé</Badge>}
        {dog.allergies && <Badge tone="danger">Allergie : {dog.allergies.toLowerCase()}</Badge>}
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-4">
          <Card title="Identité">
            <dl className="flex flex-col gap-3">
              {dog.birthDate && <Row label="Né le">{formatDate(dog.birthDate, { day: "numeric", month: "long", year: "numeric" })}</Row>}
              {dog.chipNumber && <Row label="Puce">{dog.chipNumber}</Row>}
              <Row label="Propriétaire">{`${dog.owner.firstName} ${dog.owner.lastName}`}</Row>
              <Row label="Téléphone">{dog.owner.phone}</Row>
              {dog.vetName && <Row label="Vétérinaire">{[dog.vetName, dog.vetPhone].filter(Boolean).join(" · ")}</Row>}
            </dl>
          </Card>
          <Card title="Comportement et alimentation">
            <dl className="flex flex-col gap-3">
              <Row label="Comportement">{dog.behaviorNotes ?? "Rien de particulier"}</Row>
              <Row label="Régime">{dog.diet ?? "Non précisé"}</Row>
              <Row label="Allergies">{dog.allergies ?? "Aucune connue"}</Row>
            </dl>
          </Card>
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <Card title="Vaccins">
            <DataTable
              caption={`Vaccins de ${dog.name}`}
              rows={dog.vaccinations}
              rowKey={(v) => v.id}
              empty="Aucun vaccin enregistré."
              columns={[
                { header: "Vaccin", cell: (v) => v.name },
                { header: "Expire le", cell: (v) => formatDate(v.expiresAt) },
                { header: "Statut", cell: (v) => vaccineStatus(v.expiresAt) },
                { header: "Action", cell: (v) => <DeleteVaccineButton id={v.id} name={v.name} /> },
              ]}
            />
            <VaccineForm dogId={dog.id} today={todayIso} />
          </Card>
          <Card title="Séjours">
            <DataTable
              caption={`Séjours de ${dog.name}`}
              rows={dog.bookings}
              rowKey={(b) => b.id}
              empty="Aucun séjour."
              columns={[
                {
                  header: "Dates",
                  cell: (b) => (
                    <Link href={`/reservations/${b.id}`} className={`rounded-sm underline ${focusRing}`}>
                      {`${formatDate(b.startDate, { day: "numeric", month: "short" })} → ${formatDate(b.endDate)}`}
                    </Link>
                  ),
                },
                { header: "Box", cell: (b) => b.kennel?.name ?? "—" },
                { header: "Statut", cell: (b) => <Badge tone={bookingStatus[b.status].tone}>{bookingStatus[b.status].label}</Badge> },
              ]}
            />
          </Card>
        </div>
      </div>
      {user.role === "ADMIN" && <DeleteDog id={dog.id} name={dog.name} />}
    </>
  );
}
