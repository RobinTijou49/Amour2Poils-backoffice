# Amour 2 Poils · Back-office

Back-office de gestion de la pension canine **Amour 2 Poils** (éducation positive, pension et petsitting).
Projet réalisé dans le cadre du TP de Front-end avancé (M1).

Site vitrine existant, dont ce back-office reprend la direction artistique : <https://robintijou49.github.io/Amour2Poils/>

---

## Phase 1 · Choix et préparation

### Identité

| | |
|---|---|
| **Nom** | Robin Tijou |
| **Dépôt** | <https://github.com/RobinTijou49/Amour2Poils-backoffice> |
| **IA utilisée** | Claude Code (Anthropic) |
| **Méta-framework** | Next.js 16 (App Router) + TypeScript |
| **Interpréteur ECMAScript** | Bun 1.4 |
| **Base de données** | PostgreSQL 17 + Prisma ORM 7 |
| **Thème présenté à l'oral** | Thème 6 · PWA et ses possibilités |

### Thématique

Amour 2 Poils accueille des chiens en pension, fait du petsitting à domicile et donne des cours d'éducation
positive. Aujourd'hui, le site vitrine présente l'activité mais toute la gestion se fait à la main
(agenda papier, tableur, messages). Le back-office centralise cette gestion.

**Utilisateurs**

- **Gérant·e (rôle ADMIN)** : accès complet, facturation, paramétrage des boxes et des tarifs.
- **Employé·e (rôle EMPLOYEE)** : planning du jour, arrivées et départs, fiches des chiens, sorties de stock.
  Utilise surtout un téléphone, parfois sans réseau dans les espaces extérieurs.

**Problèmes réglés**

- Savoir en un coup d'œil quels chiens arrivent, partent ou sont présents aujourd'hui, et quelles boxes sont libres.
- Avoir sous la main les informations sensibles de chaque chien : allergies, régime, comportement, vétérinaire,
  vaccins à jour ou non.
- Ne plus tomber en rupture de croquettes : suivi du stock et alerte de seuil bas.
- Facturer les séjours et les séances sans ressaisie.

### Fonctionnalités par module

| Module | Indispensable | Bonus |
|---|---|---|
| **Réservations pension** | Calendrier des séjours, attribution d'une box, statuts (en attente, confirmée, en cours, terminée, annulée), check-in / check-out, refus si la box est pleine | Glisser-déposer dans le planning (avec alternative clavier), tarif dégressif |
| **Clients et chiens** | Fiches propriétaires et chiens, vaccins avec date d'expiration, allergies, régime, notes de comportement, vétérinaire | Photos, historique des séjours par chien |
| **Stock** | Produits, entrées / sorties, seuil d'alerte, historique des mouvements | Sortie automatique des repas selon les chiens présents |
| **Facturation** | Facture générée depuis une réservation ou une séance, numérotation, statut de paiement | Export PDF, paiement en ligne (mode test) |
| **Séances éducation et petsitting** | Planning des cours (particulier, collectif, puppy class) et des visites, inscriptions | Feuille de présence |
| **Tableau de bord** | Arrivées / départs du jour, taux d'occupation, alertes stock et vaccins | Graphiques mensuels |
| **PWA** | Installable, planning du jour et fiches chiens hors connexion, notifications push (nouvelle réservation, stock bas, vaccin expiré) | Check-in hors ligne synchronisé au retour du réseau |

### Modèle de données

Défini dans [`prisma/schema.prisma`](prisma/schema.prisma).

```mermaid
erDiagram
  Owner ||--o{ Dog : possède
  Owner ||--o{ Invoice : reçoit
  Dog ||--o{ Vaccination : a
  Dog ||--o{ Booking : séjourne
  Kennel ||--o{ Booking : accueille
  Dog ||--o{ Enrollment : participe
  TrainingSession ||--o{ Enrollment : contient
  Invoice ||--o{ InvoiceLine : détaille
  Booking ||--o{ InvoiceLine : facturé
  Enrollment ||--o{ InvoiceLine : facturé
  Product ||--o{ StockMovement : mouvemente
  User ||--o{ StockMovement : saisit
```

Les montants sont en centimes (`Int`) pour éviter les erreurs d'arrondi des nombres flottants.

### Justification des choix techniques

- **Next.js** : le méta-framework le plus utilisé. Il permet dans une même application le rendu côté client,
  côté serveur, statique et les Server Components, ce qui est nécessaire pour la comparaison CSR / SSR / SSG de la
  phase 3. Le backend intégré (Route Handlers et Server Actions) suffit pour l'API du back-office.
