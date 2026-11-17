# Oral · Thème 6 : PWA, TWA, hybride et desktop

Support de présentation (≈ 10 minutes) : la question posée est « une PWA suffit-elle pour ce back-office, ou faut-il une
application native ou hybride ? ». Chaque affirmation sur *notre* projet renvoie à quelque chose de vérifié ; ce qui ne
l'est pas est dit en dernière partie.

## 1. Le contexte qui décide de tout

Le back-office sert à **un gérant et quelques employés** d'une pension canine. Usage terrain : enregistrer l'arrivée d'un
chien sur un téléphone, parfois **sans réseau** (cour, chenil), recevoir une alerte (stock bas, vaccins). Pas de
capteur exotique, pas de jeu, pas de paiement sur l'appareil. Distribution : **une poignée de personnes connues**, pas le
grand public.

## 2. Les cinq options, en une phrase chacune

| Option | Ce que c'est | Moteur d'affichage |
|---|---|---|
| **PWA** | Le site, installable (manifeste), avec service worker, hors ligne et notifications | Le navigateur de l'appareil |
| **TWA** (*Trusted Web Activity*) | La PWA **empaquetée pour le Play Store** (Android seulement) : une application dont l'écran est Chrome en plein écran, sans barre d'adresse | Chrome (donc mêmes capacités que la PWA) |
| **Capacitor** (ou Cordova) | Le site dans une WebView, avec des **plugins natifs** (caméra, fichiers, NFC…) ; iOS et Android | WebView du système |
| **React Native** | Interface **réellement native**, écrite en React ; le code web n'est pas réutilisé tel quel | Composants natifs |
| **Electron / Tauri** | Application **de bureau** : Electron embarque Chromium (≈ 100 Mo), Tauri utilise la WebView du système et du Rust (≈ 5 Mo) | Chromium / WebView |

À retenir : une **TWA n'ajoute aucune capacité** à la PWA, elle ajoute une *distribution* (présence dans le Play Store,
icône d'application « officielle »). Capacitor est la voie quand il manque une capacité web.

## 3. Comparaison

| Critère | PWA | TWA | Capacitor | React Native | Electron / Tauri |
|---|---|---|---|---|---|
| Code réutilisé du site | 100 % | 100 % | ~95 % (même site) | faible (interface à réécrire) | ~100 % (Electron), partiel (Tauri) |
| Mise à jour | Immédiate (déploiement du serveur) | Immédiate (le contenu est le site) ; le paquet ne change presque jamais | Contenu : immédiat si chargé depuis le serveur ; binaire : passage par les stores | Par les stores (ou mise à jour à distance type CodePush) | Mise à jour automatique à prévoir |
| Distribution | Un lien, « Ajouter à l'écran d'accueil » | Play Store | App Store + Play Store | App Store + Play Store | Installeur, ou stores desktop |
| Coût d'entrée | 0 € | **25 $ une fois** (compte développeur Google Play) | 25 $ + **99 $/an** (Apple Developer) | idem | Certificat de signature code (payant) pour éviter les alertes système |
| Revue par un tiers | Aucune | Revue Google Play | Revue Apple et Google | Revue Apple et Google | Aucune (hors stores) |
| Hors ligne | Oui (service worker, IndexedDB) | Oui (idem) | Oui (+ stockage natif) | Oui (+ stockage natif) | Oui |
| Notifications | Web Push (Android, bureau ; **iOS 16.4+ seulement installée**) | Web Push via Chrome | Natives (APNs, FCM) fiables | Natives | Natives du système |
| Capteurs / NFC / Bluetooth | Limité (Web NFC : Chrome Android seulement ; Web Bluetooth absent d'iOS) | Comme Chrome Android | **Oui via plugins** | **Oui** | Oui (accès système) |
| iOS | Oui, avec des limites (§4) | **Non** (Android uniquement) | Oui | Oui | Non |

Les prix sont ceux connus à la rédaction : à revérifier avant l'oral.

## 4. Les limites iOS, point faible d'une PWA

Ce sont les arguments qui font pencher vers Capacitor ou React Native :

- **Pas d'invite d'installation** : sur iPhone on installe à la main (Partager → « Sur l'écran d'accueil »). Pas d'événement `beforeinstallprompt`.
- **Notifications** : possibles depuis iOS 16.4, **uniquement si la PWA est installée** sur l'écran d'accueil, et demandées après un geste de l'utilisateur. Dans Safari « simple », rien.
- **Pas de Background Sync** : un envoi en attente ne repart pas tout seul, il faut que l'application soit ouverte (c'est le choix fait chez nous : la file hors ligne se rejoue au retour du réseau, application ouverte).
- **Capteurs** : pas de Web NFC ni de Web Bluetooth.
- **Stockage** : Safari efface les données d'un site non visité pendant ≈ 7 jours ; les PWA installées sont épargnées, d'où l'intérêt de l'installation.
- **Dépendance à Apple** : tout passe par WebKit, sans choix de moteur (le sujet a bougé avec le Digital Markets Act en Europe : à présenter comme évolutif).

## 5. Ce qu'on a réellement construit (preuves)

