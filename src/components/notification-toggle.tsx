"use client";

import { useEffect, useState } from "react";
import { focusRing } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";

type Status = "checking" | "unsupported" | "denied" | "off" | "on";

/** Convertit la clé VAPID (base64url) au format attendu par pushManager.subscribe. */
function toKey(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

const post = (method: "POST" | "DELETE", body: unknown) =>
  fetch("/api/push/abonnement", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

/** Active ou coupe les notifications de cet appareil. La permission n'est demandée qu'après un clic. */
export function NotificationToggle({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState<Status>("checking");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function check() {
      // Le service worker n'existe qu'en production : sans lui, pas de notifications.
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return "unsupported";
      if (Notification.permission === "denied") return "denied";
      return (await reg.pushManager.getSubscription()) ? "on" : "off";
    }
    check().then((s) => !cancelled && setStatus(s), () => !cancelled && setStatus("unsupported"));
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    setMessage("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const { key } = (await (await fetch("/api/push/cle")).json()) as { key: string };
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(key) });
      const res = await post("POST", sub.toJSON());
      if (!res.ok) {
        await sub.unsubscribe();
        throw new Error("save");
      }
      setStatus("on");
      setMessage("Notifications activées sur cet appareil.");
    } catch {
      setMessage("Activation impossible pour le moment.");
    }
  }

  async function disable() {
    setMessage("");
    try {
      const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
      if (sub) {
        await post("DELETE", { endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setStatus("off");
      setMessage("Notifications désactivées sur cet appareil.");
    } catch {
      setMessage("Désactivation impossible pour le moment.");
    }
  }

  if (status === "checking" || status === "unsupported") return null;
  const label = status === "on" ? "Désactiver les notifications" : "Activer les notifications";
  return (
    <div className="flex flex-col">
      {status === "denied" ? (
        <p className="px-3 py-2 text-sm text-foreground-light">Notifications bloquées : autorisez-les dans les réglages du navigateur.</p>
      ) : (
        <button
          type="button"
          onClick={status === "on" ? disable : enable}
          aria-pressed={status === "on"}
          className={`flex min-h-11 w-full items-center gap-3 rounded-sm px-3 hover:bg-background-alt ${focusRing}`}
        >
          <Icon name="alerte" />
          <span className={compact ? "sr-only" : ""}>{label}</span>
        </button>
      )}
      <p role="status" className="px-3 text-sm text-foreground-light empty:hidden">
        {message}
      </p>
    </div>
  );
}
