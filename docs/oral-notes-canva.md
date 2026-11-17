# Notes de présentateur à coller dans Canva (une par diapositive)

Support : https://canva.link/wk1ebf6tep96j7r (23 diapositives, centré sur le **hors ligne**). Durée visée : **≈ 18 minutes**.

Comment faire : dans Canva, sélectionnez la diapositive, cliquez sur **Notes** (en bas de l'éditeur), collez le bloc du même numéro.
Pendant l'oral, ouvrez la **Vue du présentateur** (application Canva Mac ou Windows, ou navigateur sur ordinateur) : seul vous voyez les notes.
Texte brut, sans mise en forme. « ⚠ » marque ce qui n'est **pas vérifié** : ne l'affirmez pas.
Démonstrations, plan B et questions probables : `docs/oral-script-theme6.md`.

| Partie | Diapos | Temps |
|---|---|---|
| Introduction | 1-2 | 0:50 |
| 1. PWA, TWA, hybride, desktop | 3-9 | 4:20 |
| 2. Le hors ligne de A à Z | 10-19 | 9:00 |
| 3. Push, puis paiement et NFC en bref | 20-22 | 2:40 |
| Conclusion | 23 | 0:30 |

---

## Diapo 1 · Titre (0:20)

Je présente le thème 6 : ce qu'une PWA permet vraiment. Je m'appuie sur mon projet, Amour 2 Poils, le back-office d'une pension canine, et je vais surtout insister sur le mode hors ligne : comment l'application continue de marcher sans réseau, et comment elle retrouve ses données quand le réseau revient.

## Diapo 2 · Plan (0:30)

Trois parties. Un : comparer quatre façons de livrer l'application, PWA, TWA, hybride et desktop, rapidement. Deux, la plus longue : le hors ligne de A à Z, avec une démonstration en mode avion. Trois : une notification push, et en bref le paiement sécurisé et le NFC.

## Diapo 3 · Ce qu'une PWA sait faire (0:40)

Installation, hors ligne, notifications, biométrie : tout existe sous forme d'API Web. Mais la réponse n'est jamais seulement oui ou non : elle dépend du navigateur, surtout sur iPhone. Mon contexte : un gérant et quelques employés, sur téléphone, parfois sans réseau dans la cour des chenils.

## Diapo 4 · Quatre façons de livrer (0:20)

Du plus simple au plus lourd : un lien pour la PWA, le Play Store pour la TWA, les stores mobiles pour l'hybride, un installeur pour le desktop. C'est la même application, avec quatre emballages.

## Diapo 5 · PWA et TWA (0:40)

PWA : le site, plus un manifeste et un service worker. Un seul code, mise à jour immédiate, zéro euro. TWA : une application Android minimale qui affiche mon site dans Chrome en plein écran, sans barre d'adresse. Elle n'ajoute aucune capacité, elle ajoute de la distribution.
⚠ Le lien de confiance de la TWA est en ligne et Google le reconnaît, mais je n'ai pas construit l'application ni testé sur Android. Compte Play Store : 25 dollars, une fois, seulement pour publier.

## Diapo 6 · Hybride avec Capacitor (0:40)

Hybride, c'est une application mobile qui contient mon site dans une WebView, un navigateur intégré. Des plugins font le pont avec le téléphone : caméra, fichiers, GPS, Bluetooth, NFC, biométrie, notifications natives. On réutilise environ 95 % du code. Coût : 99 dollars par an chez Apple, 25 chez Google, et une revue par les stores. C'est la voie logique si une API Web manque.

## Diapo 7 · Desktop avec Electron ou Tauri (0:40)

Une application d'ordinateur qui affiche le site, avec accès à ce que le navigateur interdit : fichiers, imprimante, USB, démarrage automatique. Electron embarque Chromium, environ 100 mégaoctets, c'est ce qu'utilisent Visual Studio Code, Slack et Discord. Tauri utilise le navigateur du système avec du Rust, environ 5 mégaoctets. Aucun besoin ici : le navigateur suffit.

## Diapo 8 · Comparaison (0:40)

Ne pas tout lire. Trois lignes à retenir : le code réutilisé, 100 % pour la PWA et la TWA, environ 95 % pour l'hybride. Le coût d'entrée : 0 euro, 25 dollars une fois, 99 dollars par an. Et la ligne iPhone : la PWA seule s'arrête là où commence l'hybride.

## Diapo 9 · Limites sur iPhone et notre choix (0:40)

Sur iPhone : pas d'invite d'installation, il faut passer par Partager puis Sur l'écran d'accueil. Les notifications ne marchent que si la PWA est installée, depuis iOS 16.4. Pas de Background Sync : c'est important pour la suite, car la synchronisation se fera application ouverte. Ni Web NFC ni Web Bluetooth.
Notre choix : la PWA suffit. Une couche native se justifie seulement pour une capacité qu'aucune API Web ne donne.

## Diapo 10 · Partie 2, le hors ligne : pourquoi ? (0:30)

Sur le terrain, la cour et les chenils captent mal. Il faut deux choses sans réseau. Lire : la fiche du chien, ses allergies, le vétérinaire, le téléphone du propriétaire. Écrire : enregistrer l'arrivée ou le départ d'un chien. Et surtout, retrouver ses données proprement quand le réseau revient. C'est cette dernière partie que je vais détailler.

## Diapo 11 · Trois couches (0:50)

Trois briques simples. Le service worker, pour que l'application s'ouvre sans réseau. IndexedDB, la base du navigateur, qui garde la copie de la journée. Et une file d'attente, qui garde les gestes faits sans réseau pour les envoyer plus tard. Dans la base, deux magasins : un pour l'instantané, un pour la file.

## Diapo 12 · Le service worker (0:50)

Trois règles. Les fichiers statiques et les icônes : cache d'abord, donc l'application démarre. Une page demandée : réseau d'abord ; sans réseau, on affiche ma page /offline, préchargée à l'installation. Et la règle la plus importante : les pages du back-office et les API ne sont JAMAIS mises en cache, car ce sont des données de clients qui resteraient lisibles après la déconnexion. À chaque activation, les anciens caches sont supprimés.

## Diapo 13 · L'instantané de la journée (0:50)

Quand il y a du réseau, l'application télécharge un instantané : les séjours confirmés ou en cours aujourd'hui, avec la fiche de chaque chien : allergies, régime, comportement, vétérinaire, propriétaire et téléphone, vaccins. Volontairement exclus : l'historique, la facturation, l'adresse et l'e-mail. Il est stocké dans IndexedDB et mis à jour à l'ouverture, au retour du réseau et quand on revient sur l'application.

## Diapo 14 · Enregistrer un geste sans réseau (0:50)

Je clique sur Arrivée. Le geste est ajouté à la file d'attente avec : un identifiant, la réservation, l'action arrivée ou départ, le nom du chien, et surtout l'heure réelle du geste. L'écran se met à jour tout de suite dans la copie locale, et un message dit : enregistrée sur cet appareil, synchronisée au retour du réseau. La file ne contient que des identifiants, aucune fiche de client.

## Diapo 15 · Le retour du réseau : la synchronisation (1:30)

C'est la diapositive centrale. Le déclencheur : l'événement online du navigateur, l'ouverture de l'application, ou le retour sur l'application.
Étape un : on rejoue la file, dans l'ordre des heures de geste, en envoyant au serveur l'action et l'heure.
Étape deux : on regarde la réponse pour chaque geste. Succès : le geste est retiré de la file. 409 ou 404 : le geste n'a plus de sens, par exemple le chien est déjà parti, il est ignoré et signalé, pas rejoué. 401 : la session a expiré, on garde le geste et on demande de se reconnecter. Réseau coupé ou erreur serveur : on s'arrête, les gestes restent, on réessaiera.
Étape trois, seulement si la file est vide : on retélécharge un instantané frais. Sinon on écraserait l'état local des gestes pas encore envoyés.
Principe : on ne perd jamais un geste en silence.

## Diapo 16 · Pourquoi garder l'heure réelle du geste (0:30)

Si on envoyait le geste sans son heure, le serveur daterait l'arrivée au moment de la synchronisation, parfois des heures après. Le geste emporte donc son heure, le serveur la reprend, et la file est rejouée dans l'ordre de ces heures. L'historique de la pension reste fidèle à ce qui s'est vraiment passé.

## Diapo 17 · Vie privée et sécurité (0:40)

Sur l'appareil : un instantané minimal et une file qui ne contient que des identifiants. Jamais de cache des pages ni des API. Et tout est effacé à la déconnexion, et aussi si la session expire. C'est testé automatiquement : après la déconnexion, les fiches des clients ne restent pas sur l'appareil.

## Diapo 18 · Démonstration : mode avion (1:30)

Avant : application installée, ouverte avec du réseau (pour que l'instantané soit chargé), mode ne pas déranger activé pour ne pas être interrompu.
1. Passer en mode avion. Ouvrir l'application : la journée s'affiche quand même.
2. Ouvrir la fiche d'un chien : allergies, vétérinaire, propriétaire, tout est lisible.
3. Enregistrer une arrivée : le message dit synchronisée au retour du réseau, et le compteur affiche un geste en attente.
4. Couper le mode avion : la file se rejoue, le message annonce que le geste est synchronisé, et l'arrivée apparaît au tableau de bord.
Dire pendant l'attente : sur iPhone la synchronisation se fait application ouverte, car il n'y a pas de Background Sync.
Plan B : vidéo de ces quatre étapes dans le téléphone.

## Diapo 19 · Limites et preuves (0:50)

Limites assumées : sur iPhone, pas de Background Sync, la file se rejoue application ouverte. Seuls l'arrivée et le départ se font hors ligne, pas la création d'une réservation. Un conflit n'est pas fusionné : il est signalé. Et il faut changer la version du service worker à chaque déploiement qui modifie les ressources.
Preuves : des tests de bout en bout dans un vrai Chromium : application ouverte sans réseau, arrivée rejouée avec son heure, geste devenu impossible signalé, effacement à la déconnexion. Plus des tests unitaires de la synchronisation.

## Diapo 20 · Partie 3, la notification push (1:00)

Le navigateur s'abonne avec la clé publique du serveur ; l'abonnement est enregistré. Un événement métier déclenche l'envoi, signé avec la clé privée VAPID, qui reste sur le serveur. Le service de push du navigateur livre le message et le service worker l'affiche, même application fermée.
Trois alertes : nouvelle réservation, stock bas, envoyé une seule fois au franchissement du seuil, et vaccins à renouveler, par une tâche quotidienne. Validé en production sur Chrome PC et sur mon iPhone avec la PWA installée.

## Diapo 21 · Démonstration push (1:00)

Téléphone déverrouillé, notifications activées. Sur le PC : une sortie de stock qui franchit le seuil. En quelques secondes la notification Stock bas arrive. Je la touche : l'application s'ouvre sur la bonne page. Plan B : vidéo.

## Diapo 22 · En bref : paiement sécurisé et NFC (0:40)

Une seule idée : le site ne voit jamais l'empreinte ni la carte. Passkey : l'appareil vérifie l'empreinte ou le visage, le serveur reçoit seulement une signature. Payment Request : la feuille de paiement est celle du navigateur, le site reçoit un jeton, le serveur décide du montant. Web NFC : Chrome sur Android seulement, il ne lit pas les cartes bancaires, et je ne l'ai pas implémenté.
⚠ Le paiement en ligne n'est pas prévu dans mon application : j'ai une page de démonstration, sans débit. Sur iPhone seul Apple Pay existe, il demande un compte développeur, donc je simule. Je peux la montrer si on me le demande.

## Diapo 23 · Conclusion (0:30)

Trois idées. Le hors ligne repose sur trois briques simples : service worker, IndexedDB, file d'attente. Au retour du réseau, les gestes sont rejoués dans l'ordre avec leur heure réelle, et les conflits sont signalés, jamais perdus en silence. Et une couche native ne se justifie que pour une capacité qu'aucune API Web ne donne. Merci, je prends vos questions.
