import type { Metadata, Viewport } from "next";
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
    { media: "(prefers-color-scheme: light)", color: "#5f6e55" },
    { media: "(prefers-color-scheme: dark)", color: "#1d1c19" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${quicksand.variable} ${nunito.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
