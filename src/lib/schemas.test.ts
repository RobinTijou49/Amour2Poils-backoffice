import { beforeAll, describe, expect, mock, test } from "bun:test";
import { utcDay } from "./format";

mock.module("@/lib/prisma", () => ({ prisma: {} }));
mock.module("@/lib/push", () => ({ notify: () => undefined }));

let bookingInput: typeof import("./booking-service").bookingInput;
let validateEnv: typeof import("./env").validateEnv;

beforeAll(async () => {
  ({ bookingInput } = await import("./booking-service"));
  ({ validateEnv } = await import("./env"));
});

const iso = (offsetDays: number) => utcDay(new Date(), offsetDays).toISOString().slice(0, 10);
const valid = () => ({ dogId: "dog1", kennelId: "", startDate: iso(1), endDate: iso(4), nightlyRate: "22", notes: "RAS" });
const errorPaths = (input: unknown) => {
  const r = bookingInput.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => String(i.path[0]));
};

describe("bookingInput (schéma de réservation)", () => {
  test("accepte une réservation valide et convertit dates et tarif", () => {
    const r = bookingInput.safeParse(valid());
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.startDate).toBeInstanceOf(Date);
      expect(r.data.nightlyRate).toBe(22);
    }
  });

  test("« à attribuer » : une box vide devient null, une box choisie est conservée", () => {
    const vide = bookingInput.parse({ ...valid(), kennelId: "" });
    const choisie = bookingInput.parse({ ...valid(), kennelId: "box3" });
    expect(vide.kennelId).toBeNull();
    expect(choisie.kennelId).toBe("box3");
  });

  test("l'arrivée aujourd'hui est acceptée, hier est refusée", () => {
    expect(bookingInput.safeParse({ ...valid(), startDate: iso(0), endDate: iso(2) }).success).toBe(true);
    expect(errorPaths({ ...valid(), startDate: iso(-1), endDate: iso(2) })).toContain("startDate");
  });

  test("le départ doit être strictement après l'arrivée", () => {
    expect(errorPaths({ ...valid(), startDate: iso(3), endDate: iso(3) })).toContain("endDate");
    expect(errorPaths({ ...valid(), startDate: iso(3), endDate: iso(2) })).toContain("endDate");
  });

  test("tarif : > 0 et ≤ 500 €", () => {
    expect(errorPaths({ ...valid(), nightlyRate: "0" })).toContain("nightlyRate");
    expect(errorPaths({ ...valid(), nightlyRate: "-5" })).toContain("nightlyRate");
    expect(errorPaths({ ...valid(), nightlyRate: "501" })).toContain("nightlyRate");
    expect(errorPaths({ ...valid(), nightlyRate: "abc" })).toContain("nightlyRate");
    expect(bookingInput.safeParse({ ...valid(), nightlyRate: "500" }).success).toBe(true);
    expect(bookingInput.safeParse({ ...valid(), nightlyRate: "0.01" }).success).toBe(true);
  });

  test("chien obligatoire", () => {
    expect(errorPaths({ ...valid(), dogId: "" })).toContain("dogId");
  });

  test("notes limitées à 500 caractères", () => {
    expect(errorPaths({ ...valid(), notes: "x".repeat(501) })).toContain("notes");
    expect(bookingInput.safeParse({ ...valid(), notes: "x".repeat(500) }).success).toBe(true);
  });

  test("format de date : seul AAAA-MM-JJ est accepté", () => {
    expect(errorPaths({ ...valid(), startDate: "demain" })).toContain("startDate");
    expect(errorPaths({ ...valid(), startDate: "23/10/2026" })).toContain("startDate");
  });

  test("une date qui n'existe pas dans le calendrier est refusée (30 février, mois 13)", () => {
    const futur = new Date().getUTCFullYear() + 1;
    expect(bookingInput.safeParse({ ...valid(), startDate: `${futur}-02-30`, endDate: `${futur}-03-05` }).success).toBe(false);
    expect(bookingInput.safeParse({ ...valid(), startDate: `${futur}-13-01`, endDate: `${futur + 1}-01-05` }).success).toBe(false);
  });
});

