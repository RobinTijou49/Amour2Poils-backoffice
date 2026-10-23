// Données de démonstration : `bunx prisma db seed`
// Toutes les personnes et tous les chiens sont fictifs.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const day = (offset: number) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
};

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) throw new Error("SEED_ADMIN_EMAIL et SEED_ADMIN_PASSWORD doivent être définis dans .env");

  // On repart d'une base vide (ordre imposé par les clés étrangères).
  await prisma.$transaction([
    prisma.invoiceLine.deleteMany(),
    prisma.invoice.deleteMany(),
    prisma.enrollment.deleteMany(),
    prisma.trainingSession.deleteMany(),
    prisma.stockMovement.deleteMany(),
    prisma.product.deleteMany(),
    prisma.booking.deleteMany(),
    prisma.kennel.deleteMany(),
    prisma.vaccination.deleteMany(),
    prisma.dog.deleteMany(),
    prisma.owner.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  // Bun.password utilise argon2id par défaut.
  const admin = await prisma.user.create({
    data: { email, name: "Gérant·e", role: "ADMIN", passwordHash: await Bun.password.hash(password) },
  });

  const kennels = await Promise.all(
    [
      { name: "Box 1", size: "SMALL" as const },
      { name: "Box 2", size: "SMALL" as const },
      { name: "Box 3", size: "MEDIUM" as const },
      { name: "Box 4", size: "MEDIUM" as const },
      { name: "Box 5", size: "LARGE" as const, capacity: 2 },
      { name: "Box 6", size: "LARGE" as const, capacity: 2 },
    ].map((k) => prisma.kennel.create({ data: k })),
  );

  const camille = await prisma.owner.create({
    data: {
      firstName: "Camille", lastName: "Durand", email: "camille.durand@example.com", phone: "06 12 34 56 78",
      dogs: {
        create: {
          name: "Rex", breed: "Berger australien", sex: "MALE", birthDate: new Date("2021-04-12"), weightKg: 24.5,
          sterilized: true, vetName: "Clinique des Lices", vetPhone: "02 41 00 00 00",
          behaviorNotes: "Très joueur, à sortir en premier le matin.",
          vaccinations: { create: [{ name: "CHPPiL", administeredAt: day(-200), expiresAt: day(165) }, { name: "Toux du chenil", administeredAt: day(-340), expiresAt: day(25) }] },
        },
      },
    },
    include: { dogs: true },
  });

  const lucas = await prisma.owner.create({
    data: {
      firstName: "Lucas", lastName: "Martin", email: "lucas.martin@example.com", phone: "06 98 76 54 32",
      dogs: {
        create: {
          name: "Nala", breed: "Golden retriever", sex: "FEMALE", birthDate: new Date("2025-11-03"), weightKg: 14,
          diet: "Croquettes chiot, 3 repas par jour.",
          vaccinations: { create: [{ name: "CHPPiL", administeredAt: day(-60), expiresAt: day(305) }] },
        },
      },
    },
    include: { dogs: true },
  });

  const sophie = await prisma.owner.create({
    data: {
      firstName: "Sophie", lastName: "Robert", phone: "07 11 22 33 44",
      dogs: {
        create: {
          name: "Milo", breed: "Croisé", sex: "MALE", birthDate: new Date("2019-08-20"), weightKg: 11.2, sterilized: true,
          allergies: "Poulet", behaviorNotes: "Réactif aux autres chiens en laisse, promenades seules.",
          vaccinations: { create: [{ name: "CHPPiL", administeredAt: day(-380), expiresAt: day(-15) }] },
        },
      },
    },
    include: { dogs: true },
  });

  const [rex] = camille.dogs;
  const [nala] = lucas.dogs;
  const [milo] = sophie.dogs;

  const rexStay = await prisma.booking.create({
    data: { dogId: rex.id, kennelId: kennels[4].id, startDate: day(-2), endDate: day(3), status: "CHECKED_IN", nightlyRateCents: 2500, checkedInAt: day(-2) },
  });
  await prisma.booking.create({
    data: { dogId: milo.id, kennelId: kennels[2].id, startDate: day(0), endDate: day(5), status: "CONFIRMED", nightlyRateCents: 2200, notes: "Pas de croquettes au poulet." },
  });
  await prisma.booking.create({
    data: { dogId: nala.id, startDate: day(10), endDate: day(14), status: "PENDING", nightlyRateCents: 2200 },
  });

  const food = await prisma.product.create({ data: { name: "Croquettes adulte", category: "FOOD", unit: "sac 15 kg", quantity: 4, alertThreshold: 2 } });
  await prisma.product.create({ data: { name: "Croquettes chiot", category: "FOOD", unit: "sac 12 kg", quantity: 1, alertThreshold: 2 } });
  await prisma.product.create({ data: { name: "Friandises au bœuf", category: "TREAT", unit: "sachet", quantity: 18, alertThreshold: 5 } });
  await prisma.product.create({ data: { name: "Shampoing doux", category: "HYGIENE", unit: "flacon 500 ml", quantity: 3, alertThreshold: 1 } });
  await prisma.stockMovement.create({ data: { productId: food.id, type: "OUT", quantity: 1, reason: "Repas pension", userId: admin.id } });

  const puppy = await prisma.trainingSession.create({
    data: { type: "PUPPY_CLASS", title: "Puppy class du samedi", startsAt: new Date(day(4).getTime() + 10 * 3600_000), durationMin: 60, capacity: 6, priceCents: 1800, location: "Terrain de la pension" },
  });
  await prisma.enrollment.create({ data: { sessionId: puppy.id, dogId: nala.id } });

  const julien = await prisma.owner.create({
    data: {
      firstName: "Julien", lastName: "Petit", email: "julien.petit@example.com", phone: "06 55 44 33 22",
      dogs: { create: { name: "Oslo", breed: "Husky", sex: "MALE", birthDate: new Date("2022-01-15"), weightKg: 22, vaccinations: { create: [{ name: "CHPPiL", administeredAt: day(-90), expiresAt: day(275) }] } } },
    },
    include: { dogs: true },
  });
  const ines = await prisma.owner.create({
    data: {
      firstName: "Inès", lastName: "Bernard", phone: "06 77 88 99 00",
      dogs: { create: { name: "Pepper", breed: "Jack Russell", sex: "FEMALE", birthDate: new Date("2020-06-02"), weightKg: 6.5 } },
    },
    include: { dogs: true },
  });
  const [oslo] = julien.dogs;
  const [pepper] = ines.dogs;
  await prisma.booking.create({ data: { dogId: oslo.id, kennelId: kennels[5].id, startDate: day(0), endDate: day(2), status: "CONFIRMED", nightlyRateCents: 2500 } });
  await prisma.booking.create({ data: { dogId: pepper.id, kennelId: kennels[0].id, startDate: day(-6), endDate: day(-3), status: "COMPLETED", nightlyRateCents: 2000, checkedInAt: day(-6), checkedOutAt: day(-3) } });

  const at = (offset: number, hour: number, minute = 0) => new Date(day(offset).getTime() + (hour * 60 + minute) * 60_000);
  const priv = await prisma.trainingSession.create({ data: { type: "PRIVATE", title: "Rappel en extérieur", startsAt: at(0, 8), durationMin: 60, capacity: 1, priceCents: 4000, location: "Parc Balzac" } });
  await prisma.enrollment.create({ data: { sessionId: priv.id, dogId: milo.id } });
  const group = await prisma.trainingSession.create({ data: { type: "GROUP", title: "Marche en laisse", startsAt: at(4, 9, 30), durationMin: 60, capacity: 2, priceCents: 1500, location: "Terrain de la pension" } });
  await prisma.enrollment.createMany({ data: [{ sessionId: group.id, dogId: rex.id }, { sessionId: group.id, dogId: oslo.id }] });
  await prisma.trainingSession.create({ data: { type: "PETSITTING", title: "Visite chez Inès Bernard", startsAt: at(1, 12, 30), durationMin: 30, capacity: 1, priceCents: 1800, location: "Angers centre" } });

  const invoice = (number: string, ownerId: string, status: "DRAFT" | "SENT" | "PAID", issued: number, due: number | null, label: string, quantity: number, unitPriceCents: number, bookingId?: string) =>
    prisma.invoice.create({
      data: {
        number, status, ownerId, issuedAt: day(issued), dueAt: due === null ? null : day(due), paidAt: status === "PAID" ? day(issued + 3) : null,
        lines: { create: { label, quantity, unitPriceCents, bookingId } },
      },
    });
  await invoice("F-2026-0001", camille.id, "PAID", -80, -66, "Pension Rex (7 nuits)", 7, 2500);
  await invoice("F-2026-0002", julien.id, "SENT", -21, -7, "Cours particulier", 1, 4000);
  await invoice("F-2026-0003", lucas.id, "PAID", -5, 9, "Puppy class (3 séances)", 3, 1800);
  await invoice("F-2026-0004", ines.id, "SENT", -3, 4, "Pension Pepper (3 nuits)", 3, 2000);
  await invoice("F-2026-0005", camille.id, "DRAFT", 0, null, "Pension Rex (5 nuits)", 5, 2500, rexStay.id);

  console.log("Seed terminé : 1 admin, 6 boxes, 5 clients, 5 chiens, 5 réservations, 4 produits, 4 séances, 5 factures.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
