# Notes de présentateur (20 diapositives) et démonstrations en direct

Support Canva : https://canva.link/wk1ebf6tep96j7r. Pour chaque diapositive : sélectionnez-la, cliquez sur **Notes** (en bas de l'éditeur), collez le bloc du même numéro.
Pendant l'oral : **Vue du présentateur** (application Canva Mac ou Windows, ou navigateur sur ordinateur) : seul vous voyez les notes.
« ⚠ » = **non vérifié** : ne l'affirmez pas. Durée visée : ≈ 17 minutes, démonstrations comprises.

## Où placer les démonstrations

| Quand | Démonstration | Durée |
|---|---|---|
| **Après la diapo 14** (Enregistrer un geste sans réseau) | **Démo 1A, mode avion** : lire une fiche et enregistrer une arrivée sans réseau. On **reste hors ligne** | 1:00 |
| **Après la diapo 16** (Pourquoi garder l'heure réelle) | **Démo 1B, retour du réseau** : on rétablit le réseau, la file se rejoue | 0:40 |
| **Après la diapo 18** (Partie 3, la notification push) | **Démo 2, notification push** : stock bas, du PC au téléphone | 1:00 |
| Après la diapo 19, **seulement si on vous le demande** | Démo 3, passkey et paiement (facultative) | 1:00 |

Pourquoi couper la démo 1 en deux : la démo 1A montre le geste hors ligne, puis les diapos 15 et 16 **expliquent** la synchronisation pendant que le téléphone reste en mode avion, et la démo 1B montre le résultat. Si vous préférez plus simple : **tout faire après la diapo 16** (mêmes étapes).

---

# Les notes, diapositive par diapositive

## Diapo 1 · Titre (0:20)

Je présente le thème 6 : ce qu'une PWA permet vraiment. Je m'appuie sur mon projet, Amour 2 Poils, le back-office d'une pension canine, et je vais surtout insister sur le mode hors ligne : comment l'application continue de marcher sans réseau, et comment elle retrouve ses données quand le réseau revient.

## Diapo 2 · Plan (0:30)

Trois parties. Un : comparer quatre façons de livrer l'application, PWA, TWA, hybride et desktop, rapidement. Deux, la plus longue : le hors ligne de A à Z, avec une démonstration en mode avion. Trois : une notification push avec une démonstration, et en bref le paiement sécurisé et le NFC.

## Diapo 3 · Ce qu'une PWA sait faire (0:40)

Installation, hors ligne, notifications, biométrie : tout existe sous forme d'API Web. Mais la réponse n'est jamais seulement oui ou non : elle dépend du navigateur, surtout sur iPhone. Mon contexte : un gérant et quelques employés, sur téléphone, parfois sans réseau dans la cour des chenils.

## Diapo 4 · Quatre façons de livrer (0:20)

Du plus simple au plus lourd : un lien pour la PWA, le Play Store pour la TWA, les stores mobiles pour l'hybride, un installeur pour le desktop. C'est la même application avec quatre emballages.

## Diapo 5 · PWA et TWA (0:40)

PWA : le site, plus un manifeste et un service worker. Un seul code, mise à jour immédiate, zéro euro. TWA : une application Android minimale qui affiche mon site dans Chrome en plein écran, sans barre d'adresse. Elle n'ajoute aucune capacité, elle ajoute de la distribution.
⚠ Le lien de confiance de la TWA est en ligne et Google le reconnaît, mais je n'ai pas construit l'application ni testé sur Android. Compte Play Store : 25 dollars, une fois, seulement pour publier.

## Diapo 6 · Hybride : à quoi ça sert concrètement (0:40)

L'hybride, c'est une vraie application mobile, publiée sur l'App Store et le Play Store, qui contient mon site à l'intérieur, plus des « ponts » vers le téléphone. On le choisit quand la PWA ne suffit plus, pour trois raisons concrètes.
Un : le matériel. Caméra et scanner avancés, Bluetooth pour un capteur, NFC pour lire une puce, biométrie, fichiers. Chez nous : lire la puce d'un chien sur iPhone, ce que le navigateur ne sait pas faire.
Deux : la fiabilité sur iPhone. Notifications natives sans dépendre de l'installation depuis Safari, et fonctionnement en arrière-plan.
Trois : la visibilité. L'application est sur les stores, avec son icône et ses mises à jour.
Par rapport à la PWA : plus de pouvoir, mais un coût, 99 dollars par an chez Apple, 25 chez Google, et une revue par les stores. Par rapport à la TWA : la TWA reste limitée à ce que Chrome sait faire et n'existe pas sur iPhone ; l'hybride, si. Et on réutilise environ 95 % du code web.
Les noms d'outils sont sur la diapositive : inutile de les détailler.

## Diapo 7 · Desktop : à quoi ça sert concrètement (0:40)

Le desktop, c'est un vrai logiciel pour ordinateur qui affiche mon site, installé comme n'importe quel programme. On le choisit quand l'application doit toucher à l'ordinateur lui-même, ce que le navigateur limite ou interdit.
Concrètement : lire et écrire des fichiers sur le disque, piloter une imprimante, brancher un appareil USB comme un lecteur de puces ou de codes-barres, se lancer au démarrage de l'ordinateur, rester actif en arrière-plan avec une icône dans la barre système.
Par rapport à la PWA installée sur ordinateur : elle a déjà sa fenêtre, le hors ligne et les notifications, mais elle ne touche pas au système. Le desktop, si, au prix d'un fichier à installer par système, d'une signature du code payante et de mises à jour à gérer.
Pour une pension : aucun besoin. Le navigateur de la gérante suffit, et c'est justement l'avantage de la PWA.

## Diapo 8 · Comparaison (0:40)

Ne pas tout lire. Trois lignes à retenir : le code réutilisé, 100 % pour la PWA et la TWA, environ 95 % pour l'hybride. Le coût d'entrée : 0 euro, 25 dollars une fois, 99 dollars par an. Et le point qui compte : la PWA, la TWA et l'hybride se distinguent par ce qu'elles donnent en plus : la distribution pour la TWA, le matériel et l'iPhone pour l'hybride, le système de l'ordinateur pour le desktop.

## Diapo 9 · Limites sur iPhone (0:40)

Pas d'invite d'installation : il faut passer par Partager, puis Sur l'écran d'accueil. Les notifications ne marchent que si la PWA est installée, depuis iOS 16.4. Pas de Background Sync : c'est important pour la suite, car la synchronisation se fera application ouverte. Ni Web NFC ni Web Bluetooth.
Mon choix : la PWA suffit. Une couche native ne se justifie que pour une capacité qu'aucune API Web ne donne.

## Diapo 10 · Partie 2, le hors ligne : pourquoi ? (0:30)

Sur le terrain, la cour et les chenils captent mal. Il faut deux choses sans réseau. Lire : la fiche du chien, ses allergies, le vétérinaire, le téléphone du propriétaire. Écrire : enregistrer l'arrivée ou le départ d'un chien. Et surtout retrouver ses données proprement quand le réseau revient : c'est cette dernière partie que je vais détailler.

## Diapo 11 · Trois couches (0:50)

Trois briques simples. Le service worker, pour que l'application s'ouvre sans réseau. IndexedDB, la base du navigateur, qui garde la copie de la journée. Et une file d'attente, qui garde les gestes faits sans réseau pour les envoyer plus tard. Dans la base, deux magasins : un pour l'instantané de la journée, un pour la file.

## Diapo 12 · Le service worker (0:50)

Trois règles. Les fichiers statiques et les icônes : cache d'abord, donc l'application démarre. Une page demandée : réseau d'abord ; sans réseau, on affiche ma page /offline, préchargée à l'installation. Et la règle la plus importante : les pages du back-office et les API ne sont JAMAIS mises en cache, car ce sont des données de clients qui resteraient lisibles après la déconnexion. À chaque activation, les anciens caches sont supprimés.

## Diapo 13 · L'instantané de la journée (0:50)

Quand il y a du réseau, l'application télécharge un instantané : les séjours confirmés ou en cours aujourd'hui, avec la fiche de chaque chien : allergies, régime, comportement, vétérinaire, propriétaire et téléphone, vaccins. Volontairement exclus : l'historique, la facturation, l'adresse et l'e-mail. Il est stocké dans IndexedDB et mis à jour à l'ouverture, au retour du réseau et quand on revient sur l'application. Il est effacé à la déconnexion, et si la session expire.

## Diapo 14 · Enregistrer un geste sans réseau (0:50)

Je clique sur Arrivée. Le geste est ajouté à la file d'attente avec : un identifiant, la réservation, l'action arrivée ou départ, le nom du chien, et surtout l'heure réelle du geste. L'écran se met à jour tout de suite dans la copie locale, et un message dit : enregistrée sur cet appareil, synchronisée au retour du réseau. La file ne contient que des identifiants, aucune fiche de client.
→ **DÉMONSTRATION 1A juste après cette diapo** (voir plus bas). Dire : « Je vous le montre sur mon téléphone. »

## Diapo 15 · Le retour du réseau : la synchronisation (1:30)

(Le téléphone est toujours en mode avion.) C'est la diapositive centrale. Le déclencheur : l'événement online du navigateur, l'ouverture de l'application, ou le retour sur l'application.
Étape un : on rejoue la file, dans l'ordre des heures de geste, en envoyant au serveur l'action et l'heure.
Étape deux : on regarde la réponse du serveur pour chaque geste. Succès : le geste est retiré de la file. 409 ou 404 : le geste n'a plus de sens, par exemple le chien est déjà parti ; il est ignoré et signalé, pas rejoué. 401 : la session a expiré ; on garde le geste et on demande de se reconnecter. Réseau coupé ou erreur serveur : on s'arrête, les gestes restent, on réessaiera.
Étape trois, seulement si la file est vide : on retélécharge un instantané frais. Sinon on écraserait l'état local des gestes pas encore envoyés.
Principe : on ne perd jamais un geste en silence.

## Diapo 16 · Pourquoi garder l'heure réelle du geste (0:30)

Sans l'heure du geste, le serveur daterait l'arrivée au moment de la synchronisation, parfois des heures après. Le geste emporte donc son heure, le serveur la reprend, et la file est rejouée dans l'ordre de ces heures. L'historique de la pension reste fidèle à ce qui s'est vraiment passé.
→ **DÉMONSTRATION 1B juste après cette diapo** : « Voyons ce que ça donne : je rétablis le réseau. »

## Diapo 17 · Limites et preuves (0:50)

Limites assumées : sur iPhone, pas de Background Sync, donc la file se rejoue application ouverte. Seuls l'arrivée et le départ se font hors ligne, pas la création d'une réservation. Un conflit n'est pas fusionné : il est signalé. Et il faut changer la version du service worker à chaque déploiement qui modifie les ressources.
Preuves : des tests de bout en bout dans un vrai Chromium : application ouverte sans réseau, arrivée rejouée avec son heure, geste devenu impossible signalé, effacement à la déconnexion. Plus des tests unitaires de la synchronisation.

## Diapo 18 · Partie 3, la notification push (1:00)

Le navigateur s'abonne avec la clé publique du serveur ; l'abonnement est enregistré. Un événement métier déclenche l'envoi, signé avec la clé privée VAPID, qui reste sur le serveur. Le service de push du navigateur livre le message et le service worker l'affiche, même application fermée.
Trois alertes : nouvelle réservation, stock bas, envoyé une seule fois au franchissement du seuil, et vaccins à renouveler, par une tâche quotidienne. Validé en production sur Chrome PC et sur mon iPhone avec la PWA installée. Sur iPhone : seulement si la PWA est installée.
→ **DÉMONSTRATION 2 juste après cette diapo.**

## Diapo 19 · En bref : paiement sécurisé et NFC (0:40)

Une seule idée : le site ne voit jamais l'empreinte ni la carte. Passkey : l'appareil vérifie l'empreinte ou le visage, le serveur reçoit seulement une signature. Payment Request : la feuille de paiement est celle du navigateur, le site reçoit un jeton, le serveur décide du montant. Web NFC : Chrome sur Android seulement, il ne lit pas les cartes bancaires, et je ne l'ai pas implémenté.
⚠ Le paiement en ligne n'est pas prévu dans mon application : j'ai une page de démonstration, sans débit. Sur iPhone seul Apple Pay existe, il demande un compte développeur, donc je simule. Je peux la montrer si on me le demande.

## Diapo 20 · Conclusion (0:30)

Trois idées. Le hors ligne repose sur trois briques simples : service worker, IndexedDB, file d'attente. Au retour du réseau, les gestes sont rejoués dans l'ordre avec leur heure réelle, et les conflits sont signalés, jamais perdus en silence. Et une couche native ne se justifie que pour une capacité qu'aucune API Web ne donne. Merci, je prends vos questions.

---

# Comment faire chaque démonstration en direct

## Avant (la veille, puis 10 minutes avant)

- **Montrer l'iPhone au jury** : le plus simple est de brancher l'iPhone à un Mac et d'ouvrir QuickTime (Fichier, Nouvel enregistrement vidéo, choisir l'iPhone), ou de le tenir devant une caméra de table. Sinon, racontez ce qui s'affiche. Tester le dispositif la veille.
- L'iPhone doit avoir **la PWA installée** (icône sur l'écran d'accueil), être **connecté en gérant**, et avoir **les notifications activées** (bouton dans la barre latérale du back-office).
- **Ne pas être en mode ne pas déranger** : il masquerait la notification de la démo 2. Fermez plutôt les autres applications bruyantes.
- **Recharger les données de démonstration en production** avant chaque répétition (et le matin de l'oral) : `bash scripts/demo-prod.sh 8` depuis Git Bash, à la racine du projet. Il ajoute 8 arrivées fraîches pour **aujourd'hui** et remet le stock « Démo » juste au-dessus du seuil ; il n'efface rien. Les arrivées des jours précédents non accueillies restent dans la liste : sans importance.
- Chaque répétition **consomme** une réservation (une arrivée enregistrée ne se refait pas) et du stock : préparez-en pour la répétition **et** pour l'oral (voir plus bas).
- Prévoir un **plan B** : une courte vidéo d'écran de chaque démonstration dans la galerie du téléphone.

## Démo 1A · Mode avion (après la diapo 14, ≈ 1 min)

**Préparation** : sur le PC, créez ou repérez une réservation **« confirmée » pour aujourd'hui**, pas encore accueillie, avec un chien dont la fiche est remplie (allergies, vétérinaire, propriétaire). Sur l'iPhone, **ouvrez l'application avec du réseau, 1 minute avant** : c'est ce qui télécharge l'instantané de la journée. Sans cela, la page hors ligne affiche « Aucune copie locale de la journée ».

1. Activez le **mode avion** et **vérifiez que le Wi-Fi est bien éteint** (sur iPhone, le Wi-Fi peut rester allumé en mode avion).
2. Ouvrez l'application depuis son icône. La page **« Vous êtes hors connexion »** s'affiche avec la journée. Dites : « tout vient de la base du navigateur, pas du réseau. »
3. Ouvrez la fiche du chien : allergies, vétérinaire, propriétaire, vaccins lisibles.
4. Appuyez sur **Arrivée** : le message dit que l'arrivée est enregistrée sur cet appareil et sera synchronisée au retour du réseau, et le compteur affiche **« 1 geste(s) en attente de synchronisation »**.
5. **Laissez le téléphone en mode avion**, posez-le, et repassez aux diapos : « voyons comment ce geste va revenir au serveur. »

## Démo 1B · Retour du réseau (après la diapo 16, ≈ 40 s)

1. **Désactivez le mode avion** (et remettez le Wi-Fi). **Gardez l'application ouverte au premier plan** : sur iPhone la synchronisation ne se fait que application ouverte.
2. Après quelques secondes, le message **« 1 geste(s) synchronisé(s) »** apparaît. S'il tarde, quittez l'application et revenez-y : le retour sur l'application relance la synchronisation.
3. Sur le **PC**, rechargez le tableau de bord ou la liste des réservations : le chien apparaît comme accueilli. Dites : « le serveur a reçu le geste avec son heure réelle. » ⚠ Vérifiez en répétition **où** l'heure d'arrivée s'affiche dans l'application avant de la montrer.

**Si le geste est déjà fait côté serveur** (par exemple vous avez répété avec la même réservation), le serveur répond 409 : le geste est **ignoré et signalé** avec un message. Ce n'est pas un bug, c'est le comportement prévu (diapo 15) : vous pouvez en faire une démonstration volontaire en cas de question.

## Démo 2 · Notification push (après la diapo 18, ≈ 1 min)

**Préparation** : sur le PC, connecté en gérant, créez un produit de démonstration (Stock, puis le bouton « Ajouter un produit ») avec une **quantité juste au-dessus du seuil**, par exemple quantité 12 et seuil 10. L'alerte n'est envoyée **qu'au franchissement du seuil** (de « au-dessus » à « au seuil ou en dessous »), pas à chaque sortie.

1. iPhone déverrouillé, écran visible, PWA installée et notifications activées. L'application peut être ouverte ou en arrière-plan.
2. Sur le PC : ouvrez la fiche du produit, **Type de mouvement : Sortie**, quantité **2** (12 vers 10), puis **Enregistrer le mouvement**.
3. En quelques secondes, la notification **« Stock bas »** arrive sur l'iPhone, avec le nom du produit, la quantité restante et le seuil. Montrez-la au jury.
4. **Touchez-la** : l'application s'ouvre sur la page Stock.
5. Pour **rejouer** : faites une **Entrée** de 5 sur le produit (retour au-dessus du seuil), puis une nouvelle sortie.

**Plan B** : le workflow GitHub Actions des rappels de vaccins envoie aussi une notification (« Vaccins à renouveler »), ou la vidéo.

## Démo 3 · Passkey et paiement (facultative, seulement si on vous le demande, après la diapo 19)

1. Sur l'iPhone, ouvrez `amour2poils.duckdns.org/demo/paiement` (gérance). **Me vérifier** : Face ID ou Touch ID. Dire : « le serveur ne voit jamais mon empreinte, il reçoit une signature. »
2. **Demander le montant au serveur** : le montant s'affiche. Dire : « le montant vient du serveur, pas du navigateur. »
3. **Payer** : l'application explique qu'Apple Pay exige un compte Apple Developer. Appuyez sur **Simuler le paiement** : « sur iPhone je simule ; le serveur, lui, revérifie vraiment le montant. »
4. ⚠ La vraie feuille **Google Pay** (mode TEST) ne s'ouvre que sur Chrome, PC ou Android, et je ne l'ai pas vérifiée sur un appareil réel : essayez-la la veille avant de la promettre.

## Pièges à éviter

- Démarrer la démo 1 **sans avoir ouvert l'application avec du réseau juste avant**.
- Oublier d'éteindre le **Wi-Fi** (le téléphone n'est alors pas vraiment hors ligne).
- Réutiliser une réservation déjà accueillie (le geste sera ignoré, 409).
- Une démo push avec un produit **déjà sous son seuil** : aucune alerte, car le seuil n'est pas franchi.
- Écran de connexion visible devant le jury : connectez-vous en avance.
