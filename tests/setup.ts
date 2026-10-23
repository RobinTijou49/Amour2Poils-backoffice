import { mock } from "bun:test";

// Chargé avant chaque fichier de test.
// `server-only` fait volontairement échouer tout import hors du rendu serveur de Next.js ; sous `bun test` il n'y a
// pas de rendu Next, il faut donc le neutraliser pour pouvoir importer `src/lib/*` (qui l'utilisent comme garde-fou).
mock.module("server-only", () => ({}));

// Fuseau fixé : les tests de dates ne doivent pas dépendre de la machine (poste Windows, GitHub Actions en UTC…).
process.env.TZ = "UTC";
