import { prisma } from "@/lib/prisma";

// Sonde de santé : utilisée par le healthcheck Docker et le monitoring (phase 5).
// La requête SQL empêche le prérendu : la route s'exécute à chaque appel.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", database: "up" });
  } catch {
    return Response.json({ status: "error", database: "down" }, { status: 503 });
  }
}
