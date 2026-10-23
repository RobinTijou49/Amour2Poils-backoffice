import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: false,
  // Sortie autonome pour l'image Docker : serveur minimal et dépendances tracées (voir Dockerfile).
  output: "standalone",
  // Active forbidden() (page 403) pour les écrans réservés à un rôle.
  experimental: { authInterrupts: true },
  async headers() {
    return [
      {
        // En-têtes de sécurité de toutes les réponses. La CSP, elle, dépend d'un nonce par requête : voir src/proxy.ts.
        source: "/:path*",
        headers: [
          // Interdit au navigateur de « deviner » un type de contenu (un fichier texte exécuté comme script).
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Le site n'est affichable dans aucune iframe (clickjacking). Doublé par frame-ancestors dans la CSP.
          { key: "X-Frame-Options", value: "DENY" },
          // Les liens sortants ne reçoivent que l'origine, jamais le chemin complet (ids de réservation, etc.).
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Fonctions du navigateur dont l'application n'a pas besoin : coupées, même pour un script injecté.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
          // Isole la fenêtre des pages ouvertes depuis un autre site.
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          // HTTPS obligatoire pendant 6 mois. Sans includeSubDomains : duckdns.org n'est pas notre domaine.
          // Ignoré par les navigateurs en HTTP, donc sans effet sur le développement local.
          { key: "Strict-Transport-Security", value: "max-age=15552000" },
        ],
      },
      {
        // Le navigateur doit toujours revérifier le service worker, sinon une mise à jour peut rester bloquée.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          // Le script du service worker n'a pas de page : CSP minimale propre à ce fichier.
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
  turbopack: {
    // Un package-lock.json traîne dans le dossier utilisateur : on fixe la racine du projet.
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
