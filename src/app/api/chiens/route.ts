import { guard } from "@/lib/api";
import { prisma } from "@/lib/prisma";

/** GET /api/chiens?q=rex : recherche par nom de chien ou de propriétaire. */
export async function GET(request: Request) {
  const g = await guard(request);
  if ("response" in g) return g.response;
  const q = new URL(request.url).searchParams.get("q")?.trim().slice(0, 80);
  const contains = (field: string) => ({ [field]: { contains: q, mode: "insensitive" as const } });
  const dogs = await prisma.dog.findMany({
    where: q ? { OR: [contains("name"), { owner: { OR: [contains("lastName"), contains("firstName")] } }] } : undefined,
    orderBy: { name: "asc" },
    include: { owner: { select: { id: true, firstName: true, lastName: true } }, vaccinations: true },
  });
  return Response.json({ dogs });
}
