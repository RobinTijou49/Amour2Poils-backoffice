// Formats d'affichage français. Les dates « jour » (@db.Date) sont stockées à minuit UTC :
// on les formate en UTC pour ne jamais décaler d'un jour.
const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export function formatEuros(cents: number) {
  return euros.format(cents / 100);
}

/** Euros saisis (au plus 2 décimales, ex. 19.99) en centimes entiers : les montants ne sont jamais stockés en flottant.
 *  Math.round absorbe l'erreur de représentation (0.29 * 100 vaut 28.999999999999996). */
export function eurosToCents(amount: number) {
  return Math.round(amount * 100);
}

export function formatDate(date: Date, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", ...options }).format(date);
}

export function formatTime(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }).format(date);
}

/** Décalage de Paris par rapport à UTC (en ms) à un instant donné : +1 h l'hiver, +2 h l'été. */
function parisOffsetMs(instant: number) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(new Date(instant))
      .map((p) => [p.type, p.value]),
  );
  return Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute) - instant;
}

/** Convertit une date et une heure saisies à Paris ("2026-10-24", "10:00") en instant UTC.
 *  Le décalage (UTC+1 l'hiver, UTC+2 l'été) est lu dans la base de fuseaux du navigateur/serveur.
 *  Deux passes : le décalage doit être celui de l'instant RÉEL, pas de l'instant « naïf » (heure de Paris lue comme
 *  si c'était de l'UTC). Avec une seule passe, les heures proches d'un changement d'heure étaient décalées d'une heure
 *  (révélé par le test du 29 mars 2026). Une heure qui n'existe pas (02:30 au printemps) est rapprochée de l'instant valide. */
export function parisToUtc(day: string, time: string) {
  const [y, mo, d] = day.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  const guess = naive - parisOffsetMs(naive);
  return new Date(naive - parisOffsetMs(guess));
}

/** « de » élidé devant une voyelle ou un h muet : « d'Oslo », « de Rex ». */
export function de(name: string) {
  return /^[aeiouyhàâéèêëîïôöûü]/i.test(name) ? `d'${name}` : `de ${name}`;
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
