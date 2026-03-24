
# Shpmarketing

Frontend dashboard (Vite + React) with a companion operations API (Express + PostgreSQL).

## Workspace Layout

- Root: frontend app
- operations-api: backend API service

All commands below are relative to the repository root, so moving this folder does not require path edits.

## Frontend Commands

```bash
npm install
npm run dev
npm run build
npm run lint
npm run test
```

`npm run dev` starts both the frontend and `operations-api`. To run only the Vite app, use `npm run dev:frontend`.

## Operations API Commands

```bash
cd operations-api
npm install
npm run dev
npm run lint
npm run test
```

## Dependency Security and Update Path

Run these regularly in both root and operations-api:

```bash
npm run deps:outdated
npm run deps:update
npm run deps:audit
```

If audit findings are acceptable to auto-remediate:

```bash
# operations-api only
npm run deps:fix
```

## Environment

- Root frontend env: .env.example -> .env
- API env: operations-api/.env.example -> operations-api/.env
  
