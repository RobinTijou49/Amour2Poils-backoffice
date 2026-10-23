// Crée (ou met à jour) le compte gérant·e d'une base de production : `bun prisma/create-admin.ts`.
// Contrairement au seed, ne touche à aucune autre donnée. Variables : ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const { ADMIN_EMAIL: email, ADMIN_NAME: name, ADMIN_PASSWORD: password } = process.env;
if (!email || !name || !password) throw new Error("ADMIN_EMAIL, ADMIN_NAME et ADMIN_PASSWORD doivent être définis.");
if (password.length < 12) throw new Error("Le mot de passe doit faire au moins 12 caractères.");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

// Bun.password utilise argon2id par défaut, comme le reste de l'application.
const passwordHash = await Bun.password.hash(password);
await prisma.user.upsert({
  where: { email },
  create: { email, name, role: "ADMIN", passwordHash },
  update: { name, role: "ADMIN", passwordHash },
});
console.log(`Compte gérant·e prêt : ${email}`);
await prisma.$disconnect();
