"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { fieldErrors, formValues, isUniqueViolation, optional, type FormState } from "@/lib/forms";
import { prisma } from "@/lib/prisma";

// Actions d'écriture du stock.

const movementInput = z.object({
  productId: z.string().min(1),
  type: z.enum(["IN", "OUT", "ADJUSTMENT"], { message: "Choisissez le type de mouvement." }),
  quantity: z.coerce.number({ message: "Saisissez une quantité." }).int("Nombre entier attendu.").min(0, "La quantité ne peut pas être négative.").max(10_000),
  reason: z.string().max(200).optional(),
});

/** Nouvelle quantité après un mouvement. Un ajustement fixe la quantité comptée (inventaire). */
function nextQuantity(current: number, type: "IN" | "OUT" | "ADJUSTMENT", quantity: number) {
  if (type === "IN") return current + quantity;
  if (type === "OUT") return current - quantity;
  return quantity;
}

export async function recordMovement(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  const values = formValues(formData);
  const parsed = movementInput.safeParse(values);
  if (!parsed.success) return { error: "Corrigez les champs signalés.", fieldErrors: fieldErrors(parsed.error), values };
  const m = parsed.data;
  if (m.type !== "ADJUSTMENT" && m.quantity === 0) {
    return { error: "Corrigez les champs signalés.", fieldErrors: { quantity: "La quantité doit être supérieure à 0." }, values };
  }

  // Transaction : le mouvement et la nouvelle quantité sont enregistrés ensemble, ou pas du tout.
  const result = await prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: m.productId } });
    if (!product) return { ok: false, error: "Produit introuvable." } as const;
    const quantity = nextQuantity(product.quantity, m.type, m.quantity);
    if (quantity < 0) return { ok: false, error: `Stock insuffisant : il reste ${product.quantity} ${product.unit}.` } as const;
    await tx.stockMovement.create({ data: { productId: product.id, type: m.type, quantity: m.quantity, reason: optional(m.reason), userId: user.id } });
    await tx.product.update({ where: { id: product.id }, data: { quantity } });
    return { ok: true, product, quantity } as const;
  });
  if (!result.ok) return { error: result.error, fieldErrors: { quantity: result.error }, values };

  refresh();
  const low = result.quantity <= result.product.alertThreshold;
  return { success: `Stock de « ${result.product.name} » : ${result.quantity} ${result.product.unit}.${low ? " Sous le seuil d'alerte." : ""}` };
}

const productInput = z.object({
  name: z.string().trim().min(1, "Saisissez le nom du produit.").max(80),
  category: z.enum(["FOOD", "TREAT", "HYGIENE", "MEDICAL", "OTHER"], { message: "Choisissez une catégorie." }),
  unit: z.string().trim().min(1, "Saisissez l'unité (ex. sac 15 kg).").max(40),
  alertThreshold: z.coerce.number({ message: "Saisissez un seuil." }).int("Nombre entier attendu.").min(0).max(10_000),
  quantity: z.coerce.number().int("Nombre entier attendu.").min(0, "La quantité ne peut pas être négative.").max(10_000).default(0),
});

/** Création d'un produit : réservée à la gérance. */
export async function createProduct(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (user.role !== "ADMIN") return { error: "Seule la gérance peut ajouter un produit." };
  const values = formValues(formData);
  const parsed = productInput.safeParse(values);
  if (!parsed.success) return { error: "Corrigez les champs signalés.", fieldErrors: fieldErrors(parsed.error), values };
  const p = parsed.data;
  if (await prisma.product.findUnique({ where: { name: p.name } })) {
    return { error: "Corrigez les champs signalés.", fieldErrors: { name: "Un produit porte déjà ce nom." }, values };
  }
  let id: string;
  try {
    const product = await prisma.product.create({ data: p });
    if (p.quantity > 0) await prisma.stockMovement.create({ data: { productId: product.id, type: "IN", quantity: p.quantity, reason: "Stock initial", userId: user.id } });
    id = product.id;
  } catch (e) {
    if (isUniqueViolation(e)) return { error: "Un produit porte déjà ce nom.", values };
    throw e;
  }
  redirect(`/stock/${id}`);
}
