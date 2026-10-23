"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { loadQueue, loadSnapshot } from "@/lib/offline/store";
import { queueAction, syncAll } from "@/lib/offline/sync";
import type { OfflineBooking, OfflineSnapshot } from "@/lib/offline/types";

const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
const when = (iso: string) => new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Journée consultable sans réseau : copie locale du planning, fiches des chiens, gestes en attente. */
export function OfflineDay() {
  const [snapshot, setSnapshot] = useState<OfflineSnapshot | null | undefined>(undefined);
  const [pending, setPending] = useState(0);
  const [message, setMessage] = useState("");

  const reload = useCallback(async () => {
    setSnapshot((await loadSnapshot()) ?? null);
    setPending((await loadQueue()).length);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void reload().catch(() => setSnapshot(null)), 0);
    // Retour du réseau pendant que la page est ouverte : on rejoue les gestes puis on rafraîchit.
    const onOnline = async () => {
      const r = await syncAll();
      if (r.sent) setMessage(`${r.sent} geste(s) synchronisé(s).`);
      if (r.dropped.length) setMessage((m) => `${m} Ignoré : ${r.dropped.join(" ; ")}`.trim());
      if (r.needsLogin) setMessage("Reconnectez-vous pour synchroniser vos gestes en attente.");
      await reload();
    };
    window.addEventListener("online", onOnline);
    return () => {
      clearTimeout(t);
      window.removeEventListener("online", onOnline);
    };
  }, [reload]);

  async function act(b: OfflineBooking, action: "check-in" | "check-out") {
    await queueAction(b, action);
    setMessage(`${action === "check-in" ? "Arrivée" : "Départ"} de ${b.dog.name} enregistré${action === "check-in" ? "e" : ""} sur cet appareil, synchronisé${action === "check-in" ? "e" : ""} au retour du réseau.`);
    await reload();
  }

  if (snapshot === undefined) return <p className="text-foreground-light">Chargement de la copie locale…</p>;
  if (snapshot === null) {
    return <p className="text-foreground-light">Aucune copie locale de la journée sur cet appareil. Elle se prépare quand vous utilisez l&apos;application avec du réseau.</p>;
  }
  const rows = snapshot.bookings.filter((b) => b.status !== "COMPLETED");
  return (
    <section aria-labelledby="journee" className="flex flex-col gap-4">
      <div>
        <h2 id="journee" className="font-heading text-xl font-bold">
          Journée du {day(snapshot.today)}
        </h2>
        <p className="text-sm text-foreground-light">Copie locale du {when(snapshot.generatedAt)}.</p>
      </div>
      <p role="status" className="min-h-6 font-semibold text-primary">
        {message}
      </p>
      {pending > 0 && <p className="text-sm text-warning-fg">{pending} geste(s) en attente de synchronisation.</p>}
      {rows.length === 0 && <p className="text-foreground-light">Aucun séjour en cours ni attendu aujourd&apos;hui.</p>}
      <ul className="flex flex-col gap-3">
        {rows.map((b) => {
          const arriving = b.status === "CONFIRMED";
          const leaving = b.status === "CHECKED_IN" && b.endDate <= snapshot.today;
          return (
            <li key={b.id} className="rounded-md border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-heading text-lg font-bold">{b.dog.name}</span>
                {b.dog.breed && <span className="text-foreground-light">{b.dog.breed}</span>}
                <Badge tone={arriving ? "warning" : leaving ? "info" : "success"}>{arriving ? "Arrivée attendue" : leaving ? "Départ prévu" : "Présent"}</Badge>
                <span className="text-sm text-foreground-light">
                  {b.kennel ?? "Box à attribuer"} · {day(b.startDate)} → {day(b.endDate)}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-3">
                {arriving && <Button onClick={() => act(b, "check-in")}>Enregistrer l&apos;arrivée</Button>}
                {b.status === "CHECKED_IN" && (
                  <Button variant="secondary" onClick={() => act(b, "check-out")}>
                    Enregistrer le départ
                  </Button>
                )}
              </div>
              <details className="mt-3">
                <summary className="min-h-11 cursor-pointer py-2 font-semibold text-primary">Fiche de {b.dog.name}</summary>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[160px_1fr]">
                  <Info label="Propriétaire" value={`${b.dog.owner.name} · ${b.dog.owner.phone}`} />
                  <Info label="Allergies" value={b.dog.allergies} />
                  <Info label="Alimentation" value={b.dog.diet} />
                  <Info label="Comportement" value={b.dog.behaviorNotes} />
                  <Info label="Vétérinaire" value={b.dog.vetName ? `${b.dog.vetName}${b.dog.vetPhone ? ` · ${b.dog.vetPhone}` : ""}` : null} />
                  <Info
                    label="Vaccins"
                    value={b.dog.vaccinations.map((v) => `${v.name} (jusqu'au ${day(v.expiresAt)}${v.expiresAt < snapshot.today ? ", expiré" : ""})`).join(" ; ")}
                  />
                </dl>
              </details>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <>
      <dt className="font-semibold">{label}</dt>
      <dd className="text-foreground-light">{value || "—"}</dd>
    </>
  );
}
