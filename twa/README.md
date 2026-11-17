# Application Android (TWA)

Une **Trusted Web Activity** est une application Android minimale qui affiche le site en plein écran dans Chrome, sans
barre d'adresse. Elle n'ajoute aucune capacité à la PWA (mêmes API, même service worker, mêmes notifications Web Push) :
elle ajoute une **distribution** (APK installable, publication possible sur le Play Store). Android uniquement.

## Ce qui est dans le dépôt

| Fichier | Rôle |
|---|---|
| `twa/twa-manifest.json` | Configuration de Bubblewrap : identifiant `fr.amour2poils.backoffice`, domaine, couleurs, icônes, notifications |
| `public/.well-known/assetlinks.json` | **Lien de confiance** (Digital Asset Links) : déclare que ce site accepte l'application signée avec l'empreinte SHA-256 indiquée. Sans lui Chrome affiche la barre d'adresse (mode « onglet personnalisé »). Testé en E2E : public, JSON, sans redirection |
| `src/proxy.ts` | Exclut `/.well-known` de la redirection vers la connexion |

Ne sont **jamais** dans le dépôt (`.gitignore`) : la clé de signature (`*.keystore`), son mot de passe, le projet Android
généré, l'APK.

## Clé de signature

Créée une fois, hors du dépôt : `C:\Users\robin\twa-keys\amour2poils.keystore` (alias `amour2poils`), mot de passe dans
`keystore-password.txt` à côté. **À sauvegarder** (gestionnaire de mots de passe) : une application Android ne peut être mise à jour
que par la même clé. Si elle est perdue, il faut une nouvelle application. Si une nouvelle clé est créée, mettre à jour l'empreinte
dans `assetlinks.json` : `keytool -list -v -keystore amour2poils.keystore -alias amour2poils`.

## Construire l'APK

```bash
cd twa
npx @bubblewrap/cli@latest update   # génère le projet Android depuis twa-manifest.json
npx @bubblewrap/cli@latest build    # produit app-release-signed.apk (et un .aab pour le Play Store)
```

Bubblewrap télécharge lui-même un JDK 17 dans `~/.bubblewrap` ; le SDK Android est celui de `ANDROID_HOME`.
Le fichier `assetlinks.json` doit être **déployé** (`https://amour2poils.duckdns.org/.well-known/assetlinks.json`) avant de tester.

Vérifier le lien de confiance côté Google :

```bash
curl "https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://amour2poils.duckdns.org&relation=delegate_permission/common.handle_all_urls"
```

## Installer sans compte développeur

L'APK signé peut être installé **à la main** (transfert du fichier, « sources inconnues » autorisées) : aucun compte Google
Play n'est nécessaire pour cela. Un compte (25 $, une fois) n'est nécessaire que pour **publier sur le Play Store** (avec le
fichier `.aab`). L'App Store d'Apple est hors sujet : une TWA n'existe pas sur iOS.

## Limites

- **L'APK n'est pas encore construit** (le téléchargement du JDK 17 par Bubblewrap a été interrompu) et la TWA n'a jamais été lancée sur un appareil Android. Prêts : la clé de signature, `assetlinks.json`, la configuration `twa-manifest.json`. À vérifier après déploiement : le lien de confiance côté Google (commande ci-dessus).
- Si le lien de confiance échoue (mauvaise empreinte, fichier inaccessible), l'application s'ouvre quand même, **avec** la barre d'adresse.
- La TWA s'appuie sur Chrome (ou un autre navigateur compatible) installé sur le téléphone : les capacités et les notifications sont celles de ce navigateur.
