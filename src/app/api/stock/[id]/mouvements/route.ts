import { apiError, guard, readJson, zodDetails } from "@/lib/api";
import { applyMovement, movementInput } from "@/lib/stock-service";

/** POST /api/stock/:id/mouvements  { type: "IN" | "OUT" | "ADJUSTMENT", quantity, reason? } */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(request, { write: true });
  if (!g.ok) return g.response;
  const raw = await readJson(request);
  const parsed = movementInput.safeParse(typeof raw === "object" && raw ? { ...raw, productId: (await params).id } : null);
  if (!parsed.success) return apiError("Données invalides.", 422, zodDetails(parsed.error));
  const m = parsed.data;
  if (m.type !== "ADJUSTMENT" && m.quantity === 0) return apiError("Données invalides.", 422, { quantity: "La quantité doit être supérieure à 0." });
  const result = await applyMovement(m, g.user.id, m.reason?.trim() || null);
  if (!result.ok) return apiError(result.error, result.error === "Produit introuvable." ? 404 : 409);
  return Response.json({ product: { id: result.product.id, name: result.product.name, quantity: result.quantity, low: result.quantity <= result.product.alertThreshold } }, { status: 201 });
}
