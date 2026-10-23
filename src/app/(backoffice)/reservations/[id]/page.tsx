import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink, focusRing } from "@/components/ui/button";
import { Avatar, Card, PageHeader } from "@/components/ui/card";
import { nights } from "@/lib/bookings";
import { formatDate, formatEuros } from "@/lib/format";
import { getBooking } from "@/lib/queries";
import { bookingStatus } from "@/lib/status";
import { BookingActions } from "./booking-actions";

export async function generateMetadata({ params }: PageProps<"/reservations/[id]">): Promise<Metadata> {
  const { booking } = await getBooking((await params).id);
  return { title: booking ? `Séjour de ${booking.dog.name}` : "Réservation introuvable" };
}

export default function BookingPage({ params }: PageProps<"/reservations/[id]">) {
  return (
    <Suspense fallback={<p className="text-foreground-light">Chargement de la réservation…</p>}>
      <Booking params={params} />
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

async function Booking({ params }: { params: PageProps<"/reservations/[id]">["params"] }) {
  const { id } = await params;
  const { booking, kennels, user } = await getBooking(id);
  if (!booking) notFound();
  const n = nights(booking.startDate, booking.endDate);
  const status = bookingStatus[booking.status];

  return (
    <>
      <PageHeader
        leading={<Avatar name={booking.dog.name} size={64} />}
        title={`Séjour de ${booking.dog.name}`}
        subtitle={`Du ${formatDate(booking.startDate, { day: "numeric", month: "long" })} au ${formatDate(booking.endDate, { day: "numeric", month: "long", year: "numeric" })}`}
        actions={
          <ButtonLink href={`/reservations?semaine=${booking.startDate.toISOString().slice(0, 10)}`} variant="secondary" icon="chevronGauche">
            Voir le planning
          </ButtonLink>
        }
      />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <Card title="Détails">
          <dl className="flex flex-col gap-3">
            <Row label="Statut">
              <Badge tone={status.tone}>{status.label}</Badge>
            </Row>
            <Row label="Chien">
              <Link href={`/chiens/${booking.dog.id}`} className={`rounded-sm font-semibold underline ${focusRing}`}>
                {booking.dog.name}
              </Link>
              {booking.dog.allergies && <span className="ml-2"><Badge tone="danger">Allergie : {booking.dog.allergies.toLowerCase()}</Badge></span>}
            </Row>
            <Row label="Propriétaire">{`${booking.dog.owner.firstName} ${booking.dog.owner.lastName} · ${booking.dog.owner.phone}`}</Row>
            <Row label="Box">{booking.kennel?.name ?? "À attribuer"}</Row>
            <Row label="Durée">{`${n} nuit${n > 1 ? "s" : ""}`}</Row>
            <Row label="Montant">{`${formatEuros(booking.nightlyRateCents * n)} (${formatEuros(booking.nightlyRateCents)} / nuit)`}</Row>
            {booking.notes && <Row label="Remarque">{booking.notes}</Row>}
          </dl>
        </Card>
        <Card title="Actions">
          {booking.status === "COMPLETED" || booking.status === "CANCELLED" ? (
            <p className="text-foreground-light">Ce séjour est {status.label.toLowerCase()} : plus aucune action possible.</p>
          ) : (
            <BookingActions id={booking.id} status={booking.status} kennelId={booking.kennelId} kennels={kennels} isAdmin={user.role === "ADMIN"} />
          )}
        </Card>
      </div>
    </>
  );
}
