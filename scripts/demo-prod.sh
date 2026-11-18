#!/usr/bin/env bash
# Recharge les données de démonstration EN PRODUCTION (n'efface rien) : `bash scripts/demo-prod.sh [arrivées]`.
# À lancer avant chaque répétition : de nouvelles arrivées du jour, et le stock « armé » remis juste au-dessus du seuil.
# Détecte lui-même l'image déployée (le déploiement change l'étiquette à chaque push), puis exécute prisma/seed-extra.ts.
#
# Variables facultatives : DEPLOY_KEY (défaut ~/.ssh/amour2poils_deploy), DEPLOY_HOST (défaut robin@180.149.196.131).
set -euo pipefail

ARRIVALS="${1:-8}"
KEY="${DEPLOY_KEY:-$HOME/.ssh/amour2poils_deploy}"
HOST="${DEPLOY_HOST:-robin@180.149.196.131}"

[[ "$ARRIVALS" =~ ^[0-9]+$ ]] || { echo "Usage : bash scripts/demo-prod.sh [nombre d'arrivées, 0 à 30]" >&2; exit 2; }
[[ -f "$KEY" ]] || { echo "Clé SSH introuvable : $KEY (définir DEPLOY_KEY)." >&2; exit 2; }

# Le script distant ne reçoit que le nombre d'arrivées, déjà validé comme un entier.
ssh -i "$KEY" -o BatchMode=yes -o ConnectTimeout=20 "$HOST" "ARRIVALS=$ARRIVALS bash -s" <<'REMOTE'
set -euo pipefail
cd ~/amour2poils
# Image réellement déployée : « dépôt:étiquette » du conteneur de l'application.
IMAGE="$(docker inspect --format '{{.Config.Image}}' amour2poils-app-1)"
export IMAGE_REPO="${IMAGE%:*}" TAG="${IMAGE##*:}"
echo "Image déployée : ${TAG:0:7}"
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm -T --no-deps migrate bun prisma/seed-extra.ts "$ARRIVALS" 2>&1 | grep -v "^ Container"
REMOTE
