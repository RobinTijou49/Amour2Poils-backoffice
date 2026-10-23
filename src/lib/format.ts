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

/** Convertit une date et une heure saisies à Paris ("2026-10-24", "10:00") en instant UTC.
 *  Le décalage (UTC+1 l'hiver, UTC+2 l'été) est lu dans la base de fuseaux du navigateur/serveur. */
export function parisToUtc(day: string, time: string) {
  const [y, mo, d] = day.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(new Date(asUtc))
      .map((p) => [p.type, p.value]),
  );
  const parisAsUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return new Date(asUtc - (parisAsUtc - asUtc));
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
