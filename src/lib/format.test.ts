import { describe, expect, test } from "bun:test";
import { ageInYears, capitalize, daysBetween, de, eurosToCents, formatEuros, mondayOf, parisToUtc, utcDay } from "./format";

const iso = (d: Date) => d.toISOString();
const utc = (s: string) => new Date(s);

test("le fuseau des tests est fixé à UTC (tests/setup.ts), indépendant de la machine", () => {
  expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(0);
});

describe("eurosToCents : les montants sont des centimes entiers, jamais des flottants", () => {
  test.each([
    [19.99, 1999],
    [0.29, 29], // 0.29 * 100 = 28.999999999999996
    [1.1, 110], // 1.1 * 100 = 110.00000000000001
    [22.5, 2250],
    [0, 0],
    [500, 50000],
    [100_000, 10_000_000],
  ])("%p € → %p centimes", (euros, cents) => {
    expect(eurosToCents(euros)).toBe(cents);
    expect(Number.isInteger(eurosToCents(euros))).toBe(true);
  });

  test("0.1 + 0.2 (le piège classique) donne bien 30 centimes", () => {
    expect(eurosToCents(0.1 + 0.2)).toBe(30);
  });
});

describe("formatEuros", () => {
  test("virgule décimale, symbole € et séparateur de milliers français", () => {
    expect(formatEuros(1999)).toMatch(/^19,99\s€$/);
    expect(formatEuros(123456)).toMatch(/^1\s234,56\s€$/);
    expect(formatEuros(0)).toMatch(/^0,00\s€$/);
  });
});

describe("utcDay", () => {
  test("ramène à minuit UTC", () => {
    expect(iso(utcDay(utc("2026-10-23T22:30:00Z")))).toBe("2026-10-23T00:00:00.000Z");
  });

  test("décalage en jours, y compris à travers les mois", () => {
    expect(iso(utcDay(utc("2026-10-23T12:00:00Z"), 10))).toBe("2026-11-02T00:00:00.000Z");
    expect(iso(utcDay(utc("2026-10-23T12:00:00Z"), -30))).toBe("2026-09-23T00:00:00.000Z");
    expect(iso(utcDay(utc("2026-12-31T12:00:00Z"), 1))).toBe("2027-01-01T00:00:00.000Z");
  });

  test("ne modifie pas la date reçue", () => {
    const d = utc("2026-10-23T12:00:00Z");
    utcDay(d, 5);
    expect(iso(d)).toBe("2026-10-23T12:00:00.000Z");
  });
});

describe("mondayOf : la semaine commence le lundi", () => {
  test("un vendredi retombe sur le lundi précédent", () => {
    expect(iso(mondayOf(utc("2026-10-23T15:00:00Z")))).toBe("2026-10-19T00:00:00.000Z");
  });

  test("un dimanche appartient à la semaine qui finit (pas à la suivante)", () => {
    expect(iso(mondayOf(utc("2026-10-25T10:00:00Z")))).toBe("2026-10-19T00:00:00.000Z");
  });

  test("un lundi reste lui-même", () => {
    expect(iso(mondayOf(utc("2026-10-19T00:00:00Z")))).toBe("2026-10-19T00:00:00.000Z");
  });
});

describe("daysBetween", () => {
  test("nombre de jours entiers, positif ou négatif", () => {
    expect(daysBetween(utc("2026-10-23T00:00:00Z"), utc("2026-10-28T00:00:00Z"))).toBe(5);
    expect(daysBetween(utc("2026-10-28T00:00:00Z"), utc("2026-10-23T00:00:00Z"))).toBe(-5);
    expect(daysBetween(utc("2026-10-23T00:00:00Z"), utc("2026-10-23T00:00:00Z"))).toBe(0);
  });
});

describe("ageInYears", () => {
  const born = utc("2021-04-12T00:00:00Z");

  test("la veille de l'anniversaire, pas encore l'âge suivant", () => {
    expect(ageInYears(born, utc("2026-04-11T00:00:00Z"))).toBe(4);
  });

  test("le jour de l'anniversaire, l'âge change", () => {
    expect(ageInYears(born, utc("2026-04-12T00:00:00Z"))).toBe(5);
  });

  test("un chien né un 29 février", () => {
    const bissextile = utc("2020-02-29T00:00:00Z");
    expect(ageInYears(bissextile, utc("2026-02-28T00:00:00Z"))).toBe(5);
    expect(ageInYears(bissextile, utc("2026-03-01T00:00:00Z"))).toBe(6);
  });

  test("avant l'anniversaire du mois en cours", () => {
    expect(ageInYears(utc("2021-12-25T00:00:00Z"), utc("2026-10-23T00:00:00Z"))).toBe(4);
  });
});

describe("de : élision du prénom du chien", () => {
  test.each([
    ["Oslo", "d'Oslo"],
    ["Alba", "d'Alba"],
    ["Élie", "d'Élie"],
    ["Hector", "d'Hector"],
    ["Rex", "de Rex"],
    ["Milo", "de Milo"],
  ])("%p → %p", (name, expected) => {
    expect(de(name)).toBe(expected);
  });
});

describe("capitalize", () => {
  test("met la première lettre en majuscule", () => {
    expect(capitalize("vendredi 23 octobre")).toBe("Vendredi 23 octobre");
  });

  test("chaîne vide", () => {
    expect(capitalize("")).toBe("");
  });
});

describe("parisToUtc : heure saisie à Paris → instant UTC", () => {
  test("hiver : Paris est à UTC+1", () => {
    expect(iso(parisToUtc("2026-01-15", "10:00"))).toBe("2026-01-15T09:00:00.000Z");
  });

  test("été : Paris est à UTC+2", () => {
    expect(iso(parisToUtc("2026-07-15", "10:00"))).toBe("2026-07-15T08:00:00.000Z");
  });

  test("changement d'heure de printemps (29 mars 2026, 02:00 → 03:00)", () => {
    expect(iso(parisToUtc("2026-03-29", "01:30"))).toBe("2026-03-29T00:30:00.000Z"); // encore UTC+1
    expect(iso(parisToUtc("2026-03-29", "03:30"))).toBe("2026-03-29T01:30:00.000Z"); // déjà UTC+2
  });

  test("changement d'heure d'automne (25 octobre 2026, 03:00 → 02:00)", () => {
    expect(iso(parisToUtc("2026-10-25", "01:30"))).toBe("2026-10-24T23:30:00.000Z"); // encore UTC+2
    expect(iso(parisToUtc("2026-10-25", "03:30"))).toBe("2026-10-25T02:30:00.000Z"); // déjà UTC+1
  });

  test("minuit passe sur le jour précédent en UTC", () => {
    expect(iso(parisToUtc("2026-07-15", "00:30"))).toBe("2026-07-14T22:30:00.000Z");
  });
});
