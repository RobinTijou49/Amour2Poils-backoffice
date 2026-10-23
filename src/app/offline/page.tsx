import type { Metadata } from "next";
import { OfflineDay } from "./offline-day";

export const metadata: Metadata = { title: "Hors connexion" };

// Page affichée par le service worker quand le réseau est coupé. Le HTML est statique (cachable sans risque) :
// les données de la journée sont lues dans IndexedDB par <OfflineDay>, jamais envoyées par le serveur.
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-bold">Vous êtes hors connexion</h1>
        <p className="text-foreground-light">Cette page n&apos;est pas disponible sans réseau. Voici la copie locale de la journée.</p>
        {/* Lien classique (pas next/link) : on veut une vraie navigation pour retenter le réseau. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className="inline-flex min-h-11 w-fit items-center rounded-md bg-primary px-5 font-semibold text-on-primary focus-visible:outline-2 focus-visible:outline-offset-2">
          Réessayer
        </a>
      </header>
      <OfflineDay />
    </main>
  );
}