describe("validateEnv : configuration de production", () => {
  const long = (n: number) => "a".repeat(n);
  const complete = {
    DATABASE_URL: "postgresql://u:p@db:5432/d",
    VAPID_PUBLIC_KEY: long(87),
    VAPID_PRIVATE_KEY: long(43),
    VAPID_SUBJECT: "mailto:a@b.fr",
    CRON_SECRET: long(32),
  };
  const run = (env: Record<string, string | undefined>) => () => validateEnv(env as NodeJS.ProcessEnv);

  test("une configuration de production complète passe", () => {
    expect(run({ ...complete, NODE_ENV: "production" })).not.toThrow();
  });

  test("en production, un secret manquant bloque le démarrage et le message nomme la variable", () => {
    expect(run({ ...complete, CRON_SECRET: undefined, NODE_ENV: "production" })).toThrow(/CRON_SECRET/);
  });

  test("une variable vide (`VAR=` dans .env) compte comme absente", () => {
    expect(run({ ...complete, CRON_SECRET: "", NODE_ENV: "production" })).toThrow(/CRON_SECRET/);
  });

  test("CRON_SECRET trop court refusé", () => {
    expect(run({ ...complete, CRON_SECRET: "court", NODE_ENV: "production" })).toThrow(/24 caractères/);
  });

  test("les trois variables VAPID vont ensemble", () => {
    expect(run({ ...complete, VAPID_PRIVATE_KEY: undefined, NODE_ENV: "development" })).toThrow(/VAPID/);
  });

  test("l'adresse de contact VAPID doit être mailto: ou https://", () => {
    expect(run({ ...complete, VAPID_SUBJECT: "robin@example.com", NODE_ENV: "production" })).toThrow(/mailto/);
  });

  test("DATABASE_URL doit être une URL postgresql://", () => {
    expect(run({ ...complete, DATABASE_URL: "mysql://x", NODE_ENV: "production" })).toThrow(/DATABASE_URL/);
    expect(run({ ...complete, DATABASE_URL: undefined, NODE_ENV: "production" })).toThrow(/DATABASE_URL/);
  });

  test("en développement, seule la base est obligatoire", () => {
    expect(run({ DATABASE_URL: complete.DATABASE_URL, NODE_ENV: "development" })).not.toThrow();
  });

  test("pendant `next build`, les secrets de production ne sont pas exigés", () => {
    expect(run({ DATABASE_URL: complete.DATABASE_URL, NODE_ENV: "production", NEXT_PHASE: "phase-production-build" })).not.toThrow();
  });

  test("le message d'erreur ne contient jamais la valeur d'un secret", () => {
    const secret = "secret-tres-confidentiel-123456789";
    try {
      validateEnv({ ...complete, CRON_SECRET: undefined, DATABASE_URL: `mysql://${secret}`, NODE_ENV: "production" } as NodeJS.ProcessEnv);
      throw new Error("devait échouer");
    } catch (e) {
      expect((e as Error).message).not.toContain(secret);
    }
  });
});

describe("isoDay / isRealDay : dates saisies dans les formulaires", () => {
  let isoDay: typeof import("./forms").isoDay;
  let isRealDay: typeof import("./forms").isRealDay;
  beforeAll(async () => {
    ({ isoDay, isRealDay } = await import("./forms"));
  });

  test.each(["2026-10-23", "2028-02-29", "2026-12-31", "2026-01-01"])("%p est un vrai jour", (d) => {
    expect(isRealDay(d)).toBe(true);
    expect(isoDay.safeParse(d).success).toBe(true);
  });

  test.each([
    ["2027-02-30", "le 30 février n'existe pas"],
    ["2027-02-29", "2027 n'est pas bissextile"],
    ["2026-04-31", "avril a 30 jours"],
    ["2026-13-01", "il n'y a pas de 13e mois"],
    ["2026-00-10", "il n'y a pas de mois 0"],
    ["2026-10-00", "il n'y a pas de jour 0"],
    ["2026-10-32", "il n'y a pas de 32e jour"],
  ])("%p est refusé (%s)", (d) => {
    expect(isRealDay(d)).toBe(false);
    expect(isoDay.safeParse(d).success).toBe(false);
  });

  test("convertit en minuit UTC", () => {
    expect(isoDay.parse("2026-10-23").toISOString()).toBe("2026-10-23T00:00:00.000Z");
  });

  test("refuse les formats approximatifs", () => {
    for (const d of ["", "23/10/2026", "2026-1-5", "2026-10-23T10:00", " 2026-10-23"]) expect(isoDay.safeParse(d).success).toBe(false);
  });
});
