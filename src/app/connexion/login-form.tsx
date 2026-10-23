"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { login, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      <Field label="Adresse e-mail" name="email" type="email" autoComplete="username" required defaultValue={state.email} />
      <Field label="Mot de passe" name="password" type="password" autoComplete="current-password" required />
      {/* role="alert" : le message est lu par les lecteurs d'écran dès qu'il apparaît */}
      <div role="alert" className="empty:hidden rounded-sm bg-danger-bg px-3 py-2 text-sm font-semibold text-danger-fg">
        {state.error}
      </div>
      <Button type="submit" className="w-full" disabled={pending} aria-disabled={pending}>
        {pending ? "Connexion…" : "Se connecter"}
      </Button>
    </form>
  );
}
