import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, PageHeader } from "@/components/ui/card";
import { capitalize, formatDate, formatTime, utcDay } from "@/lib/format";
import { getSessions } from "@/lib/queries";
import { sessionType } from "@/lib/status";

export const metadata: Metadata = { title: "Séances" };

export default function SessionsPage() {
  return (
    <>
      <PageHeader title="Séances d'éducation et petsitting" subtitle="Les 7 prochains jours" />
      <Suspense fallback={<p className="text-foreground-light">Chargement des séances…</p>}>
        <Sessions />
      </Suspense>
    </>
  );
}

async function Sessions() {
  await connection();
  const today = utcDay(new Date());
  const sessions = await getSessions(today);
  const byDay = Map.groupBy(sessions, (s) => utcDay(s.startsAt).getTime());
  if (byDay.size === 0) return <p className="text-foreground-light">Aucune séance prévue cette semaine.</p>;

  return (
    <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
      {[...byDay.entries()].map(([day, list]) => {
        const date = new Date(day);
        const isToday = day === today.getTime();
        return (
          <Card key={day} title={`${isToday ? "Aujourd'hui · " : ""}${capitalize(formatDate(date, { weekday: "long", day: "numeric", month: "long" }))}`}>
            <ul className="flex flex-col gap-3">
              {list.map((s) => {
                const count = s.enrollments.length;
                const full = s.type !== "PETSITTING" && count >= s.capacity;
                return (
                  <li key={s.id} className="flex flex-col gap-1.5 rounded-sm bg-background-alt p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-foreground-light tabular-nums">{formatTime(s.startsAt)} · {s.durationMin} min</span>
                      {s.type === "PETSITTING" ? (
                        <Badge tone="neutral">Petsitting</Badge>
                      ) : (
                        <Badge tone={full ? "warning" : "success"}>{full ? `Complet · ${count}/${s.capacity}` : `${count} / ${s.capacity} inscrits`}</Badge>
                      )}
                    </div>
                    <p className="font-bold">{s.title}</p>
                    <p className="text-sm text-foreground-light">
                      {sessionType[s.type]}
                      {s.location && ` · ${s.location}`}
                      {count > 0 && ` · ${s.enrollments.map((e) => e.dog.name).join(", ")}`}
                    </p>
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}
