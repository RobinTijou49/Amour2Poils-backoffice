"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import type { FormState } from "@/lib/forms";
import { addVaccination, deleteDog, deleteVaccination } from "../actions";

/** Ajout d'un vaccin, dans la carte « Vaccins » de la fiche. */
export function VaccineForm({ dogId, today }: { dogId: string; today: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addVaccination, {});
  const e = state.fieldErrors ?? {};
  const v = state.values ?? {};
  return (
    <details className="rounded-md bg-background-alt p-4" open={Boolean(state.error)}>
      <summary className="cursor-pointer font-semibold text-primary">Ajouter un vaccin</summary>
      <form key={JSON.stringify(v)} action={action} noValidate className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <input type="hidden" name="dogId" value={dogId} />
        <Field label="Vaccin" name="vaccineName" list="vaccins-courants" required defaultValue={v.vaccineName} error={e.vaccineName} />
        <datalist id="vaccins-courants">
          <option value="CHPPiL" />
          <option value="Rage" />
          <option value="Toux du chenil" />
          <option value="Leptospirose" />
        </datalist>
        <Field label="Injection" name="administeredAt" type="date" max={today} required defaultValue={v.administeredAt} error={e.administeredAt} />
        <Field label="Expiration" name="expiresAt" type="date" required defaultValue={v.expiresAt} error={e.expiresAt} />
        <div className="flex flex-col gap-3 sm:col-span-3">
          <FormMessage error={state.error} success={state.success} />
          <div>
            <Button type="submit" icon="plus" disabled={pending}>
              {pending ? "Ajout…" : "Ajouter le vaccin"}
            </Button>
          </div>
        </div>
      </form>
    </details>
  );
}

export function DeleteVaccineButton({ id, name }: { id: string; name: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(deleteVaccination, {});
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="ghost" disabled={pending} aria-label={`Supprimer le vaccin ${name}`}>
        Supprimer
      </Button>
      {state.error && <span role="alert" className="text-sm text-danger-fg">{state.error}</span>}
    </form>
  );
}

/** Suppression de la fiche : confirmation dans la page, refus côté serveur s'il y a un historique. */
export function DeleteDog({ id, name }: { id: string; name: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(deleteDog, {});
  const [ask, setAsk] = useState(false);
  if (!ask)
    return (
      <div className="flex flex-col gap-2">
        <FormMessage error={state.error} />
        <div>
          <Button variant="ghost" onClick={() => setAsk(true)}>
            Supprimer la fiche
          </Button>
        </div>
      </div>
    );
  return (
    <form action={action} className="flex flex-wrap items-center gap-3 rounded-sm bg-danger-bg p-3">
      <input type="hidden" name="id" value={id} />
      <p className="font-semibold text-danger-fg">Supprimer définitivement la fiche de {name} ?</p>
      <Button type="submit" variant="danger" disabled={pending} onClick={() => setTimeout(() => setAsk(false), 0)}>
        Oui, supprimer
      </Button>
      <Button variant="secondary" onClick={() => setAsk(false)}>
        Non, garder
      </Button>
    </form>
  );
}
