import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Active forbidden() (page 403) pour les écrans réservés à un rôle.
  experimental: { authInterrupts: true },
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
