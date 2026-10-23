import { guard } from "@/lib/api";
import { prisma } from "@/lib/prisma";

/** GET /api/stock?low=1 : produits, ou seulement ceux sous le seuil d'alerte. */
export async function GET(request: Request) {
  const g = await guard(request);
  if ("response" in g) return g.response;
  const products = await prisma.product.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] });
  const onlyLow = new URL(request.url).searchParams.get("low") === "1";
  return Response.json({ products: onlyLow ? products.filter((p) => p.quantity <= p.alertThreshold) : products });
}
