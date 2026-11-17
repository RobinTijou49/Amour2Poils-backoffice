// Données de démonstration SUPPLÉMENTAIRES pour les répétitions et l'oral : `bun prisma/seed-extra.ts [arrivées]`.
// Contrairement à `seed.ts`, ce script N'EFFACE RIEN : il ajoute ce qui manque, donc il est utilisable en production.
// Tout est fictif (personnes, chiens, adresses) et repérable : e-mails `demo.*@example.com`, puces `2500000DEMO…`,
// produits et boxes « Démo … », notes et libellés commençant par « [démo] ».
//
// Rejouable : à chaque lancement il
//   1. complète le jeu de base (clients, chiens, vaccins, séjours, stock, factures, séances) seulement s'il manque ;
//   2. ajoute de NOUVELLES ARRIVÉES DU JOUR (par défaut 6) : une arrivée enregistrée ne se refait pas, il en faut de fraîches ;
//   3. RÉARME le stock de démonstration : chaque produit « armé » repasse juste AU-DESSUS de son seuil, pour rejouer
//      la notification « Stock bas » (elle ne part qu'au franchissement du seuil).
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Dog, type Owner, type ProductCategory } from "../src/generated/prisma/client";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const TAG = "[démo]";
const arrivalsWanted = Math.max(0, Math.min(30, Number.parseInt(process.argv[2] ?? "6", 10) || 0));

const day = (offset: number) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
};
const at = (offset: number, hour: number, minute = 0) => new Date(day(offset).getTime() + (hour * 60 + minute) * 60_000);

// ───────────── Clients et chiens ─────────────

const OWNERS = [
  ["Élodie", "Fabre", "demo.fabre", "06 10 20 30 01"],
  ["Mehdi", "Benali", "demo.benali", "06 10 20 30 02"],
  ["Chloé", "Lambert", "demo.lambert", "06 10 20 30 03"],
  ["Antoine", "Moreau", "demo.moreau", "06 10 20 30 04"],
  ["Sarah", "Girard", "demo.girard", "06 10 20 30 05"],
  ["Pierre", "Rousseau", "demo.rousseau", "06 10 20 30 06"],
  ["Léa", "Fontaine", "demo.fontaine", "06 10 20 30 07"],
  ["Hugo", "Chevalier", "demo.chevalier", "06 10 20 30 08"],
  ["Manon", "Perrin", "demo.perrin", "06 10 20 30 09"],
  ["Thomas", "Garnier", "demo.garnier", "06 10 20 30 10"],
  ["Camille", "Roux", "demo.roux", "06 10 20 30 11"],
  ["Nina", "Lefort", "demo.lefort", "06 10 20 30 12"],
] as const;

