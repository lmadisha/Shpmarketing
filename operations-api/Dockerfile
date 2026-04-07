FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY operations-api/package.json operations-api/package-lock.json ./
RUN npm ci

COPY operations-api/ ./
RUN npx prisma generate
RUN npm prune --omit=dev

ENV PORT=5001

EXPOSE 5001

CMD ["node", "server.js"]
