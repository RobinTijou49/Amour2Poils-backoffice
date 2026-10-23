import type { ReactNode } from "react";

export type Column<T> = {
  header: string;
  cell: (row: T) => ReactNode;
  align?: "left" | "right";
  className?: string;
};

// Vrai <table> (et pas des div) : les lecteurs d'écran annoncent ligne et colonne.
export function DataTable<T>({ caption, columns, rows, rowKey, empty }: { caption: string; columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string; empty?: string }) {
  if (rows.length === 0) return <p className="text-foreground-light">{empty ?? "Aucun élément."}</p>;
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border">
            {columns.map((c) => (
              <th
                key={c.header}
                scope="col"
                className={`px-1 py-3 text-xs font-bold tracking-wider whitespace-nowrap text-foreground-light uppercase ${c.align === "right" ? "text-right" : ""}`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-b border-border last:border-0">
              {columns.map((c) => (
                <td key={c.header} className={`px-1 py-3 align-middle ${c.align === "right" ? "text-right tabular-nums" : ""} ${c.className ?? ""}`}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
