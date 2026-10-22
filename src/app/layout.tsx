import type { Metadata } from "next";
import { Nunito, Quicksand } from "next/font/google";
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
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${quicksand.variable} ${nunito.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
