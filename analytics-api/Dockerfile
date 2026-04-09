FROM node:20-bookworm-slim

WORKDIR /app

COPY analytics-api/package.json analytics-api/package-lock.json ./
RUN npm ci --omit=dev

COPY analytics-api/ ./

ENV PORT=5002

EXPOSE 5002

CMD ["node", "server.js"]
