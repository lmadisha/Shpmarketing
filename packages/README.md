# packages/

Shared libraries and future add-on modules live here, one directory per package (e.g. `packages/shared-types`, `packages/<add-on>`).

Conventions:

- Each package is self-contained with its own `package.json`.
- Apps in `apps/` consume packages via `file:` references or npm workspaces (to be introduced when the first package lands).
- Keep cross-app code here instead of duplicating between `apps/frontend` and the APIs.
