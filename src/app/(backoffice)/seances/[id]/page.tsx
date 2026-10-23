import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink, focusRing } from "@/components/ui/button";
import { Avatar, Card, PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { capitalize, formatDate, formatEuros, formatTime } from "@/lib/format";
import { getSession } from "@/lib/queries";
import { sessionType } from "@/lib/status";
import { InvoiceSessionsButton } from "../../facturation/[id]/invoice-actions";
import { EnrollForm, EnrollmentActions } from "../session-forms";

export async function generateMetadata({ params }: PageProps<"/seances/[id]">): Promise<Metadata> {
  const { session } = await getSession((await params).id);
  return { title: session ? session.title : "Séance introuvable" };
}

export default function SessionPage({ params }: PageProps<"/seances/[id]">) {
  return (
    <Suspense fallback={<p className="text-foreground-light">Chargement de la séance…</p>}>
      <Session params={params} />
    </Suspense>
  );
}

async function Session({ params }: { params: PageProps<"/seances/[id]">["params"] }) {
  const { id } = await params;
  const { session, dogs, user } = await getSession(id);
  if (!session) notFound();
  const count = session.enrollments.length;
  const full = count >= session.capacity;
  const past = session.startsAt < new Date();
  const enrolledIds = new Set(session.enrollments.map((e) => e.dogId));

  return (
    <>
      <PageHeader
        title={session.title}
        subtitle={`${sessionType[session.type]} · ${capitalize(formatDate(session.startsAt, { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" }))} à ${formatTime(session.startsAt)} · ${session.durationMin} min`}
        actions={
          <ButtonLink href="/seances" variant="secondary" icon="chevronGauche">
            Toutes les séances
          </ButtonLink>
        }
      />
      <div className="flex flex-wrap gap-2">
        <Badge tone={full ? "warning" : "success"}>{full ? `Complet · ${count}/${session.capacity}` : `${count} / ${session.capacity} inscrits`}</Badge>
        <Badge tone="neutral">{formatEuros(session.priceCents)} par chien</Badge>
        {session.location && <Badge tone="info">{session.location}</Badge>}
        {past && <Badge tone="neutral">Séance passée</Badge>}
      </div>
      <Card title="Inscrits">
        <DataTable
          caption={`Chiens inscrits à ${session.title}`}
          rows={session.enrollments}
          rowKey={(e) => e.id}
          empty="Aucun chien inscrit pour l'instant."
          columns={[
            {
              header: "Chien",
              cell: (e) => (
                <Link href={`/chiens/${e.dog.id}`} className={`flex items-center gap-3 rounded-sm font-semibold hover:underline ${focusRing}`}>
                  <Avatar name={e.dog.name} />
                  {e.dog.name}
                </Link>
              ),
            },
            { header: "Propriétaire", cell: (e) => `${e.dog.owner.firstName} ${e.dog.owner.lastName}` },
            {
              header: "Présence",
              cell: (e) => (e.attended === null ? (past ? "À noter" : "—") : <Badge tone={e.attended ? "success" : "danger"}>{e.attended ? "Présent" : "Absent"}</Badge>),
            },
            {
              header: "Facture",
              cell: (e) =>
                e.invoiceLines.length ? (
                  <Badge tone="info">Facturée</Badge>
                ) : user.role === "ADMIN" && e.attended !== false ? (
                  <InvoiceSessionsButton ownerId={e.dog.ownerId} compact />
                ) : (
                  "—"
                ),
            },
            { header: "Action", cell: (e) => <EnrollmentActions id={e.id} dogName={e.dog.name} attended={e.attended} past={past} /> },
          ]}
        />
        {!past && <EnrollForm sessionId={session.id} full={full} dogs={dogs.filter((d) => !enrolledIds.has(d.id))} />}
        {past && <p className="text-sm text-foreground-light">Les chiens notés absents ne sont pas facturés.</p>}
      </Card>
    </>
  );
}
