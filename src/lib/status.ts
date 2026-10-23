import type { BookingStatus, InvoiceStatus, KennelSize, ProductCategory, SessionType } from "@/generated/prisma/client";
import type { Tone } from "@/components/ui/badge";

// Libellés français et ton du badge pour chaque statut de la base.
export const bookingStatus: Record<BookingStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "En attente", tone: "warning" },
  CONFIRMED: { label: "Confirmée", tone: "success" },
  CHECKED_IN: { label: "En pension", tone: "info" },
  COMPLETED: { label: "Terminée", tone: "neutral" },
  CANCELLED: { label: "Annulée", tone: "danger" },
};

export const invoiceStatus: Record<InvoiceStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: "Brouillon", tone: "neutral" },
  SENT: { label: "Envoyée", tone: "info" },
  PAID: { label: "Payée", tone: "success" },
  CANCELLED: { label: "Annulée", tone: "neutral" },
};

export const sessionType: Record<SessionType, string> = {
  PRIVATE: "Cours particulier",
  GROUP: "Cours collectif",
  PUPPY_CLASS: "Puppy class",
  PETSITTING: "Visite petsitting",
};

export const productCategory: Record<ProductCategory, string> = {
  FOOD: "Alimentation",
  TREAT: "Friandises",
  HYGIENE: "Hygiène",
  MEDICAL: "Soins",
  OTHER: "Autre",
};

export const kennelSize: Record<KennelSize, string> = {
  SMALL: "petit gabarit",
  MEDIUM: "gabarit moyen",
  LARGE: "grand gabarit",
};
