# Oral · Thème 6 : la PWA et ses possibilités (script minuté, ≈ 19 min)

Support : la présentation Canva (23 diapositives). Ce script dit **quoi dire**, **combien de temps**, **quoi montrer**, et
**quoi ne pas affirmer** (tout ce qui n'a pas été vérifié est marqué ⚠). Parler, ne pas lire : une idée par diapositive.

| Partie | Diapos | Temps |
|---|---|---|
| Introduction | 1 à 3 | 2:00 |
| 1. PWA, TWA, hybride, desktop | 4 à 13 | 6:30 |
| 2. Paiement sécurisé (NFC, empreinte) | 14 à 18 + démo | 5:30 |
| 3. Notification push | 19 à 22 + démo | 4:30 |
| Conclusion et questions | 23 | 0:30 |

Règle d'or à répéter : **« une couche native ne se justifie que pour une capacité qu'aucune API Web ne donne. »**

---

## Introduction (2:00)

**1 · Titre (0:20).** « Je présente le thème 6 : ce qu'une PWA permet vraiment, et quand il faut aller plus loin. Mon fil rouge est
mon projet, Amour 2 Poils, le back-office d'une pension canine. »

**2 · Plan (0:20).** Trois parties : comparer quatre façons de livrer l'application ; un paiement sécurisé avec empreinte et NFC ;
une notification push, avec une démonstration chacune.

**3 · Ce qu'une PWA sait faire (1:20).** Lire le tableau en trois phrases : installation, hors ligne, push, biométrie et paiement
existent sous forme d'API Web ; seule la **NFC** est limitée (Chrome sur Android) ; et **tout dépend du navigateur, surtout sur iPhone**.
« Mon contexte : un gérant et quelques employés, sur téléphone, parfois sans réseau dans la cour. Pas de capteur exotique. »

## Partie 1 · PWA, TWA, hybride, desktop (6:30)

**4 · Quatre façons de livrer (0:30).** Du plus simple au plus lourd : un lien, le Play Store, les stores mobiles, un installeur.

**5 · PWA (0:50).** Le site + un manifeste + un service worker. Un seul code, mise à jour immédiate, 0 €. « Dans mon projet : service
worker écrit à la main, une centaine de lignes, qui ne met jamais en cache les pages ni les API, car ce sont des données de clients. »

**6 · TWA (0:50).** « Une application Android minimale qui affiche mon site dans Chrome, sans barre d'adresse. **Elle n'ajoute aucune
capacité, elle ajoute de la distribution.** » Un fichier `assetlinks.json` prouve que je possède le site : ⚠ **il est en ligne et Google
le reconnaît** (vérifié), mais **je n'ai pas construit l'APK ni testé sur Android**. Compte Play Store : 25 $ une fois, seulement pour publier.

**7-8 · Hybride, avec Capacitor (1:15).** « Une application mobile qui contient mon site dans une WebView, un navigateur intégré, et des
**plugins** qui font le pont avec le téléphone. » Possibilités : caméra, fichiers, GPS, Bluetooth, NFC, biométrie, notifications natives.
Coût : 99 $/an Apple + 25 $ Google, revue par les stores. « C'est la voie logique **si** une API Web manque. »

**9-10 · Desktop, avec Electron ou Tauri (1:00).** Une application d'ordinateur qui affiche le site. Electron embarque Chromium (~100 Mo,
c'est ce qu'utilisent VS Code, Slack, Discord) ; Tauri utilise le navigateur du système (~5 Mo). Possibilités : fichiers, imprimante, USB,
démarrage automatique. « Aucun besoin pour une pension : le navigateur suffit. »

**11 · Comparaison (1:00).** Ne pas tout lire. Trois lignes à retenir : code réutilisé (100 % → ≈ 95 % → ≈ 100 %), **coût d'entrée**
(0 € / 25 $ / 99 $ par an), **iPhone** (la PWA seule s'arrête là où commence l'hybride).

**12 · Limites sur iPhone (0:45).** Pas d'invite d'installation (Partager → Sur l'écran d'accueil) ; **notifications seulement si la PWA
est installée** (iOS 16.4+) ; pas de Background Sync ; ni Web NFC ni Web Bluetooth. « C'est ce qui fait pencher vers l'hybride. »

**13 · Notre choix (0:30).** PWA suffisante ici. TWA si on veut l'icône du Play Store. Hybride si un besoin natif apparaît (exemple :
lire une puce NFC sur iPhone). Desktop : pas de besoin.

