FROM node:20-bookworm AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .

ARG NUXT_PUBLIC_OPERATIONS_API_BASE=/api
ENV NUXT_PUBLIC_OPERATIONS_API_BASE=$NUXT_PUBLIC_OPERATIONS_API_BASE

RUN npm run build

FROM node:20-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY --from=build /app/.output ./.output

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
