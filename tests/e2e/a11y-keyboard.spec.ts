import { expect, test, type Page } from "@playwright/test";
import { ADMIN } from "./accounts";
import { login } from "./helpers";
import { reseed } from "./reseed";
import { pageIds, SCREENS } from "./screens";

// Ce qu'axe ne mesure pas (ou mal) : clavier, indicateur de focus, focus non masqué, taille des cibles, reflow, annonces.
test.beforeAll(() => reseed());

type Stop = { backToStart: boolean; uaOwnedFocus: boolean; name: string; tag: string; outlineStyle: string; outlineWidth: number; boxShadow: string; borderWidth: number; obscured: boolean };

/** Parcourt la page à la tabulation et note, à chaque arrêt, ce qu'un utilisateur du clavier voit. */
async function tabThrough(page: Page, max = 80) {
  const stops: Stop[] = [];
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    const stop = await page.evaluate<Stop | null>(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      // Repère du premier élément atteint : on reconnaît ainsi le tour complet par l'ÉLÉMENT, pas par son nom (deux liens
      // d'une même page peuvent porter le même nom).
      const backToStart = el.hasAttribute("data-tab-start");
      if (!document.querySelector("[data-tab-start]")) el.setAttribute("data-tab-start", "1");
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const cx = Math.min(Math.max(r.left + r.width / 2, 0), innerWidth - 1);
      const cy = Math.min(Math.max(r.top + r.height / 2, 0), innerHeight - 1);
      const top = document.elementFromPoint(cx, cy);
      // Focus à l'INTÉRIEUR d'un champ de date (le bouton calendrier, dans le shadow DOM du navigateur) : l'élément actif reste
      // l'<input>, mais ce n'est plus lui qui est « focus-visible ». Le cadre est alors dessiné par le navigateur.
      const uaOwnedFocus = el instanceof HTMLInputElement && ["date", "time", "datetime-local", "month", "week"].includes(el.type) && !el.matches(":focus-visible");
      return {
        backToStart,
        uaOwnedFocus,
        name: (el.getAttribute("aria-label") || el.textContent || el.getAttribute("name") || el.tagName).replace(/\s+/g, " ").trim().slice(0, 40),
        tag: el.tagName,
        outlineStyle: cs.outlineStyle,
        outlineWidth: parseFloat(cs.outlineWidth),
        boxShadow: cs.boxShadow,
        borderWidth: parseFloat(cs.borderTopWidth),
        obscured: !(top && (el === top || el.contains(top) || top.contains(el))),
      };
    });
    if (!stop) break;
    if (stop.backToStart) break; // on a fait le tour
    stops.push(stop);
  }
  return stops;
}

const hasFocusIndicator = (s: Stop) =>
  s.uaOwnedFocus || (s.outlineStyle !== "none" && (s.outlineStyle === "auto" || s.outlineWidth >= 2)) || s.boxShadow !== "none" || (["INPUT", "SELECT", "TEXTAREA"].includes(s.tag) && s.borderWidth >= 2);

