// Formats d'affichage français. Les dates « jour » (@db.Date) sont stockées à minuit UTC :
// on les formate en UTC pour ne jamais décaler d'un jour.
const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export function formatEuros(cents: number) {
  return euros.format(cents / 100);
}

export function formatDate(date: Date, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", ...options }).format(date);
}

export function formatTime(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }).format(date);
}

export function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Minuit UTC du jour donné, décalé de `offset` jours. */
export function utcDay(base: Date, offset = 0) {
  const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
}

/** Lundi (minuit UTC) de la semaine contenant `date`. */
export function mondayOf(date: Date) {
  const d = utcDay(date);
  const shift = (d.getUTCDay() + 6) % 7;
  return utcDay(d, -shift);
}

export function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function ageInYears(birth: Date, today: Date) {
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const m = today.getUTCMonth() - birth.getUTCMonth();
  if (m < 0 || (m === 0 && today.getUTCDate() < birth.getUTCDate())) age--;
  return age;
}
