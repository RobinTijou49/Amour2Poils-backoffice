import "server-only";
import { z } from "zod";

// Variables d'environnement du serveur, validées une fois au démarrage (voir src/instrumentation.ts).
// Un secret manquant ou trop court fait échouer le démarrage avec un message clair, au lieu d'une erreur
// obscure à la première notification ou au premier appel du cron. Les valeurs ne sont jamais affichées.

const schema = z
  .object({
    DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\/.+/, "doit être une URL postgresql://"),
    // Notifications push : clés VAPID (`bunx web-push generate-vapid-keys`). Toutes ou aucune.
    VAPID_PUBLIC_KEY: z.string().min(80, "clé publique VAPID trop courte").optional(),
    VAPID_PRIVATE_KEY: z.string().min(40, "clé privée VAPID trop courte").optional(),
    VAPID_SUBJECT: z.string().regex(/^(mailto:|https:\/\/).+/, "doit commencer par mailto: ou https://").optional(),
    // Secret du cron des rappels de vaccins : assez long pour résister à une attaque par essais.
    CRON_SECRET: z.string().min(24, "au moins 24 caractères").optional(),
  })
  .superRefine((env, ctx) => {
    const vapid = [env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY, env.VAPID_SUBJECT];
    if (vapid.some(Boolean) && !vapid.every(Boolean)) {
      ctx.addIssue({ code: "custom", path: ["VAPID_PRIVATE_KEY"], message: "les trois variables VAPID_* doivent être définies ensemble" });
    }
  });

/** Variables obligatoires en production uniquement (le développement fonctionne sans notifications ni cron). */
const requiredInProduction = ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT", "CRON_SECRET"] as const;

export function validateEnv(source: NodeJS.ProcessEnv = process.env) {
  // Une chaîne vide (`VAR=` dans .env) compte comme « non définie ».
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== undefined && v !== ""));
  const parsed = schema.safeParse(cleaned);
  const problems = parsed.success ? [] : parsed.error.issues.map((i) => `${i.path.join(".") || "env"} : ${i.message}`);
  // Pendant `next build` les secrets de production ne sont pas (et ne doivent pas être) disponibles.
  if (source.NODE_ENV === "production" && source.NEXT_PHASE !== "phase-production-build") {
    for (const name of requiredInProduction) if (!cleaned[name]) problems.push(`${name} : obligatoire en production`);
  }
  if (problems.length) {
    throw new Error(`Configuration invalide (voir .env.example) :\n - ${problems.join("\n - ")}`);
  }
}
