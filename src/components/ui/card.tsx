import type { ReactNode } from "react";

export function Card({ title, children, className, action }: { title?: string; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <section className={`flex min-w-0 flex-col gap-4 rounded-md border border-border bg-surface p-5 ${className ?? ""}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3">
          {title && <h2 className="text-lg font-bold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function KpiCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-md border border-border bg-surface p-4">
      <p className="text-xs font-bold tracking-wider text-foreground-light uppercase">{label}</p>
      <p className="font-heading text-[28px] leading-[34px] font-bold tabular-nums">{value}</p>
      {detail && <p className="text-sm text-foreground-light">{detail}</p>}
    </div>
  );
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-sage-soft font-bold text-primary"
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

export function PageHeader({ title, subtitle, actions, leading }: { title: string; subtitle?: string; actions?: ReactNode; leading?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-center gap-4">
      {leading}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h1 className="text-[32px] leading-10 font-bold text-balance">{title}</h1>
        {subtitle && <p className="text-foreground-light">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </header>
  );
}