## Partie 2 · Paiement sécurisé (5:30)

**14 · Trois briques (0:40).** Payment Request, WebAuthn, prestataire. « Le site ne manipule **jamais** le numéro de carte ni l'empreinte. »
⚠ **Dire clairement** : « Dans mon application le paiement en ligne n'est pas prévu : je le présente comme une démonstration. »

**15 · Payment Request (0:50).** Le navigateur dessine la feuille de paiement ; le site ne reçoit qu'un **jeton à usage unique**. Le prestataire
débite, le serveur valide. « Le serveur décide du montant, en centimes ; le navigateur ne le décide jamais. »

**16 · WebAuthn (0:50).** Le téléphone vérifie l'empreinte ou le visage **en local** ; le serveur reçoit une **signature** d'un défi qui change
à chaque fois, vérifiée avec la clé publique. Liée au nom de domaine : inutilisable sur un faux site.

**17 · Web NFC (0:40).** ⚠ Chrome sur Android seulement ; ni iPhone ni ordinateur ; **ne lit pas les cartes bancaires** (le sans contact bancaire
passe par le portefeuille du téléphone). Usage réaliste : une puce ou un badge de chien. **Non implémenté** dans mon projet.

**18 · De bout en bout (0:30).** Passkey → montant décidé par le serveur → feuille de paiement → jeton → serveur revérifie. Principes :
le serveur valide tout, montants en centimes entiers.

**Démonstration paiement (2:00)** : voir la checklist plus bas.

## Partie 3 · Notification push (4:30)

**19 · Comment ça marche (0:50).** Le navigateur s'abonne avec la clé publique VAPID du serveur ; l'abonnement est enregistré ; un événement
métier déclenche l'envoi, signé avec la **clé privée VAPID (jamais côté client)** ; le service de push du navigateur (FCM pour Chrome) livre ;
le service worker affiche, même application fermée.

**20 · Notre mise en place (0:50).** Trois alertes : nouvelle réservation, **stock bas** (une seule alerte au franchissement du seuil),
vaccins à renouveler (tâche quotidienne GitHub Actions). **Validé en production sur Chrome PC et sur iPhone avec la PWA installée.**

**21 · Démonstration (1:30)** : voir la checklist.

**22 · Limites et sécurité (0:40).** iPhone : installée obligatoire ; autorisation demandée après un geste, refus définitif possible ;
contenu minimal à l'écran verrouillé ; une redirection ouverte du service worker a été **trouvée et corrigée**. ⚠ La purge d'un abonnement
expiré est écrite mais **non testée en vrai**.

## Conclusion (0:30)

**23.** « La PWA couvre installation, hors ligne, push, biométrie et paiement par des API Web. TWA, hybride et desktop ne se justifient que
pour une capacité manquante ou une distribution précise. Et dans tous les cas, **le site ne voit jamais la carte ni l'empreinte, et le serveur
valide tout**. Merci, je prends vos questions. »

---

## Démonstrations : checklists (à préparer la veille)

### Démo 1 · Paiement sécurisé (≈ 2 min)

**Avant** : connecté en gérant sur `https://amour2poils.duckdns.org/demo/paiement` sur l'iPhone **et** sur le PC (Chrome). Une passkey
déjà enregistrée sur chaque appareil (étape 1 déjà validée sur iPhone). Une facture « envoyée » existe (F-2026-0002 et F-2026-0004 dans les
données de test).

**Sur l'iPhone** (parcours qui marche à coup sûr) :
1. Montrer la liste des capacités détectées (WebAuthn et empreinte disponibles, Apple Pay détecté).
2. « Me vérifier » → Face ID ou Touch ID. Dire : « le serveur ne voit **jamais** mon empreinte, il reçoit une signature. »
3. « Demander le montant au serveur » → le montant s'affiche. « Le montant vient du serveur. »
4. « Payer » → ⚠ message expliquant qu'Apple Pay exige un compte Apple Developer, puis **« Simuler le paiement »**. Dire sans détour :
   « Sur iPhone seul Apple Pay existe ; je n'ai pas de compte développeur, donc je simule. Le serveur, lui, revérifie vraiment le montant. »

**Sur le PC (Chrome)** : la **vraie** feuille Google Pay en mode TEST s'ouvre. ⚠ **Non vérifié sur un vrai appareil à ce jour : l'essayer la veille.**
Si aucune carte n'est enregistrée dans le compte Google, elle propose d'en ajouter une ; utiliser le bouton de simulation si besoin.

