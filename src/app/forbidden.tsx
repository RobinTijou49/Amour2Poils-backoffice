import { ButtonLink } from "@/components/ui/button";

export default function Forbidden() {
  return (
    <main className="mx-auto flex max-w-xl flex-1 flex-col justify-center gap-4 px-4 py-16">
      <h1 className="text-[32px] leading-10 font-bold">Accès réservé</h1>
      <p className="text-foreground-light">Cette page est réservée à la gérance. Demandez l&apos;accès à la gérante si vous en avez besoin.</p>
      <p>
        <ButtonLink href="/" variant="secondary" icon="chevronGauche">
          Retour au tableau de bord
        </ButtonLink>
      </p>
    </main>
  );
}
