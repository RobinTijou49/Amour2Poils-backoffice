"use client";

import { useActionState, useState } from "react";
import type { InvoiceStatus } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import type { FormState } from "@/lib/forms";
import { addLine, invoiceEnrollments, removeLine, setInvoiceStatus } from "../actions";

/** Boutons de changement de statut. L'annulation demande une confirmation dans la page. */
export function StatusActions({ id, status }: { id: string; status: InvoiceStatus }) {
  const [state, action, pending] = useActionState<FormState, FormData>(setInvoiceStatus, {});
  const [askCancel, setAskCancel] = useState(false);
  const button = (to: InvoiceStatus, label: string, variant: "primary" | "secondary" | "danger" = "primary") => (
    <Button type="submit" name="status" value={to} variant={variant} disabled={pending}>
      {label}
    </Button>
  );
  return (
    <form action={action} className="flex flex-col gap-3 print:hidden">
      <input type="hidden" name="id" value={id} />
      <FormMessage error={state.error} success={state.success} />
      <div className="flex flex-wrap gap-3">
        {status === "DRAFT" && button("SENT", "Valider et envoyer")}
        {status === "SENT" && button("PAID", "Marquer comme payée")}
        <Button variant="secondary" icon="facture" onClick={() => window.print()}>
          Imprimer / PDF
        </Button>
        {(status === "DRAFT" || status === "SENT") &&
          (askCancel ? (
            <span className="flex flex-wrap items-center gap-3 rounded-sm bg-danger-bg p-2">
              <span className="font-semibold text-danger-fg">Annuler cette facture ?</span>
              {button("CANCELLED", "Oui, annuler", "danger")}
              <Button variant="secondary" onClick={() => setAskCancel(false)}>
                Non
              </Button>
            </span>
          ) : (
            <Button variant="ghost" onClick={() => setAskCancel(true)}>
              Annuler la facture
            </Button>
          ))}
      </div>
    </form>
  );
}

export function AddLineForm({ invoiceId }: { invoiceId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addLine, {});
  const e = state.fieldErrors ?? {};
  const v = state.values ?? {};
  return (
    <details className="rounded-md bg-background-alt p-4 print:hidden" open={Boolean(state.error)}>
      <summary className="cursor-pointer font-semibold text-primary">Ajouter une ligne (supplément, remise…)</summary>
      <form key={JSON.stringify(v)} action={action} noValidate className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[1fr_120px_160px]">
        <input type="hidden" name="invoiceId" value={invoiceId} />
        <Field label="Libellé" name="label" required defaultValue={v.label} error={e.label} />
        <Field label="Quantité" name="quantity" type="number" min="1" step="1" required defaultValue={v.quantity ?? "1"} error={e.quantity} />
        <Field label="Prix unitaire (€)" name="unitPrice" type="number" min="0" step="0.01" required defaultValue={v.unitPrice} error={e.unitPrice} />
        <div className="flex flex-col gap-3 sm:col-span-3">
          <FormMessage error={state.error} success={state.success} />
          <div>
            <Button type="submit" icon="plus" disabled={pending}>
              Ajouter la ligne
            </Button>
          </div>
        </div>
      </form>
    </details>
  );
}

export function RemoveLineButton({ id, label }: { id: string; label: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(removeLine, {});
  return (
    <form action={action} className="print:hidden">
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="ghost" disabled={pending} aria-label={`Supprimer la ligne ${label}`}>
        Retirer
      </Button>
      {state.error && <span role="alert" className="text-sm text-danger-fg">{state.error}</span>}
    </form>
  );
}

export function InvoiceSessionsButton({ ownerId, count, compact }: { ownerId: string; count?: number; compact?: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(invoiceEnrollments, {});
  return (
    <form action={action} className="flex flex-col gap-2 print:hidden">
      <input type="hidden" name="ownerId" value={ownerId} />
      <FormMessage error={state.error} />
      <div>
        <Button type="submit" variant="secondary" icon={compact ? undefined : "education"} disabled={pending} aria-label={compact ? "Facturer les séances non facturées de ce client" : undefined}>
          {compact
            ? "Facturer"
            : `Facturer les ${count} séance${(count ?? 0) > 1 ? "s" : ""} non facturée${(count ?? 0) > 1 ? "s" : ""} de ce client`}
        </Button>
      </div>
    </form>
  );
}
