import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { GET as health } from "@/app/api/health/route";
import { GET as listDogs } from "@/app/api/chiens/route";
import { GET as offlineSnapshot } from "@/app/api/hors-ligne/route";
import { GET as pushKey } from "@/app/api/push/cle/route";
import { DELETE as unsubscribe, POST as subscribe } from "@/app/api/push/abonnement/route";
import { POST as vaccineReminders } from "@/app/api/push/rappels-vaccins/route";
import { POST as cspReport } from "@/app/api/csp-report/route";
import { apiRequest, day, makeBooking, makeDog, makeOwner, prisma, pushCalls, resetDb, signIn } from "./helpers";

beforeEach(resetDb);

const json = async (res: Response) => (await res.json()) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

test("GET /api/health : base joignable", async () => {
  const res = await health();
  expect(res.status).toBe(200);
  expect(await json(res)).toEqual({ status: "ok", database: "up" });
});

describe("GET /api/chiens", () => {
  test("sans session : 401", async () => {
    expect((await listDogs(apiRequest("GET", "/api/chiens"))).status).toBe(401);
  });

  test("recherche par nom de chien ou de propriétaire, sans tenir compte de la casse", async () => {
    await signIn();
    const martin = await makeOwner({ firstName: "Léa", lastName: "Martin" });
    await makeDog({ name: "Oslo", ownerId: martin.id });
    await makeDog({ name: "Rex" });
    const byDog = await json(await listDogs(apiRequest("GET", "/api/chiens?q=OSL")));
    expect(byDog.dogs.map((d: { name: string }) => d.name)).toEqual(["Oslo"]);
    const byOwner = await json(await listDogs(apiRequest("GET", "/api/chiens?q=martin")));
    expect(byOwner.dogs.map((d: { name: string }) => d.name)).toEqual(["Oslo"]);
    const all = await json(await listDogs(apiRequest("GET", "/api/chiens")));
    expect(all.dogs).toHaveLength(2);
  });

  test("ne renvoie du propriétaire que son identité (ni téléphone, ni e-mail, ni adresse)", async () => {
    await signIn();
    await makeDog({ ownerId: (await makeOwner({ email: "secret@example.com", address: "1 rue Privée" })).id });
    const dog = (await json(await listDogs(apiRequest("GET", "/api/chiens")))).dogs[0];
    expect(Object.keys(dog.owner).sort()).toEqual(["firstName", "id", "lastName"]);
  });

  test("une recherche sans résultat renvoie une liste vide, pas une erreur", async () => {
    await signIn();
    expect((await json(await listDogs(apiRequest("GET", "/api/chiens?q=zzzz")))).dogs).toEqual([]);
  });
});

describe("GET /api/hors-ligne : copie locale de la journée", () => {
  test("sans session : 401", async () => {
    expect((await offlineSnapshot(apiRequest("GET", "/api/hors-ligne"))).status).toBe(401);
  });

  test("ne contient que les séjours en cours ou du jour, confirmés ou arrivés", async () => {
    await signIn();
    const dog = (name: string) => makeDog({ name });
    await makeBooking({ dogId: (await dog("Present")).id, status: "CHECKED_IN", startDate: day(-2), endDate: day(3) });
    await makeBooking({ dogId: (await dog("ArriveAujourdhui")).id, status: "CONFIRMED", startDate: day(0), endDate: day(2) });
    await makeBooking({ dogId: (await dog("ArriveDemain")).id, status: "CONFIRMED", startDate: day(1), endDate: day(3) });
    await makeBooking({ dogId: (await dog("PartAujourdhui")).id, status: "CHECKED_IN", startDate: day(-3), endDate: day(0) });
    await makeBooking({ dogId: (await dog("DansUneSemaine")).id, status: "CONFIRMED", startDate: day(7), endDate: day(9) });
    await makeBooking({ dogId: (await dog("DejaParti")).id, status: "CHECKED_IN", startDate: day(-6), endDate: day(-1) });
    await makeBooking({ dogId: (await dog("EnAttente")).id, status: "PENDING", startDate: day(0), endDate: day(2) });
    await makeBooking({ dogId: (await dog("Annule")).id, status: "CANCELLED", startDate: day(0), endDate: day(2) });
    await makeBooking({ dogId: (await dog("Termine")).id, status: "COMPLETED", startDate: day(-3), endDate: day(1) });
    const res = await offlineSnapshot(apiRequest("GET", "/api/hors-ligne"));
    expect(res.headers.get("cache-control")).toBe("no-store");
    const names = (await json(res)).bookings.map((b: { dog: { name: string } }) => b.dog.name).sort();
    expect(names).toEqual(["ArriveAujourdhui", "ArriveDemain", "PartAujourdhui", "Present"]);
  });

  test("donne ce qu'il faut sur le terrain, mais ni e-mail ni adresse du propriétaire", async () => {
    await signIn();
    const owner = await makeOwner({ firstName: "Léa", lastName: "Martin", phone: "06 11 22 33 44", email: "lea@example.com", address: "3 rue Cachée" });
    const dog = await makeDog({ ownerId: owner.id, name: "Oslo", allergies: "poulet", vetName: "Dr Vet", vetPhone: "02 00 00 00 00" });
    await prisma.vaccination.create({ data: { dogId: dog.id, name: "Rage", administeredAt: day(-300), expiresAt: day(60) } });
    await makeBooking({ dogId: dog.id, status: "CONFIRMED", startDate: day(0), endDate: day(2) });
    const text = await (await offlineSnapshot(apiRequest("GET", "/api/hors-ligne"))).text();
    const body = JSON.parse(text);
    const b = body.bookings[0];
    expect(b.dog).toMatchObject({ name: "Oslo", allergies: "poulet", vetName: "Dr Vet" });
    expect(b.dog.owner).toEqual({ name: "Léa Martin", phone: "06 11 22 33 44" });
    expect(b.dog.vaccinations).toEqual([{ name: "Rage", expiresAt: day(60).toISOString().slice(0, 10) }]);
    expect(body.today).toBe(day(0).toISOString().slice(0, 10));
    expect(text).not.toContain("lea@example.com");
    expect(text).not.toContain("3 rue Cachée");
  });
});

