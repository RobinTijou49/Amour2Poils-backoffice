#!/usr/bin/env bash
# Préparation unique du VPS, à lancer par l'utilisateur lui-même sur le serveur :
#   bash vps-bootstrap.sh "<clé publique de déploiement>"
# Ce script ne télécharge ni n'installe rien d'extérieur : il vérifie les prérequis, crée le dossier
# de déploiement et autorise la clé publique (celle dont la clé privée est le secret GitHub SSH_KEY).
set -euo pipefail

PUBKEY="${1:-}"
DIR=/opt/amour2poils
PORT=8082

[ -n "$PUBKEY" ] || { echo "Usage : bash vps-bootstrap.sh \"ssh-ed25519 AAAA... amour2poils-deploy\"" >&2; exit 1; }
case "$PUBKEY" in ssh-ed25519\ *) ;; *) echo "Clé publique ed25519 attendue." >&2; exit 1 ;; esac

echo "== Docker =="
command -v docker >/dev/null || { echo "Docker n'est pas installé : https://docs.docker.com/engine/install/ puis relancer." >&2; exit 1; }
docker compose version >/dev/null || { echo "Le plugin « docker compose » est manquant." >&2; exit 1; }
if ! docker info >/dev/null 2>&1; then
  echo "L'utilisateur $USER n'a pas accès à Docker. Exécuter : sudo usermod -aG docker $USER   puis se reconnecter." >&2
  exit 1
fi
docker --version

echo "== Port $PORT =="
if ss -ltn "sport = :$PORT" | grep -q LISTEN; then
  echo "Le port $PORT est déjà utilisé : choisir un autre port (docker-compose.prod.yml, Caddyfile) avant de continuer." >&2
  exit 1
fi
echo "libre"

echo "== Dossier de déploiement =="
sudo mkdir -p "$DIR"
sudo chown "$USER":"$USER" "$DIR"
if [ -f /tmp/.env.production ]; then
  install -m 600 /tmp/.env.production "$DIR/.env.production"
  rm -f /tmp/.env.production
  echo "$DIR/.env.production installé (droits 600)"
else
  [ -f "$DIR/.env.production" ] || echo "ATTENTION : $DIR/.env.production est absent (voir .env.production.example)."
fi

echo "== Clé de déploiement =="
install -m 700 -d ~/.ssh
touch ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys
grep -qF "$PUBKEY" ~/.ssh/authorized_keys || echo "$PUBKEY" >> ~/.ssh/authorized_keys
echo "clé autorisée"

echo "== Pare-feu =="
if command -v ufw >/dev/null && sudo ufw status | grep -q "Status: active"; then
  sudo ufw allow "$PORT"/tcp
else
  echo "ufw inactif ou absent : rien à ouvrir (vérifier aussi le pare-feu de l'hébergeur)."
fi

echo "Prêt. Étape suivante : créer les secrets GitHub, puis pousser sur main."
