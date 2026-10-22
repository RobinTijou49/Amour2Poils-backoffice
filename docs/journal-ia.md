# Journal d'utilisation de l'IA

Outil : Claude Code. Ce journal sert à l'oral (thème 5, posture critique) : pour chaque usage notable,
ce qui a été demandé, ce que l'IA a produit, et ce qui a été vérifié ou corrigé.

| Date | Demande | Produit par l'IA | Vérifié / corrigé par moi |
|---|---|---|---|
| 2026-10-22 | Todo list du TP | Page de suivi avec les tâches par phase | À relire : tâches pertinentes ? |
| 2026-10-22 | Initialisation du projet | Next.js + Bun, Docker Postgres, schéma Prisma, seed, README, CLAUDE.md | À relire : schéma de données, choix des statuts |

## Points d'attention relevés

- `bun add -d prisma` installait par défaut Prisma 8.0 en *release candidate* (tag `latest`), incompatible avec le client 7.10.1.
  La CLI a été fixée en 7.10.1.
- Un PostgreSQL installé sur Windows occupait déjà le port 5432 : le conteneur est exposé sur 5433.
- `prisma init` a ajouté des *skills* Prisma pour les agents IA dans `.agents/skills` et `.claude/skills` :
  conservés, ils servent d'exemple d'intégration de skills (thème 5).
