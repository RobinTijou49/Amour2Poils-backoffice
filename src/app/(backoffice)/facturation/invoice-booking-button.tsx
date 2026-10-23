"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import type { FormState } from "@/lib/forms";
import { invoiceBooking } from "./actions";

export function InvoiceBookingButton({ bookingId }: { bookingId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(invoiceBooking, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="bookingId" value={bookingId} />
      <FormMessage error={state.error} />
      <div>
        <Button type="submit" variant="secondary" icon="facture" disabled={pending}>
          {pending ? "Création…" : "Créer la facture du séjour"}
        </Button>
      </div>
    </form>
  );
}
