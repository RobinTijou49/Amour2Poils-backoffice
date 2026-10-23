import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink, focusRing } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Avatar, Card, PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { utcDay } from "@/lib/format";
import { getDogs } from "@/lib/queries";

export const metadata: Metadata = { title: "Clients et chiens" };

export default function DogsPage({ searchParams }: PageProps<"/chiens">) {
  return (
    <>
      <PageHeader
        title="Clients et chiens"
        actions={
          <ButtonLink href="/chiens/nouveau" icon="plus">
            Nouveau chien
          </ButtonLink>
        }
      />
      <Suspense fallback={<p className="text-foreground-light">Chargement des chiens…</p>}>
        <DogList searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function DogList({ searchParams }: { searchParams: PageProps<"/chiens">["searchParams"] }) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q : "";
  const dogs = await getDogs(query);
  const today = utcDay(new Date());
  return (
    <Card>
      {/* Formulaire GET : la recherche fonctionne même sans JavaScript et l'URL peut être partagée. */}
      <form role="search" action="/chiens" className="flex flex-wrap items-end gap-3">
        <Field label="Rechercher un chien ou un propriétaire" name="q" type="search" defaultValue={query} className="min-w-64 flex-1" />
        <Button type="submit" variant="secondary">
          Rechercher
        </Button>
        {query && (
          <ButtonLink href="/chiens" variant="ghost">
            Effacer
          </ButtonLink>
        )}
      </form>
      <p role="status" className="text-sm text-foreground-light">
        {dogs.length} chien{dogs.length > 1 ? "s" : ""}
        {query ? ` pour « ${query} »` : ""}
      </p>
      <DataTable
        caption="Chiens et propriétaires"
        rows={dogs}
        rowKey={(d) => d.id}
        empty={query ? "Aucun chien ne correspond à cette recherche." : "Aucun chien enregistré."}
        columns={[
          {
            header: "Chien",
            cell: (d) => (
              <Link href={`/chiens/${d.id}`} className={`flex items-center gap-3 rounded-sm font-semibold hover:underline ${focusRing}`}>
                <Avatar name={d.name} />
                {d.name}
              </Link>
            ),
          },
          { header: "Race", cell: (d) => d.breed ?? "—" },
          { header: "Propriétaire", cell: (d) => `${d.owner.firstName} ${d.owner.lastName}` },
          { header: "Téléphone", cell: (d) => <span className="whitespace-nowrap">{d.owner.phone}</span> },
          {
            header: "Statut",
            cell: (d) => (
              <span className="flex flex-wrap gap-2">
                {d.bookings[0] && <Badge tone="info">En pension · {d.bookings[0].kennel?.name}</Badge>}
                {d.vaccinations.some((v) => v.expiresAt < today) && <Badge tone="danger">Vaccin expiré</Badge>}
                {d.allergies && <Badge tone="warning">Allergie</Badge>}
              </span>
            ),
          },
        ]}
      />
    </Card>
  );
}
