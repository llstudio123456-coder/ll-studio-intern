# ─────────────────────────────────────────────────────────────
# LL Studio Inspector — Production-Image für Node-Hosts
# (Railway / Render / Fly.io / eigener VPS mit Docker)
#
# Warum kein Vercel: Die App braucht (a) echtes Chromium via Playwright für
# URL-Analyse, Website-Scores, Screenshots und den 1:1-Klon und (b) einen
# persistenten Datenträger für SQLite + .data/*.json. Beides gibt es auf
# Serverless nicht. Dieses Image löst beides.
#
# WICHTIG: Der Datenträger muss auf LLI_DATA_DIR (/data) gemountet werden,
# sonst sind Kunden, Pipeline und Reports nach jedem Deploy weg.
# ─────────────────────────────────────────────────────────────

# ── Stufe 1: Build ──
FROM node:22-bookworm-slim AS builder
WORKDIR /app

# Im Builder werden keine Browser gebraucht → Download sparen (schnellerer Build)
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV NEXT_TELEMETRY_DISABLED=1

# Zuerst nur die Manifeste → Docker-Layer-Cache für npm ci
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stufe 2: Runtime ──
FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Browser an einen festen, vom Runtime-User lesbaren Ort
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
# Alle Speicher (SQLite + JSON) lesen diesen Pfad – hier muss das Volume hängen
ENV LLI_DATA_DIR=/data

# Produktions-Abhängigkeiten. Der postinstall-Hook zieht Chromium passend zur
# installierten Playwright-Version; --with-deps ergänzt die System-Bibliotheken.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
  && npx playwright install --with-deps chromium \
  && npm cache clean --force \
  && rm -rf /root/.npm

# Build-Artefakte aus Stufe 1
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./next.config.mjs

# Fallback-Datenverzeichnis, falls (noch) kein Volume gemountet ist
RUN mkdir -p /data

EXPOSE 3000
# next start übernimmt PORT automatisch (Railway/Render setzen die Variable)
CMD ["npm", "run", "start"]
