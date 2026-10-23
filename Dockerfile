# Image de production en plusieurs étapes : seule la dernière (`runner`) est déployée.
#   docker build --target runner  -t amour2poils .          # l'application
#   docker build --target migrate -t amour2poils-migrate .  # migrations + création du premier compte
# Le code utilise Bun.password (argon2id) : l'application tourne donc sous Bun, pas sous Node.

# 1. Dépendances (couche mise en cache tant que bun.lock ne change pas)
FROM oven/bun:1-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
# --ignore-scripts : le postinstall lance `prisma generate`, qui a besoin du schéma (copié plus loin).
RUN bun install --frozen-lockfile --ignore-scripts

# 2. Build : client Prisma puis Next.js (sortie « standalone »)
FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# L'URL n'est lue qu'à l'exécution ; cette valeur factice permet seulement au build de s'exécuter.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" bun --bun prisma generate \
 && DATABASE_URL="postgresql://build:build@localhost:5432/build" bun --bun next build

# 3a. Outil de migration : uniquement la CLI Prisma, le schéma, les migrations et le client généré.
#     Versions exactes = celles de bun.lock (le tag `latest` de Prisma est une version 8 incompatible).
FROM oven/bun:1-alpine AS migrate
WORKDIR /app
RUN printf '{"name":"migrate","private":true,"dependencies":{"prisma":"7.10.1","@prisma/client":"7.10.1","@prisma/adapter-pg":"7.10.1"}}' > package.json  && bun install
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY --from=build /app/src/generated ./src/generated
RUN chown -R bun:bun /app
USER bun
CMD ["bun", "--bun", "prisma", "migrate", "deploy"]

# 3b. Application : uniquement le serveur standalone, les fichiers statiques et public/
FROM oven/bun:1-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
# Le standalone n'inclut ni .next/static ni public/ (sw.js, icônes) : on les copie explicitement.
COPY --from=build --chown=bun:bun /app/.next/standalone ./
COPY --from=build --chown=bun:bun /app/.next/static ./.next/static
COPY --from=build --chown=bun:bun /app/public ./public
USER bun
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["bun", "server.js"]
