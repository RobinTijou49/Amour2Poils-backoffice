import { beforeEach, describe, expect, test } from "bun:test";
import { addLine, invoiceBooking, invoiceEnrollments, removeLine, setInvoiceStatus } from "@/app/(backoffice)/facturation/actions";
import { createSession, enrollDog, setAttendance, unenroll } from "@/app/(backoffice)/seances/actions";
import { day, formData, makeBooking, makeDog, makeOwner, makeTrainingSession, prisma, redirectedTo, resetDb, signIn } from "./helpers";

beforeEach(resetDb);

const year = new Date().getUTCFullYear();
const number = (n: number) => `F-${year}-${String(n).padStart(4, "0")}`;

/** Crée une facture brouillon avec une ligne, directement en base. */
async function draftInvoice(ownerId?: string, lines = [{ label: "Pension", quantity: 2, unitPriceCents: 2000 }]) {
  const owner = ownerId ? { id: ownerId } : await makeOwner();
  return prisma.invoice.create({ data: { number: `BROUILLON-${Math.random().toString(36).slice(2, 10)}`, ownerId: owner.id, lines: { create: lines } }, include: { lines: true } });
}
const send = (id: string) => setInvoiceStatus({}, formData({ id, status: "SENT" }));

describe("invoiceBooking : facturer un séjour", () => {
  test("crée un brouillon d'une ligne : nuits × tarif de la nuit, rattaché au séjour et au propriétaire", async () => {
    await signIn("ADMIN");
    const dog = await makeDog({ name: "Oslo" });
    const b = await makeBooking({ dogId: dog.id, startDate: day(-5), endDate: day(0), nightlyRateCents: 2250, status: "COMPLETED" });
    const target = await redirectedTo(() => invoiceBooking({}, formData({ bookingId: b.id })));
    const invoice = await prisma.invoice.findFirstOrThrow({ include: { lines: true } });
    expect(target).toBe(`/facturation/${invoice.id}`);
    expect(invoice).toMatchObject({ status: "DRAFT", ownerId: dog.ownerId });
    expect(invoice.number.startsWith("BROUILLON-")).toBe(true);
    expect(invoice.lines).toHaveLength(1);
    expect(invoice.lines[0]).toMatchObject({ quantity: 5, unitPriceCents: 2250, bookingId: b.id });
    expect(invoice.lines[0].label).toContain("5 nuits");
    expect(invoice.lines[0].label).toContain("Oslo");
  });

  test("une seule nuit : « 1 nuit » au singulier", async () => {
    await signIn("ADMIN");
    const b = await makeBooking({ startDate: day(-1), endDate: day(0), status: "COMPLETED" });
    await redirectedTo(() => invoiceBooking({}, formData({ bookingId: b.id })));
    expect((await prisma.invoiceLine.findFirstOrThrow()).label).toMatch(/\(1 nuit\)$/);
  });

  test.each(["PENDING", "CANCELLED"] as const)("un séjour %s ne se facture pas", async (status) => {
    await signIn("ADMIN");
    const b = await makeBooking({ status });
    expect((await invoiceBooking({}, formData({ bookingId: b.id }))).error).toContain("Seul un séjour");
    expect(await prisma.invoice.count()).toBe(0);
  });

  test("un séjour déjà facturé ne l'est pas deux fois, mais peut l'être de nouveau si la facture est annulée", async () => {
    await signIn("ADMIN");
    const b = await makeBooking({ status: "COMPLETED" });
    await redirectedTo(() => invoiceBooking({}, formData({ bookingId: b.id })));
    expect((await invoiceBooking({}, formData({ bookingId: b.id }))).error).toContain("déjà facturé");
    await prisma.invoice.updateMany({ data: { status: "CANCELLED" } });
    expect(await redirectedTo(() => invoiceBooking({}, formData({ bookingId: b.id })))).toMatch(/^\/facturation\//);
    expect(await prisma.invoice.count()).toBe(2);
  });

  test("réservé à la gérance : un employé est refusé, rien n'est créé", async () => {
    await signIn("EMPLOYEE");
    const b = await makeBooking({ status: "COMPLETED" });
    expect((await invoiceBooking({}, formData({ bookingId: b.id }))).error).toContain("gérance");
    expect(await prisma.invoice.count()).toBe(0);
  });

  test("séjour inconnu", async () => {
    await signIn("ADMIN");
    expect((await invoiceBooking({}, formData({ bookingId: "inconnu" }))).error).toBe("Séjour introuvable.");
  });
});

describe("setInvoiceStatus : numérotation et cycle de vie", () => {
  test("envoi : numéro définitif F-AAAA-0001, émission aujourd'hui, échéance à 14 jours", async () => {
    await signIn("ADMIN");
    const inv = await draftInvoice();
    const state = await send(inv.id);
    expect(state.success).toBe(`Facture ${number(1)} envoyée.`);
    const row = await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } });
    expect(row).toMatchObject({ number: number(1), status: "SENT" });
    expect(row.issuedAt.toISOString().slice(0, 10)).toBe(day(0).toISOString().slice(0, 10));
    expect(row.dueAt?.toISOString().slice(0, 10)).toBe(day(14).toISOString().slice(0, 10));
  });

  test("numérotation continue, sans trou : les numéros se suivent dans l'ordre d'envoi, pas de création", async () => {
    await signIn("ADMIN");
    const a = await draftInvoice();
    const b = await draftInvoice();
    const c = await draftInvoice();
    await send(c.id);
    await send(a.id);
    await send(b.id);
    const numbers = Object.fromEntries((await prisma.invoice.findMany()).map((i) => [i.id, i.number]));
    expect(numbers[c.id]).toBe(number(1));
    expect(numbers[a.id]).toBe(number(2));
    expect(numbers[b.id]).toBe(number(3));
  });

  test("un brouillon supprimé ou annulé ne crée pas de trou (il n'a jamais eu de vrai numéro)", async () => {
    await signIn("ADMIN");
    const abandoned = await draftInvoice();
    const kept = await draftInvoice();
    await setInvoiceStatus({}, formData({ id: abandoned.id, status: "CANCELLED" }));
    await send(kept.id);
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: kept.id } })).number).toBe(number(1));
  });

  test("une facture envoyée puis annulée garde son numéro : il n'est jamais réattribué", async () => {
    await signIn("ADMIN");
    const first = await draftInvoice();
    await send(first.id);
    await setInvoiceStatus({}, formData({ id: first.id, status: "CANCELLED" }));
    const second = await draftInvoice();
    await send(second.id);
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: first.id } })).number).toBe(number(1));
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: second.id } })).number).toBe(number(2));
  });

  test("la séquence repart de 1 pour une nouvelle année : les numéros d'une autre année ne comptent pas", async () => {
    await signIn("ADMIN");
    const old = await draftInvoice();
    await prisma.invoice.update({ where: { id: old.id }, data: { number: `F-${year - 1}-0042`, status: "SENT" } });
    const inv = await draftInvoice();
    await send(inv.id);
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } })).number).toBe(number(1));
  });

  test("on n'envoie pas une facture sans ligne", async () => {
    await signIn("ADMIN");
    const empty = await draftInvoice(undefined, []);
    expect((await send(empty.id)).error).toContain("au moins une ligne");
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: empty.id } })).status).toBe("DRAFT");
  });

  test("paiement : date de paiement enregistrée ; une facture payée ne peut plus changer", async () => {
    await signIn("ADMIN");
    const inv = await draftInvoice();
    await send(inv.id);
    expect((await setInvoiceStatus({}, formData({ id: inv.id, status: "PAID" }))).success).toContain("payée");
    const row = await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } });
    expect(row.status).toBe("PAID");
    expect(row.paidAt).not.toBeNull();
    expect((await setInvoiceStatus({}, formData({ id: inv.id, status: "CANCELLED" }))).error).toContain("plus possible");
  });

  test("un brouillon ne peut pas être marqué payé, ni être envoyé deux fois", async () => {
    await signIn("ADMIN");
    const inv = await draftInvoice();
    expect((await setInvoiceStatus({}, formData({ id: inv.id, status: "PAID" }))).error).toContain("plus possible");
    await send(inv.id);
    expect((await send(inv.id)).error).toContain("plus possible");
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } })).number).toBe(number(1));
  });

  test("statut inconnu ou facture inconnue", async () => {
    await signIn("ADMIN");
    const inv = await draftInvoice();
    expect((await setInvoiceStatus({}, formData({ id: inv.id, status: "REMBOURSEE" }))).error).toBe("Action inconnue.");
    expect((await setInvoiceStatus({}, formData({ id: "inconnue", status: "SENT" }))).error).toBe("Facture introuvable.");
  });

  test("réservé à la gérance", async () => {
    await signIn("EMPLOYEE");
    const inv = await draftInvoice();
    expect((await send(inv.id)).error).toContain("gérance");
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } })).status).toBe("DRAFT");
  });
});

