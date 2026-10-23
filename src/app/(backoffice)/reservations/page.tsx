import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink, focusRing } from "@/components/ui/button";
import { Avatar, Card, PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { daysBetween, formatDate, mondayOf, utcDay } from "@/lib/format";
import { getWeekPlanning } from "@/lib/queries";
import { bookingStatus } from "@/lib/status";

export const metadata: Metadata = { title: "Réservations" };

const barTone = {
  PENDING: "bg-warning-bg text-warning-fg border-warning-fg",
  CONFIRMED: "bg-success-bg text-success-fg border-success-fg",
  CHECKED_IN: "bg-info-bg text-info-fg border-info-fg",
  COMPLETED: "bg-background-alt text-foreground-light border-foreground-light",
  CANCELLED: "bg-background-alt text-foreground-light border-foreground-light",
} as const;

export default function ReservationsPage({ searchParams }: PageProps<"/reservations">) {
  return (
    <Suspense fallback={<PageHeader title="Réservations" subtitle="Chargement du planning…" />}>
      <Planning searchParams={searchParams} />
    </Suspense>
  );
}

function parseWeek(value: string | string[] | undefined) {
  const d = typeof value === "string" ? new Date(`${value}T00:00:00Z`) : new Date();
  return mondayOf(Number.isNaN(d.getTime()) ? new Date() : d);
}

async function Planning({ searchParams }: { searchParams: PageProps<"/reservations">["searchParams"] }) {
  const { semaine } = await searchParams;
  await connection();
  const monday = parseWeek(semaine);
  const { kennels, pending, today } = await getWeekPlanning(monday);
  const days = Array.from({ length: 7 }, (_, i) => utcDay(monday, i));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const sunday = days[6];

  return (
    <>
      <PageHeader
        title="Réservations"
        subtitle={`Semaine du ${formatDate(monday, { day: "numeric", month: "long" })} au ${formatDate(sunday, { day: "numeric", month: "long", year: "numeric" })} · ${kennels.length} boxes`}
        actions={
          <>
            <ButtonLink href={`/reservations?semaine=${iso(utcDay(monday, -7))}`} variant="secondary" icon="chevronGauche">
              Semaine précédente
            </ButtonLink>
            <ButtonLink href={`/reservations?semaine=${iso(utcDay(monday, 7))}`} variant="secondary">
              Semaine suivante
            </ButtonLink>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold text-foreground-light">Légende :</span>
        {(["CHECKED_IN", "CONFIRMED", "PENDING", "COMPLETED"] as const).map((s) => (
          <Badge key={s} tone={bookingStatus[s].tone}>
            {bookingStatus[s].label}
          </Badge>
        ))}
      </div>

      <Card className="p-0!">
        <div className="overflow-x-auto">
          <div role="table" aria-label="Planning des boxes" className="grid min-w-[880px] grid-cols-[120px_repeat(7,minmax(0,1fr))]">
            <div role="row" className="contents">
              <span role="columnheader" className="bg-background-alt px-4 py-3 text-sm font-semibold text-foreground-light">
                Box
              </span>
              {days.map((d) => {
                const isToday = d.getTime() === today.getTime();
                return (
                  <span
                    role="columnheader"
                    key={d.toISOString()}
                    aria-current={isToday ? "date" : undefined}
                    className={`bg-background-alt px-3 py-3 text-sm ${isToday ? "border-b-3 border-primary font-bold text-primary" : "text-foreground-light"}`}
                  >
                    {formatDate(d, { weekday: "short", day: "numeric" })}
                  </span>
                );
              })}
            </div>
            {kennels.map((k) => (
              <div role="row" key={k.id} className="relative col-span-8 grid grid-cols-subgrid border-t border-border">
                <span role="rowheader" className="flex h-16 items-center px-4 text-sm font-semibold">
                  {k.name}
                </span>
                {days.map((d) => (
                  <span key={d.toISOString()} className="border-l border-border" aria-hidden="true" />
                ))}
                <div role="cell" className="pointer-events-none absolute inset-y-0 right-0 left-[120px] grid grid-cols-7 items-center">
                  {k.bookings.length === 0 && <span className="sr-only">Libre toute la semaine</span>}
                  {k.bookings.map((b) => {
                    const start = Math.max(0, daysBetween(monday, b.startDate));
                    const end = Math.min(7, daysBetween(monday, b.endDate));
                    return (
                      <Link
                        key={b.id}
                        href={`/chiens/${b.dog.id}`}
                        style={{ gridColumn: `${start + 1} / ${end + 1}`, gridRow: 1 }}
                        className={`pointer-events-auto mx-1 flex h-10 items-center truncate rounded-sm border-l-4 px-3 text-sm font-semibold ${barTone[b.status]} ${focusRing}`}
                      >
                        {b.dog.name}
                        <span className="sr-only">
                          , {bookingStatus[b.status].label}, du {formatDate(b.startDate, { day: "numeric", month: "long" })} au {formatDate(b.endDate, { day: "numeric", month: "long" })}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card title="Demandes en attente">
        <DataTable
          caption="Demandes de réservation sans box attribuée"
          rows={pending}
          rowKey={(b) => b.id}
          empty="Aucune demande en attente."
          columns={[
            {
              header: "Chien",
              cell: (b) => (
                <span className="flex items-center gap-3">
                  <Avatar name={b.dog.name} />
                  <span>
                    {b.dog.name}
                    {b.dog.breed && <span className="text-foreground-light"> · {b.dog.breed}</span>}
                  </span>
                </span>
              ),
            },
            {
              header: "Dates",
              cell: (b) =>
                `${formatDate(b.startDate, { day: "numeric", month: "short" })} → ${formatDate(b.endDate, { day: "numeric", month: "short" })} · ${daysBetween(b.startDate, b.endDate)} nuits`,
            },
            { header: "Statut", cell: (b) => <Badge tone={bookingStatus[b.status].tone}>{bookingStatus[b.status].label}</Badge> },
          ]}
        />
      </Card>
    </>
  );
}
