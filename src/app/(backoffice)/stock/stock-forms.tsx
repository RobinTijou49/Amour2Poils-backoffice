"use client";

import { useActionState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import type { FormState } from "@/lib/forms";
import { createProduct, recordMovement } from "./actions";

export function MovementForm({ productId, unit }: { productId: string; unit: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(recordMovement, {});
  const e = state.fieldErrors ?? {};
  const v = state.values ?? {};
  return (
    <form key={JSON.stringify(v)} action={action} noValidate className="flex flex-col gap-4">
      <input type="hidden" name="productId" value={productId} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select label="Type de mouvement" name="type" defaultValue={v.type ?? "OUT"} error={e.type}>
          <option value="OUT">Sortie (utilisation)</option>
          <option value="IN">Entrée (livraison)</option>
          <option value="ADJUSTMENT">Inventaire (quantité comptée)</option>
        </Select>
        <Field label={`Quantité (${unit})`} name="quantity" type="number" inputMode="numeric" min="0" step="1" required defaultValue={v.quantity ?? "1"} error={e.quantity} />
      </div>
      <Field label="Motif (facultatif)" name="reason" maxLength={200} defaultValue={v.reason} hint="Ex. repas de la pension, livraison du fournisseur." />
      <FormMessage error={state.error} success={state.success} />
      <div>
        <Button type="submit" icon="valider" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer le mouvement"}
        </Button>
      </div>
    </form>
  );
}

export function ProductForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createProduct, {});
  const e = state.fieldErrors ?? {};
  const v = state.values ?? {};
  return (
    <form key={JSON.stringify(v)} action={action} noValidate className="flex max-w-2xl flex-col gap-5">
      <Field label="Nom du produit" name="name" required defaultValue={v.name} error={e.name} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select label="Catégorie" name="category" defaultValue={v.category ?? ""} error={e.category}>
          <option value="" disabled>
            Choisir…
          </option>
          <option value="FOOD">Alimentation</option>
          <option value="TREAT">Friandises</option>
          <option value="HYGIENE">Hygiène</option>
          <option value="MEDICAL">Soins</option>
          <option value="OTHER">Autre</option>
        </Select>
        <Field label="Unité" name="unit" required placeholder="ex. sac 15 kg" defaultValue={v.unit} error={e.unit} />
        <Field label="Quantité initiale" name="quantity" type="number" min="0" step="1" defaultValue={v.quantity ?? "0"} error={e.quantity} />
        <Field label="Seuil d'alerte" name="alertThreshold" type="number" min="0" step="1" required defaultValue={v.alertThreshold ?? "1"} error={e.alertThreshold} hint="Une alerte apparaît quand le stock descend à ce niveau." />
      </div>
      <FormMessage error={state.error} />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" icon="plus" disabled={pending}>
          {pending ? "Création…" : "Créer le produit"}
        </Button>
        <ButtonLink href="/stock" variant="secondary">
          Annuler
        </ButtonLink>
      </div>
    </form>
  );
}
