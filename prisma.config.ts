import { defineConfig, env } from "prisma/config";

// Bun charge automatiquement .env, pas besoin de dotenv.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "bun prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
