import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { connection } from "next/server";
import { Nunito, Quicksand } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import "./globals.css";

// Mêmes polices que le site vitrine.
const quicksand = Quicksand({
  variable: "--font-quicksand",
  subsets: ["latin"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Back-office · Amour 2 Poils",
    template: "%s · Amour 2 Poils",
  },
  description: "Gestion de la pension canine Amour 2 Poils : réservations, clients, stock, facturation.",
  robots: { index: false, follow: false },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
  appleWebApp: { capable: true, title: "Amour 2 Poils", statusBarStyle: "default" },
};

// Couleur de la barre du navigateur : `primary` en clair, fond sombre en mode sombre.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#5a6950" },
    { media: "(prefers-color-scheme: dark)", color: "#1d1c19" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Rendu à la demande pour toutes les pages : sans cela, une page prérendue au build n'aurait pas de nonce CSP
  // (src/proxy.ts) et ses scripts seraient bloqués.
  await connection();
  // Le nonce posé par src/proxy.ts autorise ce script en ligne (la CSP interdit tout autre script en ligne).
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    // suppressHydrationWarning : le script ci-dessous ajoute data-theme sur <html> avant l'hydratation de React.
    <html lang="fr" suppressHydrationWarning className={`${quicksand.variable} ${nunito.variable} h-full antialiased`}>
      <head>
        {/* Applique le thème choisi (ou celui du système) avant le premier affichage : évite un flash de clair vers sombre. */}
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("a2p-theme");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
