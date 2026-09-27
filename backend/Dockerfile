FROM node:22-alpine AS build
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine AS runner
WORKDIR /usr/src/app
ENV NODE_ENV=production PORT=3001
COPY --from=build --chown=node:node /usr/src/app/package*.json ./
COPY --from=build --chown=node:node /usr/src/app/node_modules ./node_modules
COPY --from=build --chown=node:node /usr/src/app/dist ./dist
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD wget -qO- http://127.0.0.1:3001/api/v1/health || exit 1
# RUN_MIGRATIONS=true (Coolify) runs pending migrations first, behind an advisory lock.
# docker-compose.yml leaves it off and uses its one-off `migrate` service instead.
CMD ["sh", "-c", "if [ \"$RUN_MIGRATIONS\" = true ]; then node dist/database/migrate.js || exit 1; fi; exec node dist/main.js"]
