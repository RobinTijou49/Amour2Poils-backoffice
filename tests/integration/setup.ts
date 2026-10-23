import { mock } from "bun:test";
import { assertTestDatabase, TEST_DATABASE_URL } from "../test-db";
import { cookieStore, pushCalls } from "./fakes";

// Préchargé avant les tests d'intégration (bun run test:int). Les modules ci-dessous sont remplacés AVANT que le code
// de l'application ne les importe ; tout le reste est le vrai code, branché sur une vraie base Postgres de test.

// 1. Base : jamais autre chose qu'une base de test (le nom doit finir par _test), car les tests vident les tables.
assertTestDatabase(TEST_DATABASE_URL);
process.env.DATABASE_URL = TEST_DATABASE_URL; // lu par src/lib/prisma.ts à l'import

// 2. Next.js : hors d'une requête, ces API n'ont pas de contexte. On leur donne un équivalent minimal.
mock.module("next/headers", () => ({ cookies: async () => cookieStore }));
mock.module("next/cache", () => ({
  refresh: () => undefined,
  revalidatePath: () => undefined,
  revalidateTag: () => undefined,
}));

// 3. Notifications push : enregistrées dans `pushCalls` au lieu d'être envoyées.
mock.module("@/lib/push", () => ({
  notify: (payload: (typeof pushCalls)[number]) => void pushCalls.push(payload),
  sendToAll: async (payload: (typeof pushCalls)[number]) => {
    pushCalls.push(payload);
    return { sent: 1, removed: 0 };
  },
}));
