"use client";

import { useActionState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { createBooking, type FormState } from "../actions";

type Props = {
  dogs: { id: string; name: string; breed: string | null; owner: { lastName: string } }[];
  kennels: { id: string; name: string; capacity: number }[];
  today: string;
  defaultDogId?: string;
};

export function BookingForm({ dogs, kennels, today, defaultDogId }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(createBooking, {});
  const e = state.fieldErrors ?? {};
  const v = state.values ?? {};
  return (
    <form key={JSON.stringify(v)} action={action} noValidate className="flex max-w-2xl flex-col gap-5">
      <Select label="Chien" name="dogId" required defaultValue={v.dogId ?? defaultDogId ?? ""} error={e.dogId}>
        <option value="" disabled>
          Choisir un chien…
        </option>
        {dogs.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
            {d.breed ? ` · ${d.breed}` : ""} ({d.owner.lastName})
          </option>
        ))}
      </Select>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Arrivée" name="startDate" type="date" required min={today} defaultValue={v.startDate ?? today} error={e.startDate} />
        <Field label="Départ" name="endDate" type="date" required min={today} defaultValue={v.endDate} error={e.endDate} />
      </div>
      <Select
        label="Box"
        name="kennelId"
        defaultValue={v.kennelId ?? ""}
        error={e.kennelId}
        hint="Sans box, la réservation reste « en attente » jusqu'à sa confirmation."
      >
        <option value="">À attribuer plus tard</option>
        {kennels.map((k) => (
          <option key={k.id} value={k.id}>
            {k.name}
            {k.capacity > 1 ? ` (${k.capacity} places)` : ""}
          </option>
        ))}
      </Select>
      <Field label="Tarif par nuit (€)" name="nightlyRate" type="number" inputMode="decimal" min="1" step="0.5" required defaultValue={v.nightlyRate ?? "25"} error={e.nightlyRate} />
      <Field label="Remarque (facultatif)" name="notes" maxLength={500} defaultValue={v.notes} />
      <FormMessage error={state.error} />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" icon="valider" disabled={pending}>
          {pending ? "Enregistrement…" : "Créer la réservation"}
        </Button>
        <ButtonLink href="/reservations" variant="secondary">
          Annuler
        </ButtonLink>
      </div>
    </form>
  );
}
