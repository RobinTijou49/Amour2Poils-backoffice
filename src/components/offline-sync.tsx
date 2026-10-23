"use client";

import { useEffect } from "react";
import { clearSnapshot } from "@/lib/offline/store";
import { syncAll } from "@/lib/offline/sync";

/** Monté dans le back-office : met à jour la copie locale de la journée et rejoue les gestes en attente. */
export function OfflineSync() {
  useEffect(() => {
    const run = () => {
      if (navigator.onLine) syncAll().catch(() => undefined);
    };
    run();
    window.addEventListener("online", run);
    // Au retour sur l'application (changement d'onglet, téléphone déverrouillé) : instantané à jour.
    const onVisible = () => document.visibilityState === "visible" && run();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", run);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return null;
}

/** Monté sur la page de connexion : après une déconnexion, les fiches des clients ne restent pas dans le navigateur. */
export function ClearOfflineData() {
  useEffect(() => {
    clearSnapshot().catch(() => undefined);
  }, []);
  return null;
}
