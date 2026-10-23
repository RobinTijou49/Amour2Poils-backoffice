import { describe, expect, test } from "bun:test";
import type { InvoiceStatus } from "@/generated/prisma/client";
import { nights } from "./bookings";
import { eurosToCents } from "./format";
import { canSetInvoiceStatus, DRAFT_PREFIX, invoiceTotal, isProvisionalNumber, nextInvoiceNumber } from "./invoices";

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe("nextInvoiceNumber : numérotation sans trou", () => {
  test("première facture de l'année", () => {
    expect(nextInvoiceNumber(2026, [])).toBe("F-2026-0001");
  });

  test("suit le plus grand numéro existant", () => {
    expect(nextInvoiceNumber(2026, ["F-2026-0001", "F-2026-0002", "F-2026-0006"])).toBe("F-2026-0007");
  });

  test("l'ordre de la liste n'a pas d'importance", () => {
    expect(nextInvoiceNumber(2026, ["F-2026-0006", "F-2026-0002", "F-2026-0004"])).toBe("F-2026-0007");
  });

  test("les numéros des autres années sont ignorés (la séquence repart de 1 chaque année)", () => {
    expect(nextInvoiceNumber(2027, ["F-2026-0099"])).toBe("F-2027-0001");
    expect(nextInvoiceNumber(2026, ["F-2025-0123", "F-2026-0003"])).toBe("F-2026-0004");
  });

  test("les brouillons (numéro provisoire) ne comptent pas", () => {
    expect(nextInvoiceNumber(2026, [`${DRAFT_PREFIX}ab12cd34`, "F-2026-0001"])).toBe("F-2026-0002");
  });

  test("les valeurs illisibles sont ignorées", () => {
    expect(nextInvoiceNumber(2026, ["F-2026-abcd", "F-2026-", "F-2026-0005"])).toBe("F-2026-0006");
  });

  test("le remplissage à 4 chiffres ne tronque pas au-delà de 9999", () => {
    expect(nextInvoiceNumber(2026, ["F-2026-9999"])).toBe("F-2026-10000");
  });
});

describe("isProvisionalNumber", () => {
  test("reconnaît un brouillon", () => {
    expect(isProvisionalNumber(`${DRAFT_PREFIX}ab12cd34`)).toBe(true);
  });

  test("refuse un numéro définitif", () => {
    expect(isProvisionalNumber("F-2026-0001")).toBe(false);
    expect(isProvisionalNumber("")).toBe(false);
  });
});

describe("invoiceTotal", () => {
  test("facture vide : zéro", () => {
    expect(invoiceTotal([])).toBe(0);
  });

  test("somme quantité × prix unitaire de chaque ligne, en centimes entiers", () => {
    expect(
      invoiceTotal([
        { quantity: 5, unitPriceCents: 2200 },
        { quantity: 1, unitPriceCents: 4500 },
        { quantity: 2, unitPriceCents: 999 },
      ]),
    ).toBe(11000 + 4500 + 1998);
  });

  test("une remise (prix négatif) vient en déduction", () => {
    expect(invoiceTotal([{ quantity: 3, unitPriceCents: 2000 }, { quantity: 1, unitPriceCents: -1500 }])).toBe(4500);
  });
});

describe("prix d'un séjour", () => {
  test("nuits × tarif de la nuit, de la saisie en euros au total en centimes", () => {
    const tarifSaisi = 22.5; // € la nuit
    const lignes = [{ quantity: nights(day("2026-10-23"), day("2026-10-28")), unitPriceCents: eurosToCents(tarifSaisi) }];
    expect(invoiceTotal(lignes)).toBe(5 * 2250);
  });

  test("pas d'erreur d'arrondi flottant sur un tarif à 2 décimales", () => {
    const lignes = [{ quantity: 3, unitPriceCents: eurosToCents(19.99) }];
    expect(invoiceTotal(lignes)).toBe(5997); // et non 5996.999999999999 ou 5997.000000001
    expect(Number.isInteger(invoiceTotal(lignes))).toBe(true);
  });
});

describe("canSetInvoiceStatus : cycle de vie d'une facture", () => {
  const all: InvoiceStatus[] = ["DRAFT", "SENT", "PAID", "CANCELLED"];
  const allowed = new Set(["DRAFT>SENT", "DRAFT>CANCELLED", "SENT>PAID", "SENT>CANCELLED"]);

  for (const from of all) {
    for (const to of all) {
      const ok = allowed.has(`${from}>${to}`);
      test(`${from} → ${to} : ${ok ? "autorisé" : "refusé"}`, () => {
        expect(canSetInvoiceStatus(from, to)).toBe(ok);
      });
    }
  }

  test("une facture payée ne peut plus être annulée ni modifiée", () => {
    for (const to of all) expect(canSetInvoiceStatus("PAID", to)).toBe(false);
  });

  test("on ne peut pas marquer payé un brouillon jamais envoyé", () => {
    expect(canSetInvoiceStatus("DRAFT", "PAID")).toBe(false);
  });
});
