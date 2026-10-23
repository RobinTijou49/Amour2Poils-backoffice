"use client";

import { useActionState, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Checkbox, Field, Select, Textarea } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import type { FormState } from "@/lib/forms";
import { saveDog } from "./actions";

export type DogDefaults = Partial<
  Record<"id" | "name" | "breed" | "sex" | "birthDate" | "weightKg" | "chipNumber" | "allergies" | "diet" | "behaviorNotes" | "vetName" | "vetPhone" | "ownerId", string>
> & { sterilized?: boolean };

type Props = {
  owners: { id: string; firstName: string; lastName: string; phone: string }[];
  dog?: DogDefaults;
  today: string;
  cancelHref: string;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4 border-t border-border pt-5">
      <legend className="pr-3 font-heading text-lg font-bold">{title}</legend>
      {children}
    </fieldset>
  );
}

/** Formulaire de création et de modification d'un chien (le même composant pour les deux). */
export function DogForm({ owners, dog = {}, today, cancelHref }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveDog, {});
  const e = state.fieldErrors ?? {};
  // Valeurs renvoyées après une erreur, sinon valeurs de la fiche existante.
  const { sterilized: initialSterilized, ...dogText } = dog;
  const v: Record<string, string | undefined> = state.values ?? dogText;
  const [ownerId, setOwnerId] = useState(v.ownerId ?? (owners.length ? "" : "__new__"));
  const sterilized = state.values ? state.values.sterilized === "on" : initialSterilized;

  return (
    <form key={JSON.stringify(state.values ?? {})} action={action} noValidate className="flex max-w-3xl flex-col gap-6">
      {dog.id && <input type="hidden" name="id" value={dog.id} />}

      <Section title="Propriétaire">
        <Select label="Propriétaire" name="ownerId" value={ownerId} onChange={(ev) => setOwnerId(ev.target.value)} error={e.ownerId}>
          <option value="" disabled>
            Choisir un propriétaire…
          </option>
          <option value="__new__">+ Nouveau propriétaire</option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.lastName} {o.firstName} · {o.phone}
            </option>
          ))}
        </Select>
        {ownerId === "__new__" && (
          <div className="grid grid-cols-1 gap-4 rounded-md bg-background-alt p-4 sm:grid-cols-2">
            <Field label="Prénom" name="ownerFirstName" autoComplete="off" required defaultValue={v.ownerFirstName} error={e.ownerFirstName} />
            <Field label="Nom" name="ownerLastName" autoComplete="off" required defaultValue={v.ownerLastName} error={e.ownerLastName} />
            <Field label="Téléphone" name="ownerPhone" type="tel" required defaultValue={v.ownerPhone} error={e.ownerPhone} />
            <Field label="E-mail (facultatif)" name="ownerEmail" type="email" defaultValue={v.ownerEmail} error={e.ownerEmail} />
            <Field label="Adresse (facultatif)" name="ownerAddress" defaultValue={v.ownerAddress} className="sm:col-span-2" />
          </div>
        )}
      </Section>

      <Section title="Identité du chien">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nom" name="name" required defaultValue={v.name} error={e.name} />
          <Field label="Race (facultatif)" name="breed" defaultValue={v.breed} />
          <Select label="Sexe" name="sex" required defaultValue={v.sex ?? ""} error={e.sex}>
            <option value="" disabled>
              Choisir…
            </option>
            <option value="MALE">Mâle</option>
            <option value="FEMALE">Femelle</option>
          </Select>
          <Field label="Date de naissance (facultatif)" name="birthDate" type="date" max={today} defaultValue={v.birthDate} error={e.birthDate} />
          <Field label="Poids en kg (facultatif)" name="weightKg" type="number" inputMode="decimal" step="0.1" min="0" defaultValue={v.weightKg} error={e.weightKg} />
          <Field label="Numéro de puce (facultatif)" name="chipNumber" defaultValue={v.chipNumber} error={e.chipNumber} />
        </div>
        <Checkbox label="Stérilisé" name="sterilized" defaultChecked={sterilized} />
      </Section>

      <Section title="Santé et comportement">
        <Textarea label="Allergies (facultatif)" name="allergies" defaultValue={v.allergies} />
        <Textarea label="Régime alimentaire (facultatif)" name="diet" defaultValue={v.diet} />
        <Textarea label="Comportement (facultatif)" name="behaviorNotes" defaultValue={v.behaviorNotes} hint="Ce que l'équipe doit savoir : peurs, réactions aux autres chiens, habitudes." />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Vétérinaire (facultatif)" name="vetName" defaultValue={v.vetName} />
          <Field label="Téléphone du vétérinaire (facultatif)" name="vetPhone" type="tel" defaultValue={v.vetPhone} />
        </div>
      </Section>

      <FormMessage error={state.error} />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" icon="valider" disabled={pending}>
          {pending ? "Enregistrement…" : dog.id ? "Enregistrer les modifications" : "Créer la fiche"}
        </Button>
        <ButtonLink href={cancelHref} variant="secondary">
          Annuler
        </ButtonLink>
      </div>
    </form>
  );
}