type DogSpec = { name: string; breed: string; sex: "MALE" | "FEMALE"; birth: string; kg: number; allergies?: string; diet?: string; behavior?: string; vet?: [string, string] };
// Un chien par client, plus quelques seconds chiens. L'ordre sert aux scénarios de séjour plus bas.
const DOGS: DogSpec[] = [
  { name: "Maya", breed: "Labrador", sex: "FEMALE", birth: "2020-03-14", kg: 28, diet: "Croquettes adulte, 2 repas.", vet: ["Clinique du Lac", "02 41 11 22 01"] },
  { name: "Ulysse", breed: "Border collie", sex: "MALE", birth: "2021-09-02", kg: 19, behavior: "Très énergique, besoin de longues sorties.", vet: ["Clinique du Lac", "02 41 11 22 01"] },
  { name: "Chipie", breed: "Cavalier King Charles", sex: "FEMALE", birth: "2019-05-21", kg: 8.4, allergies: "Bœuf", vet: ["Dr Aubry", "02 41 11 22 02"] },
  { name: "Balto", breed: "Husky", sex: "MALE", birth: "2022-12-10", kg: 24, behavior: "Fugueur : toujours tenu en laisse.", vet: ["Dr Aubry", "02 41 11 22 02"] },
  { name: "Noisette", breed: "Teckel", sex: "FEMALE", birth: "2018-07-30", kg: 7.1, diet: "Ration réduite (surpoids).", vet: ["Clinique des Lices", "02 41 11 22 03"] },
  { name: "Gaspard", breed: "Bouledogue français", sex: "MALE", birth: "2023-02-18", kg: 12, allergies: "Poulet", behavior: "Craint la chaleur : box à l'ombre.", vet: ["Clinique des Lices", "02 41 11 22 03"] },
  { name: "Lola", breed: "Beagle", sex: "FEMALE", birth: "2021-01-25", kg: 11.5, behavior: "Gourmande, surveiller les gamelles.", vet: ["Clinique du Lac", "02 41 11 22 01"] },
  { name: "Tyson", breed: "Boxer", sex: "MALE", birth: "2020-10-08", kg: 31, vet: ["Dr Aubry", "02 41 11 22 02"] },
  { name: "Plume", breed: "Épagneul breton", sex: "FEMALE", birth: "2022-04-17", kg: 15, diet: "Sans céréales.", vet: ["Clinique des Lices", "02 41 11 22 03"] },
  { name: "Rocky", breed: "Berger allemand", sex: "MALE", birth: "2019-11-11", kg: 34, behavior: "Protecteur avec les inconnus : présentation progressive.", vet: ["Clinique du Lac", "02 41 11 22 01"] },
  { name: "Daisy", breed: "Cocker", sex: "FEMALE", birth: "2021-06-06", kg: 13, allergies: "Poisson", vet: ["Dr Aubry", "02 41 11 22 02"] },
  { name: "Zeus", breed: "Dogue allemand", sex: "MALE", birth: "2022-08-19", kg: 58, diet: "Double ration, 3 repas.", vet: ["Clinique des Lices", "02 41 11 22 03"] },
  { name: "Pixel", breed: "Chihuahua", sex: "MALE", birth: "2020-02-02", kg: 2.6, behavior: "Peureux, aime être porté.", vet: ["Clinique du Lac", "02 41 11 22 01"] },
  { name: "Savane", breed: "Rhodesian ridgeback", sex: "FEMALE", birth: "2021-12-12", kg: 30, vet: ["Dr Aubry", "02 41 11 22 02"] },
];
const EXTRA_NAMES = ["Biscotte", "Ficelle", "Réglisse", "Moka", "Tango", "Câline", "Vanille", "Olympe", "Pistache", "Praline", "Caramel", "Sultan"];

const dogChip = (n: number) => `2500000DEMO${String(n).padStart(4, "0")}`;

// ───────────── Boxes ─────────────

async function freeKennel(start: Date, end: Date) {
  const kennels = await prisma.kennel.findMany({ where: { name: { startsWith: "Box Démo" }, active: true }, orderBy: { name: "asc" } });
  for (const k of kennels) {
    // Capacité nuit par nuit simplifiée : on ne place un séjour que dans un box sans AUCUN séjour qui chevauche (capacité 1 de fait).
    const overlapping = await prisma.booking.count({
      where: { kennelId: k.id, status: { in: ["CONFIRMED", "CHECKED_IN"] }, startDate: { lt: end }, endDate: { gt: start } },
    });
    if (overlapping < k.capacity) return k;
  }
  const n = kennels.length + 1;
  return prisma.kennel.create({ data: { name: `Box Démo ${n}`, size: n % 3 === 0 ? "LARGE" : n % 2 === 0 ? "MEDIUM" : "SMALL", capacity: 1 } });
}

