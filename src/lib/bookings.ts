import type { BookingStatus } from "@/generated/prisma/client";

// Règles métier des réservations. Fonctions pures, sans accès base : faciles à tester.

/** Transitions de statut autorisées. Tout le reste est refusé côté serveur. */
export const transitions: Record<BookingStatus, BookingStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["CHECKED_IN", "CANCELLED"],
  CHECKED_IN: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus) {
  return transitions[from].includes(to);
}

/** Nombre de nuits entre deux dates « jour » (minuit UTC). */
export function nights(start: Date, end: Date) {
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

/** Deux séjours se chevauchent si l'un commence avant la fin de l'autre (le jour du départ est libre). */
export function overlaps(a: { start: Date; end: Date }, b: { start: Date; end: Date }) {
  return a.start < b.end && b.start < a.end;
}

/**
 * Reste-t-il de la place dans la box ? On vérifie chaque nuit du séjour :
 * deux séjours qui ne se croisent pas ne doivent pas être additionnés.
 */
export function hasRoom(capacity: number, existing: { start: Date; end: Date }[], wanted: { start: Date; end: Date }) {
  for (let t = wanted.start.getTime(); t < wanted.end.getTime(); t += 86_400_000) {
    const night = { start: new Date(t), end: new Date(t + 86_400_000) };
    if (existing.filter((b) => overlaps(b, night)).length >= capacity) return false;
  }
  return true;
}
