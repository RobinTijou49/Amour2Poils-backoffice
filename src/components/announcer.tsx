"use client";

import { useEffect, useRef, useState } from "react";

// Annonces aux lecteurs d'écran qui survivent au rafraîchissement de la page.
//
// Problème (révélé par le test d'accessibilité) : après « Enregistrer l'arrivée » sur le tableau de bord, la page se
// rafraîchit et le composant qui affichait « Arrivée d'Oslo enregistrée. » (role="status") est retiré du DOM presque
// aussitôt, remplacé par un badge « Fait ». Un lecteur d'écran n'annonce qu'une zone qui EXISTE déjà quand son texte change :
// la confirmation n'était jamais lue. Ici la zone vit dans la coque de la page (layout) et n'est jamais démontée.

const EVENT = "a2p:announce";

/** Demande à la zone d'annonce de lire ce message. Utilisable depuis n'importe quel composant client. */
export function announce(message: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: message }));
}

/** Enveloppe une Server Action : si elle réussit, son message de succès est annoncé, que le composant soit démonté ou non. */
export function withAnnouncement<S extends { success?: string }>(action: (prev: S, data: FormData) => Promise<S>) {
  return async (prev: S, data: FormData) => {
    const next = await action(prev, data);
    if (next.success) announce(next.success);
    return next;
  };
}

/** Zone d'annonce unique de l'application, à monter une fois dans la coque du back-office. */
export function Announcer() {
  const [text, setText] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const onAnnounce = (event: Event) => {
      const message = (event as CustomEvent<string>).detail;
      clearTimeout(timer.current);
      // Vider puis remettre : le même message annoncé deux fois de suite est relu (le texte doit CHANGER).
      setText("");
      timer.current = setTimeout(() => {
        setText(message);
        timer.current = setTimeout(() => setText(""), 8_000);
      }, 50);
    };
    window.addEventListener(EVENT, onAnnounce);
    return () => {
      window.removeEventListener(EVENT, onAnnounce);
      clearTimeout(timer.current);
    };
  }, []);

  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {text}
    </div>
  );
}
