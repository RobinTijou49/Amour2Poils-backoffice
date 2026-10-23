import Link from "next/link";
import { Suspense } from "react";
import { MobileUserBar, UserCard, UserNav } from "@/components/current-user";
import { SideNavLinks, TabBar, TabBarLinks } from "@/components/navigation";
import { focusRing } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";

// Coquille commune des écrans du back-office (maquette : composant « Barre latérale »).
// Ce qui dépend de l'utilisateur connecté (menu selon le rôle, nom) est streamé sous <Suspense>.
export default function BackofficeLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-1">
      <a
        href="#contenu"
        className={`sr-only z-50 rounded-sm bg-primary px-4 py-3 font-bold text-on-primary focus:not-sr-only focus:fixed focus:top-4 focus:left-4 ${focusRing}`}
      >
        Aller au contenu
      </a>

      <aside className="sticky top-0 hidden h-dvh w-66 shrink-0 flex-col gap-6 border-r border-border bg-surface px-4 py-6 md:flex">
        <Link href="/" className={`flex items-center gap-2.5 rounded-sm px-3 ${focusRing}`}>
          <Icon name="patte" className="text-primary" />
          <span className="flex flex-col">
            <span className="font-heading text-lg font-bold">Amour 2 Poils</span>
            <span className="text-sm text-foreground-light">Back-office</span>
          </span>
        </Link>
        <nav aria-label="Navigation principale" className="flex-1">
          <Suspense fallback={<SideNavLinks pathname="" />}>
            <UserNav />
          </Suspense>
        </nav>
        <Suspense fallback={<div className="h-28" />}>
          <UserCard />
        </Suspense>
      </aside>

      <header className="fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b border-border bg-surface px-4 py-2 md:hidden">
        <Link href="/" className={`flex items-center gap-2 rounded-sm font-heading font-bold ${focusRing}`}>
          <Icon name="patte" className="text-primary" />
          Amour 2 Poils
        </Link>
        <Suspense fallback={null}>
          <MobileUserBar />
        </Suspense>
      </header>

      <main id="contenu" tabIndex={-1} className="flex min-w-0 flex-1 flex-col gap-6 px-4 pt-20 pb-28 outline-none md:px-8 md:py-8">
        {children}
      </main>

      <nav aria-label="Navigation principale" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface md:hidden">
        <Suspense fallback={<TabBarLinks pathname="" />}>
          <TabBar />
        </Suspense>
      </nav>
    </div>
  );
}
