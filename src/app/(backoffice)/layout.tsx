import Link from "next/link";
import { Suspense } from "react";
import { SideNav, SideNavLinks, TabBar, TabBarLinks } from "@/components/navigation";
import { focusRing } from "@/components/ui/button";
import { Avatar } from "@/components/ui/card";
import { Icon } from "@/components/ui/icons";

// Coquille commune des écrans du back-office (maquette : composant « Barre latérale »).
// L'utilisateur affiché est fictif tant que l'authentification n'existe pas (tâche mod-01).
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
            <SideNav />
          </Suspense>
        </nav>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3 px-3 py-3">
            <Avatar name="Claire" />
            <span className="flex flex-col text-sm">
              <span className="font-semibold">Claire Morel</span>
              <span className="text-foreground-light">Gérante</span>
            </span>
          </div>
          <Link href="/connexion" className={`flex min-h-11 items-center gap-3 rounded-sm px-3 hover:bg-background-alt ${focusRing}`}>
            <Icon name="deconnexion" />
            Se déconnecter
          </Link>
        </div>
      </aside>

      <main id="contenu" tabIndex={-1} className="flex min-w-0 flex-1 flex-col gap-6 px-4 pt-6 pb-28 outline-none md:px-8 md:py-8">
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