async function main() {
  // ── 1. Clients, chiens, vaccins (par e-mail et numéro de puce : pas de doublon au deuxième lancement)
  const owners: Owner[] = [];
  for (const [i, [firstName, lastName, slug, phone]] of OWNERS.entries()) {
    owners.push(
      await prisma.owner.upsert({
        where: { email: `${slug}@example.com` },
        create: { firstName, lastName, email: `${slug}@example.com`, phone, address: `${10 + i} rue des Tilleuls, 49000 Angers`, notes: `${TAG} client de démonstration` },
        update: {},
      }),
    );
  }
  const dogs: Dog[] = [];
  for (const [i, d] of DOGS.entries()) {
    const owner = owners[i % owners.length]!;
    // Vaccins variés : à jour, à renouveler bientôt (alerte du tableau de bord), échus.
    const expiry = [200, 25, 12, 300, -20, 90, 8, 150, 365, -5, 40, 220, 18, 120][i]!;
    dogs.push(
      await prisma.dog.upsert({
        where: { chipNumber: dogChip(i + 1) },
        create: {
          name: d.name, breed: d.breed, sex: d.sex, birthDate: new Date(d.birth), weightKg: d.kg, sterilized: i % 2 === 0, chipNumber: dogChip(i + 1),
          allergies: d.allergies, diet: d.diet, behaviorNotes: d.behavior, vetName: d.vet?.[0], vetPhone: d.vet?.[1], ownerId: owner.id,
          vaccinations: { create: [{ name: "CHPPiL", administeredAt: day(expiry - 365), expiresAt: day(expiry) }, { name: "Rage", administeredAt: day(-100), expiresAt: day(265) }] },
        },
        update: {},
      }),
    );
  }

  // ── 2. Séjours de base (une seule fois par chien : repérés par leur note)
  const stay = async (dogIdx: number, from: number, to: number, status: "PENDING" | "CONFIRMED" | "CHECKED_IN" | "COMPLETED" | "CANCELLED", rate: number, label: string) => {
    const dog = dogs[dogIdx]!;
    if (await prisma.booking.findFirst({ where: { dogId: dog.id, notes: `${TAG} ${label}` } })) return;
    const holdsKennel = status === "CONFIRMED" || status === "CHECKED_IN" || status === "COMPLETED";
    const kennel = holdsKennel ? await freeKennel(day(from), day(to)) : null;
    await prisma.booking.create({
      data: {
        dogId: dog.id, kennelId: kennel?.id, startDate: day(from), endDate: day(to), status, nightlyRateCents: rate, notes: `${TAG} ${label}`,
        checkedInAt: status === "CHECKED_IN" || status === "COMPLETED" ? at(from, 9, 30) : null,
        checkedOutAt: status === "COMPLETED" ? at(to, 17, 15) : null,
      },
    });
  };
  await stay(0, -3, 0, "CHECKED_IN", 2500, "départ du jour");
  await stay(1, -2, 0, "CHECKED_IN", 2500, "départ du jour");
  await stay(2, -4, 0, "CHECKED_IN", 2200, "départ du jour");
  await stay(3, -1, 2, "CHECKED_IN", 2500, "sur place");
  await stay(4, -1, 3, "CHECKED_IN", 2200, "sur place");
  await stay(5, -10, -7, "COMPLETED", 2200, "terminé");
  await stay(6, -20, -16, "COMPLETED", 2000, "terminé");
  await stay(7, -35, -30, "COMPLETED", 2500, "terminé");
  await stay(8, 3, 7, "CONFIRMED", 2200, "à venir");
  await stay(9, 5, 9, "CONFIRMED", 2500, "à venir");
  await stay(10, 8, 12, "PENDING", 2200, "en attente");
  await stay(11, 2, 4, "CANCELLED", 2500, "annulé");

  // ── 3. Stock : produits « Démo » (noms uniques → pas de doublon), armés juste au-dessus du seuil
  type DemoProduct = { name: string; category: ProductCategory; unit: string; threshold: number; armed: boolean; initial?: number };
  const products: DemoProduct[] = [
    { name: "Démo · Croquettes adulte 15 kg", category: "FOOD", unit: "sac 15 kg", threshold: 10, armed: true },
    { name: "Démo · Croquettes chiot 12 kg", category: "FOOD", unit: "sac 12 kg", threshold: 6, armed: true },
    { name: "Démo · Friandises au poulet", category: "TREAT", unit: "sachet", threshold: 20, armed: true },
    { name: "Démo · Shampoing antiparasitaire", category: "HYGIENE", unit: "flacon 500 ml", threshold: 4, armed: true },
    { name: "Démo · Vermifuge", category: "MEDICAL", unit: "boîte", threshold: 5, armed: true },
    { name: "Démo · Litière de box", category: "OTHER", unit: "balle", threshold: 8, armed: false, initial: 30 },
    { name: "Démo · Gants jetables", category: "HYGIENE", unit: "boîte de 100", threshold: 3, armed: false, initial: 1 }, // déjà sous le seuil : alerte du tableau de bord
    { name: "Démo · Désinfectant", category: "HYGIENE", unit: "bidon 5 L", threshold: 2, armed: false, initial: 9 },
  ];
  const stockUser = await prisma.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" } });
  let rearmed = 0;
  for (const p of products) {
    const found = await prisma.product.findUnique({ where: { name: p.name } });
    // « Armé » : quantité = seuil + 2. Une sortie de 2 la fait pile atteindre le seuil, donc franchir « au-dessus → au seuil ».
    const target = p.armed ? p.threshold + 2 : (p.initial ?? p.threshold + 5);
    if (!found) {
      const created = await prisma.product.create({ data: { name: p.name, category: p.category, unit: p.unit, quantity: target, alertThreshold: p.threshold } });
      await prisma.stockMovement.create({ data: { productId: created.id, type: "IN", quantity: target, reason: `${TAG} stock initial`, userId: stockUser?.id } });
    } else if (p.armed && found.quantity !== target) {
      await prisma.product.update({ where: { id: found.id }, data: { quantity: target, alertThreshold: p.threshold } });
      await prisma.stockMovement.create({ data: { productId: found.id, type: "ADJUSTMENT", quantity: target, reason: `${TAG} produit réarmé pour la démonstration`, userId: stockUser?.id } });
      rearmed++;
    }
  }

  // ── 4. Factures : au moins 8 « envoyées » de démonstration (pour la démo de paiement), 3 payées, 2 brouillons
  const year = new Date().getUTCFullYear();
  const existingNumbers = (await prisma.invoice.findMany({ where: { number: { startsWith: `F-${year}-` } }, select: { number: true } })).map((i) => i.number);
  let nextNumber = existingNumbers.map((n) => Number.parseInt(n.slice(`F-${year}-`.length), 10)).filter(Number.isFinite).reduce((a, b) => Math.max(a, b), 0) + 1;
  const demoInvoice = { lines: { some: { label: { startsWith: TAG } } } };
  const invoice = async (status: "DRAFT" | "SENT" | "PAID", ownerIdx: number, issued: number, due: number | null, label: string, qty: number, unit: number) => {
    const number = status === "DRAFT" ? `BROUILLON-demo${Date.now().toString(36)}${ownerIdx}` : `F-${year}-${String(nextNumber++).padStart(4, "0")}`;
    await prisma.invoice.create({
      data: {
        number, status, ownerId: owners[ownerIdx % owners.length]!.id, issuedAt: day(issued), dueAt: due === null ? null : day(due), paidAt: status === "PAID" ? day(issued + 4) : null,
        lines: { create: [{ label: `${TAG} ${label}`, quantity: qty, unitPriceCents: unit }, ...(qty > 2 ? [{ label: `${TAG} Option promenade`, quantity: 1, unitPriceCents: 800 }] : [])] },
      },
    });
  };
  const sentNow = await prisma.invoice.count({ where: { status: "SENT", ...demoInvoice } });
  const sentSpecs: [number, number, number, string, number, number][] = [
    [0, -12, 3, "Pension Maya (5 nuits)", 5, 2500],
    [1, -9, -2, "Pension Ulysse (3 nuits)", 3, 2500], // échue : apparaît dans les alertes du tableau de bord
    [2, -6, 8, "Pension Chipie (4 nuits)", 4, 2200],
    [3, -4, 10, "Cours particulier", 1, 4000],
    [4, -3, 11, "Pension Noisette (2 nuits)", 2, 2200],
    [5, -2, 12, "Puppy class (3 séances)", 3, 1800],
    [6, -2, -1, "Pension Lola (6 nuits)", 6, 2000], // échue
    [7, -1, 13, "Pension Tyson (7 nuits)", 7, 2500],
  ];
  for (const s of sentSpecs.slice(sentNow)) await invoice("SENT", s[0], s[1], s[2], s[3], s[4], s[5]);
  if ((await prisma.invoice.count({ where: { status: "PAID", ...demoInvoice } })) === 0) {
    await invoice("PAID", 8, -40, -26, "Pension Plume (8 nuits)", 8, 2200);
    await invoice("PAID", 9, -30, -16, "Pension Rocky (4 nuits)", 4, 2500);
    await invoice("PAID", 10, -22, -8, "Cours collectif (4 séances)", 4, 1500);
  }
  if ((await prisma.invoice.count({ where: { status: "DRAFT", ...demoInvoice } })) === 0) {
    await invoice("DRAFT", 11, 0, null, "Pension Zeus (5 nuits)", 5, 3000);
    await invoice("DRAFT", 0, 0, null, "Visite chez Élodie Fabre", 1, 1800);
  }

  // ── 5. Séances d'éducation et petsitting (une fois)
  if ((await prisma.trainingSession.count({ where: { title: { startsWith: "Démo" } } })) === 0) {
    const sessions = [
      { type: "PUPPY_CLASS" as const, title: "Démo · Puppy class du mercredi", startsAt: at(2, 10), durationMin: 60, capacity: 6, priceCents: 1800, location: "Terrain de la pension", dogs: [8, 12] },
      { type: "GROUP" as const, title: "Démo · Marche en laisse", startsAt: at(3, 9, 30), durationMin: 60, capacity: 4, priceCents: 1500, location: "Parc Balzac", dogs: [0, 1, 3] },
      { type: "PRIVATE" as const, title: "Démo · Rappel en extérieur", startsAt: at(1, 14), durationMin: 60, capacity: 1, priceCents: 4000, location: "Parc Balzac", dogs: [7] },
      { type: "GROUP" as const, title: "Démo · Sociabilisation", startsAt: at(6, 17), durationMin: 90, capacity: 5, priceCents: 1700, location: "Terrain de la pension", dogs: [] },
      { type: "PETSITTING" as const, title: "Démo · Visite chez Léa Fontaine", startsAt: at(1, 12, 30), durationMin: 30, capacity: 1, priceCents: 1800, location: "Angers centre", dogs: [6] },
    ];
    for (const { dogs: idx, ...data } of sessions) {
      const s = await prisma.trainingSession.create({ data });
      if (idx.length) await prisma.enrollment.createMany({ data: idx.map((i) => ({ sessionId: s.id, dogId: dogs[i]!.id })) });
    }
  }

  // ── 6. Nouvelles arrivées du jour (à chaque lancement) : séjours CONFIRMÉS qui commencent aujourd'hui
  const demoDogs = await prisma.dog.findMany({ where: { chipNumber: { startsWith: "2500000DEMO" } }, orderBy: { chipNumber: "asc" } });
  const busy = new Set(
    (await prisma.booking.findMany({ where: { dogId: { in: demoDogs.map((d) => d.id) }, status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] }, startDate: { lt: day(5) }, endDate: { gt: day(0) } }, select: { dogId: true } })).map((b) => b.dogId),
  );
  const available = demoDogs.filter((d) => !busy.has(d.id));
  let created = 0;
  for (let i = 0; i < arrivalsWanted; i++) {
    let dog = available.shift();
    if (!dog) {
      // Plus de chien libre : on en crée un nouveau (numéro de puce suivant), chez un client de démonstration.
      const n = demoDogs.length + created + 1;
      dog = await prisma.dog.create({
        data: { name: `${EXTRA_NAMES[(n - 1) % EXTRA_NAMES.length]}`, breed: "Croisé", sex: n % 2 ? "MALE" : "FEMALE", chipNumber: dogChip(n), weightKg: 10 + (n % 12), ownerId: owners[n % owners.length]!.id, vaccinations: { create: [{ name: "CHPPiL", administeredAt: day(-120), expiresAt: day(245) }] } },
      });
    }
    const nights = 3 + (i % 3);
    const kennel = await freeKennel(day(0), day(nights));
    await prisma.booking.create({
      data: { dogId: dog.id, kennelId: kennel.id, startDate: day(0), endDate: day(nights), status: "CONFIRMED", nightlyRateCents: 2200 + (i % 3) * 150, notes: `${TAG} arrivée du jour` },
    });
    created++;
  }

  const [nOwners, nDogs, nBookings, nProducts, nInvoices, nSessions, nToday] = await Promise.all([
    prisma.owner.count({ where: { email: { startsWith: "demo." } } }),
    prisma.dog.count({ where: { chipNumber: { startsWith: "2500000DEMO" } } }),
    prisma.booking.count({ where: { notes: { startsWith: TAG } } }),
    prisma.product.count({ where: { name: { startsWith: "Démo" } } }),
    prisma.invoice.count({ where: demoInvoice }),
    prisma.trainingSession.count({ where: { title: { startsWith: "Démo" } } }),
    prisma.booking.count({ where: { status: "CONFIRMED", startDate: day(0), endDate: { gt: day(0) } } }),
  ]);
  console.log(
    `Données de démonstration prêtes (rien n'a été supprimé) : ${nOwners} clients, ${nDogs} chiens, ${nBookings} séjours de démo, ${nProducts} produits (${rearmed} réarmé(s)), ${nInvoices} factures, ${nSessions} séances.\n` +
      `Arrivées ajoutées à cette exécution : ${created}. Arrivées confirmées pour aujourd'hui (toutes origines) : ${nToday}.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
