import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/card";

export default function DogNotFound() {
  return (
    <>
      <PageHeader title="Chien introuvable" subtitle="Cette fiche n'existe pas ou a été supprimée." />
      <p>
        <ButtonLink href="/chiens" variant="secondary" icon="chevronGauche">
          Retour à la liste des chiens
        </ButtonLink>
      </p>
    </>
  );
}
