import { beforeEach, describe, expect, test } from "bun:test";
import { addVaccination, deleteDog, deleteVaccination, saveDog } from "@/app/(backoffice)/chiens/actions";
import { createProduct, recordMovement } from "@/app/(backoffice)/stock/actions";
import { day, formData, isoDay, makeBooking, makeDog, makeOwner, makeProduct, makeTrainingSession, prisma, pushCalls, redirectedTo, resetDb, signIn } from "./helpers";

beforeEach(resetDb);

const newOwnerFields = { ownerId: "__new__", ownerFirstName: "Léa", ownerLastName: "Martin", ownerPhone: "06 11 22 33 44", ownerEmail: "lea@example.com" };

describe("saveDog : création", () => {
  test("nouveau chien et nouveau propriétaire créés ensemble, puis redirection vers la fiche", async () => {
    await signIn();
    const target = await redirectedTo(() => saveDog({}, formData({ name: "Oslo", sex: "MALE", weightKg: "22.5", sterilized: "on", ...newOwnerFields })));
    const dog = await prisma.dog.findFirstOrThrow({ include: { owner: true } });
    expect(target).toBe(`/chiens/${dog.id}`);
    expect(dog).toMatchObject({ name: "Oslo", sterilized: true });
    expect(Number(dog.weightKg)).toBe(22.5);
    expect(dog.owner).toMatchObject({ firstName: "Léa", lastName: "Martin", email: "lea@example.com" });
  });

  test("chien rattaché à un propriétaire existant : aucun propriétaire créé en plus", async () => {
    await signIn();
    const owner = await makeOwner();
    await redirectedTo(() => saveDog({}, formData({ name: "Rex", sex: "FEMALE", ownerId: owner.id })));
    expect(await prisma.owner.count()).toBe(1);
    expect((await prisma.dog.findFirstOrThrow()).ownerId).toBe(owner.id);
  });

  test("champs invalides : erreurs par champ pour le chien ET le propriétaire, rien d'écrit", async () => {
    await signIn();
    const state = await saveDog({}, formData({ name: "", sex: "AUTRE", ...newOwnerFields, ownerPhone: "abc" }));
    expect(Object.keys(state.fieldErrors ?? {}).sort()).toEqual(["name", "ownerPhone", "sex"]);
    expect(await prisma.dog.count()).toBe(0);
    expect(await prisma.owner.count()).toBe(0);
  });

  test("sans propriétaire choisi : erreur sur le champ", async () => {
    await signIn();
    const state = await saveDog({}, formData({ name: "Rex", sex: "MALE" }));
    expect(state.fieldErrors?.ownerId).toBeDefined();
  });

  test("numéro de puce déjà pris : erreur sur le champ, et le nouveau propriétaire n'est PAS créé", async () => {
    await signIn();
    await makeDog({ chipNumber: "250268000000001" });
    const ownersBefore = await prisma.owner.count();
    const state = await saveDog({}, formData({ name: "Copie", sex: "MALE", chipNumber: "250268000000001", ...newOwnerFields }));
    expect(state.fieldErrors?.chipNumber).toContain("déjà enregistré");
    expect(await prisma.owner.count()).toBe(ownersBefore);
    expect(await prisma.dog.count()).toBe(1);
  });

  test("e-mail de propriétaire déjà utilisé : erreur sur le champ", async () => {
    await signIn();
    await makeOwner({ email: "lea@example.com" });
    const state = await saveDog({}, formData({ name: "Rex", sex: "MALE", ...newOwnerFields }));
    expect(state.fieldErrors?.ownerEmail).toContain("déjà");
  });

  test("date de naissance dans le futur ou inexistante : refusée", async () => {
    await signIn();
    const owner = await makeOwner();
    const futur = await saveDog({}, formData({ name: "Rex", sex: "MALE", ownerId: owner.id, birthDate: isoDay(30) }));
    expect(futur.fieldErrors?.birthDate).toBeDefined();
    const fausse = await saveDog({}, formData({ name: "Rex", sex: "MALE", ownerId: owner.id, birthDate: "2025-02-30" }));
    expect(fausse.fieldErrors?.birthDate).toBeDefined();
    expect(await prisma.dog.count()).toBe(0);
  });
});

