import "server-only";
import { getCurrentUser, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { utcDay } from "@/lib/format";

// Lectures pour les écrans du back-office.
// Chaque fonction vérifie d'abord la session (Data Access Layer) : aucune donnée sans utilisateur connecté.
// La lecture du cookie rend aussi la requête dynamique (exclue du prérendu avec cacheComponents).

const ACTIVE = ["CONFIRMED", "CHECKED_IN"] as const;

export async function getDashboard() {
  await getCurrentUser();
  const today = utcDay(new Date());
  const tomorrow = utcDay(today, 1);
  const in30 = utcDay(today, 30);
  const in7 = utcDay(today, 7);

  const [kennels, present, arrivals, departures, vaccinations, products, invoices, sessions] = await Promise.all([
    prisma.kennel.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      include: {
        bookings: {
          where: { status: { in: [...ACTIVE] }, startDate: { lte: today }, endDate: { gt: today } },
          include: { dog: { select: { name: true } } },
        },
      },
    }),
    // « Présent » = arrivée enregistrée ; les arrivées prévues du jour ne comptent pas encore.
    prisma.booking.count({ where: { status: "CHECKED_IN" } }),
    prisma.booking.findMany({
      where: { status: { in: [...ACTIVE] }, startDate: today },
      include: { dog: true, kennel: true },
    }),
    prisma.booking.findMany({
      where: { status: { in: [...ACTIVE] }, endDate: today },
      include: { dog: true, kennel: true },
    }),
    prisma.vaccination.findMany({ where: { expiresAt: { lt: in30 } }, include: { dog: true }, orderBy: { expiresAt: "asc" } }),
    prisma.product.findMany({ orderBy: { name: "asc" } }),
    prisma.invoice.findMany({ where: { status: "SENT", dueAt: { lt: in7 } }, include: { owner: true, lines: true }, orderBy: { dueAt: "asc" } }),
    prisma.trainingSession.findMany({ where: { startsAt: { gte: today, lt: tomorrow } }, include: { enrollments: { include: { dog: true } } }, orderBy: { startsAt: "asc" } }),
  ]);

  const capacity = kennels.reduce((sum, k) => sum + k.capacity, 0);
  const lowStock = products.filter((p) => p.quantity <= p.alertThreshold);
  return { today, kennels, present, capacity, arrivals, departures, vaccinations, lowStock, invoices, sessions };
}

export async function getWeekPlanning(weekStart: Date) {
  await getCurrentUser();
  const weekEnd = utcDay(weekStart, 7);
  const [kennels, pending] = await Promise.all([
    prisma.kennel.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      include: {
        bookings: {
          where: { status: { not: "CANCELLED" }, startDate: { lt: weekEnd }, endDate: { gt: weekStart } },
          include: { dog: { select: { name: true, id: true } } },
          orderBy: { startDate: "asc" },
        },
      },
    }),
    prisma.booking.findMany({
      where: { status: "PENDING", kennelId: null },
      include: { dog: { select: { id: true, name: true, breed: true } } },
      orderBy: { startDate: "asc" },
    }),
  ]);
  return { kennels, pending, today: utcDay(new Date()) };
}

/** Liste des chiens, filtrée par nom du chien ou du propriétaire si `q` est fourni. */
export async function getDogs(q?: string) {
  await getCurrentUser();
  const term = q?.trim();
  const contains = (field: string) => ({ [field]: { contains: term, mode: "insensitive" as const } });
  return prisma.dog.findMany({
    where: term ? { OR: [contains("name"), { owner: { OR: [contains("lastName"), contains("firstName")] } }] } : undefined,
    orderBy: { name: "asc" },
    include: {
      owner: true,
      bookings: { where: { status: "CHECKED_IN" }, include: { kennel: true } },
      vaccinations: true,
    },
  });
}

export async function getDog(id: string) {
  await getCurrentUser();
  return prisma.dog.findUnique({
    where: { id },
    include: {
      owner: true,
      vaccinations: { orderBy: { expiresAt: "asc" } },
      bookings: { include: { kennel: true }, orderBy: { startDate: "desc" } },
    },
  });
}

export async function getProducts() {
  await getCurrentUser();
  const weekAgo = utcDay(new Date(), -7);
  const [products, outThisWeek] = await Promise.all([
    prisma.product.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] }),
    prisma.stockMovement.aggregate({ where: { type: "OUT", createdAt: { gte: weekAgo } }, _sum: { quantity: true } }),
  ]);
  return { products, outThisWeek: outThisWeek._sum.quantity ?? 0 };
}

export async function getInvoices() {
  await requireRole("ADMIN");
  const invoices = await prisma.invoice.findMany({ include: { owner: true, lines: true }, orderBy: { number: "desc" } });
  return {
    today: utcDay(new Date()),
    invoices: invoices.map((inv) => ({ ...inv, totalCents: inv.lines.reduce((s, l) => s + l.quantity * l.unitPriceCents, 0) })),
  };
}

export async function getSessions(weekStart: Date) {
  await getCurrentUser();
  return prisma.trainingSession.findMany({
    where: { startsAt: { gte: weekStart, lt: utcDay(weekStart, 7) } },
    include: { enrollments: { include: { dog: true } } },
    orderBy: { startsAt: "asc" },
  });
}

export async function getBookingFormOptions() {
  await getCurrentUser();
  const [dogs, kennels] = await Promise.all([
    prisma.dog.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, breed: true, owner: { select: { lastName: true } } } }),
    prisma.kennel.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  return { dogs, kennels };
}

export async function getBooking(id: string) {
  const user = await getCurrentUser();
  const [booking, kennels] = await Promise.all([
    prisma.booking.findUnique({ where: { id }, include: { dog: { include: { owner: true } }, kennel: true } }),
    prisma.kennel.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  return { booking, kennels, user };
}

export async function getOwners() {
  await getCurrentUser();
  return prisma.owner.findMany({ orderBy: [{ lastName: "asc" }, { firstName: "asc" }], select: { id: true, firstName: true, lastName: true, phone: true } });
}

export async function getProduct(id: string) {
  const user = await getCurrentUser();
  const product = await prisma.product.findUnique({
    where: { id },
    include: { movements: { orderBy: { createdAt: "desc" }, take: 20, include: { user: { select: { name: true } } } } },
  });
  return { product, user };
}
