import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, PageHeader } from "@/components/ui/card";
import { utcDay } from "@/lib/format";
import { getBookingFormOptions } from "@/lib/queries";
import { BookingForm } from "./booking-form";

export const metadata: Metadata = { title: "Nouvelle réservation" };

export default function NewBookingPage({ searchParams }: PageProps<"/reservations/nouvelle">) {
  return (
    <>
      <PageHeader title="Nouvelle réservation" subtitle="Séjour en pension" />
      <Card>
        <Suspense fallback={<p className="text-foreground-light">Chargement du formulaire…</p>}>
          <Form searchParams={searchParams} />
        </Suspense>
      </Card>
    </>
  );
}

async function Form({ searchParams }: { searchParams: PageProps<"/reservations/nouvelle">["searchParams"] }) {
  const { chien } = await searchParams;
  const { dogs, kennels } = await getBookingFormOptions();
  const today = utcDay(new Date()).toISOString().slice(0, 10);
  return <BookingForm dogs={dogs} kennels={kennels} today={today} defaultDogId={typeof chien === "string" ? chien : undefined} />;
}
