# Design System (current state)

Snapshot of the **as-built** visual design of the FrostLink frontend (`apps/frontend`), captured from `assets/css/` and the component library. This is descriptive (what exists today), not aspirational — use it as the baseline before any redesign so new work stays consistent. Component inventory: [CODEBASE.md](CODEBASE.md).

> ⚠️ **Known tension:** `assets/css/theme.css` defines a full shadcn-style token set (oklch, `--primary: #030213`, etc.), but most components **do not use those tokens** — they hardcode Tailwind utility colors (`slate-*`, brand `#006aea`, `emerald/amber/red`). The token layer is largely dormant. A redesign should decide: adopt the tokens, or formalize the utility palette actually in use. Both are documented below.

## Foundations

### Typography
- **Font:** Inter (Google Fonts), weights 400/500/600/700; fallback `system-ui, -apple-system, sans-serif` (`fonts.css`).
- **Base size:** `--font-size: 16px` on `html`.
- **Weights:** `--font-weight-normal: 400`, `--font-weight-medium: 500`. Headings use medium; semibold (600) is applied ad-hoc via `font-semibold` in components.
- **Heading ramp** (`theme.css` base layer): `h1`=text-2xl, `h2`=text-xl, `h3`=text-lg, `h4`/`label`/`button`=text-base, all line-height 1.5.
- In practice page titles use `text-2xl`/`text-3xl font-semibold text-slate-900`; metric values `text-3xl font-semibold`.

### Color — palette actually in use (utility classes)

| Role | Value | Where |
|---|---|---|
| **Brand / primary action** | `#006aea` (hover `#005bcc`) | Button default, links, active nav |
| **Success** | `#00DD16` (hover `#00BF13`) | Button success |
| Text primary | `slate-900` | Headings, values |
| Text secondary | `slate-500` / `slate-600` / `slate-700` | Labels, body, captions |
| Surfaces | `white` on `slate-50` | Cards on page bg |
| Borders / dividers | `slate-200` | Card borders, table rules |
| Destructive | `red-600` (button), `red-200`/`red-50`/`red-600` (alerts) | Delete, errors |

**Status colors** (semantic, `StatusBadge.vue`):

| Status | Classes |
|---|---|
| `ok` | `bg-emerald-100 text-emerald-700` |
| `med` / `warn` | `bg-amber-100 text-amber-700` |
| `high` / `bad` | `bg-red-100 text-red-700` |
| `no-data` | `bg-slate-100 text-slate-500` |

**Chart colors** (passed inline, not tokenized):
- Fleet health pie (from analytics-api): On `#10b981` · Powered-off `#f59e0b` · Inactive `#ef4444`.
- Unit-detail trends: door `#2563eb` · temperature `#10b981` · powered `#8b5cf6` · voltage `#ea580c`.

### Color — token layer (defined, mostly unused)
`theme.css` `:root` + `.dark` define oklch-based shadcn tokens exposed via `@theme inline` as `--color-*` (background, foreground, card, primary `#030213`, secondary, muted, accent, destructive `#d4183d`, border, ring, chart-1..5, sidebar-*). A `.dark` variant exists for all of them. **Dark mode is wired at the token level but components hardcode light colors, so it is not actually functional in the UI today.** Color mode preference is `light` (`nuxt.config.ts`, `@nuxtjs/color-mode`).

### Radius
`--radius: 0.625rem` (10px) with derived `--radius-sm/md/lg/xl`. In practice: cards `rounded-xl`, buttons/inputs `rounded-md`, badges `rounded-full`, small buttons `rounded-sm`.

### Spacing & layout
- Page container: `mx-auto max-w-[1440px]`, padding `p-4 md:p-6 lg:p-8`, vertical rhythm `space-y-6`.
- Card internal padding: `p-5` (headers and bodies), section headers separated by `border-b border-slate-200`.
- Filter/toolbar bar: `border-b border-slate-200 bg-white px-4 py-3 md:px-6`, controls `flex flex-col gap-3 lg:flex-row`.
- Grid patterns: metric rows `grid gap-4 md:grid-cols-2 xl:grid-cols-5`; chart rows `xl:grid-cols-3`.
- Elevation: `shadow-sm` on cards; buttons `shadow`/`shadow-xs`.

