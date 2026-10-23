"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/forms";
import { setInvoiceStatus } from "./facturation/actions";
import { recordMovement } from "./stock/actions";

/** Entrée de stock en un geste depuis l'alerte « Stock bas » du tableau de bord. */
export function RestockForm({ productId, name, unit }: { productId: string; name: string; unit: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(recordMovement, {});
  if (state.success) return <p role="status" className="text-sm font-semibold text-success-fg">{state.success}</p>;
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="type" value="IN" />
      <input type="hidden" name="reason" value="Réapprovisionnement (tableau de bord)" />
      <label className="text-sm" htmlFor={`restock-${productId}`}>
        Quantité reçue ({unit})
      </label>
      <input
        id={`restock-${productId}`}
        name="quantity"
        type="number"
        min="1"
        step="1"
        required
        defaultValue="10"
        aria-label={`Quantité reçue pour ${name}`}
        className="min-h-11 w-20 rounded-sm border border-border bg-surface px-2"
      />
      <Button type="submit" variant="secondary" disabled={pending}>
        Entrée
      </Button>
      {(state.error || state.fieldErrors?.quantity) && (
        <p role="alert" className="w-full text-sm text-danger-fg">{state.fieldErrors?.quantity ?? state.error}</p>
      )}
    </form>
  );
}

/** Marque une facture envoyée comme payée (action réservée à la gérance, revérifiée côté serveur). */
export function MarkPaidForm({ id, number }: { id: string; number: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(setInvoiceStatus, {});
  if (state.success) return <p role="status" className="text-sm font-semibold text-success-fg">{state.success}</p>;
  return (
    <form action={action} className="flex flex-col items-start gap-1">
      <input type="hidden" name="id" value={id} />
      <Button type="submit" name="status" value="PAID" variant="secondary" disabled={pending} aria-label={`Marquer la facture ${number} comme payée`}>
        Marquer payée
      </Button>
      {state.error && <p role="alert" className="text-sm text-danger-fg">{state.error}</p>}
    </form>
  );
}
