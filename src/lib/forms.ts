import type { z } from "zod";
import { Prisma } from "@/generated/prisma/client";

// Utilitaires partagés par les Server Actions de formulaire.

/** État renvoyé par une action à useActionState. `values` permet de pré-remplir à nouveau le formulaire,
 *  que React 19 vide après chaque envoi. */
export type FormState = { error?: string; success?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> };

/** Champs saisis, sans les champs techniques ajoutés par React ($ACTION_…). */
export function formValues(formData: FormData) {
  return Object.fromEntries([...formData].filter(([k]) => !k.startsWith("$")).map(([k, v]) => [k, String(v)]));
}

/** Première erreur Zod de chaque champ. */
export function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) out[String(issue.path[0])] ??= issue.message;
  return out;
}

/** Contrainte d'unicité violée en base (filet de sécurité si deux envois arrivent en même temps :
 *  les actions vérifient d'abord l'unicité elles-mêmes pour afficher l'erreur sur le bon champ). */
export function isUniqueViolation(e: unknown) {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

/** Champ texte facultatif : "" devient null. */
export const optional = (v: string | undefined) => (v && v.trim() ? v.trim() : null);
