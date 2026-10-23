# Journal d'utilisation de l'IA

Outil : Claude Code. Ce journal sert à l'oral (thème 5, posture critique) : pour chaque usage notable,
ce qui a été demandé, ce que l'IA a produit, et ce qui a été vérifié ou corrigé.

| Date | Demande | Produit par l'IA | Vérifié / corrigé par moi |
|---|---|---|---|
| 2026-10-22 | Todo list du TP | Page de suivi avec les tâches par phase | À relire : tâches pertinentes ? |
| 2026-10-22 | Initialisation du projet | Next.js + Bun, Docker Postgres, schéma Prisma, seed, README, CLAUDE.md | À relire : schéma de données, choix des statuts |
| 2026-10-23 | Maquette Figma (serveur MCP Figma) | Variables, styles, 7 composants, 7 écrans desktop, 3 écrans mobiles | Contrastes recalculés ; défauts corrigés après capture : texte d'erreur rogné, boutons tronqués, avatars écrasés, onglet actif indiqué par la couleur seule. À relire : contenu des écrans |

| 2026-10-23 | Coder la maquette en Next.js | Composants UI, layout, 7 pages branchées sur Prisma, seed enrichi | Build cassé par `usePathname` hors `<Suspense>` sur la route dynamique (corrigé) ; « chiens présents » comptait les arrivées non enregistrées (corrigé) |
| 2026-10-23 | Authentification et rôles | Sessions en base, connexion/déconnexion, proxy, rôles | Choix de `cache()` de React au lieu de `use cache: private` (résultat gardé en mémoire en dev, risqué après une déconnexion) ; oubli de la déconnexion sur mobile repéré au test et corrigé |
| 2026-10-23 | Actions d'écriture des réservations | Règles métier, Server Actions, formulaire, détail, actions rapides | Formulaire vidé par React 19 après une erreur (valeurs renvoyées par l'action) ; titre d'onglet perdu après une action (`generateMetadata`) ; `usePathname` du menu mobile signalé au build (lu après la session) |
| 2026-10-23 | Clients, chiens et stock | Formulaire chien + propriétaire, vaccins, recherche, mouvements de stock en transaction | Test « puce en double » faussé : la puce de Rex n'existait que dans la maquette, pas en base (refait sur un vrai doublon) ; `typecheck` complété par `next typegen` pour les nouvelles routes |
| 2026-10-23 | Facturation et séances | Factures depuis séjours et séances, numérotation à l'envoi, impression, séances, inscriptions, présence | **Bug SQL trouvé au test** : `attended: { not: false }` excluait aussi les présences non notées (`NULL`), donc aucune séance n'était facturable ; ergonomie : bouton « Facturer » ajouté sur la séance ; élision « Séjour d'Oslo » |
| 2026-10-23 | Tableau de bord : actions | Entrée de stock depuis l'alerte « Stock bas », « Marquer payée » sur les factures à échéance (gérance), réutilisant les Server Actions existantes | Lint et typecheck passés ; non testé dans le navigateur (à faire) ; rôle déjà revérifié côté serveur, le bouton est seulement masqué aux employés |
| 2026-10-23 | API intégrée (mod-08) | Route Handlers `/api/reservations`, `/api/stock`, `/api/chiens`, services partagés avec les Server Actions (`booking-service`, `stock-service`), garde 401/403 + contrôle d'Origin, proxy qui répond 401 JSON sur `/api` | Premier jet de commande shell cassé (guillemets) : aucun fichier créé, refait à la main ; testé en curl avec une session temporaire (401, 403 origine, 422, 409 stock et capacité, 404) ; message Zod « Saisissez une quantité » trompeur au-delà de 10 000 (existant, à revoir) |

| 2026-10-23 | PWA : installable (pwa-01) | `manifest.ts`, icônes PNG générées par `next/og` (192, 512, maskable), `themeColor` clair/sombre, exclusion du manifeste et des icônes dans `proxy.ts` | Sans cette exclusion le manifeste redirigeait vers /connexion (non installable) ; icône relue à l'écran ; pas de captures d'écran dans le manifeste (à ajouter), audit Lighthouse PWA à faire sur build de production |

| 2026-10-23 | PWA : service worker (pwa-02) | `public/sw.js` écrit à la main (cache d'abord pour `/_next/static` et icônes, réseau d'abord + page `/offline` pour les navigations), enregistrement en production seulement, en-têtes `no-cache` sur `/sw.js` | **Choix contre le plan** : pas de Serwist ni de cache des pages, car elles contiennent des données clients lisibles après déconnexion ; les données hors ligne passeront par IndexedDB (pwa-03). Testé dans Chrome sur build de production : activation, cache, puis page hors connexion serveur coupé. Le navigateur intégré à l'app ne gère pas les service workers (faux négatif) |

| 2026-10-23 | PWA : mode hors connexion (pwa-03) | `/api/hors-ligne` (instantané du jour, sans adresse ni e-mail), IndexedDB (`kv` + `queue`), page `/offline` avec planning, fiches et boutons arrivée/départ, file rejouée via `PATCH /api/reservations/:id` (champ `at` = heure réelle du geste), synchro au retour du réseau, instantané effacé sur `/connexion` | **3 défauts trouvés au test réel (Chrome, build de production)** : un ancien `next start` occupait le port 3100 et servait l'ancienne version (EADDRINUSE passé inaperçu) ; le service worker précachait l'ancien HTML de `/offline` via le cache HTTP du navigateur (corrigé : `cache: "reload"`) ; les fichiers JS de `/offline` n'étaient pas préchargés. Libellé « Box Box 5 » corrigé. Limite connue : après un déploiement, `sw.js` doit changer (VERSION) pour renouveler la copie de `/offline`. Test : arrivée de Milo hors ligne, synchronisée avec l'heure du clic, donnée remise en état |

## Points d'attention relevés

- `bun add -d prisma` installait par défaut Prisma 8.0 en *release candidate* (tag `latest`), incompatible avec le client 7.10.1.
  La CLI a été fixée en 7.10.1.
- Un PostgreSQL installé sur Windows occupait déjà le port 5432 : le conteneur est exposé sur 5433.
- `prisma init` a ajouté des *skills* Prisma pour les agents IA dans `.agents/skills` et `.claude/skills` :
  conservés, ils servent d'exemple d'intégration de skills (thème 5).
- Le vert sauge du site vitrine ne passe pas le contraste AA pour du texte : un token `primary` plus foncé a été
  ajouté. Exemple d'une DA existante à corriger plutôt qu'à recopier.
- Dans la maquette, les premières captures ont révélé des défauts que le code généré ne signalait pas
  (aucune erreur à l'exécution) : la relecture visuelle reste indispensable.