- **Bun** : interpréteur rapide, TypeScript exécuté sans étape de compilation, gestionnaire de paquets et test runner
  intégrés, hachage de mots de passe argon2id natif (`Bun.password`). Next.js est lancé avec `bun --bun` pour
  utiliser réellement Bun comme runtime, pas seulement comme gestionnaire de paquets.
- **PostgreSQL + Prisma** : base relationnelle adaptée aux relations du domaine (clients, chiens, séjours, factures),
  schéma typé et migrations versionnées. Prisma 7 se connecte via l'adaptateur `@prisma/adapter-pg`.
  La CLI est fixée en 7.10.1 : le tag `latest` de npm pointe vers une version 8 en release candidate.
- **Tailwind CSS 4** : les tokens de la DA du site vitrine sont déclarés une fois dans
  [`globals.css`](src/app/globals.css) et réutilisés partout.
- **Claude Code** : utilisé pour le scaffolding, la revue de code et le refactoring. Les règles de travail sont dans
  [`CLAUDE.md`](CLAUDE.md) et chaque usage notable est consigné dans le [journal IA](docs/journal-ia.md).

---

## Phase 2 · Maquette Figma

Maquette : <https://www.figma.com/design/2ju0WFXMpBtETVELEKz6Ee>

| Page Figma | Contenu |
|---|---|
| **Design system** | Palette clair / sombre avec ratios de contraste, échelle typographique, 17 icônes, composants (Bouton, Champ, Badge, Élément de menu, Carte KPI, Avatar chien, Barre latérale) |
| **Écrans · Desktop** (1440 × 900) | Connexion, Tableau de bord, Réservations (planning des boxes), Fiche chien, Stock, Facturation, Séances |
| **Écrans · Mobile** (390 × 844) | Journée en mode hors connexion, Enregistrement d'une arrivée, Fiche chien |

**Choix de design**

- La DA du site vitrine est conservée (crème, sauge, brun, Quicksand + Nunito). Les variables Figma portent
  les mêmes noms que les variables CSS de [`globals.css`](src/app/globals.css) : la maquette et le code
  partagent une seule source de tokens.
- **Contraste** : le vert sauge du site (`#6f7f64`) n'atteint que 4,2:1 sur le fond, sous le seuil AA de 4,5:1.
  Le back-office utilise un `primary` assombri (`#5f6e55`, 5,3:1 ; texte blanc dessus 5,5:1). Tous les couples
  texte / fond de statut dépassent 5:1. La bordure des champs (`border-strong`) atteint 3:1 (WCAG 1.4.11).
- **Accessibilité intégrée dès la maquette** : boutons et champs de 44 px de haut (WCAG 2.5.8), étiquettes
  toujours visibles, statuts écrits en toutes lettres et pas seulement en couleur (WCAG 1.4.1), onglet actif
  signalé par un fond et pas seulement par la couleur du texte.
- **Mobile terrain** : les écrans mobiles anticipent la PWA (bandeau hors connexion, arrivée enregistrée
  sans réseau puis synchronisée).
- **Limites du plan Figma gratuit** : 3 pages maximum et un seul mode par collection de variables.
  Le thème sombre est donc une seconde collection « Couleurs · Sombre » au lieu d'un mode.

### De la maquette au code

