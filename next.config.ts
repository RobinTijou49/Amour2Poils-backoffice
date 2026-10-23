import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Active forbidden() (page 403) pour les écrans réservés à un rôle.
  experimental: { authInterrupts: true },
  async headers() {
    return [
      {
        // Le navigateur doit toujours revérifier le service worker, sinon une mise à jour peut rester bloquée.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
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