describe("saveDog : modification", () => {
  test("met à jour la fiche existante sans en créer une autre", async () => {
    await signIn();
    const dog = await makeDog({ name: "Rex" });
    await redirectedTo(() => saveDog({}, formData({ id: dog.id, name: "Rex II", sex: "MALE", ownerId: dog.ownerId })));
    expect(await prisma.dog.count()).toBe(1);
    expect((await prisma.dog.findUniqueOrThrow({ where: { id: dog.id } })).name).toBe("Rex II");
  });

  test("garder sa propre puce n'est pas un doublon", async () => {
    await signIn();
    const dog = await makeDog({ chipNumber: "250268000000002" });
    const state = await redirectedTo(() => saveDog({}, formData({ id: dog.id, name: dog.name, sex: "MALE", ownerId: dog.ownerId, chipNumber: "250268000000002" })));
    expect(state).toBe(`/chiens/${dog.id}`);
  });

  test("fiche supprimée entre-temps ou propriétaire inconnu : message clair, pas de plantage", async () => {
    await signIn();
    const owner = await makeOwner();
    const gone = await saveDog({}, formData({ id: "disparue", name: "Rex", sex: "MALE", ownerId: owner.id }));
    expect(gone.error).toContain("introuvable");
    const badOwner = await saveDog({}, formData({ name: "Rex", sex: "MALE", ownerId: "inconnu" }));
    expect(badOwner.error).toContain("introuvable");
  });
});

describe("vaccins", () => {
  test("ajout avec dates valides", async () => {
    await signIn();
    const dog = await makeDog();
    const state = await addVaccination({}, formData({ dogId: dog.id, vaccineName: "Rage", administeredAt: isoDay(-10), expiresAt: isoDay(355) }));
    expect(state.success).toContain("Rage");
    expect(await prisma.vaccination.count({ where: { dogId: dog.id } })).toBe(1);
  });

  test("l'expiration doit suivre l'injection", async () => {
    await signIn();
    const dog = await makeDog();
    const state = await addVaccination({}, formData({ dogId: dog.id, vaccineName: "Rage", administeredAt: isoDay(-10), expiresAt: isoDay(-20) }));
    expect(state.fieldErrors?.expiresAt).toBeDefined();
    expect(await prisma.vaccination.count()).toBe(0);
  });

  test("suppression, et suppression d'un vaccin déjà supprimé sans erreur", async () => {
    await signIn();
    const dog = await makeDog();
    const v = await prisma.vaccination.create({ data: { dogId: dog.id, name: "Rage", administeredAt: day(-10), expiresAt: day(300) } });
    expect((await deleteVaccination({}, formData({ id: v.id }))).success).toBe("Vaccin supprimé.");
    expect((await deleteVaccination({}, formData({ id: v.id }))).success).toBe("Vaccin supprimé.");
    expect(await prisma.vaccination.count()).toBe(0);
  });
});

describe("deleteDog", () => {
  test("réservé à la gérance : un employé est refusé, la fiche reste", async () => {
    await signIn("EMPLOYEE");
    const dog = await makeDog();
    expect((await deleteDog({}, formData({ id: dog.id }))).error).toContain("gérance");
    expect(await prisma.dog.count()).toBe(1);
  });

  test("la gérance supprime un chien sans historique, avec ses vaccins", async () => {
    await signIn("ADMIN");
    const dog = await makeDog();
    await prisma.vaccination.create({ data: { dogId: dog.id, name: "Rage", administeredAt: day(-10), expiresAt: day(300) } });
    expect(await redirectedTo(() => deleteDog({}, formData({ id: dog.id })))).toBe("/chiens");
    expect(await prisma.dog.count()).toBe(0);
    expect(await prisma.vaccination.count()).toBe(0);
  });

  test("refusée si le chien a un séjour ou une séance (historique de facturation)", async () => {
    await signIn("ADMIN");
    const avecSejour = await makeDog();
    await makeBooking({ dogId: avecSejour.id });
    expect((await deleteDog({}, formData({ id: avecSejour.id }))).error).toContain("historique");
    const avecSeance = await makeDog();
    const session = await makeTrainingSession();
    await prisma.enrollment.create({ data: { dogId: avecSeance.id, sessionId: session.id } });
    expect((await deleteDog({}, formData({ id: avecSeance.id }))).error).toContain("historique");
    expect(await prisma.dog.count()).toBe(2);
  });

  test("chien inconnu", async () => {
    await signIn("ADMIN");
    expect((await deleteDog({}, formData({ id: "inconnu" }))).error).toBe("Chien introuvable.");
  });
});

