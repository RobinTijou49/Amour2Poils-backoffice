// Couverture de code des trois suites (unitaires, intégration, composants), fusionnée en un seul rapport.
// Chaque suite a son propre préchargement ; `bun test` ne sait donc pas les mesurer d'un bloc. On lance chacune avec le
// rapport lcov, puis on fusionne : une ligne est « couverte » si AU MOINS UNE suite l'exécute.
// Usage : `bun run coverage` (base de test requise : `bun run db:up`). Seuil : variable COVERAGE_MIN_LINES (défaut 80).
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { Glob } from "bun";
import { relative, resolve } from "node:path";

const SUITES: { name: string; args: string[] }[] = [
  { name: "unit", args: ["src"] },
  { name: "integration", args: ["--preload", "./tests/integration/setup.ts", "tests/integration"] },
  { name: "components", args: ["--preload", "./tests/components/setup.ts", "tests/components"] },
];
const MIN_LINES = Number(process.env.COVERAGE_MIN_LINES ?? 80);
const root = process.cwd();
rmSync("coverage", { recursive: true, force: true });
mkdirSync("coverage", { recursive: true });

// La base de test doit exister avant la suite d'intégration (même commande que `bun run test:db`).
const db = Bun.spawnSync(["bun", "tests/db-setup.ts"], { stdout: "inherit", stderr: "inherit" });
if (db.exitCode !== 0) process.exit(db.exitCode ?? 1);

for (const s of SUITES) {
  const r = Bun.spawnSync(
    ["bun", "test", ...s.args, "--coverage", "--coverage-reporter=lcov", `--coverage-dir=coverage/${s.name}`],
    { stdout: "inherit", stderr: "inherit" },
  );
  if (r.exitCode !== 0) {
    console.error(`Suite « ${s.name} » en échec : couverture non calculée.`);
    process.exit(r.exitCode ?? 1);
  }
}

// file -> ligne -> nombre d'exécutions (maximum sur toutes les suites)
const merged = new Map<string, Map<number, number>>();
for (const s of SUITES) {
  const path = `coverage/${s.name}/lcov.info`;
  if (!existsSync(path)) continue;
  let file = "";
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (line.startsWith("SF:")) {
      file = relative(root, resolve(root, line.slice(3))).replaceAll("\\", "/");
      if (!merged.has(file)) merged.set(file, new Map());
    } else if (line.startsWith("DA:") && file) {
      const [n, hits] = line.slice(3).split(",").map(Number);
      const lines = merged.get(file)!;
      lines.set(n!, Math.max(lines.get(n!) ?? 0, hits!));
    }
  }
}

type Row = { name: string; covered: number; total: number };
const rows: Row[] = [...merged]
  .filter(([f]) => f.startsWith("src/") && !f.startsWith("src/generated/"))
  .map(([name, lines]) => ({ name, total: lines.size, covered: [...lines.values()].filter((h) => h > 0).length }));

// Bun ne liste dans lcov que les fichiers CHARGÉS par au moins un test. Un fichier jamais importé (page, route, composant)
// serait donc absent sans qu'on le voie : on les liste et on affiche leur poids (lignes de code), sans les mêler au pourcentage.
const never: Row[] = [];
for (const f of new Glob("src/**/*.{ts,tsx}").scanSync({ cwd: root })) {
  const name = f.replaceAll("\\", "/");
  if (name.startsWith("src/generated/") || merged.has(name) || /\.(d|test)\.tsx?$/.test(name)) continue;
  const code = readFileSync(f, "utf8").split("\n").filter((l) => l.trim() && !/^\s*(\/\/|\/\*|\*)/.test(l)).length;
  if (code) never.push({ name, covered: 0, total: code });
}
const neverLines = never.reduce((n, r) => n + r.total, 0);

// Regroupé par dossier (src/lib, src/app/(backoffice)/stock, …) pour que le tableau reste lisible.
const groups = new Map<string, Row>();
for (const r of rows) {
  const dir = r.name.split("/").slice(0, -1).join("/");
  const g = groups.get(dir) ?? { name: dir, covered: 0, total: 0 };
  g.covered += r.covered;
  g.total += r.total;
  groups.set(dir, g);
}
const pct = (r: { covered: number; total: number }) => (r.total ? (100 * r.covered) / r.total : 100);
const all = rows.reduce((a, r) => ({ name: "Total", covered: a.covered + r.covered, total: a.total + r.total }), { name: "Total", covered: 0, total: 0 });

const table = [
  "| Dossier | Lignes couvertes | % |",
  "|---|---|---|",
  ...[...groups.values()].sort((a, b) => a.name.localeCompare(b.name)).map((g) => `| \`${g.name}\` | ${g.covered} / ${g.total} | ${pct(g).toFixed(1)} % |`),
  `| **Fichiers chargés par les tests** | **${all.covered} / ${all.total}** | **${pct(all).toFixed(1)} %** |`,
  `| ${never.length} fichiers jamais chargés (pages, formulaires, routes : vérifiés par les E2E, non mesurés) | 0 / ${neverLines} | n/a |`,
  `| Toutes les lignes de \`src\`, E2E non mesuré | ${all.covered} / ${all.total + neverLines} | ${((100 * all.covered) / (all.total + neverLines)).toFixed(1)} % |`,
].join("\n");
console.log(`\nCouverture fusionnée des trois suites (lignes)\n\n${table}\n`);

// Dans GitHub Actions, le tableau s'affiche sur la page du run.
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Couverture de code\n\n${table}\n`);

if (never.length) console.log(`Fichiers jamais chargés par un test unitaire, d'intégration ou de composant (pages : exercées par les E2E) : ${never.length}\n` + never.map((r) => `  ${r.name}`).join("\n") + "\n");
const worst = rows.filter((r) => r.total >= 10 && pct(r) < 50).sort((a, b) => pct(a) - pct(b)).slice(0, 8);
if (worst.length) console.log("Fichiers les moins couverts (< 50 %) :\n" + worst.map((r) => `  ${pct(r).toFixed(0).padStart(3)} %  ${r.name}`).join("\n") + "\n");

if (pct(all) < MIN_LINES) {
  console.error(`Couverture ${pct(all).toFixed(1)} % sous le seuil de ${MIN_LINES} %.`);
  process.exit(1);
}