test.describe("clavier", () => {
  test("lien d'évitement : première tabulation, visible, et il amène bien au contenu", async ({ page }) => {
    await login(page, ADMIN);
    await page.keyboard.press("Tab");
    const lien = page.getByRole("link", { name: "Aller au contenu" });
    await expect(lien).toBeFocused();
    await expect(lien).toBeInViewport({ ratio: 1 }); // caché par défaut, il apparaît entièrement au focus
    await page.keyboard.press("Enter");
    await expect(page.locator("#contenu")).toBeFocused();
    await expect(page).toHaveURL(/#contenu$/);
  });

  test("connexion : l'ordre de tabulation suit la lecture (adresse, mot de passe, bouton)", async ({ page }) => {
    await page.goto("/connexion");
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Adresse e-mail")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Mot de passe")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Se connecter" })).toBeFocused();
  });

  test("connexion : Entrée dans le champ mot de passe envoie le formulaire (pas besoin de la souris)", async ({ page }) => {
    await page.goto("/connexion");
    await page.getByLabel("Adresse e-mail").fill(ADMIN.email);
    await page.getByLabel("Mot de passe").fill(ADMIN.password);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL("/");
  });

  test("une action se fait entièrement au clavier : réservation créée sans souris", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/stock");
    await page.getByRole("link", { name: /^Shampoing doux ·/ }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Shampoing doux" })).toBeVisible();
    await page.getByLabel(/^Quantité \(/).focus();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("1");
    await page.keyboard.press("Enter"); // envoi du formulaire au clavier
    await expect(page.getByRole("status").filter({ hasText: /Stock de « Shampoing doux »/ })).toBeVisible();
  });
});

for (const [mode, viewport] of [
  ["ordinateur", { width: 1280, height: 800 }],
  ["téléphone", { width: 390, height: 844 }],
] as const) {
  test.describe(`focus visible et non masqué (WCAG 2.4.7, 2.4.11) : ${mode}`, () => {
    test.use({ viewport });

    for (const screen of SCREENS.filter((s) => ["tableau de bord", "réservations (planning)", "nouvelle réservation", "fiche d'un produit", "fiche d'une facture", "fiche d'un chien", "nouvelle fiche chien"].includes(s.name))) {
      test(screen.name, async ({ page }) => {
        await login(page, ADMIN);
        await screen.open(page, await pageIds(page));
        await expect(page.locator("h1").first()).toBeVisible();
        // Attendre la fin du chargement : si la tabulation commence PENDANT l'hydratation de React, la page se redessine et le
        // focus est perdu (test intermittent constaté). Puis repartir d'un focus neutre, en haut de la page.
        await page.waitForLoadState("networkidle");
        await page.evaluate(() => {
          (document.activeElement as HTMLElement | null)?.blur();
          window.scrollTo(0, 0);
        });
        const arrets = await tabThrough(page);
        expect(arrets.length, "au moins un élément atteignable au clavier").toBeGreaterThan(3);
        const sansIndicateur = arrets.filter((s) => !hasFocusIndicator(s)).map((s) => `${s.tag} « ${s.name} »`);
        expect(sansIndicateur, `éléments sans indicateur de focus sur « ${screen.name} »`).toEqual([]);
        const masques = arrets.filter((s) => s.obscured).map((s) => `${s.tag} « ${s.name} »`);
        expect(masques, `éléments masqués par un en-tête ou une barre fixe quand ils ont le focus sur « ${screen.name} »`).toEqual([]);
      });
    }
  });
}

test.describe("taille des cibles (WCAG 2.5.8 : au moins 24 × 24 px)", () => {
  for (const [mode, viewport] of [
    ["ordinateur", { width: 1280, height: 800 }],
    ["téléphone", { width: 390, height: 844 }],
  ] as const) {
    test.describe(mode, () => {
      test.use({ viewport });
      for (const screen of SCREENS) {
        test(screen.name, async ({ page }) => {
          await login(page, ADMIN);
          await screen.open(page, await pageIds(page));
          await expect(page.locator("h1").first()).toBeVisible();
          const trop_petits = await page.evaluate(() =>
            [...document.querySelectorAll<HTMLElement>("button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button]")]
              .filter((el) => {
                const r = el.getBoundingClientRect();
                if (r.width <= 1 || r.height <= 1) return false; // masqué ou réservé aux lecteurs d'écran (lien d'évitement)
                if (getComputedStyle(el).display === "inline") return false; // lien dans une phrase : exemption du critère
                return r.width < 24 || r.height < 24;
              })
              .map((el) => `${el.tagName.toLowerCase()} « ${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30)} » ${Math.round(el.getBoundingClientRect().width)}×${Math.round(el.getBoundingClientRect().height)}`),
          );
          expect(trop_petits, `cibles de moins de 24 px sur « ${screen.name} » (${mode})`).toEqual([]);
        });
      }
    });
  }
});

test.describe("reflow (WCAG 1.4.10) : aucune barre de défilement horizontale à 320 px", () => {
  test.use({ viewport: { width: 320, height: 568 } });
  for (const screen of SCREENS) {
    test(screen.name, async ({ page }) => {
      await login(page, ADMIN);
      await screen.open(page, await pageIds(page));
      await expect(page.locator("h1").first()).toBeVisible();
      const debordement = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(debordement, `la page « ${screen.name} » dépasse de ${debordement} px à 320 px de large`).toBeLessThanOrEqual(1);
    });
  }
});

test.describe("espacement du texte et mouvement (WCAG 1.4.12, 2.3.3)", () => {
  test("avec les espacements de texte imposés par l'utilisateur, rien n'est rogné ni ne déborde", async ({ page }) => {
    await login(page, ADMIN);
    await page.addStyleTag({ content: "* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }" });
    for (const path of ["/", "/reservations/nouvelle", "/stock"]) {
      await page.goto(path);
      await page.addStyleTag({ content: "* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }" });
      const debordement = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(debordement, `débordement horizontal sur ${path}`).toBeLessThanOrEqual(1);
      await expect(page.locator("h1").first()).toBeVisible();
    }
  });

  test("« réduire les animations » est respecté : aucune transition longue active", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await login(page, ADMIN);
    const animees = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("*")].filter((el) => {
        const cs = getComputedStyle(el);
        return parseFloat(cs.animationDuration) > 0.5 && cs.animationName !== "none";
      }).length,
    );
    expect(animees).toBe(0);
  });
});

test.describe("annonces aux lecteurs d'écran après une action rapide", () => {
  /** Texte de toutes les zones d'annonce actuellement dans la page (ce qu'un lecteur d'écran peut encore lire). */
  const annonces = (page: Page) =>
    page.evaluate(() => [...document.querySelectorAll('[role="status"], [role="alert"], [aria-live]')].map((e) => e.textContent?.trim() ?? "").filter(Boolean).join(" | "));

  test("arrivée d'un chien : la confirmation reste dans une zone d'annonce après le rafraîchissement du tableau de bord", async ({ page }) => {
    await login(page, ADMIN);
    await page.getByRole("button", { name: "Enregistrer l'arrivée d'Oslo" }).click();
    await expect(page.getByRole("row", { name: /Oslo/ }).getByText("Fait")).toBeVisible(); // le tableau s'est rafraîchi
    await expect.poll(() => annonces(page), { message: "annonce de l'arrivée" }).toContain("Arrivée d'Oslo enregistrée.");
  });

  test("réapprovisionnement d'un produit sous son seuil : le nouveau stock est annoncé", async ({ page }) => {
    await login(page, ADMIN);
    const form = page.locator("form", { has: page.getByLabel("Quantité reçue pour Croquettes chiot") });
    await form.getByRole("button", { name: "Entrée" }).click();
    await expect(page.getByRole("link", { name: /Stock bas Croquettes chiot/ })).toHaveCount(0); // l'alerte a disparu du tableau
    await expect.poll(() => annonces(page)).toContain("Stock de « Croquettes chiot »");
  });

  test("facture à échéance marquée payée : la confirmation est annoncée", async ({ page }) => {
    await login(page, ADMIN);
    await page.getByRole("button", { name: /^Marquer payée : facture F-2026-0004$/ }).click();
    await expect(page.getByRole("link", { name: /Facture à échéance F-2026-0004/ })).toHaveCount(0);
    await expect.poll(() => annonces(page)).toContain("marquée payée");
  });
});