describe("recordMovement (formulaire de stock)", () => {
  test("sortie : met à jour la quantité, message et alerte de seuil", async () => {
    await signIn();
    const p = await makeProduct({ name: "Shampoing", quantity: 4, alertThreshold: 2, unit: "flacon" });
    const state = await recordMovement({}, formData({ productId: p.id, type: "OUT", quantity: "3", reason: "Bain" }));
    expect(state.success).toBe("Stock de « Shampoing » : 1 flacon. Sous le seuil d'alerte.");
    expect(pushCalls).toHaveLength(1);
  });

  test("stock insuffisant : erreur sur la quantité, rien n'est modifié", async () => {
    await signIn();
    const p = await makeProduct({ quantity: 2 });
    const state = await recordMovement({}, formData({ productId: p.id, type: "OUT", quantity: "5" }));
    expect(state.fieldErrors?.quantity).toContain("Stock insuffisant");
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).quantity).toBe(2);
    expect(await prisma.stockMovement.count()).toBe(0);
  });

  test("une entrée ou sortie de zéro est refusée, un inventaire à zéro est accepté", async () => {
    await signIn();
    const p = await makeProduct({ quantity: 5 });
    const zero = await recordMovement({}, formData({ productId: p.id, type: "IN", quantity: "0" }));
    expect(zero.fieldErrors?.quantity).toContain("supérieure à 0");
    const inventaire = await recordMovement({}, formData({ productId: p.id, type: "ADJUSTMENT", quantity: "0" }));
    expect(inventaire.success).toBeDefined();
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).quantity).toBe(0);
  });
});

describe("createProduct", () => {
  const fields = { name: "Brosse", category: "HYGIENE", unit: "pièce", alertThreshold: "2", quantity: "6" };

  test("réservé à la gérance", async () => {
    await signIn("EMPLOYEE");
    expect((await createProduct({}, formData(fields))).error).toContain("gérance");
    expect(await prisma.product.count()).toBe(0);
  });

  test("crée le produit et trace le stock initial comme une entrée, avec son auteur", async () => {
    const admin = await signIn("ADMIN");
    const target = await redirectedTo(() => createProduct({}, formData(fields)));
    const product = await prisma.product.findFirstOrThrow();
    expect(target).toBe(`/stock/${product.id}`);
    expect(product.quantity).toBe(6);
    expect(await prisma.stockMovement.findFirstOrThrow()).toMatchObject({ type: "IN", quantity: 6, reason: "Stock initial", userId: admin.id });
  });

  test("sans stock initial, pas de mouvement", async () => {
    await signIn("ADMIN");
    await redirectedTo(() => createProduct({}, formData({ ...fields, quantity: "0" })));
    expect(await prisma.stockMovement.count()).toBe(0);
  });

  test("nom déjà pris : erreur sur le champ", async () => {
    await signIn("ADMIN");
    await makeProduct({ name: "Brosse" });
    expect((await createProduct({}, formData(fields))).fieldErrors?.name).toContain("déjà");
    expect(await prisma.product.count()).toBe(1);
  });

  test("catégorie ou seuil invalides", async () => {
    await signIn("ADMIN");
    const state = await createProduct({}, formData({ ...fields, category: "ARMES", alertThreshold: "-1" }));
    expect(Object.keys(state.fieldErrors ?? {}).sort()).toEqual(["alertThreshold", "category"]);
  });
});
