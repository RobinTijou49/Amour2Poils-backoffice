import { beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { contentSecurityPolicy } from "./csp";

// La session est simulée : guard() la lit via getSession() (cookie + base), qu'on ne veut pas toucher ici.
type FakeSession = { user: { id: string; role: "ADMIN" | "EMPLOYEE" } } | null;
let session: FakeSession = null;
mock.module("@/lib/session", () => ({ getSession: async () => session }));

let isSameOrigin: typeof import("./api").isSameOrigin;
let guard: typeof import("./api").guard;
beforeAll(async () => {
  ({ isSameOrigin, guard } = await import("./api"));
});
beforeEach(() => {
  session = null;
});

/** Requête minimale : isSameOrigin et guard ne lisent que `headers` et `url`. (`new Request` filtre certains en-têtes `Sec-*`.) */
const req = (headers: Record<string, string> = {}, url = "https://amour2poils.duckdns.org/api/stock") =>
  ({ headers: new Headers(headers), url, method: "POST" }) as unknown as Request;

const JSON_TYPE = { "content-type": "application/json" };

describe("isSameOrigin : contrôle anti-CSRF des écritures", () => {
  test("hors navigateur (ni Origin ni Sec-Fetch-Site) : autorisé, sans cookie d'un tiers il n'y a rien à détourner", () => {
    expect(isSameOrigin(req())).toBe(true);
  });

  test("même origine derrière un proxy : Origin comparé à X-Forwarded-Host", () => {
    expect(isSameOrigin(req({ origin: "https://amour2poils.duckdns.org", "x-forwarded-host": "amour2poils.duckdns.org" }, "http://0.0.0.0:3000/api/x"))).toBe(true);
  });

  test("même origine sans proxy : Origin comparé à Host", () => {
    expect(isSameOrigin(req({ origin: "http://localhost:3100", host: "localhost:3100" }, "http://localhost:3100/api/x"))).toBe(true);
  });

  test("plusieurs proxys en chaîne : le premier hôte est celui du navigateur", () => {
    expect(isSameOrigin(req({ origin: "https://amour2poils.duckdns.org", "x-forwarded-host": "amour2poils.duckdns.org, 172.18.0.5" }))).toBe(true);
  });

  test("Origin d'un autre site : refusé", () => {
    expect(isSameOrigin(req({ origin: "https://evil.example", "x-forwarded-host": "amour2poils.duckdns.org" }))).toBe(false);
  });

  test("Origin du site mais hôte différent (en-tête X-Forwarded-Host incohérent) : refusé", () => {
    expect(isSameOrigin(req({ origin: "https://amour2poils.duckdns.org", "x-forwarded-host": "autre.example" }))).toBe(false);
  });

  test("Origin illisible : refusé", () => {
    expect(isSameOrigin(req({ origin: "pas une url", "x-forwarded-host": "amour2poils.duckdns.org" }))).toBe(false);
  });

  test.each([
    ["same-origin", true],
    ["none", true],
    ["same-site", false], // un autre sous-domaine du même site
    ["cross-site", false],
  ])("Sec-Fetch-Site: %s → %p", (value, expected) => {
    expect(isSameOrigin(req({ "sec-fetch-site": value }))).toBe(expected);
  });

  test("Sec-Fetch-Site cross-site l'emporte même si Origin semble correct", () => {
    expect(isSameOrigin(req({ "sec-fetch-site": "cross-site", origin: "https://amour2poils.duckdns.org", "x-forwarded-host": "amour2poils.duckdns.org" }))).toBe(false);
  });
});

describe("guard : porte d'entrée de chaque Route Handler", () => {
  const status = async (r: ReturnType<typeof guard>) => {
    const out = await r;
    return out.response ? out.response.status : "ok";
  };

  test("lecture sans session : 401", async () => {
    expect(await status(guard(req({})))).toBe(401);
  });

  test("lecture avec session : passe, sans exiger de JSON", async () => {
    session = { user: { id: "u1", role: "EMPLOYEE" } };
    expect(await status(guard(req({})))).toBe("ok");
  });

  test("écriture depuis un autre site : 403, avant même de regarder la session", async () => {
    session = { user: { id: "u1", role: "ADMIN" } };
    expect(await status(guard(req({ ...JSON_TYPE, "sec-fetch-site": "cross-site" }), { write: true }))).toBe(403);
  });

  test("écriture sans JSON (formulaire d'un autre site, text/plain) : 415", async () => {
    session = { user: { id: "u1", role: "ADMIN" } };
    for (const type of ["text/plain", "application/x-www-form-urlencoded", "multipart/form-data; boundary=x", ""]) {
      expect(await status(guard(req(type ? { "content-type": type } : {}), { write: true }))).toBe(415);
    }
  });

  test("écriture JSON sans session : 401", async () => {
    expect(await status(guard(req(JSON_TYPE), { write: true }))).toBe(401);
  });

  test("écriture JSON avec session : passe, et renvoie l'utilisateur", async () => {
    session = { user: { id: "u1", role: "EMPLOYEE" } };
    const out = await guard(req({ ...JSON_TYPE, "content-type": "Application/JSON; charset=utf-8" }), { write: true });
    expect(out.user?.id).toBe("u1");
  });

  test("route réservée à la gérance : employé 403, gérant accepté", async () => {
    session = { user: { id: "u1", role: "EMPLOYEE" } };
    expect(await status(guard(req(JSON_TYPE), { write: true, admin: true }))).toBe(403);
    session = { user: { id: "u2", role: "ADMIN" } };
    expect(await status(guard(req(JSON_TYPE), { write: true, admin: true }))).toBe("ok");
  });
});

describe("contentSecurityPolicy", () => {
  const directives = (csp: string) => Object.fromEntries(csp.split("; ").map((d) => [d.split(" ")[0], d]));
  const prod = directives(contentSecurityPolicy("NONCE123", { local: false, dev: false }));

  test("le nonce de la requête figure dans script-src", () => {
    expect(prod["script-src"]).toContain("'nonce-NONCE123'");
  });

  test("deux requêtes avec deux nonces donnent deux politiques différentes", () => {
    expect(contentSecurityPolicy("A", { local: false, dev: false })).not.toBe(contentSecurityPolicy("B", { local: false, dev: false }));
  });

  test("production : aucun 'unsafe-inline' ni 'unsafe-eval' pour les scripts (c'est tout l'intérêt du nonce)", () => {
    expect(prod["script-src"]).not.toContain("unsafe-inline");
    expect(prod["script-src"]).not.toContain("unsafe-eval");
    expect(prod["script-src"]).toContain("'strict-dynamic'");
  });

  test("développement : 'unsafe-eval' autorisé (rechargement à chaud de Next) mais toujours pas 'unsafe-inline'", () => {
    const dev = directives(contentSecurityPolicy("N", { local: true, dev: true }));
    expect(dev["script-src"]).toContain("'unsafe-eval'");
    expect(dev["script-src"]).not.toContain("unsafe-inline");
  });

  test("le site ne peut être mis en iframe, ni charger d'objet, ni changer sa base d'URL", () => {
    expect(prod["frame-ancestors"]).toBe("frame-ancestors 'none'");
    expect(prod["object-src"]).toBe("object-src 'none'");
    expect(prod["base-uri"]).toBe("base-uri 'self'");
    expect(prod["form-action"]).toBe("form-action 'self'");
  });

  test("tout le reste est limité à l'origine du site par défaut", () => {
    expect(prod["default-src"]).toBe("default-src 'self'");
    expect(prod["connect-src"]).toBe("connect-src 'self'");
    expect(prod["worker-src"]).toBe("worker-src 'self'");
  });

  test("upgrade-insecure-requests en ligne, mais pas sur localhost (HTTP)", () => {
    expect(contentSecurityPolicy("N", { local: false, dev: false })).toContain("upgrade-insecure-requests");
    expect(contentSecurityPolicy("N", { local: true, dev: false })).not.toContain("upgrade-insecure-requests");
  });

  test("les violations sont rapportées à /api/csp-report", () => {
    expect(prod["report-uri"]).toBe("report-uri /api/csp-report");
  });
});

describe("service worker : internalPath (redirection ouverte des notifications)", () => {
  // sw.js est un script de navigateur, pas un module : on en extrait la fonction pour la tester telle qu'elle est servie.
  let internalPath: (url: unknown) => string;
  beforeAll(async () => {
    const source = await Bun.file("public/sw.js").text();
    const fn = source.match(/function internalPath\(url\) \{[\s\S]*?\n\}/)?.[0];
    if (!fn) throw new Error("internalPath introuvable dans public/sw.js");
    internalPath = new Function(`${fn}; return internalPath;`)();
  });

  test.each(["/", "/reservations/abc", "/stock?x=1#bas", "/chiens/nouveau"])("%p reste sur le site", (u) => {
    expect(internalPath(u)).toBe(u);
  });

  const BACKSLASH = String.fromCharCode(92);
  test.each([
    ["//evil.example", "URL relative au protocole : sort du site"],
    ["///evil.example", "idem avec trois barres"],
    [`/${BACKSLASH}evil.example`, "barre oblique inverse : certains navigateurs la lisent comme une barre"],
    ["https://evil.example", "URL absolue"],
    ["javascript:alert(1)", "schéma javascript"],
    ["reservations", "chemin sans barre initiale"],
    ["", "vide"],
  ])("%p est refusé (%s) et remplacé par /", (u) => {
    expect(internalPath(u)).toBe("/");
  });

  test("valeurs qui ne sont pas du texte", () => {
    for (const v of [null, undefined, 42, {}, ["/ok"]]) expect(internalPath(v)).toBe("/");
  });
});
