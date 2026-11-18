import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeToggle, THEME_KEY } from "@/components/theme-toggle";

// Le thème vit dans l'attribut data-theme de <html> (posé avant l'hydratation par le script de src/app/layout.tsx).
beforeEach(() => {
  localStorage.clear();
  document.documentElement.dataset.theme = "light";
});
afterEach(() => {
  delete document.documentElement.dataset.theme;
});

describe("ThemeToggle", () => {
  test("en mode clair : propose le mode sombre, puis bascule et retient le choix", async () => {
    render(<ThemeToggle />);
    await userEvent.click(screen.getByRole("button", { name: "Passer en mode sombre" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem(THEME_KEY)).toBe("dark");
    // Le libellé suit l'état : c'est lui qu'un lecteur d'écran annonce.
    await waitFor(() => expect(screen.getByRole("button", { name: "Passer en mode clair" })).toBeDefined());
  });

  test("en mode sombre : revient au clair", async () => {
    document.documentElement.dataset.theme = "dark";
    render(<ThemeToggle />);
    await userEvent.click(screen.getByRole("button", { name: "Passer en mode clair" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem(THEME_KEY)).toBe("light");
  });

  test("stockage indisponible : le thème change quand même", async () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error("bloqué");
    };
    try {
      render(<ThemeToggle />);
      await userEvent.click(screen.getByRole("button", { name: "Passer en mode sombre" }));
      expect(document.documentElement.dataset.theme).toBe("dark");
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});
