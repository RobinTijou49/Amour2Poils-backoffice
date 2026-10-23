// Formes des données gardées dans IndexedDB pour le mode hors connexion. Dates en texte (JSON, IndexedDB).

export type OfflineBooking = {
  id: string;
  status: "CONFIRMED" | "CHECKED_IN" | "COMPLETED";
  startDate: string;
  endDate: string;
  kennel: string | null;
  dog: {
    id: string;
    name: string;
    breed: string | null;
    allergies: string | null;
    diet: string | null;
    behaviorNotes: string | null;
    vetName: string | null;
    vetPhone: string | null;
    owner: { name: string; phone: string };
    vaccinations: { name: string; expiresAt: string }[];
  };
};

export type OfflineSnapshot = { generatedAt: string; today: string; bookings: OfflineBooking[] };

/** Arrivée ou départ enregistré sans réseau, rejoué dès que la connexion revient. */
export type QueuedAction = {
  id: string;
  bookingId: string;
  action: "check-in" | "check-out";
  dogName: string;
  /** Heure réelle du geste (le serveur la reprend, sinon ce serait l'heure de synchronisation). */
  at: string;
};
