// Page d'accueil provisoire : sera remplacée par le tableau de bord (phase 2).
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-4 py-16">
      <p className="text-sm font-bold uppercase tracking-widest text-sage-dark">🐾 Amour 2 Poils</p>
      <h1 className="text-4xl font-bold text-balance">Back-office de la pension</h1>
      <p className="text-lg text-foreground-light">
        Réservations, fiches clients et chiens, stock, facturation et séances d&apos;éducation. Le projet est en cours
        d&apos;initialisation.
      </p>
      <p>
        <a
          href="/api/health"
          className="inline-block rounded-md bg-sage-dark px-5 py-3 font-bold text-background focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brown"
        >
          Vérifier l&apos;état de l&apos;API
        </a>
      </p>
    </main>
  );
}