describe("abonnements push", () => {
  const sub = (endpoint: string) => ({ endpoint, keys: { p256dh: "cle-publique", auth: "secret-auth" } });
  const post = (body: unknown, headers?: Record<string, string>) => subscribe(apiRequest("POST", "/api/push/abonnement", body, headers));
  const del = (body: unknown) => unsubscribe(apiRequest("DELETE", "/api/push/abonnement", body));

  test("enregistre l'appareil de l'utilisateur connecté", async () => {
    const user = await signIn();
    expect((await post(sub("https://push.example/abc"))).status).toBe(201);
    expect(await prisma.pushSubscription.findFirstOrThrow()).toMatchObject({ endpoint: "https://push.example/abc", userId: user.id, p256dh: "cle-publique" });
  });

  test("le même appareil qui s'abonne deux fois ne crée qu'une ligne, et passe au dernier utilisateur connecté", async () => {
    await signIn();
    await post(sub("https://push.example/abc"));
    const second = await signIn();
    await post(sub("https://push.example/abc"));
    const rows = await prisma.pushSubscription.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe(second.id);
  });

  test("refuse une adresse non HTTPS, des clés absentes, ou un corps vide", async () => {
    await signIn();
    expect((await post(sub("http://push.example/abc"))).status).toBe(422);
    expect((await post({ endpoint: "https://push.example/abc" })).status).toBe(422);
    expect((await post({})).status).toBe(422);
    expect(await prisma.pushSubscription.count()).toBe(0);
  });

  test("on ne se désabonne que de ses propres appareils", async () => {
    await signIn();
    await post(sub("https://push.example/a"));
    await signIn(); // autre utilisateur
    expect((await del({ endpoint: "https://push.example/a" })).status).toBe(200);
    expect(await prisma.pushSubscription.count()).toBe(1); // celui du premier utilisateur est resté
    await post(sub("https://push.example/b"));
    await del({ endpoint: "https://push.example/b" });
    expect(await prisma.pushSubscription.count()).toBe(1);
  });

  test("sans session 401, origine étrangère 403", async () => {
    expect((await post(sub("https://push.example/a"))).status).toBe(401);
    await signIn();
    expect((await post(sub("https://push.example/a"), { origin: "https://evil.example" })).status).toBe(403);
    expect(await prisma.pushSubscription.count()).toBe(0);
  });
});

describe("GET /api/push/cle", () => {
  const saved = process.env.VAPID_PUBLIC_KEY;
  afterEach(() => {
    if (saved === undefined) delete process.env.VAPID_PUBLIC_KEY;
    else process.env.VAPID_PUBLIC_KEY = saved;
  });

  test("renvoie la clé publique, jamais autre chose", async () => {
    await signIn();
    process.env.VAPID_PUBLIC_KEY = "cle-publique-de-test";
    process.env.VAPID_PRIVATE_KEY = "ne-doit-jamais-sortir";
    const text = await (await pushKey(apiRequest("GET", "/api/push/cle"))).text();
    expect(JSON.parse(text)).toEqual({ key: "cle-publique-de-test" });
    expect(text).not.toContain("ne-doit-jamais-sortir");
  });

  test("non configuré : 503 ; sans session : 401", async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    expect((await pushKey(apiRequest("GET", "/api/push/cle"))).status).toBe(401);
    await signIn();
    expect((await pushKey(apiRequest("GET", "/api/push/cle"))).status).toBe(503);
  });
});