## Components

### UI primitives (`components/ui/`)
- **Button** — CVA variants: `default` (brand `#006aea`), `destructive`, `outline`, `secondary`, `success` (`#00DD16`), `ghost`, `link`. Sizes: `default` h-9, `sm` h-8, `lg` h-12, `icon` 9×9. Focus ring `ring-blue-500`. Disabled `opacity-50`.
- **Card** — `rounded-xl border border-slate-200 bg-white shadow-sm`; content via slot (callers add `p-5`).
- **Badge** — `rounded-full px-2.5 py-1 text-xs font-medium`; variants `default` (slate-900), `secondary`, `outline`, `destructive` (red-100/700), `success` (emerald-100/700).
- **Input / Select / Textarea / Label** — slate-bordered form controls; Select supports searchable + keyboard nav.
- **ModalDialog** — teleported, backdrop, Escape-close, header/footer slots.

### Dashboard components (`components/dashboard/`)
- **MetricCard** — title (slate-500) + `text-3xl font-semibold` value + optional subtitle + optional change pill (emerald/red/slate with arrow icon).
- **StatusBadge** — wraps Badge, maps 6 status values → emerald/amber/red/slate (see table).
- **PieChart** — conic-gradient pie + legend + %; takes `items: {label,value,color?}` and `size`.
- **TrendChart** — SVG line chart, hover tooltip, grid, legend; props `points`, `color`, `y-label`, `unit`.
- **DistributionBars**, **TierBadge**, **InsightCard**, **AIAssistantDrawer** — see CODEBASE.md.

### Icons
`lucide-vue-next` throughout (e.g. `RefreshCw`, `Download`, `ArrowUpDown`, chevrons). Sized `h-3.5/h-4`.

## Patterns & conventions
- **Page shell:** sticky-style filter bar (date / tenant / action) at top, then `max-w-[1440px]` content with `space-y-6` cards.
- **Data tables:** `min-w-full divide-y divide-slate-200`, `thead bg-slate-50` uppercase `text-xs text-slate-500`, sortable headers with lucide arrow, client-side paginate (PAGE_SIZE 25), CSV+Excel export buttons, count Badge.
- **Loading/empty/error:** inline — red alert box for errors, centered slate-500 text for empty, button label swaps to "Loading…".
- **Links:** brand `#006aea hover:underline`; MAC addresses `font-mono`.
- **Brand accent is hardcoded `#006aea`** across pages (not a token/Tailwind color) — search-and-replace risk if rebranding.

## Gaps / cleanup candidates (for redesign)
1. **Token vs utility split** — adopt `theme.css` tokens or codify the utility palette; pick one source of truth (esp. brand `#006aea`, status colors, chart colors).
2. **Dark mode** — defined in tokens but non-functional; either implement or drop.
3. **Duplicated logic** — flag→status normalization differs between performance-report (`normalizeFlag`) and unit-detail (`flagToStatus`); chart colors and row types are copy-pasted. Lift into shared `composables/`+`types/`.
4. **No shared chart color constants** — fleet/trend colors are inline literals.
5. **Limited primitive set** — no Tabs, Tooltip, Skeleton, Toast-styled loaders (vue-sonner is a dep but unused in these pages).

## References
- Tokens/base: `apps/frontend/assets/css/theme.css`, `fonts.css`, `index.css`, `tailwind.css`
- Build: Tailwind CSS v4 via `@tailwindcss/vite` (no `tailwind.config`), radix-vue + class-variance-authority, `@nuxtjs/color-mode`
- Attribution: shadcn/ui (see `ATTRIBUTIONS.md`)
