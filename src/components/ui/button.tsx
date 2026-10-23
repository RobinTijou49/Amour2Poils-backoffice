import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Icon, type IconName } from "./icons";

// Composant « Bouton » de la maquette : 44 px de haut (cible tactile WCAG 2.5.8).
const variants = {
  primary: "bg-primary text-on-primary hover:brightness-110",
  secondary: "bg-surface text-foreground border border-border-strong hover:bg-background-alt",
  ghost: "text-primary hover:bg-sage-soft",
  danger: "bg-danger-bg text-danger-fg border border-danger-fg hover:brightness-95",
} as const;

export const focusRing =
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brown-dark";

type Common = { variant?: keyof typeof variants; icon?: IconName; children: ReactNode; className?: string };

function classes(variant: keyof typeof variants, className?: string) {
  return `inline-flex min-h-11 items-center justify-center gap-2 rounded-sm px-4 font-bold whitespace-nowrap transition ${variants[variant]} ${focusRing} ${className ?? ""}`;
}

export function Button({ variant = "primary", icon, children, className, ...props }: Common & ComponentProps<"button">) {
  return (
    <button type="button" className={classes(variant, className)} {...props}>
      {icon && <Icon name={icon} size={20} />}
      {children}
    </button>
  );
}

export function ButtonLink({ variant = "primary", icon, children, className, ...props }: Common & ComponentProps<typeof Link>) {
  return (
    <Link className={classes(variant, className)} {...props}>
      {icon && <Icon name={icon} size={20} />}
      {children}
    </Link>
  );
}
