import { useId, type ComponentProps } from "react";

const controlClass = (error?: string) =>
  `min-h-11 rounded-sm border bg-surface px-3 text-foreground outline-none focus:border-2 focus:border-primary ${error ? "border-2 border-danger-fg" : "border-border-strong"}`;

/** Liste déroulante, mêmes règles que Field (étiquette visible, erreur reliée). */
export function Select({ label, error, hint, className, children, ...select }: { label: string; error?: string; hint?: string } & ComponentProps<"select">) {
  const id = useId();
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(" ") || undefined;
  return (
    <div className={`flex flex-col gap-2 ${className ?? ""}`}>
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <select id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy} className={controlClass(error)} {...select}>
        {children}
      </select>
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

// Composant « Champ » : étiquette toujours visible, erreur reliée au champ par aria-describedby.
export function Field({ label, error, hint, className, ...input }: { label: string; error?: string; hint?: string } & ComponentProps<"input">) {
  const id = useId();
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(" ") || undefined;
  return (
    <div className={`flex flex-col gap-2 ${className ?? ""}`}>
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`min-h-11 rounded-sm border bg-surface px-3 text-foreground outline-none focus:border-2 focus:border-primary ${
          error ? "border-2 border-danger-fg" : "border-border-strong"
        }`}
        {...input}
      />
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
