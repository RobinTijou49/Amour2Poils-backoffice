import { useId, type ComponentProps, type ReactNode } from "react";

// Champs de formulaire du design system : étiquette toujours visible,
// aide et erreur reliées au contrôle par aria-describedby, erreur signalée par aria-invalid.

type Common = { label: string; error?: string; hint?: string; className?: string };

const controlClass = (error?: string) =>
  `min-h-11 rounded-sm border bg-surface px-3 text-foreground outline-none focus:border-2 focus:border-primary ${
    error ? "border-2 border-danger-fg" : "border-border-strong"
  }`;

function Wrapper({ id, label, error, hint, className, children }: Common & { id: string; children: ReactNode }) {
  return (
    <div className={`flex flex-col gap-2 ${className ?? ""}`}>
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-foreground-light">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm text-danger-fg">
          {error}
        </p>
      )}
    </div>
  );
}

function a11y(id: string, error?: string, hint?: string) {
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(" ") || undefined;
  return { id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy };
}

export function Field({ label, error, hint, className, ...input }: Common & ComponentProps<"input">) {
  const id = useId();
  return (
    <Wrapper id={id} label={label} error={error} hint={hint} className={className}>
      <input {...a11y(id, error, hint)} className={controlClass(error)} {...input} />
    </Wrapper>
  );
}

/** Liste déroulante. */
export function Select({ label, error, hint, className, children, ...select }: Common & ComponentProps<"select">) {
  const id = useId();
  return (
    <Wrapper id={id} label={label} error={error} hint={hint} className={className}>
      <select {...a11y(id, error, hint)} className={controlClass(error)} {...select}>
        {children}
      </select>
    </Wrapper>
  );
}

/** Texte sur plusieurs lignes. */
export function Textarea({ label, error, hint, className, ...area }: Common & ComponentProps<"textarea">) {
  const id = useId();
  return (
    <Wrapper id={id} label={label} error={error} hint={hint} className={className}>
      <textarea rows={3} {...a11y(id, error, hint)} className={`${controlClass(error)} py-2`} {...area} />
    </Wrapper>
  );
}

/** Case à cocher : l'étiquette est à droite et toute la ligne est cliquable (cible ≥ 24 px). */
export function Checkbox({ label, className, ...input }: { label: string; className?: string } & Omit<ComponentProps<"input">, "type">) {
  const id = useId();
  return (
    <div className={`flex min-h-11 items-center gap-3 ${className ?? ""}`}>
      <input id={id} type="checkbox" className="size-6 accent-primary" {...input} />
      <label htmlFor={id} className="font-semibold">
        {label}
      </label>
    </div>
  );
}
