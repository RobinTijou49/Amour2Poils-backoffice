import type { Page } from "@playwright/test";

// Les écrans du back-office, pour les tests d'accessibilité (axe, clavier, taille des cibles, reflow).

/** Adresses des pages à identifiant, lues dans l'API avec la session de la personne connectée. */
export async function pageIds(page: Page) {
  const get = async <T>(path: string) => (await (await page.request.get(path)).json()) as T;
  const { dogs } = await get<{ dogs: { id: string }[] }>("/api/chiens");
  const { bookings } = await get<{ bookings: { id: string }[] }>("/api/reservations");
  const { products } = await get<{ products: { id: string }[] }>("/api/stock");
  return { dog: dogs[0]!.id, booking: bookings[0]!.id, product: products[0]!.id };
}

export type Ids = Awaited<ReturnType<typeof pageIds>>;
export type Screen = { name: string; open: (page: Page, ids: Ids) => Promise<void> };

const go = (path: string) => async (page: Page) => void (await page.goto(path));
const goWith = (path: (i: Ids) => string) => async (page: Page, ids: Ids) => void (await page.goto(path(ids)));

/** Premier lien vers une fiche dans la page de liste (les identifiants Prisma commencent par « c », « nouvelle » non). */
const openFirst = (listPath: string, hrefPrefix: string) => async (page: Page) => {
  await page.goto(listPath);
  await page.locator(`main a[href^="${hrefPrefix}c"]`).first().click();
};

export const SCREENS: Screen[] = [
  { name: "tableau de bord", open: go("/") },
  { name: "réservations (planning)", open: go("/reservations") },
  { name: "nouvelle réservation", open: go("/reservations/nouvelle") },
  { name: "fiche d'une réservation", open: goWith((i) => `/reservations/${i.booking}`) },
  { name: "clients et chiens", open: go("/chiens") },
  { name: "nouvelle fiche chien", open: go("/chiens/nouveau") },
  { name: "fiche d'un chien", open: goWith((i) => `/chiens/${i.dog}`) },
  { name: "modifier un chien", open: goWith((i) => `/chiens/${i.dog}/modifier`) },
  { name: "séances", open: go("/seances") },
  { name: "nouvelle séance", open: go("/seances/nouvelle") },
  { name: "fiche d'une séance", open: openFirst("/seances", "/seances/") },
  { name: "stock", open: go("/stock") },
  { name: "fiche d'un produit", open: goWith((i) => `/stock/${i.product}`) },
  { name: "nouveau produit", open: go("/stock/nouveau") },
  { name: "facturation", open: go("/facturation") },
  { name: "fiche d'une facture", open: openFirst("/facturation", "/facturation/") },
  { name: "page hors connexion", open: go("/offline") },
];