describe("lignes de facture", () => {
  test("ajout d'une ligne libre sur un brouillon : prix saisi en euros, stocké en centimes", async () => {
    await signIn("ADMIN");
    const inv = await draftInvoice();
    const state = await addLine({}, formData({ invoiceId: inv.id, label: "Bain", quantity: "2", unitPrice: "19.99" }));
    expect(state.success).toBe("Ligne ajoutée.");
    expect(await prisma.invoiceLine.findFirstOrThrow({ where: { label: "Bain" } })).toMatchObject({ quantity: 2, unitPriceCents: 1999 });
  });

  test("une remise (prix négatif) est refusée par le schéma, un prix nul est accepté", async () => {
    await signIn("ADMIN");
    const inv = await draftInvoice();
    expect((await addLine({}, formData({ invoiceId: inv.id, label: "Remise", quantity: "1", unitPrice: "-5" }))).fieldErrors?.unitPrice).toBeDefined();
    expect((await addLine({}, formData({ invoiceId: inv.id, label: "Offert", quantity: "1", unitPrice: "0" }))).success).toBeDefined();
  });

  test("on ne modifie pas une facture envoyée : ajout et suppression refusés", async () => {
    await signIn("ADMIN");
    const inv = await draftInvoice();
    await send(inv.id);
    expect((await addLine({}, formData({ invoiceId: inv.id, label: "Bain", quantity: "1", unitPrice: "10" }))).error).toContain("brouillon");
    expect((await removeLine({}, formData({ id: inv.lines[0].id }))).error).toContain("brouillon");
    expect(await prisma.invoiceLine.count()).toBe(1);
  });

  test("suppression d'une ligne d'un brouillon", async () => {
    await signIn("ADMIN");
    const inv = await draftInvoice();
    expect((await removeLine({}, formData({ id: inv.lines[0].id }))).success).toBe("Ligne supprimée.");
    expect(await prisma.invoiceLine.count()).toBe(0);
  });

  test("réservé à la gérance", async () => {
    await signIn("EMPLOYEE");
    const inv = await draftInvoice();
    expect((await addLine({}, formData({ invoiceId: inv.id, label: "Bain", quantity: "1", unitPrice: "10" }))).error).toContain("gérance");
    expect((await removeLine({}, formData({ id: inv.lines[0].id }))).error).toContain("gérance");
  });
});

