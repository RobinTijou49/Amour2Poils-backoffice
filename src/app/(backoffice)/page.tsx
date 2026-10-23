import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink, focusRing } from "@/components/ui/button";
import { Avatar, Card, KpiCard, PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Icon } from "@/components/ui/icons";
import { capitalize, daysBetween, formatDate, formatEuros, formatTime } from "@/lib/format";
import { getDashboard } from "@/lib/queries";
import { kennelSize, sessionType } from "@/lib/status";

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Tableau de bord"
        actions={
          <>
            <ButtonLink href="/chiens" variant="secondary" icon="clients">
              Clients et chiens
            </ButtonLink>
            <ButtonLink href="/reservations" icon="plus">
              Nouvelle réservation
            </ButtonLink>
          </>
        }
      />
      <Suspense fallback={<p className="text-foreground-light">Chargement des données du jour…</p>}>
        <Dashboard />
      </Suspense>
    </>
  );
}

async function Dashboard() {
  const d = await getDashboard();
  const movements = [
    ...d.arrivals.map((b) => ({ id: b.id, dog: b.dog, kennel: b.kennel?.name ?? "—", what: "Arrivée", tone: "warning" as const })),
    ...d.departures.map((b) => ({ id: b.id, dog: b.dog, kennel: b.kennel?.name ?? "—", what: "Départ", tone: "info" as const })),
  ];
  const alerts = [
    ...d.vaccinations.map((v) => {
      const days = daysBetween(d.today, v.expiresAt);
      return {
        key: v.id,
        tone: days < 0 ? "text-danger-fg" : "text-warning-fg",
        title: days < 0 ? "Vaccin expiré" : "Vaccin bientôt expiré",
        detail: `${v.dog.name} · ${v.name} ${days < 0 ? `expiré depuis ${-days} jours` : `expire dans ${days} jours`}`,
        href: `/chiens/${v.dogId}`,
      };
    }),
    ...d.lowStock.map((p) => ({ key: p.id, tone: "text-warning-fg", title: "Stock bas", detail: `${p.name} · ${p.quantity} ${p.unit} restant(s) (seuil ${p.alertThreshold})`, href: "/stock" })),
    ...d.invoices.map((i) => ({
      key: i.id,
      tone: "text-info-fg",
      title: "Facture à échéance",
      detail: `${i.number} · ${i.owner.firstName} ${i.owner.lastName} · ${formatEuros(i.lines.reduce((s, l) => s + l.quantity * l.unitPriceCents, 0))}`,
      href: "/facturation",
    })),
  ];
  const occupancy = d.capacity ? Math.round((d.present / d.capacity) * 100) : 0;

  return (
    <>
      <p className="-mt-4 text-foreground-light">{capitalize(formatDate(d.today, { weekday: "long", day: "numeric", month: "long", year: "numeric" }))}</p>
      <section aria-label="Indicateurs" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Chiens présents" value={`${d.present} / ${d.capacity}`} detail={`Taux d'occupation ${occupancy} %`} />
        <KpiCard label="Arrivées" value={String(d.arrivals.length)} detail={d.arrivals.map((b) => b.dog.name).join(", ") || "Aucune aujourd'hui"} />
        <KpiCard label="Départs" value={String(d.departures.length)} detail={d.departures.map((b) => b.dog.name).join(", ") || "Aucun aujourd'hui"} />
        <KpiCard label="Alertes" value={String(alerts.length)} detail="Vaccins, stock, factures" />
      </section>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_360px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card title="Mouvements du jour">
            <DataTable
              caption="Arrivées et départs du jour"
              rows={movements}
              rowKey={(m) => m.id}
              empty="Aucune arrivée ni aucun départ aujourd'hui."
              columns={[
                {
                  header: "Chien",
                  cell: (m) => (
                    <Link href={`/chiens/${m.dog.id}`} className={`flex items-center gap-3 rounded-sm font-semibold hover:underline ${focusRing}`}>
                      <Avatar name={m.dog.name} />
                      {m.dog.name}
                      {m.dog.breed && <span className="font-normal text-foreground-light">· {m.dog.breed}</span>}
                    </Link>
                  ),
                },
                { header: "Box", cell: (m) => m.kennel },
                { header: "Mouvement", cell: (m) => <Badge tone={m.tone}>{m.what}</Badge> },
              ]}
            />
          </Card>
          <Card title="Séances du jour">
            {d.sessions.length === 0 ? (
              <p className="text-foreground-light">Aucune séance aujourd&apos;hui.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {d.sessions.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-3">
                    <span className="font-bold tabular-nums">{formatTime(s.startsAt)}</span>
                    <span>{s.title}</span>
                    <Badge tone="success">{sessionType[s.type]}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Card title="À traiter">
            {alerts.length === 0 ? (
              <p className="text-foreground-light">Rien à signaler.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {alerts.map((a) => (
                  <li key={a.key}>
                    <Link href={a.href} className={`flex gap-3 rounded-sm hover:underline ${focusRing}`}>
                      <Icon name="alerte" className={a.tone} />
                      <span className="flex flex-col">
                        <span className="font-bold">{a.title}</span>
                        <span className="text-sm text-foreground-light">{a.detail}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Boxes">
            <ul className="grid grid-cols-3 gap-2">
              {d.kennels.map((k) => {
                const dogs = k.bookings.map((b) => b.dog.name).join(", ");
                return (
                  <li key={k.id} className={`flex flex-col rounded-sm px-2.5 py-2 ${dogs ? "bg-sage-soft" : "bg-background-alt"}`} title={kennelSize[k.size]}>
                    <span className="text-sm font-semibold">{k.name}</span>
                    <span className={`text-sm ${dogs ? "text-primary" : "text-foreground-light"}`}>{dogs || "Libre"}</span>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
