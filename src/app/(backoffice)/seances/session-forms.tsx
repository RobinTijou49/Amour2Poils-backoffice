"use client";

import { useActionState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import type { FormState } from "@/lib/forms";
import { createSession, enrollDog, setAttendance, unenroll } from "./actions";

export function SessionForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createSession, {});
  const e = state.fieldErrors ?? {};
  const v = state.values ?? {};
  return (
    <form key={JSON.stringify(v)} action={action} noValidate className="flex max-w-2xl flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select label="Type" name="type" defaultValue={v.type ?? ""} error={e.type}>
          <option value="" disabled>
            Choisir…
          </option>
          <option value="PRIVATE">Cours particulier</option>
          <option value="GROUP">Cours collectif</option>
          <option value="PUPPY_CLASS">Puppy class</option>
          <option value="PETSITTING">Visite petsitting</option>
        </Select>
        <Field label="Titre" name="title" required defaultValue={v.title} error={e.title} hint="Ex. Marche en laisse, Rappel en extérieur." />
        <Field label="Date" name="day" type="date" min={today} required defaultValue={v.day ?? today} error={e.day} />
        <Field label="Heure (heure de Paris)" name="time" type="time" required defaultValue={v.time ?? "10:00"} error={e.time} />
        <Field label="Durée (minutes)" name="durationMin" type="number" min="15" step="15" required defaultValue={v.durationMin ?? "60"} error={e.durationMin} />
        <Field label="Nombre de places" name="capacity" type="number" min="1" max="30" required defaultValue={v.capacity ?? "1"} error={e.capacity} hint="Une visite petsitting compte toujours 1 place." />
        <Field label="Tarif par chien (€)" name="price" type="number" min="0" step="0.5" required defaultValue={v.price ?? "40"} error={e.price} />
        <Field label="Lieu (facultatif)" name="location" defaultValue={v.location} />
      </div>
      <FormMessage error={state.error} />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" icon="valider" disabled={pending}>
          {pending ? "Enregistrement…" : "Planifier la séance"}
        </Button>
        <ButtonLink href="/seances" variant="secondary">
          Annuler
        </ButtonLink>
      </div>
    </form>
  );
}

export function EnrollForm({ sessionId, dogs, full }: { sessionId: string; dogs: { id: string; name: string; owner: { lastName: string } }[]; full: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(enrollDog, {});
  // Séance pleine : on garde le message de la dernière action visible au lieu de retirer tout le bloc.
  if (full)
    return (
      <div className="flex flex-col gap-3">
        <FormMessage error={state.error} success={state.success} />
        <p className="text-sm text-foreground-light">Séance complète : désinscrivez un chien pour libérer une place.</p>
      </div>
    );
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="sessionId" value={sessionId} />
      <div className="flex flex-wrap items-end gap-3">
        <Select label="Chien à inscrire" name="dogId" defaultValue="" error={state.fieldErrors?.dogId} className="min-w-64">
          <option value="" disabled>
            Choisir un chien…
          </option>
          {dogs.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} ({d.owner.lastName})
            </option>
          ))}
        </Select>
        <Button type="submit" icon="plus" disabled={pending}>
          Inscrire
        </Button>
      </div>
      <FormMessage error={state.error} success={state.success} />
    </form>
  );
}

export function EnrollmentActions({ id, dogName, attended, past }: { id: string; dogName: string; attended: boolean | null; past: boolean }) {
  const [attState, attAction, attPending] = useActionState<FormState, FormData>(setAttendance, {});
  const [unState, unAction, unPending] = useActionState<FormState, FormData>(unenroll, {});
  const error = attState.error ?? unState.error;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {past && (
        <form action={attAction} className="flex gap-2">
          <input type="hidden" name="id" value={id} />
          <Button type="submit" name="attended" value="yes" variant={attended === true ? "primary" : "secondary"} disabled={attPending} aria-pressed={attended === true} aria-label={`${dogName} présent`}>
            Présent
          </Button>
          <Button type="submit" name="attended" value="no" variant={attended === false ? "danger" : "secondary"} disabled={attPending} aria-pressed={attended === false} aria-label={`${dogName} absent`}>
            Absent
          </Button>
        </form>
      )}
      {!past && (
        <form action={unAction}>
          <input type="hidden" name="id" value={id} />
          <Button type="submit" variant="ghost" disabled={unPending} aria-label={`Désinscrire ${dogName}`}>
            Désinscrire
          </Button>
        </form>
      )}
      {error && <span role="alert" className="text-sm text-danger-fg">{error}</span>}
    </div>
  );
}