describe("séances d'éducation", () => {
  const sessionFields = (extra: Record<string, string> = {}) => ({ type: "GROUP", title: "Cours collectif", day: new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10), time: "10:00", durationMin: "60", capacity: "4", price: "30", ...extra });

  test("planification : heure saisie à Paris convertie en UTC, prix en centimes, redirection", async () => {
    await signIn();
    const fields = sessionFields({ day: `${year + 1}-07-15`, time: "10:00" });
    const target = await redirectedTo(() => createSession({}, formData(fields)));
    const s = await prisma.trainingSession.findFirstOrThrow();
    expect(target).toBe(`/seances/${s.id}`);
    expect(s.startsAt.toISOString()).toBe(`${year + 1}-07-15T08:00:00.000Z`); // été : Paris = UTC+2
    expect(s).toMatchObject({ priceCents: 3000, capacity: 4, durationMin: 60 });
  });

  test("le petsitting n'a qu'une place, quoi qu'on saisisse", async () => {
    await signIn();
    await redirectedTo(() => createSession({}, formData(sessionFields({ type: "PETSITTING", capacity: "10" }))));
    expect((await prisma.trainingSession.findFirstOrThrow()).capacity).toBe(1);
  });

  test("une séance dans le passé, ou un jour inexistant, est refusée", async () => {
    await signIn();
    const passe = await createSession({}, formData(sessionFields({ day: new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10) })));
    expect(passe.fieldErrors?.day).toContain("passé");
    const fausse = await createSession({}, formData(sessionFields({ day: `${year + 1}-02-30` })));
    expect(fausse.fieldErrors?.day).toBeDefined();
    expect(await prisma.trainingSession.count()).toBe(0);
  });

  test("durée, places et tarif bornés", async () => {
    await signIn();
    const state = await createSession({}, formData(sessionFields({ durationMin: "5", capacity: "99", price: "-1" })));
    expect(Object.keys(state.fieldErrors ?? {}).sort()).toEqual(["capacity", "durationMin", "price"]);
  });

  test("inscription d'un chien, puis refus s'il est déjà inscrit", async () => {
    await signIn();
    const s = await makeTrainingSession({ capacity: 3 });
    const dog = await makeDog({ name: "Oslo" });
    expect((await enrollDog({}, formData({ sessionId: s.id, dogId: dog.id }))).success).toBe("Oslo est inscrit.");
    expect((await enrollDog({}, formData({ sessionId: s.id, dogId: dog.id }))).error).toContain("déjà inscrit");
    expect(await prisma.enrollment.count()).toBe(1);
  });

  test("séance complète : refusée avec le nombre de places", async () => {
    await signIn();
    const s = await makeTrainingSession({ capacity: 1 });
    await enrollDog({}, formData({ sessionId: s.id, dogId: (await makeDog()).id }));
    const state = await enrollDog({}, formData({ sessionId: s.id, dogId: (await makeDog()).id }));
    expect(state.error).toBe("Séance complète (1 place).");
    expect(await prisma.enrollment.count()).toBe(1);
  });

  test("séance inconnue, ou aucun chien choisi", async () => {
    await signIn();
    expect((await enrollDog({}, formData({ sessionId: "inconnue", dogId: (await makeDog()).id }))).error).toBe("Séance introuvable.");
    expect((await enrollDog({}, formData({ sessionId: "x", dogId: "" }))).fieldErrors?.dogId).toBeDefined();
  });

  test("désinscription, sauf si l'inscription est déjà facturée", async () => {
    await signIn();
    const s = await makeTrainingSession();
    const libre = await prisma.enrollment.create({ data: { sessionId: s.id, dogId: (await makeDog({ name: "Rex" })).id } });
    expect((await unenroll({}, formData({ id: libre.id }))).success).toBe("Rex est désinscrit.");
    const facturee = await prisma.enrollment.create({ data: { sessionId: s.id, dogId: (await makeDog({ name: "Oslo" })).id } });
    const inv = await draftInvoice();
    await prisma.invoiceLine.create({ data: { invoiceId: inv.id, label: "Séance", quantity: 1, unitPriceCents: 3000, enrollmentId: facturee.id } });
    expect((await unenroll({}, formData({ id: facturee.id }))).error).toContain("facturée");
    expect(await prisma.enrollment.count()).toBe(1);
  });

  test("présence : noter présent ou absent ; inscription inconnue : message, pas de plantage", async () => {
    await signIn();
    const s = await makeTrainingSession();
    const e = await prisma.enrollment.create({ data: { sessionId: s.id, dogId: (await makeDog({ name: "Rex" })).id } });
    expect((await setAttendance({}, formData({ id: e.id, attended: "yes" }))).success).toBe("Rex noté présent.");
    expect((await setAttendance({}, formData({ id: e.id, attended: "no" }))).success).toBe("Rex noté absent.");
    expect((await prisma.enrollment.findUniqueOrThrow({ where: { id: e.id } })).attended).toBe(false);
    expect((await setAttendance({}, formData({ id: "inconnue", attended: "yes" }))).error).toBe("Inscription introuvable.");
  });
});

