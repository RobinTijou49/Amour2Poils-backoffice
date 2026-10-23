# Audit sécurité : autorisation et validation côté serveur (sec-06)

Réalisé le 23/10/2026 en lisant chaque Server Action et chaque Route Handler, puis en testant les rôles avec de vraies
sessions (un compte gérant et un compte employé sur la base locale). Règle de l'application : **aucune confiance dans
l'interface** : masquer un bouton ne protège rien, chaque action revérifie la session, le rôle et les données.

## Server Actions (formulaires)

| Fichier · action | Session | Rôle | Validation | Remarques |
|---|---|---|---|---|
| `connexion` · `login` | publique | n/a | Zod (e-mail ≤ 254, mot de passe ≤ 200) | 5 échecs / 15 min par e-mail, hash factice si le compte n'existe pas (temps constant), message identique dans les deux cas, ménage des sessions expirées et anciennes tentatives |
| `connexion` · `logout` | oui (jeton du cookie) | tous | n/a | supprime la session en base |
| `reservations` · `createBooking` | oui | tous | Zod (dates, tarif ≤ 500, notes ≤ 500) + capacité de la box | |
| `reservations` · `confirmBooking`, `checkIn`, `checkOut` | oui | tous | transitions de statut vérifiées (`canTransition`) | identifiant inconnu → erreur propre |
| `reservations` · `cancelBooking` | oui | **gérance** | transition vérifiée | testé : employé refusé |
| `chiens` · `saveDog` | oui | tous | Zod (longueurs max, sexe, poids ≤ 120) + unicité puce / e-mail | **corrigé** : identifiant de fiche ou de propriétaire inexistant plantait (500) |
| `chiens` · `addVaccination`, `deleteVaccination` | oui | tous | Zod / `deleteMany` (sans levée d'erreur) | choix métier : les employés gèrent les vaccins |
| `chiens` · `deleteDog` | oui | **gérance** | refus s'il a des séjours ou séances | |
| `stock` · `recordMovement` | oui | tous | Zod (entier 0 à 10 000), stock jamais négatif, transaction | alerte push au franchissement du seuil |
| `stock` · `createProduct` | oui | **gérance** | Zod + nom unique | page `/stock/nouveau` : 403 pour un employé |
| `seances` · `createSession`, `enrollDog`, `unenroll` | oui | tous | Zod, capacité contrôlée en transaction | |
| `seances` · `setAttendance` | oui | tous | booléen | **corrigé** : inscription inconnue plantait (500) |
| `facturation` · 5 actions | oui | **gérance** (`requireAdmin`) | Zod (quantité ≤ 1000, prix ≤ 100 000), transitions de statut, brouillon seulement pour les lignes | numérotation sans trou dans une transaction |

## Pages réservées

| Page | Contrôle | Résultat testé (employé / gérant) |
|---|---|---|
| `/facturation`, `/facturation/[id]` | `requireRole("ADMIN")` au début de la page **et** dans les requêtes (`queries.ts`) | **403** / 200 |
| `/stock/nouveau` | `requireRole("ADMIN")` | **403** / 200 |
| autres pages du back-office | `getCurrentUser()` (redirection vers `/connexion`) | 200 / 200 |

Avant correction, ces pages renvoyaient 200 à l'employé : la vérification se faisait dans un `<Suspense>`, donc après
l'envoi de l'en-tête. Aucune donnée n'en fuyait (0 numéro de facture dans le HTML de l'employé contre 5 pour le gérant),
mais le code HTTP était trompeur ; il est maintenant exact.

## Route Handlers (API JSON)

| Route | Session | Rôle | Contrôles |
|---|---|---|---|
| `GET /api/reservations` | oui | tous | statut validé par Zod |
| `POST /api/reservations` | oui | tous | origine, JSON obligatoire, Zod, capacité |
| `PATCH /api/reservations/[id]` | oui | `cancel` : **gérance** | origine, JSON, Zod, transition ; `at` plausible (pas dans le futur, ≤ 7 jours) |
| `GET /api/stock`, `GET /api/chiens`, `GET /api/hors-ligne` | oui | tous | lecture seule, `hors-ligne` sans adresse ni e-mail |
| `POST /api/stock/[id]/mouvements` | oui | tous | origine, JSON, Zod, stock ≥ 0 |
| `GET /api/push/cle` | oui | tous | clé publique seulement |
| `POST`, `DELETE /api/push/abonnement` | oui | tous | origine, JSON, Zod (URL https), suppression limitée à ses propres abonnements |
| `POST /api/push/rappels-vaccins` | **secret** `CRON_SECRET` | n/a | comparaison en temps constant, secret ≥ 24 caractères (validé au démarrage) |
| `POST /api/csp-report` | publique | n/a | corps ≤ 8 Ko, champs tronqués, rien de stocké |
| `GET /api/health` | publique | n/a | ne renvoie que `ok` / `down` |

Sans cookie de session, `/api/*` répond 401 en JSON (`src/proxy.ts`). Les écritures vérifient `Sec-Fetch-Site`, `Origin` et
`Content-Type: application/json` (voir CSRF dans le journal IA).

## Limites connues (assumées)

- **Verrouillage par e-mail** : après 5 échecs, le compte est bloqué 15 minutes ; un inconnu peut donc empêcher
  quelqu'un de se connecter en essayant son adresse (déni de service ciblé). Pas de limite par adresse IP : derrière les deux
  reverse proxies, l'IP vue par l'application n'est pas fiable et un en-tête `X-Forwarded-For` pourrait être forgé.
- **Pas de changement de mot de passe** dans l'interface (le compte se recrée avec `prisma/create-admin.ts`).
- **Pas de journal d'audit** des actions sensibles (qui a annulé, supprimé, facturé) : seuls les mouvements de stock gardent leur auteur.
- Un employé peut lire toutes les fiches (clients, vaccins, séjours) : voulu, c'est son métier, mais pas de cloisonnement par client.
