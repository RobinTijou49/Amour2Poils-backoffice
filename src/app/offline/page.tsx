import type { Metadata } from "next";

export const metadata: Metadata = { title: "Hors connexion" };

// Page affichée par le service worker quand le réseau est coupé. Statique : aucune donnée, donc cachable sans risque.
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="font-heading text-2xl font-bold">Vous êtes hors connexion</h1>
      <p className="text-foreground-light">
        Cette page n&apos;est pas disponible sans réseau. Vérifiez votre connexion, puis réessayez.
      </p>
      {/* Lien classique (pas next/link) : on veut une vraie navigation pour retenter le réseau. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/" className="inline-flex min-h-11 w-fit items-center rounded-md bg-primary px-5 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2">
        Réessayer
      </a>
    </main>
  );
}
