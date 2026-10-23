"use client";

import { useEffect } from "react";

/** Enregistre le service worker. Seulement en production : en développement il masquerait les modifications. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Échec silencieux : l'application fonctionne normalement sans service worker.
    });
  }, []);
  return null;
}
