import { beforeEach, describe, expect, test } from "bun:test";
import { GET as listStock } from "@/app/api/stock/route";
import { POST as moveStock } from "@/app/api/stock/[id]/mouvements/route";
import { apiRequest, makeProduct, prisma, pushCalls, resetDb, signIn, signOut, withId } from "./helpers";

beforeEach(resetDb);

const move = (productId: string, body: unknown, headers?: Record<string, string>) =>
  moveStock(apiRequest("POST", `/api/stock/${productId}/mouvements`, body, headers), withId(productId));

describe("GET /api/stock", () => {
  test("sans session : 401", async () => {
    const res = await listStock(apiRequest("GET", "/api/stock"));
    expect(res.status).toBe(401);
  });

  test("liste les produits, et seulement ceux sous le seuil avec ?low=1", async () => {
    await signIn();
    await makeProduct({ name: "Plein", quantity: 20, alertThreshold: 3 });
    await makeProduct({ name: "Bas", quantity: 2, alertThreshold: 3 });
    const all = (await (await listStock(apiRequest("GET", "/api/stock"))).json()) as { products: { name: string }[] };
    expect(all.products.map((p) => p.name).sort()).toEqual(["Bas", "Plein"]);
    const low = (await (await listStock(apiRequest("GET", "/api/stock?low=1"))).json()) as { products: { name: string }[] };
    expect(low.products.map((p) => p.name)).toEqual(["Bas"]);
  });
});

describe("POST /api/stock/:id/mouvements", () => {
  test("une entrée augmente la quantité et laisse une trace avec son auteur", async () => {
    const user = await signIn();
    const p = await makeProduct({ quantity: 10 });
    const res = await move(p.id, { type: "IN", quantity: 5, reason: "Livraison" });
    expect(res.status).toBe(201);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).quantity).toBe(15);
    const mv = await prisma.stockMovement.findFirstOrThrow({ where: { productId: p.id } });
    expect(mv).toMatchObject({ type: "IN", quantity: 5, reason: "Livraison", userId: user.id });
  });

  test("une sortie diminue la quantité", async () => {
    await signIn();
    const p = await makeProduct({ quantity: 10 });
    expect((await move(p.id, { type: "OUT", quantity: 4 })).status).toBe(201);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).quantity).toBe(6);
  });

  test("un inventaire fixe la quantité comptée", async () => {
    await signIn();
    const p = await makeProduct({ quantity: 10 });
    expect((await move(p.id, { type: "ADJUSTMENT", quantity: 7 })).status).toBe(201);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).quantity).toBe(7);
  });

  test("le stock ne devient jamais négatif : 409, et RIEN n'est écrit (ni quantité ni mouvement)", async () => {
    await signIn();
    const p = await makeProduct({ quantity: 3 });
    const res = await move(p.id, { type: "OUT", quantity: 4 });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: string }).error).toContain("Stock insuffisant");
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).quantity).toBe(3);
    expect(await prisma.stockMovement.count()).toBe(0);
  });

  test("on peut vider le stock exactement", async () => {
    await signIn();
    const p = await makeProduct({ quantity: 3 });
    expect((await move(p.id, { type: "OUT", quantity: 3 })).status).toBe(201);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).quantity).toBe(0);
  });

  test("une alerte push part quand le stock franchit le seuil, pas ensuite", async () => {
    await signIn();
    const p = await makeProduct({ name: "Shampoing", quantity: 5, alertThreshold: 2 });
    await move(p.id, { type: "OUT", quantity: 1 }); // 5 → 4 : au-dessus du seuil
    expect(pushCalls).toHaveLength(0);
    await move(p.id, { type: "OUT", quantity: 2 }); // 4 → 2 : tombe pile sur le seuil
    expect(pushCalls).toHaveLength(1);
    expect(pushCalls[0]).toMatchObject({ title: "Stock bas", url: "/stock" });
    expect(pushCalls[0].body).toContain("Shampoing");
    await move(p.id, { type: "OUT", quantity: 1 }); // 2 → 1 : déjà sous le seuil
    expect(pushCalls).toHaveLength(1);
  });

  test("produit inconnu : 404", async () => {
    await signIn();
    expect((await move("inconnu", { type: "IN", quantity: 1 })).status).toBe(404);
  });

  test("données invalides : 422 avec le détail par champ, rien n'est écrit", async () => {
    await signIn();
    const p = await makeProduct();
    const res = await move(p.id, { type: "VOL", quantity: -2 });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { details: Record<string, string> };
    expect(Object.keys(body.details).sort()).toEqual(["quantity", "type"]);
    expect(await prisma.stockMovement.count()).toBe(0);
  });

  test("une entrée ou sortie de 0 est refusée (seul l'inventaire peut valoir 0)", async () => {
    await signIn();
    const p = await makeProduct();
    const res = await move(p.id, { type: "IN", quantity: 0 });
    expect(res.status).toBe(422);
  });

  test("sans session : 401, avec un Origin étranger : 403, sans JSON : 415", async () => {
    const p = await makeProduct();
    expect((await move(p.id, { type: "IN", quantity: 1 })).status).toBe(401);
    await signIn();
    expect((await move(p.id, { type: "IN", quantity: 1 }, { origin: "https://evil.example" })).status).toBe(403);
    const noJson = new Request(`http://localhost:3000/api/stock/${p.id}/mouvements`, { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" });
    expect((await moveStock(noJson, withId(p.id))).status).toBe(415);
    expect(await prisma.stockMovement.count()).toBe(0);
  });

  test("après déconnexion, la même requête est refusée", async () => {
    await signIn();
    const p = await makeProduct();
    expect((await move(p.id, { type: "IN", quantity: 1 })).status).toBe(201);
    signOut();
    expect((await move(p.id, { type: "IN", quantity: 1 })).status).toBe(401);
  });
});
