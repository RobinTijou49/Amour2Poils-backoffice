import type { MetadataRoute } from "next";

// Manifeste de l'application web : sert l'installation (écran d'accueil, fenêtre dédiée).
// Couleurs = tokens `background` (fond de la maquette) et `primary` du thème clair.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Amour 2 Poils · Back-office",
    short_name: "Amour 2 Poils",
    description: "Gestion de la pension canine : réservations, clients, stock, facturation.",
    lang: "fr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#fdfcf9",
    theme_color: "#5f6e55",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Nouvelle réservation", url: "/reservations/nouvelle" },
      { name: "Stock", url: "/stock" },
    ],
  };
}