| Route | Écran |
|---|---|
| `/` | Tableau de bord |
| `/reservations?semaine=AAAA-MM-JJ` | Planning des boxes |
| `/chiens`, `/chiens/[id]` | Liste et fiche chien |
| `/stock`, `/facturation`, `/seances` | Stock, factures, séances |
| `/connexion` | Connexion (visuel, l'authentification arrive ensuite) |

- Composants dans [`src/components/ui`](src/components/ui), un par composant Figma (Bouton, Champ, Badge, Carte, Tableau, Icônes).
- Coquille commune dans le route group [`src/app/(backoffice)`](src/app/(backoffice)/layout.tsx) : lien
  « Aller au contenu », barre latérale sur desktop, barre d'onglets en bas sur mobile, `aria-current="page"`.
- Données lues avec Prisma dans des Server Components ([`src/lib/queries.ts`](src/lib/queries.ts)).
  Chaque requête appelle `connection()` et s'affiche dans un `<Suspense>` : la coquille est streamée, puis les données.
  `cacheComponents` (prérendu partiel) a été **désactivé en phase Sécurité** : une page prérendue au build n'a pas de
  nonce, donc ses scripts seraient bloqués par une CSP stricte. Le layout racine appelle `connection()` : toutes les pages
  sont rendues à la demande, ce qui permet à Next d'ajouter le nonce de `src/proxy.ts` à chaque `<script>`.

### Réservations : cycle de vie

```mermaid
stateDiagram-v2
  [*] --> PENDING : demande sans box
  [*] --> CONFIRMED : demande avec box
  PENDING --> CONFIRMED : box attribuée
  CONFIRMED --> CHECKED_IN : arrivée
  CHECKED_IN --> COMPLETED : départ
  PENDING --> CANCELLED : annulation (gérance)
  CONFIRMED --> CANCELLED : annulation (gérance)
```

- Règles métier pures dans [`src/lib/bookings.ts`](src/lib/bookings.ts) : transitions autorisées, nuits, contrôle de
  capacité nuit par nuit (une box de 2 places accepte deux séjours qui se chevauchent, pas trois).
- Server Actions dans [`reservations/actions.ts`](src/app/(backoffice)/reservations/actions.ts) : session vérifiée,
  entrées validées avec Zod, transition revérifiée côté serveur, puis `refresh()` pour mettre l'écran à jour.
- Écrans : `/reservations/nouvelle` (formulaire, erreurs reliées aux champs, saisie conservée en cas d'erreur),
  `/reservations/[id]` (détail et actions selon le statut, annulation confirmée dans la page), boutons
  « Arrivée » / « Départ » directement dans le tableau de bord.

### Clients, chiens et stock

- **Chiens** : `/chiens/nouveau` et `/chiens/[id]/modifier` partagent un seul formulaire
  ([`dog-form.tsx`](src/app/(backoffice)/chiens/dog-form.tsx)). Le propriétaire peut être créé dans le même
  formulaire : une **transaction** Prisma crée le propriétaire et le chien ensemble, ou rien. Numéro de puce et
  e-mail du client vérifiés avant l'écriture (message sur le bon champ).
- **Vaccins** ajoutés ou supprimés depuis la fiche ; les vaccins expirés remontent dans les alertes du tableau de bord.
- **Suppression d'un chien** : gérance uniquement, et refusée s'il a des séjours ou des séances (historique de facturation).
- **Recherche** `/chiens?q=` : formulaire GET, sans JavaScript, sur le nom du chien ou du propriétaire.
- **Stock** : `/stock/[id]` enregistre entrées, sorties et inventaires dans une transaction (mouvement + quantité) ;
  une sortie ne peut pas rendre le stock négatif ; l'historique indique qui a fait chaque mouvement.
  Création de produit réservée à la gérance.
- Utilitaires partagés par toutes les actions : [`src/lib/forms.ts`](src/lib/forms.ts).

### Facturation et séances

- **Facture d'un séjour** : bouton « Créer la facture du séjour » sur le détail d'une réservation (gérance) ;
  un séjour ne peut pas être facturé deux fois.
- **Facture des séances** : bouton « Facturer » sur une séance ; regroupe toutes les séances non facturées
  du client, sauf celles où le chien était noté absent.
- **Cycle** : brouillon → envoyée → payée (ou annulée). Le numéro définitif `F-AAAA-NNNN` n'est attribué
  qu'à l'envoi, dans une transaction : pas de trou dans la numérotation. Règles pures dans
  [`src/lib/invoices.ts`](src/lib/invoices.ts).
- **Impression / PDF** : la page `/facturation/[id]` masque la navigation à l'impression (`print:hidden`) ;
  le navigateur l'enregistre en PDF, sans bibliothèque.
- **Séances** : `/seances/nouvelle` (heure saisie à Paris, convertie en UTC en tenant compte de l'heure d'été),
  `/seances/[id]` (inscriptions avec contrôle des places dans une transaction, présence notée après la séance).

### Authentification et rôles

Sessions maison, sans bibliothèque, pour maîtriser et expliquer chaque mécanisme :

| Mécanisme | Où | Pourquoi |
|---|---|---|
| Mot de passe haché en argon2id (`Bun.password`) | [`actions.ts`](src/app/connexion/actions.ts), seed | Un mot de passe n'est jamais stocké en clair |
| Jeton de session aléatoire (32 octets), seule son empreinte SHA-256 en base | [`session.ts`](src/lib/session.ts) | Une fuite de la base ne permet pas d'usurper une session |
| Cookie `HttpOnly`, `SameSite=Lax`, `Secure` en production, 7 jours | [`session.ts`](src/lib/session.ts) | Illisible par JavaScript (XSS), non envoyé par les formulaires d'autres sites (CSRF) |
| Message d'erreur identique et temps de vérification constant | [`actions.ts`](src/app/connexion/actions.ts) | Ne révèle pas si une adresse e-mail a un compte |
| 5 échecs maximum en 15 minutes par adresse | table `LoginAttempt` | Freine les attaques par force brute |
| `proxy.ts` : redirection si pas de cookie | [`proxy.ts`](src/proxy.ts) | Vérification rapide, mais **pas** une sécurité |
| Vérification de la session dans chaque lecture de données | [`auth.ts`](src/lib/auth.ts), [`queries.ts`](src/lib/queries.ts) | Data Access Layer : aucune donnée sans utilisateur connecté |
| Rôles : Facturation réservée à la gérance (`forbidden()` → page 403) | [`auth.ts`](src/lib/auth.ts) | L'employé ne voit ni le lien ni les données |

Comptes de développement créés par le seed : voir `SEED_ADMIN_*` et `SEED_EMPLOYEE_*` dans `.env`.

---

## Lancer le projet

Prérequis : [Bun](https://bun.sh) ≥ 1.4 et Docker Desktop.

```bash
cp .env.example .env      # puis adapter les valeurs si besoin
bun install               # génère aussi le client Prisma
bun run db:up             # lance PostgreSQL (port 5433)
bun run db:migrate        # applique les migrations
bun run db:seed           # données de démonstration fictives
bun run dev               # http://localhost:3000
```

Vérifier que l'API et la base répondent : <http://localhost:3000/api/health>

### Scripts

| Script | Rôle |
|---|---|
| `dev` / `build` / `start` | Next.js exécuté par Bun |
| `lint` / `typecheck` | ESLint et vérification TypeScript |
| `db:up` / `db:down` | Démarre ou arrête PostgreSQL (Docker) |
| `db:migrate` | Crée et applique une migration après modification du schéma |
| `db:generate` | Régénère le client Prisma |
| `db:seed` / `db:reset` | Remplit la base / la réinitialise |
| `db:studio` | Interface Prisma Studio |

## Déploiement (VPS, Docker, Caddy)

L'application tourne dans trois conteneurs (`docker-compose.prod.yml`) : Caddy (seul port publié : **8082**, car 8080 est déjà pris sur le VPS), l'application Next.js (sous Bun) et PostgreSQL (volume persistant, aucun port exposé). Les images sont construites par GitHub Actions et publiées sur GHCR ; le déploiement part du pipeline (`.github/workflows/ci.yml`), jamais depuis un poste avec un mot de passe.

**Mise en place (une seule fois)**

1. Sur le poste : `deploy/vps-bootstrap.sh` et `.env.production` (généré en local, jamais commité) sont copiés sur le VPS, puis le script est lancé : il vérifie Docker et le port, crée le dossier de déploiement, installe `.env.production` (droits 600) et autorise la clé de déploiement.
2. Dans GitHub (Settings, Secrets and variables, Actions) : `SSH_HOST`, `SSH_USER`, `SSH_KEY` (clé privée dédiée), et si besoin `SSH_PORT`. Créer l'environnement `production`.
3. Un push sur `main` lance : lint, typecheck, build, publication des images, déploiement, contrôle de `/api/health`.
4. Premier compte gérant (le seed efface tout, il n'est pas utilisable en production) :

```bash
cd ~/amour2poils
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm   -e ADMIN_EMAIL=... -e ADMIN_NAME=... -e ADMIN_PASSWORD=... migrate bun prisma/create-admin.ts
```

**HTTPS** : le VPS héberge un autre projet (`salon2danse`) dont le Caddy tient déjà les ports 80 et 443, et le port 8082 est filtré depuis l'extérieur. Le site est donc publié sur `https://amour2poils.duckdns.org` (sous-domaine DuckDNS pointant sur le VPS) : un bloc ajouté à la main au `Caddyfile` de `salon2danse` envoie ce nom vers notre Caddy (`172.17.0.1:8082`), et Let's Encrypt fournit le certificat. HTTPS est requis pour l'installation de la PWA et les notifications push. Limite : ce `Caddyfile` est suivi par Git dans l'autre projet ; la sauvegarde d'origine est dans `~/amour2poils/Caddyfile.salon2danse.bak`, et un `git pull` échouera (sans rien écraser) si ce fichier change en amont.

**Rappels de vaccins** : le VPS n'a pas de `cron` utilisable sans droits root ; le workflow `.github/workflows/rappels.yml` appelle chaque matin (7 h UTC) `POST /api/push/rappels-vaccins` avec le secret GitHub `CRON_SECRET` (identique à celui de `.env.production`). Lancement manuel possible : onglet Actions, « Rappels de vaccins », Run workflow.

## Sécurité

Détail et décisions dans [docs/journal-ia.md](docs/journal-ia.md) ; audit des accès dans [docs/audit-securite.md](docs/audit-securite.md).

| Sujet | Mise en œuvre |
|---|---|
| **CSP** | `src/proxy.ts` : nonce aléatoire par requête, `script-src 'self' 'nonce-…' 'strict-dynamic'` sans `unsafe-inline`, `object-src 'none'`, `frame-ancestors 'none'`, `form-action 'self'`. Rapports de violation : `POST /api/csp-report`. `cacheComponents` est désactivé pour que chaque page soit rendue à la demande (sinon pas de nonce). `style-src` garde `unsafe-inline` (attributs `style=`). |
| **En-têtes** | `next.config.ts` : HSTS, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, COOP ; CSP propre à `sw.js`. |
| **Secrets** | `.env` jamais commité ; variables validées au démarrage (`src/lib/env.ts`, `src/instrumentation.ts`) ; la CI échoue si un secret ou un `.env` se retrouve dans le code client ou la sortie autonome ; secrets GitHub pour SSH et le cron. |
| **XSS** | React échappe tout ; aucun `dangerouslySetInnerHTML` ; charges malveillantes testées sur 8 écrans ; CSP en seconde ligne ; redirection ouverte du service worker corrigée. |
| **CSRF** | Cookie `HttpOnly`, `Secure`, `SameSite=Lax` ; Server Actions : contrôle `Origin`/`Host` de Next ; API : `Sec-Fetch-Site`, `Origin` et JSON obligatoire (pas de jeton synchronisé, choix documenté). |
| **Autorisation** | Session et rôle revérifiés dans chaque action et chaque route ; pages gérance en vrai 403 ; mots de passe argon2id ; 5 échecs / 15 min par e-mail. |
| **Dépendances** | `bun audit` bloquant en CI (une exception justifiée et datée) ; Dependabot hebdomadaire (bun, GitHub Actions, Docker) et alertes de sécurité activées ; *secret scanning* et protection au push activés. |

## Tests

Trois suites, trois commandes, toutes branchées en CI (`.github/workflows/ci.yml`). Total : 451 tests.

| Commande | Suite | Ce qu'elle exerce |
|---|---|---|
| `bun run test` | **Unitaires** (`src/**/*.test.ts`, 221 tests, ~0,2 s) | Règles métier pures, schémas Zod, dates, sécurité (CSRF, CSP, garde d'API), synchronisation hors ligne. Aucune base. |
| `bun run test:db` puis `bun run test:int` | **Intégration** (`tests/integration`, 164 tests, ~15 s) | Les vrais Route Handlers et Server Actions, branchés sur une **vraie base PostgreSQL de test** : droits, validation, transactions, notifications, **accès simultanés**. |
| `bun run test:components` | **Composants** (`tests/components`, 66 tests) | Testing Library + happy-dom : étiquettes et annonces pour lecteurs d'écran, formulaires, bouton de notifications, page hors connexion. |
| `bun run test:all` | Les trois | |

**Base de test** : `amour2poils_test`, sur le même serveur Postgres que le développement (`bun run db:up`), créée et migrée par
`bun run test:db`. Garde-fou : les tests vident les tables, donc ils **refusent** toute base dont le nom ne finit pas par `_test`.
En CI, un conteneur PostgreSQL jetable remplace le serveur local (`TEST_DATABASE_URL`).

**Ce qui est réel, ce qui est simulé** (`tests/integration/setup.ts`) : la base, Prisma, les sessions (ligne en base + jeton haché),
Zod, les règles métier sont réels. Sont remplacés : les cookies de Next (`next/headers`), le rafraîchissement de page
(`next/cache`) et l'envoi de notifications push (enregistré au lieu d'être envoyé).

**Pourquoi des tests de concurrence** : ils lancent plusieurs requêtes en même temps sur la vraie base. Ils ont révélé que le stock,
les places de séance, les boxes et la numérotation des factures reposaient sur « lire puis écrire » sans verrou (voir journal IA).

## Structure

```
prisma/              schéma, migrations, seed
src/app/             routes Next.js (pages et API)
src/lib/             code serveur partagé (client Prisma…)
src/generated/       client Prisma généré (non versionné)
docs/                suivi du projet (todo list, journal IA)
```

## Suivi

- Todo list du TP : <https://claude.ai/artifact/RJq6bfB3CYz1hfetKG7qG3> (source : [`docs/todo-tp.html`](docs/todo-tp.html))
- Journal d'utilisation de l'IA : [`docs/journal-ia.md`](docs/journal-ia.md)
