FROM node:20-bookworm-slim

WORKDIR /app

COPY operations-api/package.json operations-api/package-lock.json ./
RUN npm ci --omit=dev

COPY operations-api/ ./

ENV PORT=5001

EXPOSE 5001

CMD ["node", "server.js"]
