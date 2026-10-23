"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { de } from "@/lib/format";
import { checkIn, checkOut, type FormState } from "./actions";

/** Bouton d'arrivée ou de départ en un clic, pour les listes (tableau de bord). */
export function QuickAction({ id, kind, dogName }: { id: string; kind: "in" | "out"; dogName: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(kind === "in" ? checkIn : checkOut, {});
  if (state.success) return <span role="status" className="text-sm font-semibold text-success-fg">{state.success}</span>;
  return (
    <form action={action} className="flex flex-col items-start gap-1">
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="secondary" disabled={pending} aria-label={`${kind === "in" ? "Enregistrer l'arrivée" : "Enregistrer le départ"} ${de(dogName)}`}>
        {kind === "in" ? "Arrivée" : "Départ"}
      </Button>
      {state.error && <span role="alert" className="text-sm text-danger-fg">{state.error}</span>}
    </form>
  );
}
