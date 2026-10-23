"use client";

import { useActionState, useState } from "react";
import type { BookingStatus } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { cancelBooking, checkIn, checkOut, confirmBooking, type FormState } from "../actions";

type Props = {
  id: string;
  status: BookingStatus;
  kennelId: string | null;
  kennels: { id: string; name: string }[];
  isAdmin: boolean;
};

/** Boutons d'action proposés selon le statut. Le serveur revérifie chaque transition. */
export function BookingActions({ id, status, kennelId, kennels, isAdmin }: Props) {
  const [confirmState, confirmAction, confirming] = useActionState<FormState, FormData>(confirmBooking, {});
  const [inState, inAction, checkingIn] = useActionState<FormState, FormData>(checkIn, {});
  const [outState, outAction, checkingOut] = useActionState<FormState, FormData>(checkOut, {});
  const [cancelState, cancelAction, cancelling] = useActionState<FormState, FormData>(cancelBooking, {});
  const [askCancel, setAskCancel] = useState(false);
  const last = [cancelState, outState, inState, confirmState].find((s) => s.error || s.success) ?? {};
  const canCancel = isAdmin && (status === "PENDING" || status === "CONFIRMED");

  return (
    <div className="flex flex-col gap-4">
      <FormMessage error={last.error} success={last.success} />

      {status === "PENDING" && (
        <form action={confirmAction} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="id" value={id} />
          <Select label="Box attribuée" name="kennelId" defaultValue={kennelId ?? ""} error={confirmState.fieldErrors?.kennelId} className="min-w-56">
            <option value="" disabled>
              Choisir une box…
            </option>
            {kennels.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </Select>
          <Button type="submit" icon="valider" disabled={confirming}>
            {confirming ? "Confirmation…" : "Confirmer la réservation"}
          </Button>
        </form>
      )}

      {status === "CONFIRMED" && (
        <form action={inAction}>
          <input type="hidden" name="id" value={id} />
          <Button type="submit" icon="valider" disabled={checkingIn}>
            {checkingIn ? "Enregistrement…" : "Enregistrer l'arrivée"}
          </Button>
        </form>
      )}

      {status === "CHECKED_IN" && (
        <form action={outAction}>
          <input type="hidden" name="id" value={id} />
          <Button type="submit" icon="deconnexion" disabled={checkingOut}>
            {checkingOut ? "Enregistrement…" : "Enregistrer le départ"}
          </Button>
        </form>
      )}

      {canCancel &&
        (askCancel ? (
          <form action={cancelAction} className="flex flex-wrap items-center gap-3 rounded-sm bg-danger-bg p-3">
            <input type="hidden" name="id" value={id} />
            <p className="font-semibold text-danger-fg">Annuler définitivement cette réservation ?</p>
            <Button type="submit" variant="danger" disabled={cancelling}>
              Oui, annuler
            </Button>
            <Button variant="secondary" onClick={() => setAskCancel(false)}>
              Non, garder
            </Button>
          </form>
        ) : (
          <div>
            <Button variant="ghost" onClick={() => setAskCancel(true)}>
              Annuler la réservation
            </Button>
          </div>
        ))}
    </div>
  );
}
