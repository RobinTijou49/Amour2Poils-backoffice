import { beforeEach, describe, expect, test } from "bun:test";
import { cancelBooking, checkIn, checkOut, confirmBooking, createBooking } from "@/app/(backoffice)/reservations/actions";
import { day, formData, isoDay, makeBooking, makeDog, makeKennel, prisma, redirectedTo, resetDb, signIn, signOut } from "./helpers";

beforeEach(resetDb);

const newBooking = async (extra: Record<string, string> = {}) =>
  formData({ dogId: (await makeDog({ name: "Oslo" })).id, startDate: isoDay(2), endDate: isoDay(5), nightlyRate: "22", ...extra });

describe("createBooking", () => {
  test("réservation sans box : en attente, puis redirection vers sa fiche", async () => {
    await signIn();
    const target = await redirectedTo(async () => createBooking({}, await newBooking()));
    const booking = await prisma.booking.findFirstOrThrow();
    expect(target).toBe(`/reservations/${booking.id}`);
    expect(booking).toMatchObject({ status: "PENDING", nightlyRateCents: 2200, kennelId: null });
  });

  test("avec une box libre : confirmée", async () => {
    await signIn();
    const kennel = await makeKennel();
    await redirectedTo(async () => createBooking({}, await newBooking({ kennelId: kennel.id })));
    expect(await prisma.booking.findFirstOrThrow()).toMatchObject({ status: "CONFIRMED", kennelId: kennel.id });
  });

  test("box complète : erreur sur le champ de la box, formulaire renvoyé pré-rempli, rien d'écrit", async () => {
    await signIn();
    const kennel = await makeKennel({ capacity: 1 });
    await makeBooking({ kennelId: kennel.id, startDate: day(3), endDate: day(6), status: "CONFIRMED" });
    const fd = await newBooking({ kennelId: kennel.id });
    const state = await createBooking({}, fd);
    expect(state.error).toContain("complète");
    expect(state.fieldErrors?.kennelId).toContain("Box complète");
    expect(state.values?.nightlyRate).toBe("22"); // React vide le formulaire : les valeurs sont renvoyées pour le re-remplir
    expect(await prisma.booking.count()).toBe(1);
  });

  test("champs invalides : une erreur par champ, formulaire pré-rempli, rien d'écrit", async () => {
    await signIn();
    const state = await createBooking({}, await newBooking({ startDate: isoDay(-3), nightlyRate: "0" }));
    expect(state.error).toBe("Corrigez les champs signalés.");
    expect(Object.keys(state.fieldErrors ?? {}).sort()).toEqual(["nightlyRate", "startDate"]);
    expect(await prisma.booking.count()).toBe(0);
  });

  test("non connecté : renvoyé vers /connexion, rien d'écrit", async () => {
    const fd = await newBooking();
    signOut();
    expect(await redirectedTo(() => createBooking({}, fd))).toBe("/connexion");
    expect(await prisma.booking.count()).toBe(0);
  });
});

describe("confirmBooking", () => {
  test("choisit une box et confirme, message avec l'élision du prénom", async () => {
    await signIn();
    const kennel = await makeKennel();
    const b = await makeBooking({ status: "PENDING", dogId: (await makeDog({ name: "Oslo" })).id });
    const state = await confirmBooking({}, formData({ id: b.id, kennelId: kennel.id }));
    expect(state.success).toBe("Réservation d'Oslo confirmée.");
    expect(await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).toMatchObject({ status: "CONFIRMED", kennelId: kennel.id });
  });

  test("sans box : erreur sur le champ, la réservation reste en attente", async () => {
    await signIn();
    const b = await makeBooking({ status: "PENDING" });
    const state = await confirmBooking({}, formData({ id: b.id }));
    expect(state.fieldErrors?.kennelId).toBeDefined();
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("PENDING");
  });

  test("box complète : refusé", async () => {
    await signIn();
    const kennel = await makeKennel({ capacity: 1 });
    await makeBooking({ kennelId: kennel.id, startDate: day(1), endDate: day(4), status: "CONFIRMED" });
    const b = await makeBooking({ status: "PENDING", startDate: day(2), endDate: day(3) });
    const state = await confirmBooking({}, formData({ id: b.id, kennelId: kennel.id }));
    expect(state.error).toContain("complète");
  });

  test("réservation inconnue, ou déjà confirmée : message clair", async () => {
    await signIn();
    expect((await confirmBooking({}, formData({ id: "inconnue", kennelId: "x" }))).error).toBe("Réservation introuvable.");
    const b = await makeBooking({ status: "CONFIRMED" });
    expect((await confirmBooking({}, formData({ id: b.id, kennelId: "x" }))).error).toContain("plus possible");
  });
});

describe("checkIn / checkOut", () => {
  test("arrivée puis départ : statuts, horodatages et messages", async () => {
    await signIn();
    const b = await makeBooking({ status: "CONFIRMED", dogId: (await makeDog({ name: "Rex" })).id });
    const arrival = await checkIn({}, formData({ id: b.id }));
    expect(arrival.success).toBe("Arrivée de Rex enregistrée.");
    let row = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(row.status).toBe("CHECKED_IN");
    expect(row.checkedInAt).not.toBeNull();
    const departure = await checkOut({}, formData({ id: b.id }));
    expect(departure.success).toBe("Départ de Rex enregistré.");
    row = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(row.status).toBe("COMPLETED");
    expect(row.checkedOutAt).not.toBeNull();
  });

  test("double clic : la deuxième arrivée est refusée proprement", async () => {
    await signIn();
    const b = await makeBooking({ status: "CONFIRMED" });
    await checkIn({}, formData({ id: b.id }));
    expect((await checkIn({}, formData({ id: b.id }))).error).toContain("plus possible");
  });

  test("départ sans arrivée refusé", async () => {
    await signIn();
    const b = await makeBooking({ status: "CONFIRMED" });
    expect((await checkOut({}, formData({ id: b.id }))).error).toContain("plus possible");
  });

  test("non connecté : renvoyé vers /connexion", async () => {
    const b = await makeBooking({ status: "CONFIRMED" });
    signOut();
    expect(await redirectedTo(() => checkIn({}, formData({ id: b.id })))).toBe("/connexion");
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("CONFIRMED");
  });
});

describe("cancelBooking", () => {
  test("réservé à la gérance : un employé reçoit un refus et la réservation n'est pas touchée", async () => {
    await signIn("EMPLOYEE");
    const b = await makeBooking({ status: "CONFIRMED" });
    expect((await cancelBooking({}, formData({ id: b.id }))).error).toContain("gérance");
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("CONFIRMED");
  });

  test("la gérance annule une réservation confirmée", async () => {
    await signIn("ADMIN");
    const b = await makeBooking({ status: "CONFIRMED", dogId: (await makeDog({ name: "Oslo" })).id });
    expect((await cancelBooking({}, formData({ id: b.id }))).success).toBe("Réservation d'Oslo annulée.");
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("CANCELLED");
  });

  test("on n'annule pas un chien déjà arrivé", async () => {
    await signIn("ADMIN");
    const b = await makeBooking({ status: "CHECKED_IN" });
    expect((await cancelBooking({}, formData({ id: b.id }))).error).toContain("plus possible");
  });
});
