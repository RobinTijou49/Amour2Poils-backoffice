"use client";

import { useSyncExternalStore } from "react";
import { focusRing } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";

// Clé du choix dans localStorage. Le script de src/app/layout.tsx la lit avant le premier affichage (pas de flash).
export const THEME_KEY = "a2p-theme";

type Theme = "light" | "dark";

const read = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

// Le thème vit dans l'attribut data-theme de <html> : on s'abonne à ses changements plutôt que de dupliquer un état React.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

/** Bouton icône clair/sombre. Le choix est retenu sur l'appareil ; sans choix, on suit le réglage du système. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, read, () => "light" as Theme);
  const next: Theme = theme === "dark" ? "light" : "dark";

  function toggle() {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Stockage bloqué (navigation privée) : le thème change quand même pour cette page.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={next === "dark" ? "Passer en mode sombre" : "Passer en mode clair"}
      className={`flex size-11 shrink-0 items-center justify-center rounded-sm text-foreground hover:bg-background-alt ${focusRing} ${className}`}
    >
      <Icon name={theme === "dark" ? "soleil" : "lune"} />
    </button>
  );
}
