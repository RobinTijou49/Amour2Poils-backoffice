"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { focusRing } from "./ui/button";
import { Icon, type IconName } from "./ui/icons";

// Client Component uniquement pour usePathname : marquer la page courante (aria-current).
const links: { href: string; label: string; short: string; icon: IconName; mobile: boolean }[] = [
  { href: "/", label: "Tableau de bord", short: "Accueil", icon: "maison", mobile: true },
  { href: "/reservations", label: "Réservations", short: "Planning", icon: "calendrier", mobile: true },
  { href: "/chiens", label: "Clients et chiens", short: "Chiens", icon: "patte", mobile: true },
  { href: "/seances", label: "Séances", short: "Séances", icon: "education", mobile: false },
  { href: "/stock", label: "Stock", short: "Stock", icon: "stock", mobile: true },
  { href: "/facturation", label: "Facturation", short: "Factures", icon: "facture", mobile: false },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

// `pathname` vide = rendu de repli pendant le prérendu (aucun lien actif).
export function SideNavLinks({ pathname }: { pathname: string }) {
  return (
    <ul className="flex flex-col gap-1">
      {links.map((l) => {
        const active = isActive(pathname, l.href);
        return (
          <li key={l.href}>
            <Link
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-sm px-3 ${focusRing} ${
                active ? "bg-sage-soft font-bold text-primary" : "text-foreground hover:bg-background-alt"
              }`}
            >
              <Icon name={l.icon} />
              {l.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function TabBarLinks({ pathname }: { pathname: string }) {
  return (
    <ul className="grid grid-cols-4 gap-1 px-2 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
      {links
        .filter((l) => l.mobile)
        .map((l) => {
          const active = isActive(pathname, l.href);
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-md text-sm ${focusRing} ${
                  active ? "bg-sage-soft font-bold text-primary" : "font-semibold text-foreground-light"
                }`}
              >
                <Icon name={l.icon} />
                {l.short}
              </Link>
            </li>
          );
        })}
    </ul>
  );
}

export function SideNav() {
  return <SideNavLinks pathname={usePathname()} />;
}

export function TabBar() {
  return <TabBarLinks pathname={usePathname()} />;
}
