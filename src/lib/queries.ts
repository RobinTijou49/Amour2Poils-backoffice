import "server-only";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { utcDay } from "@/lib/format";

// Lectures pour les écrans du back-office.
// `connection()` : ces données changent à chaque requête, on les exclut du prérendu (cacheComponents).

const ACTIVE = ["CONFIRMED", "CHECKED_IN"] as const;

export async function getDashboard() {
  await connection();
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
  await connection();
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

export async function getDogs() {
  await connection();
  return prisma.dog.findMany({
    orderBy: { name: "asc" },
    include: {
      owner: true,
      bookings: { where: { status: "CHECKED_IN" }, include: { kennel: true } },
      vaccinations: true,
    },
  });
}

export async function getDog(id: string) {
  await connection();
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
  await connection();
  const weekAgo = utcDay(new Date(), -7);
  const [products, outThisWeek] = await Promise.all([
    prisma.product.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] }),
    prisma.stockMovement.aggregate({ where: { type: "OUT", createdAt: { gte: weekAgo } }, _sum: { quantity: true } }),
  ]);
  return { products, outThisWeek: outThisWeek._sum.quantity ?? 0 };
}

export async function getInvoices() {
  await connection();
  const invoices = await prisma.invoice.findMany({ include: { owner: true, lines: true }, orderBy: { number: "desc" } });
  return {
    today: utcDay(new Date()),
    invoices: invoices.map((inv) => ({ ...inv, totalCents: inv.lines.reduce((s, l) => s + l.quantity * l.unitPriceCents, 0) })),
  };
}

export async function getSessions(weekStart: Date) {
  await connection();
  return prisma.trainingSession.findMany({
    where: { startsAt: { gte: weekStart, lt: utcDay(weekStart, 7) } },
    include: { enrollments: { include: { dog: true } } },
    orderBy: { startsAt: "asc" },
  });
}
