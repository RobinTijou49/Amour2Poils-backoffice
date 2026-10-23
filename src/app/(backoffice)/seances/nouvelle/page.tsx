import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Card, PageHeader } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { utcDay } from "@/lib/format";
import { SessionForm } from "../session-forms";

export const metadata: Metadata = { title: "Planifier une séance" };

export default function NewSessionPage() {
  return (
    <>
      <PageHeader title="Planifier une séance" subtitle="Cours d'éducation ou visite de petsitting" />
      <Card>
        <Suspense fallback={<p className="text-foreground-light">Chargement du formulaire…</p>}>
          <Form />
        </Suspense>
      </Card>
    </>
  );
}

async function Form() {
  await Promise.all([getCurrentUser(), connection()]);
  return <SessionForm today={utcDay(new Date()).toISOString().slice(0, 10)} />;
}
