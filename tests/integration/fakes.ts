// Doublures partagées entre le préchargement (setup.ts, qui installe les mocks) et les tests (qui les inspectent).

/** « Cookies du navigateur » : remplace `cookies()` de next/headers, hors de toute requête Next. */
export const cookieJar = new Map<string, string>();
export const cookieStore = {
  get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined),
  set: (name: string, value: string) => void cookieJar.set(name, value),
  delete: (name: string) => void cookieJar.delete(name),
};

/** Notifications push « envoyées » : on enregistre l'appel au lieu de joindre Google. */
export type PushCall = { title: string; body: string; url: string; tag?: string };
export const pushCalls: PushCall[] = [];