describe("POST /api/push/rappels-vaccins (cron)", () => {
  const SECRET = "secret-de-test-assez-long-123456";
  const saved = process.env.CRON_SECRET;
  beforeEach(() => {
    process.env.CRON_SECRET = SECRET;
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = saved;
  });
  const call = (token?: string) => vaccineReminders(apiRequest("POST", "/api/push/rappels-vaccins", undefined, token ? { authorization: `Bearer ${token}` } : {}));
  const vaccin = async (dogName: string, expiresIn: number, name = "Rage") => {
    const dog = await makeDog({ name: dogName });
    await prisma.vaccination.create({ data: { dogId: dog.id, name, administeredAt: day(-300), expiresAt: day(expiresIn) } });
    return dog;
  };

  test("sans secret, avec un mauvais secret, ou sans secret configuré : 401, aucune notification", async () => {
    await vaccin("Oslo", 3);
    expect((await call()).status).toBe(401);
    expect((await call("mauvais")).status).toBe(401);
    expect((await call(SECRET + "x")).status).toBe(401);
    delete process.env.CRON_SECRET;
    expect((await call(SECRET)).status).toBe(401);
    expect(pushCalls).toHaveLength(0);
  });

  test("prévient pour un vaccin qui expire dans les 7 jours, nomme le chien", async () => {
    await vaccin("Oslo", 3);
    const res = await call(SECRET);
    expect(res.status).toBe(200);
    expect(await json(res)).toMatchObject({ due: 1, sent: 1 });
    expect(pushCalls).toHaveLength(1);
    expect(pushCalls[0]).toMatchObject({ title: "Vaccins à renouveler", url: "/chiens", tag: "rappel-vaccins" });
    expect(pushCalls[0].body).toContain("Oslo");
  });

  test("bornes : expire aujourd'hui = inclus, dans 6 jours = inclus, dans 7 jours = exclu, déjà expiré = exclu", async () => {
    await vaccin("Aujourdhui", 0);
    await vaccin("DansSixJours", 6);
    await vaccin("DansSeptJours", 7);
    await vaccin("DejaExpire", -1);
    const res = await json(await call(SECRET));
    expect(res.due).toBe(2);
    expect(pushCalls[0].body).toContain("Aujourdhui");
    expect(pushCalls[0].body).toContain("DansSixJours");
    expect(pushCalls[0].body).not.toContain("DansSeptJours");
    expect(pushCalls[0].body).not.toContain("DejaExpire");
  });

  test("rien à signaler : 200, `due: 0`, aucune notification", async () => {
    await vaccin("Loin", 100);
    const res = await call(SECRET);
    expect(await json(res)).toEqual({ due: 0, sent: 0 });
    expect(pushCalls).toHaveLength(0);
  });

  test("un chien avec deux vaccins proches n'est nommé qu'une fois ; au-delà de 3 chiens on résume", async () => {
    const rex = await vaccin("Rex", 2, "Rage");
    await prisma.vaccination.create({ data: { dogId: rex.id, name: "Toux", administeredAt: day(-300), expiresAt: day(4) } });
    await vaccin("Milo", 1);
    await vaccin("Nala", 2);
    await vaccin("Oslo", 3);
    await vaccin("Luna", 5);
    await call(SECRET);
    const body = pushCalls[0].body;
    expect(body.match(/Rex/g)).toHaveLength(1);
    expect(body).toContain("et 2 autre(s)");
  });
});

describe("POST /api/csp-report", () => {
  test("accepte un rapport (204) sans rien stocker", async () => {
    const res = await cspReport(apiRequest("POST", "/api/csp-report", { "csp-report": { "violated-directive": "script-src", "blocked-uri": "inline", "document-uri": "https://x/y" } }));
    expect(res.status).toBe(204);
  });

  test("corps trop gros : 413 ; corps illisible : 204 (ignoré)", async () => {
    const big = new Request("http://localhost:3000/api/csp-report", { method: "POST", body: "x".repeat(9000) });
    expect((await cspReport(big)).status).toBe(413);
    const garbage = new Request("http://localhost:3000/api/csp-report", { method: "POST", body: "pas du json" });
    expect((await cspReport(garbage)).status).toBe(204);
  });
});