**Plan B** : captures d'écran ou courte vidéo de chaque étape, prêtes dans le téléphone.

### Démo 2 · Notification push (≈ 1 min 30)

**Avant** : PWA installée sur l'écran d'accueil de l'iPhone, notifications activées (bouton dans la barre latérale du back-office), téléphone
déverrouillé et réseau OK. Repérer un produit **juste au-dessus de son seuil** (par exemple Croquettes chiot).

1. Sur le PC : faire une sortie de stock qui franchit le seuil.
2. La notification « Stock bas » arrive sur le téléphone en quelques secondes. Toucher : l'application s'ouvre sur la bonne page.

**Plan B** : le workflow GitHub Actions des rappels de vaccins déclenche aussi une notification ; ou vidéo préparée.

### Avant de partir

- Batterie, mode « ne pas déranger » désactivé (sinon pas de notification visible), réseau de la salle testé, partage d'écran ou câble prévu.
- Connexion au site en avance (la session peut avoir expiré) ; ne **pas** montrer l'écran de connexion avec un mot de passe.
- ⚠ **Changer le mot de passe du VPS** qui a été collé dans le chat pendant le projet (à faire avant, pas devant le jury).

## Questions probables, et réponses honnêtes

- **« Pourquoi pas une application native ? »** Aucune capacité native demandée ; la PWA donne l'installation, le hors ligne et le push, avec un seul code et un déploiement immédiat.
- **« Qu'est-ce qu'une TWA, concrètement ? »** Une application Android minimale qui ouvre le site dans Chrome en plein écran, après vérification que je possède le domaine (Digital Asset Links). De la distribution, pas une capacité. ⚠ Je l'ai préparée (lien de confiance validé par Google) mais pas construite ni testée sur un appareil.
- **« Pourquoi pas Capacitor ? »** Je n'en ai pas besoin ; je l'ajouterais pour une capacité manquante (lire une puce NFC sur iPhone), en réutilisant ~95 % du code.
- **« Le paiement marche vraiment ? »** C'est une démonstration : aucun débit, aucune facture modifiée. Ce qui est réel : la passkey (vraie signature, testée avec un authentificateur virtuel et sur iPhone) et le montant décidé et revérifié par le serveur. La feuille Google Pay n'est pas vérifiée sur un vrai appareil ; sur iPhone je simule faute de compte Apple Developer.
- **« Pourquoi pas Apple Pay ? »** Il exige un compte Apple Developer (99 $/an), la validation du commerce par Apple et un certificat : hors de ma portée pour ce projet.
- **« Le serveur voit-il l'empreinte ? »** Non, jamais : elle reste dans la puce sécurisée de l'appareil. Le serveur ne garde que la clé publique, un compteur, et vérifie une signature.
- **« Et si on rejoue la réponse signée ? »** Le défi est à usage unique et dure 5 minutes : refusé (testé en E2E, ainsi qu'une réponse dont l'origine est falsifiée).
- **« Et si le navigateur envoie un faux montant ? »** Le serveur compare au montant calculé depuis les lignes de la facture : refusé (409, testé).
- **« Le NFC pour payer ? »** Web NFC lit des étiquettes, pas les cartes bancaires, et n'existe que sur Chrome Android. Le sans contact bancaire passe par le portefeuille du téléphone.
- **« Les notifications marchent sur iPhone ? »** Oui depuis iOS 16.4, **si la PWA est installée** ; validé en production sur mon iPhone.
- **« Et si le service worker met en cache une donnée sensible ? »** Choix assumé : jamais de cache des pages ni des API ; seul un instantané de la journée est dans IndexedDB, effacé à la déconnexion.
- **« Pourquoi un service worker écrit à la main ? »** Une centaine de lignes relisibles ; je peux défendre chaque ligne, ce que je ne saurais pas faire avec une bibliothèque de plus. Contrepartie : changer `VERSION` à chaque déploiement qui modifie les ressources cachées.
- **« Comment avez-vous utilisé l'IA ? »** Voir `docs/journal-ia.md` : exemples de défauts réels trouvés et corrigés (course sur le stock, origine WebAuthn derrière deux proxys, message Google Pay trompeur sur iPhone).

## À revérifier la veille (donnés de mémoire)

Prix des comptes développeur (25 $ Google Play une fois, 99 $/an Apple), position d'Apple sur les PWA en Europe, version minimale d'iOS pour le push (16.4),
et le comportement de Google Pay (mode TEST) sur le matériel que vous utiliserez.
