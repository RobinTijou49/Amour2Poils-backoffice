# Notes de présentateur à coller dans Canva (une par diapositive)

Comment faire : dans Canva, sélectionnez la diapositive, cliquez sur **Notes** (en bas de l'éditeur), collez le bloc correspondant.
Pendant l'oral, ouvrez la **Vue du présentateur** (application Canva Mac ou Windows, ou navigateur sur ordinateur) : seul vous voyez les notes.

Chaque bloc est du texte brut, sans mise en forme. « ⚠ » marque ce qui n'est **pas vérifié** : ne l'affirmez pas. Durée totale visée : 19 minutes.
Le détail des démonstrations et les questions probables sont dans `docs/oral-script-theme6.md`.

---

## Diapo 1 · Titre (0:20)

Je présente le thème 6 : ce qu'une PWA permet vraiment, et à partir de quand il faut aller plus loin. Mon fil rouge est mon projet, Amour 2 Poils, le back-office d'une pension canine.

## Diapo 2 · Plan (0:20)

Trois parties. Un : comparer quatre façons de livrer l'application, PWA, TWA, hybride et desktop. Deux : un paiement sécurisé avec empreinte et NFC. Trois : une notification push. Deux démonstrations en direct.

## Diapo 3 · Ce qu'une PWA sait faire (1:20)

Le tableau en trois phrases. Un : installation, hors ligne, push, biométrie et paiement existent sous forme d'API Web. Deux : seule la NFC est limitée, Chrome sur Android seulement. Trois : tout dépend du navigateur, surtout sur iPhone.
Mon contexte : un gérant et quelques employés, sur téléphone, parfois sans réseau dans la cour. Pas de capteur exotique.

## Diapo 4 · Quatre façons de livrer (0:30)

Du plus simple au plus lourd : un lien pour la PWA, le Play Store pour la TWA, les stores mobiles pour l'hybride, un installeur pour le desktop. Même application, quatre emballages.

## Diapo 5 · PWA (0:50)

Un site, plus un manifeste, plus un service worker. Un seul code, mise à jour immédiate, zéro euro.
Dans mon projet : un service worker écrit à la main, une centaine de lignes. Il ne met jamais en cache les pages ni les API, car ce sont des données de clients. Seul un instantané de la journée est stocké sur l'appareil, effacé à la déconnexion.

## Diapo 6 · TWA (0:50)

Une Trusted Web Activity : une application Android minimale qui affiche mon site dans Chrome, en plein écran, sans barre d'adresse. Elle n'ajoute aucune capacité, elle ajoute de la distribution.
Un fichier assetlinks.json prouve que je possède le site : il est en ligne et Google le reconnaît.
⚠ Je n'ai pas construit l'application ni testé sur Android. Compte Play Store : 25 dollars, une fois, seulement pour publier.

## Diapo 7 · Hybride, c'est quoi (0:40)

Une application mobile, iOS ou Android, qui contient mon site dans une WebView, c'est-à-dire un navigateur intégré. Des plugins font le pont avec le téléphone : tout ce que le navigateur ne sait pas faire. Elle se publie sur les stores comme une vraie application, et réutilise environ 95 % du code.

## Diapo 8 · Hybride avec Capacitor (0:35)

Capacitor emballe le site en application iOS et Android. Possibilités : caméra, fichiers, GPS, Bluetooth, NFC, biométrie, notifications natives. Coût : 99 dollars par an chez Apple, 25 dollars chez Google, plus la revue par les stores.
C'est la voie logique si, et seulement si, une API Web manque.

## Diapo 9 · Desktop, c'est quoi (0:25)

Une application installable sur Windows, macOS ou Linux, qui affiche le site. Elle accède à ce que le navigateur interdit : fichiers, imprimante, USB, démarrage automatique. Exemples connus : Visual Studio Code, Slack, Discord.

## Diapo 10 · Electron ou Tauri (0:35)

Electron embarque un navigateur complet, Chromium : environ 100 mégaoctets, très mature. Tauri utilise le navigateur déjà présent dans le système, avec du Rust : environ 5 mégaoctets. Dans les deux cas : signature du code payante et mise à jour à prévoir.
Aucun besoin ici : le navigateur suffit au poste de la gérante.

## Diapo 11 · Comparaison (1:00)

Ne pas tout lire. Trois lignes à retenir. Le code réutilisé : 100 % pour PWA et TWA, environ 95 % pour l'hybride. Le coût d'entrée : 0 euro, 25 dollars une fois, 99 dollars par an. Et la ligne iPhone : la PWA seule s'arrête là où commence l'hybride.

## Diapo 12 · Limites sur iPhone (0:45)

Pas d'invite d'installation : il faut passer par Partager, puis Sur l'écran d'accueil. Les notifications ne marchent que si la PWA est installée, depuis iOS 16.4. Pas de Background Sync. Ni Web NFC ni Web Bluetooth. C'est ce qui peut faire pencher vers l'hybride.

## Diapo 13 · Notre choix (0:30)

La PWA suffit ici. La TWA seulement si on veut l'icône du Play Store. L'hybride si un besoin natif apparaît, par exemple lire une puce NFC sur iPhone. Le desktop : pas de besoin.
Règle à retenir : une couche native ne se justifie que pour une capacité qu'aucune API Web ne donne.

## Diapo 14 · Partie 2, paiement sécurisé (0:40)

Trois briques : Payment Request, WebAuthn, et le prestataire de paiement. Le site ne manipule jamais ni le numéro de carte ni l'empreinte.
⚠ À dire clairement : dans mon application le paiement en ligne n'est pas prévu. Je le présente comme une démonstration, sans aucun débit.

## Diapo 15 · Payment Request (0:50)

Le navigateur dessine lui-même la feuille de paiement, le site n'y touche pas. Il ne reçoit qu'un jeton à usage unique. Le prestataire débite, le serveur valide.
Point clé : c'est le serveur qui décide du montant, en centimes. Le navigateur ne le décide jamais.

## Diapo 16 · WebAuthn (0:50)

Le téléphone vérifie l'empreinte ou le visage en local. Le serveur reçoit seulement une signature d'un défi qui change à chaque fois, et la vérifie avec la clé publique. La passkey est liée au nom de domaine : sur un faux site, elle ne se déclenche pas. C'est ce qui protège de l'hameçonnage.

## Diapo 17 · Web NFC (0:40)

⚠ Il faut être précis. Web NFC lit et écrit des étiquettes NFC. Il fonctionne seulement sur Chrome pour Android, ni iPhone ni ordinateur. Et il ne lit pas les cartes bancaires : le sans contact bancaire passe par le portefeuille du téléphone.
Usage réaliste chez nous : la puce ou le badge d'un chien. Non implémenté dans mon projet.

## Diapo 18 · Paiement de bout en bout (0:30 + démo 2:00)

Le parcours : passkey, puis montant décidé par le serveur, puis feuille de paiement, puis jeton, puis le serveur revérifie. Principes : le serveur valide tout, les montants sont en centimes entiers.
DÉMO PAIEMENT ICI (voir la checklist du script) : sur l'iPhone, Face ID, demande du montant, puis simulation. Dire sans détour : sur iPhone seul Apple Pay existe, il demande un compte développeur, donc je simule ; le serveur, lui, revérifie vraiment le montant.
⚠ Feuille Google Pay réelle seulement sur Chrome PC, à essayer la veille.

## Diapo 19 · Partie 3, push (0:50)

Le navigateur s'abonne avec la clé publique du serveur. L'abonnement est enregistré en base. Un événement métier déclenche l'envoi, signé avec la clé privée VAPID, qui ne quitte jamais le serveur. Le service de push du navigateur livre le message, et le service worker l'affiche, même application fermée.

## Diapo 20 · Notre mise en place (0:50)

Trois alertes : nouvelle réservation, stock bas, envoyée une seule fois au franchissement du seuil, et vaccins à renouveler, par une tâche quotidienne sur GitHub Actions.
Validé en production, sur Chrome PC et sur mon iPhone avec la PWA installée.

## Diapo 21 · Démonstration push (1:30)

Téléphone déverrouillé, notifications activées, mode ne pas déranger désactivé. Sur le PC : une sortie de stock qui franchit le seuil. Dans quelques secondes la notification Stock bas arrive. Je la touche : l'application s'ouvre sur la bonne page.
Plan B : vidéo ou captures prêtes.

## Diapo 22 · Limites et sécurité du push (0:40)

Sur iPhone : seulement si la PWA est installée. L'autorisation se demande après un geste, et un refus peut être définitif. Contenu minimal dans la notification : rien de sensible sur un écran verrouillé. J'ai trouvé et corrigé une redirection ouverte dans le service worker.
⚠ La purge d'un abonnement expiré est écrite, mais pas testée en vrai.

## Diapo 23 · Conclusion (0:30)

La PWA couvre installation, hors ligne, push, biométrie et paiement par des API Web. TWA, hybride et desktop ne se justifient que pour une capacité manquante ou une distribution précise. Et dans tous les cas, le site ne voit jamais la carte ni l'empreinte, et le serveur valide tout. Merci, je prends vos questions.