| Capacité | Réalisé | Preuve |
|---|---|---|
| Installable | Manifeste, icônes 192/512 maskable, `themeColor` clair et sombre | `src/app/manifest.ts`, test E2E « le manifeste est valide et ses icônes se chargent » |
| Hors ligne | `public/sw.js` **écrit à la main** (~100 lignes, push compris), pas de bibliothèque : cache-first pour `/_next/static` et icônes, réseau d'abord + page `/offline` pour les navigations, **jamais de cache des pages ni des API** (données clients) | Tests E2E hors connexion : service worker actif, page hydratée sans réseau |
| Données hors ligne | Instantané de la journée dans **IndexedDB**, arrivée/départ en file, rejoués avec **l'heure réelle du geste**, instantané effacé à la déconnexion | Test E2E : arrivée hors ligne puis synchronisation |
| Notifications | Web Push, clés VAPID, abonnements en base, 3 alertes (réservation, stock bas au franchissement du seuil, vaccins par GitHub Actions) | **Validé en production** sur Chrome PC et iPhone installé |
| Sécurité de l'ensemble | CSP à nonce, en-têtes, redirection ouverte du service worker corrigée | tâches sec-01 à sec-04 |

Choix à défendre : **service worker maison plutôt que Serwist/Workbox**. Avantage : chaque ligne relisible, comportement
exact voulu (rien de sensible mis en cache). Coût : il faut **changer `VERSION`** dans `sw.js` à chaque déploiement qui
modifie les ressources mises en cache, sinon les anciens caches restent.

## 6. Ma recommandation

1. **PWA** : suffisante ici. Une capacité de plus (caméra, NFC) n'est pas demandée, les utilisateurs sont connus et peuvent installer l'application, le déploiement continu du site *est* la mise à jour.
2. **TWA** si le gérant veut une icône « installée depuis le Play Store » sur Android : faisable sans toucher au code (outils : Bubblewrap ou PWABuilder) ; il faut publier `/.well-known/assetlinks.json` sur le domaine (lien de confiance entre l'application et le site) et payer 25 $. **Pas construite ici.**
3. **Capacitor** seulement si un besoin natif apparaît (par exemple lecture NFC de la puce d'un chien sur iPhone). On réutiliserait l'interface telle quelle.
4. **React Native** : écarter, il faudrait réécrire toute l'interface pour un gain qu'on ne mesure pas ici.
5. **Electron/Tauri** : écarter, aucun besoin de bureau (le navigateur suffit au poste de la gérante) ; Tauri serait le choix si on y tenait (léger).

Critère de décision à énoncer : **on n'ajoute une couche native que pour une capacité qu'aucune API web ne donne**, car
chaque couche ajoute un coût de revue, de compte développeur et de mise à jour.

## 7. Démonstration conseillée (3 minutes)

1. Sur le téléphone, ouvrir `https://amour2poils.duckdns.org` : montrer l'application installée (sans barre d'adresse).
2. Couper le réseau (mode avion), ouvrir la journée, **enregistrer une arrivée** : message « synchronisée au retour du réseau ».
3. Rétablir le réseau : la file se rejoue, l'arrivée apparaît au tableau de bord.
4. Depuis le PC, déclencher un mouvement de stock sous le seuil : la notification « Stock bas » arrive sur le téléphone (tâche oral-03).

À préparer **avant** de passer : téléphone connecté, notifications activées, un produit juste au-dessus de son seuil,
et un plan B en vidéo si le réseau de la salle fait défaut.

## 8. Ce qui n'est pas fait ni vérifié (à dire plutôt qu'à cacher)

- **TWA non construite** ni testée ; la partie ci-dessus décrit la méthode, pas un résultat.
- **Android non testé** physiquement (notifications validées sur Chrome PC et iPhone ; le moteur Chrome est le même mais ce n'est pas une preuve).
- **Audit Lighthouse PWA** non lancé.
- **Purge d'un abonnement push expiré** : code écrit, non testé en vrai.
- **Mode hors ligne sur iPhone** : vérifié côté code et en navigateur de bureau, pas détaillé lors du test téléphone.
- Prix des comptes développeur et position d'Apple sur les PWA en Europe : à revérifier la veille.

## 9. Questions probables

- **« Pourquoi pas une application native ? »** Aucune capacité native demandée ; la PWA donne l'installation, le hors-ligne et les notifications, avec une seule base de code et un déploiement immédiat.
- **« Les notifications marchent sur iPhone ? »** Oui depuis iOS 16.4, à condition d'installer la PWA ; nous l'avons validé en production.
- **« Qu'est-ce qu'une TWA, concrètement ? »** Une application Android minimale qui ouvre ton site dans Chrome en plein écran, après vérification que tu possèdes le domaine (Digital Asset Links). C'est de la distribution, pas une capacité.
- **« Et si le service worker met en cache une donnée sensible ? »** Choix assumé : les pages et les API ne sont jamais mises en cache ; seul un instantané de la journée est en IndexedDB, effacé à la déconnexion.
- **« Pourquoi pas Workbox ? »** Une centaine de lignes relisibles (cache, hors ligne, push) suffisent ; une bibliothèque de plus ajoute du code que je ne saurais pas défendre ligne à ligne.
