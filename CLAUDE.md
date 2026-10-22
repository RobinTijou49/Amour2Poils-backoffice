@AGENTS.md

# Amour 2 Poils · Back-office

Back-office d'une pension canine (TP M1 Front-end avancé). Voir README.md pour le contexte et les choix.

## Stack

- Next.js 16 App Router, TypeScript strict, `cacheComponents` activé. Lire `node_modules/next/dist/docs/` avant d'utiliser une API Next.
- Runtime Bun : toujours `bun` / `bunx`, jamais npm. Les scripts Next et Prisma passent par `bun --bun` pour que `.env` soit chargé.
- PostgreSQL (Docker, port hôte 5433) + Prisma 7 avec `@prisma/adapter-pg`. Client généré dans `src/generated/prisma`, importé via `@/generated/prisma/client`.
- Tailwind CSS 4, tokens de la DA dans `src/app/globals.css` (`sage`, `brown`, `background-alt`, `font-heading`…). Ne pas introduire d'autres couleurs.

## Commandes

- `bun run dev`, `bun run build`, `bun run lint`, `bun run typecheck`
- `bun run db:up`, `bun run db:migrate`, `bun run db:seed`, `bun run db:studio`

## Conventions

- Interface et textes en français, code (noms de variables, modèles) en anglais.
- Montants en centimes (`Int`), jamais en flottant.
- Accès base uniquement côté serveur via `@/lib/prisma` (protégé par `server-only`).
- Toute entrée utilisateur est validée avec Zod côté serveur, et chaque action vérifie la session et le rôle.
- Accessibilité WCAG 2.2 AA : labels, focus visible, cibles ≥ 24 px, navigation clavier.
- Pas de secret dans le code : tout passe par `.env` (modèle dans `.env.example`).

## Travail avec l'IA

- Expliquer ce qui est généré : l'étudiant doit pouvoir relire et défendre chaque ligne.
- Après une modification : `bun run lint` et `bun run typecheck`, puis les tests quand ils existeront.
- Noter les usages importants dans `docs/journal-ia.md` (ce qui a été demandé, généré, corrigé).
