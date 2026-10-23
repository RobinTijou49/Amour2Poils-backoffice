import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { focusRing } from "@/components/ui/button";
import { Avatar, Card, PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { utcDay } from "@/lib/format";
import { getDogs } from "@/lib/queries";

export const metadata: Metadata = { title: "Clients et chiens" };

export default function DogsPage() {
  return (
    <>
      <PageHeader title="Clients et chiens" />
      <Suspense fallback={<p className="text-foreground-light">Chargement des chiens…</p>}>
        <DogList />
      </Suspense>
    </>
  );
}

async function DogList() {
  const dogs = await getDogs();
  const today = utcDay(new Date());
  return (
    <Card>
      <DataTable
        caption="Chiens et propriétaires"
        rows={dogs}
        rowKey={(d) => d.id}
        empty="Aucun chien enregistré."
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
