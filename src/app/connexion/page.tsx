import type { Metadata } from "next";
import { Icon } from "@/components/ui/icons";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion" };

export default function LoginPage() {
  return (
    <div className="grid min-h-full flex-1 grid-cols-1 md:grid-cols-[1fr_640px]">
      <section className="hidden flex-col justify-center gap-6 bg-sage-soft px-20 md:flex">
        <Icon name="patte" size={60} className="text-primary" />
        <p className="text-xs font-bold tracking-wider text-primary uppercase">Amour 2 Poils</p>
        <p className="max-w-[520px] font-heading text-[32px] leading-10 font-bold text-balance">Le quotidien de la pension, au même endroit.</p>
        <p className="max-w-[480px] text-foreground-light">
          Réservations, fiches des chiens, stock, facturation et séances d&apos;éducation : tout ce qu&apos;il faut pour s&apos;occuper des pensionnaires.
        </p>
      </section>
      <main className="flex items-center justify-center px-4 py-12">
        <div className="flex w-full max-w-[440px] flex-col gap-5 rounded-lg border border-border bg-surface p-10 shadow-[0_10px_30px_rgba(61,58,52,0.08)]">
          <h1 className="text-2xl font-bold">Connexion</h1>
          <p className="text-foreground-light">Accès réservé à l&apos;équipe de la pension.</p>
          <LoginForm />
        </div>
      </main>
    </div>
  );
}