describe("invoiceEnrollments : facturer les séances d'un client", () => {
  test("regroupe sur UNE facture les séances présentes ou non notées ; les absents ne sont pas facturés", async () => {
    await signIn("ADMIN");
    const owner = await makeOwner();
    const dog = await makeDog({ ownerId: owner.id, name: "Rex" });
    const sessions = await Promise.all([1, 2, 3, 4].map((n) => makeTrainingSession({ title: `Séance ${n}`, priceCents: 1000 * n, startsAt: new Date(Date.now() + n * 86_400_000) })));
    const attended = [true, null, false, true];
    for (const [i, s] of sessions.entries()) await prisma.enrollment.create({ data: { sessionId: s.id, dogId: dog.id, attended: attended[i] } });
    const target = await redirectedTo(() => invoiceEnrollments({}, formData({ ownerId: owner.id })));
    const invoice = await prisma.invoice.findFirstOrThrow({ include: { lines: true } });
    expect(target).toBe(`/facturation/${invoice.id}`);
    // Séance 1 (présent), 2 (non notée → NULL en SQL, doit rester facturable), 4 (présent) ; la 3 (absent) est exclue.
    expect(invoice.lines.map((l) => l.unitPriceCents).sort((a, b) => a - b)).toEqual([1000, 2000, 4000]);
    expect(invoice.ownerId).toBe(owner.id);
  });

  test("ne refacture jamais une séance déjà sur une facture non annulée", async () => {
    await signIn("ADMIN");
    const owner = await makeOwner();
    const dog = await makeDog({ ownerId: owner.id });
    const s = await makeTrainingSession();
    await prisma.enrollment.create({ data: { sessionId: s.id, dogId: dog.id, attended: true } });
    await redirectedTo(() => invoiceEnrollments({}, formData({ ownerId: owner.id })));
    expect((await invoiceEnrollments({}, formData({ ownerId: owner.id }))).error).toContain("Aucune séance");
    expect(await prisma.invoice.count()).toBe(1);
  });

  test("aucune séance à facturer, ou employé : refus", async () => {
    await signIn("ADMIN");
    const owner = await makeOwner();
    expect((await invoiceEnrollments({}, formData({ ownerId: owner.id }))).error).toContain("Aucune séance");
    await signIn("EMPLOYEE");
    expect((await invoiceEnrollments({}, formData({ ownerId: owner.id }))).error).toContain("gérance");
  });
});
