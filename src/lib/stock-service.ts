import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/push";

// Mouvements de stock partagés par la Server Action et l'API.

export const movementInput = z.object({
  productId: z.string().min(1),
  type: z.enum(["IN", "OUT", "ADJUSTMENT"], { message: "Choisissez le type de mouvement." }),
  quantity: z.coerce.number({ message: "Saisissez une quantité." }).int("Nombre entier attendu.").min(0, "La quantité ne peut pas être négative.").max(10_000),
  reason: z.string().max(200).optional(),
});
export type MovementInput = z.output<typeof movementInput>;

/** Nouvelle quantité après un mouvement. Un ajustement fixe la quantité comptée (inventaire). */
export function nextQuantity(current: number, type: MovementInput["type"], quantity: number) {
  if (type === "IN") return current + quantity;
  if (type === "OUT") return current - quantity;
  return quantity;
}

/** Une alerte « stock bas » part seulement quand le stock PASSE sous le seuil (ou tombe pile dessus) :
 *  pas à chaque mouvement tant qu'il reste bas, pas non plus quand il remonte. */
export function crossesAlertThreshold(before: number, after: number, threshold: number) {
  return before > threshold && after <= threshold;
}

/** Transaction : le mouvement et la nouvelle quantité sont enregistrés ensemble, ou pas du tout. */
export async function applyMovement(m: MovementInput, userId: string, reason: string | null) {
  const result = await prisma.$transaction(async (tx) => {
    // Verrou sur la ligne du produit jusqu'à la fin de la transaction : « lire la quantité, calculer, écrire » est sinon
    // une course (deux sorties simultanées lisent le même stock et l'une écrase l'autre : stock vendu deux fois).
    await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${m.productId} FOR UPDATE`;
    const product = await tx.product.findUnique({ where: { id: m.productId } });
    if (!product) return { ok: false, error: "Produit introuvable." } as const;
    const quantity = nextQuantity(product.quantity, m.type, m.quantity);
    if (quantity < 0) return { ok: false, error: `Stock insuffisant : il reste ${product.quantity} ${product.unit}.` } as const;
    await tx.stockMovement.create({ data: { productId: product.id, type: m.type, quantity: m.quantity, reason, userId } });
    await tx.product.update({ where: { id: product.id }, data: { quantity } });
    return { ok: true, product, quantity } as const;
  });
  if (result.ok && crossesAlertThreshold(result.product.quantity, result.quantity, result.product.alertThreshold)) {
    notify({
      title: "Stock bas",
      body: `${result.product.name} : ${result.quantity} ${result.product.unit} restant(s) (seuil ${result.product.alertThreshold}).`,
      url: "/stock",
      tag: `stock-${result.product.id}`,
    });
  }
  return result;
}
