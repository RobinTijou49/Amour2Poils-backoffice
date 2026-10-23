import { describe, expect, test } from "bun:test";
import type { BookingStatus } from "@/generated/prisma/client";
import { canTransition, hasRoom, nights, overlaps } from "./bookings";

// Dates « jour » : minuit UTC, comme les colonnes @db.Date de la base.
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
const stay = (from: string, to: string) => ({ start: day(from), end: day(to) });

describe("canTransition : cycle de vie d'une réservation", () => {
  const all: BookingStatus[] = ["PENDING", "CONFIRMED", "CHECKED_IN", "COMPLETED", "CANCELLED"];
  // Écrite à la main, volontairement, plutôt que relue dans `transitions` : sinon le test répéterait le code.
  const allowed = new Set(["PENDING>CONFIRMED", "PENDING>CANCELLED", "CONFIRMED>CHECKED_IN", "CONFIRMED>CANCELLED", "CHECKED_IN>COMPLETED"]);

  for (const from of all) {
    for (const to of all) {
      const ok = allowed.has(`${from}>${to}`);
      test(`${from} → ${to} : ${ok ? "autorisé" : "refusé"}`, () => {
        expect(canTransition(from, to)).toBe(ok);
      });
    }
  }

  test("COMPLETED et CANCELLED sont des états terminaux", () => {
    for (const to of all) {
      expect(canTransition("COMPLETED", to)).toBe(false);
      expect(canTransition("CANCELLED", to)).toBe(false);
    }
  });

  test("on ne peut pas annuler un chien déjà arrivé", () => {
    expect(canTransition("CHECKED_IN", "CANCELLED")).toBe(false);
  });
});

describe("nights", () => {
  test("compte les nuits entre l'arrivée et le départ", () => {
    expect(nights(day("2026-10-23"), day("2026-10-28"))).toBe(5);
    expect(nights(day("2026-10-23"), day("2026-10-24"))).toBe(1);
  });

  test("zéro nuit le même jour", () => {
    expect(nights(day("2026-10-23"), day("2026-10-23"))).toBe(0);
  });

  test("traverse un changement de mois et d'année", () => {
    expect(nights(day("2026-12-30"), day("2027-01-02"))).toBe(3);
    expect(nights(day("2026-02-27"), day("2026-03-02"))).toBe(3); // 2026 n'est pas bissextile
    expect(nights(day("2028-02-27"), day("2028-03-02"))).toBe(4); // 2028 l'est
  });
});

describe("overlaps : le jour du départ est libre", () => {
  test("deux séjours qui se suivent ne se chevauchent pas", () => {
    expect(overlaps(stay("2026-10-23", "2026-10-25"), stay("2026-10-25", "2026-10-27"))).toBe(false);
  });

  test("chevauchement partiel", () => {
    expect(overlaps(stay("2026-10-23", "2026-10-25"), stay("2026-10-24", "2026-10-26"))).toBe(true);
  });

  test("un séjour contenu dans un autre", () => {
    expect(overlaps(stay("2026-10-20", "2026-10-30"), stay("2026-10-23", "2026-10-25"))).toBe(true);
  });

  test("séjours identiques", () => {
    expect(overlaps(stay("2026-10-23", "2026-10-25"), stay("2026-10-23", "2026-10-25"))).toBe(true);
  });

  test("symétrique : l'ordre des arguments ne change rien", () => {
    const a = stay("2026-10-23", "2026-10-25");
    const b = stay("2026-10-24", "2026-10-26");
    const c = stay("2026-10-25", "2026-10-27");
    expect(overlaps(b, a)).toBe(overlaps(a, b));
    expect(overlaps(c, a)).toBe(overlaps(a, c));
  });
});

describe("hasRoom : capacité d'une box, nuit par nuit", () => {
  test("box vide : de la place", () => {
    expect(hasRoom(1, [], stay("2026-10-23", "2026-10-25"))).toBe(true);
  });

  test("capacité 1 : un séjour qui commence le jour du départ du précédent est accepté", () => {
    expect(hasRoom(1, [stay("2026-10-23", "2026-10-25")], stay("2026-10-25", "2026-10-27"))).toBe(true);
  });

  test("capacité 1 : une seule nuit en commun suffit à refuser", () => {
    expect(hasRoom(1, [stay("2026-10-23", "2026-10-25")], stay("2026-10-24", "2026-10-26"))).toBe(false);
  });

  test("capacité 1 : refusé si la dernière nuit demandée est prise", () => {
    expect(hasRoom(1, [stay("2026-10-26", "2026-10-28")], stay("2026-10-23", "2026-10-27"))).toBe(false);
  });

  test("capacité 2 : un chien déjà présent laisse de la place, deux non", () => {
    const un = [stay("2026-10-23", "2026-10-27")];
    const deux = [stay("2026-10-23", "2026-10-27"), stay("2026-10-24", "2026-10-26")];
    expect(hasRoom(2, un, stay("2026-10-24", "2026-10-25"))).toBe(true);
    expect(hasRoom(2, deux, stay("2026-10-24", "2026-10-25"))).toBe(false);
    // …mais la nuit du 23, un seul chien est présent
    expect(hasRoom(2, deux, stay("2026-10-23", "2026-10-24"))).toBe(true);
  });

  test("des séjours qui ne se croisent pas ne s'additionnent pas (capacité 2)", () => {
    // A : nuits des 23 et 24 ; B : nuits des 25 et 26. Jamais plus d'un chien par nuit, donc un 3e séjour tient.
    const existants = [stay("2026-10-23", "2026-10-25"), stay("2026-10-25", "2026-10-27")];
    expect(hasRoom(2, existants, stay("2026-10-23", "2026-10-27"))).toBe(true);
  });

  test("capacité 1 : la nuit libre entre deux séjours est utilisable, pas celles autour", () => {
    const existants = [stay("2026-10-23", "2026-10-24"), stay("2026-10-25", "2026-10-26")];
    expect(hasRoom(1, existants, stay("2026-10-24", "2026-10-25"))).toBe(true);
    expect(hasRoom(1, existants, stay("2026-10-23", "2026-10-26"))).toBe(false);
  });

  test("séjour de zéro nuit : rien à vérifier (la validation Zod le refuse en amont)", () => {
    expect(hasRoom(1, [stay("2026-10-23", "2026-10-25")], stay("2026-10-24", "2026-10-24"))).toBe(true);
  });
});
