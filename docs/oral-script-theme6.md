# Oral · Thème 6 : la PWA et ses possibilités (≈ 18 min, centré sur le hors ligne)

Support Canva : https://canva.link/wk1ebf6tep96j7r (23 diapositives). Ce que vous dites, diapositive par diapositive, est dans
**`docs/oral-notes-canva.md`** (à coller dans les Notes de Canva). Ce fichier-ci contient le **minutage**, les **checklists de démonstration**,
le **plan B** et les **questions probables**. Tout ce qui n'a pas été vérifié est marqué ⚠.

| Partie | Diapos | Temps |
|---|---|---|
| Introduction | 1-2 | 0:50 |
| 1. PWA, TWA, hybride, desktop | 3-9 | 4:20 |
| **2. Le hors ligne de A à Z** | 10-19 | **9:00** |
| 3. Push, puis paiement et NFC en bref | 20-22 | 2:40 |
| Conclusion | 23 | 0:30 |

Idée directrice de la partie 2 : **trois briques simples** (service worker, IndexedDB, file d'attente) et **une règle de synchronisation** :
« on rejoue les gestes dans l'ordre avec leur heure réelle, et on ne perd jamais un geste en silence. »

## Le hors ligne en une page (pour répondre sans notes)

- **Service worker** (`public/sw.js`, ~100 lignes, écrit à la main). Fichiers `/_next/static` et icônes : cache d'abord. Navigation : réseau d'abord, sinon la page `/offline` (préchargée à l'installation). **Jamais** de cache des pages du back-office ni des API (données de clients). Anciens caches supprimés à l'activation (`VERSION`).
- **Instantané** : `GET /api/hors-ligne` renvoie les séjours confirmés ou en cours du jour, avec la fiche de chaque chien (allergies, régime, comportement, vétérinaire, propriétaire et téléphone, vaccins). **Exclus** : historique, facturation, adresse, e-mail. Stocké dans IndexedDB (base `a2p-offline`, magasin `kv`). Rafraîchi à l'ouverture, à l'événement `online`, et au retour sur l'application.
- **File d'attente** (magasin `queue`) : `{ id, bookingId, action (arrivée ou départ), dogName, at }`. **`at` = heure réelle du geste** : le serveur la reprend, sinon l'arrivée serait datée de la synchronisation. Aucune fiche de client dans la file.
- **Synchronisation** (`syncAll`) : (1) rejouer la file **dans l'ordre des heures** par `PATCH /api/reservations/:id { action, at }` ; (2) par geste : **succès** → retiré ; **409 ou 404** → geste devenu impossible, **ignoré et signalé** (« nom du chien : motif ») ; **401** → session expirée, **geste conservé**, « Reconnectez-vous » ; **réseau coupé** → on s'arrête, on réessaiera ; **erreur serveur** → on garde le geste ; (3) **seulement si la file est vide**, on retélécharge un instantané frais (sinon on écraserait l'état local des gestes pas encore envoyés).
- **Vie privée** : instantané effacé à la déconnexion (page de connexion) et sur 401 ; test E2E « les fiches ne restent pas sur l'appareil après la déconnexion ».
- **Limites** : iPhone sans Background Sync → rejeu **application ouverte** ; seuls l'arrivée et le départ marchent hors ligne ; un conflit est signalé, jamais fusionné ; changer `VERSION` du service worker à chaque déploiement qui modifie les ressources.

## Démonstrations : checklists (à préparer la veille)

### Démo 1 · Mode avion (diapo 18, ≈ 1 min 30) : la plus importante

**Avant** : PWA installée sur l'écran d'accueil de l'iPhone ; **ouverte avec du réseau juste avant** (c'est ce qui charge l'instantané) ; connecté en gérant ; une réservation « confirmée » pour aujourd'hui avec un chien dont la fiche est remplie (allergies, vétérinaire). Mode ne pas déranger activé.

1. Mode avion. Ouvrir l'application : message « Vous êtes hors connexion », la journée s'affiche.
2. Ouvrir une fiche : allergies, vétérinaire, propriétaire lisibles. Dire : « tout vient d'IndexedDB, pas du réseau. »
3. Enregistrer une arrivée : message « enregistrée sur cet appareil, synchronisée au retour du réseau », compteur « 1 geste(s) en attente de synchronisation ».
4. Couper le mode avion, **laisser l'application ouverte** : « 1 geste(s) synchronisé(s) ». Sur le PC, le tableau de bord montre le chien accueilli.
5. Dire : « sur iPhone il n'y a pas de Background Sync : la synchronisation se fait application ouverte. »

**Plan B** : courte vidéo des cinq étapes. **À éviter** : démarrer sans avoir ouvert l'application avec du réseau (la page hors ligne dirait « Aucune copie locale de la journée »). ⚠ Si le geste est déjà fait côté serveur, il sera **ignoré et signalé** (409) : c'est le bon comportement, mais prévoir une réservation « confirmée » non encore accueillie.

### Démo 2 · Notification push (diapo 21, ≈ 1 min)

**Avant** : notifications activées dans la barre latérale, téléphone déverrouillé, un produit **juste au-dessus de son seuil**. Sur le PC : une sortie de stock qui franchit le seuil ; la notification « Stock bas » arrive ; la toucher ouvre la bonne page. **Plan B** : vidéo.

### Démo 3 · Paiement (facultative, seulement si on la demande)

`https://amour2poils.duckdns.org/demo/paiement` (gérance). iPhone : « Me vérifier » (Face ID), « Demander le montant au serveur », puis **« Simuler le paiement »** (⚠ Apple Pay exige un compte Apple Developer : dire que c'est une simulation). Google Pay réel : Chrome sur PC, ⚠ non vérifié sur un appareil réel, à essayer la veille.

### Avant de partir

Batterie, ne pas déranger, réseau de la salle testé, partage d'écran prévu, connexion faite en avance (pas d'écran de connexion devant le jury). ⚠ **Changer le mot de passe du VPS** collé dans le chat pendant le projet.

## Questions probables, et réponses honnêtes

**Sur le hors ligne (le cœur de l'oral)**
- **« Que se passe-t-il quand le réseau revient ? »** L'événement `online` (ou l'ouverture / le retour sur l'application) lance la synchronisation : la file est rejouée dans l'ordre des heures de geste ; chaque réponse du serveur est traitée (succès, 409/404, 401, erreur) ; puis, si la file est vide, un instantané frais est téléchargé.
- **« Pourquoi garder l'heure du geste ? »** Sans elle, le serveur daterait l'arrivée au moment de la synchronisation, parfois des heures après. Le serveur reprend `at`.
- **« Et si deux personnes font le même geste ? »** Le second reçoit un 409 : ignoré et signalé, pas rejoué.
- **« Et si la session a expiré pendant la coupure ? »** 401 : le geste est conservé dans la file, on demande de se reconnecter, puis il est rejoué.
- **« Pourquoi ne pas mettre les pages en cache ? »** Ce sont des données de clients : elles resteraient lisibles après la déconnexion. On garde seulement un instantané minimal, effacé à la déconnexion.
- **« Pourquoi n'actualiser l'instantané que si la file est vide ? »** Sinon on écraserait l'état local des gestes pas encore envoyés.
- **« Pourquoi IndexedDB et pas localStorage ? »** IndexedDB stocke des objets structurés, de façon asynchrone, avec plus de place ; localStorage est synchrone et ne stocke que du texte. (Réponse générale, non propre à mon projet.)
- **« Et la synchronisation en arrière-plan ? »** Le Background Sync existe sur Chrome Android mais pas sur iPhone ; j'ai choisi un comportement identique partout : rejeu à l'ouverture ou au retour du réseau, application ouverte. ⚠ Je n'ai pas mesuré le délai réel.
- **« Peut-on créer une réservation hors ligne ? »** Non : seulement l'arrivée et le départ. Créer exigerait de contrôler la capacité des boxes côté serveur, donc le réseau.
- **« Comment l'avez-vous prouvé ? »** Tests de bout en bout dans un vrai Chromium : hors ligne, arrivée rejouée avec son heure, geste devenu impossible signalé, effacement à la déconnexion ; plus des tests unitaires de la synchronisation.

**Sur la comparaison et le reste**
- **« Pourquoi pas une application native ? »** Aucune capacité native demandée ; la PWA donne l'installation, le hors ligne et le push, avec un seul code et un déploiement immédiat.
- **« Qu'est-ce qu'une TWA ? »** Une application Android minimale qui ouvre le site dans Chrome en plein écran, après vérification que je possède le domaine. De la distribution, pas une capacité. ⚠ Lien de confiance reconnu par Google, mais APK non construit et non testé sur Android.
- **« Pourquoi pas Capacitor ? »** Pas de besoin ; je l'ajouterais pour une capacité manquante (par exemple lire une puce NFC sur iPhone), en réutilisant ~95 % du code.
- **« Les notifications marchent sur iPhone ? »** Oui depuis iOS 16.4, **si la PWA est installée** ; validé en production sur mon iPhone.
- **« Le paiement marche vraiment ? »** Démonstration sans débit. Réel : la passkey (vraie signature) et le montant décidé et revérifié par le serveur. Sur iPhone seul Apple Pay existe et demande un compte Apple Developer : je simule.
- **« Le NFC pour payer ? »** Web NFC lit des étiquettes, pas les cartes bancaires, et n'existe que sur Chrome Android. Non implémenté.
- **« Pourquoi un service worker écrit à la main ? »** Une centaine de lignes relisibles ; je peux défendre chaque ligne. Contrepartie : changer `VERSION` à chaque déploiement.
- **« Comment avez-vous utilisé l'IA ? »** Voir `docs/journal-ia.md` : défauts réels trouvés et corrigés (courses sur le stock, origine WebAuthn derrière deux proxys, message Google Pay trompeur sur iPhone).

## À revérifier la veille (donnés de mémoire)

Prix des comptes développeur (25 $ Google Play une fois, 99 $/an Apple), version minimale d'iOS pour le push (16.4), position d'Apple sur les PWA en Europe,
et le comportement de Google Pay (mode TEST) sur le matériel utilisé.
