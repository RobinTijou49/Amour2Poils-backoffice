// Exécuté une fois au démarrage du serveur Next.js : on refuse de démarrer avec une configuration incomplète.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnv } = await import("./lib/env");
    validateEnv();
  }
}
