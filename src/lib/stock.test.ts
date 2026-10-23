import { beforeAll, describe, expect, mock, test } from "bun:test";

// stock-service ouvre la base et envoie des notifications : on les remplace, ces tests ne touchent que des règles pures.
mock.module("@/lib/prisma", () => ({ prisma: {} }));
mock.module("@/lib/push", () => ({ notify: () => undefined }));

let nextQuantity: typeof import("./stock-service").nextQuantity;
let crossesAlertThreshold: typeof import("./stock-service").crossesAlertThreshold;
let movementInput: typeof import("./stock-service").movementInput;

beforeAll(async () => {
  ({ nextQuantity, crossesAlertThreshold, movementInput } = await import("./stock-service"));
});

describe("nextQuantity", () => {
  test("une entrée ajoute", () => {
    expect(nextQuantity(4, "IN", 3)).toBe(7);
  });

  test("une sortie retranche", () => {
    expect(nextQuantity(4, "OUT", 3)).toBe(1);
  });

  test("une sortie peut vider le stock", () => {
    expect(nextQuantity(4, "OUT", 4)).toBe(0);
  });

  test("une sortie trop grosse donne un stock négatif (c'est l'appelant qui la refuse)", () => {
    expect(nextQuantity(4, "OUT", 5)).toBe(-1);
  });

  test("un inventaire FIXE la quantité comptée, quelle que soit l'ancienne", () => {
    expect(nextQuantity(4, "ADJUSTMENT", 12)).toBe(12);
    expect(nextQuantity(4, "ADJUSTMENT", 0)).toBe(0);
  });
});

describe("crossesAlertThreshold : une seule alerte au franchissement du seuil", () => {
  test("passer sous le seuil déclenche l'alerte", () => {
    expect(crossesAlertThreshold(5, 1, 2)).toBe(true);
  });

  test("tomber pile sur le seuil déclenche l'alerte (seuil inclus)", () => {
    expect(crossesAlertThreshold(3, 2, 2)).toBe(true);
  });

  test("rester au-dessus du seuil : rien", () => {
    expect(crossesAlertThreshold(5, 3, 2)).toBe(false);
  });

  test("déjà au seuil ou en dessous : pas de nouvelle alerte à chaque mouvement", () => {
    expect(crossesAlertThreshold(2, 1, 2)).toBe(false);
    expect(crossesAlertThreshold(1, 0, 2)).toBe(false);
    expect(crossesAlertThreshold(2, 2, 2)).toBe(false);
  });

  test("une remontée du stock ne déclenche rien", () => {
    expect(crossesAlertThreshold(1, 10, 2)).toBe(false);
  });

  test("seuil 0 : alerte quand le stock tombe à zéro", () => {
    expect(crossesAlertThreshold(1, 0, 0)).toBe(true);
    expect(crossesAlertThreshold(3, 1, 0)).toBe(false);
  });
});

describe("movementInput (schéma Zod)", () => {
  const ok = { productId: "p1", type: "OUT", quantity: "3", reason: "test" };

  test("accepte un mouvement valide et convertit la quantité saisie en nombre", () => {
    const r = movementInput.safeParse(ok);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.quantity).toBe(3);
  });

  test("la raison est facultative", () => {
    expect(movementInput.safeParse({ productId: "p1", type: "IN", quantity: 1 }).success).toBe(true);
  });

  test.each([
    ["quantité négative", { ...ok, quantity: "-1" }],
    ["quantité décimale", { ...ok, quantity: "1.5" }],
    ["quantité au-delà de 10 000", { ...ok, quantity: "10001" }],
    ["quantité absente", { productId: "p1", type: "IN" }],
    ["quantité non numérique", { ...ok, quantity: "beaucoup" }],
    ["type inconnu", { ...ok, type: "VOL" }],
    ["produit vide", { ...ok, productId: "" }],
    ["raison trop longue", { ...ok, reason: "x".repeat(201) }],
  ])("refuse : %s", (_nom, input) => {
    expect(movementInput.safeParse(input).success).toBe(false);
  });

  test("accepte les bornes : 0 (inventaire) et 10 000", () => {
    expect(movementInput.safeParse({ ...ok, type: "ADJUSTMENT", quantity: "0" }).success).toBe(true);
    expect(movementInput.safeParse({ ...ok, quantity: "10000" }).success).toBe(true);
  });
});
