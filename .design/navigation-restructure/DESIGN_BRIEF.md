# Design Brief: Navigation Restructure — Top App Bar & Profile Menu

## Problem

Account-level destinations (Workspace, Settings) sit in the **left sidebar** mixed in with the operational sections (Performance, Unit Detail, Asset Manager). For the user they don't belong there — Workspace and Settings are "about me / my account / admin", not a place in the data they're navigating. The sidebar conflates "where am I working" with "manage my account". There's also no consistent top-of-page anchor: the layout's header is commented out, identity lives only in a sidebar footer, and Sign out is a lone button.

## Solution

Introduce a persistent **global top app bar** across the dashboard. The bar carries brand identity on the left and a **user-profile menu** on the right (avatar/initials + name). Opening it reveals account destinations — **Workspace** (permission-gated), **Settings**, and **Sign out**. The left sidebar is trimmed to operational sections only. On pages that have filters (Performance Report, Unit Detail), the existing page filter bar sits directly **below** the global bar, keeping identity/navigation visually separate from page controls.

## Experience Principles

1. **Place by purpose, not by convenience** — operational navigation lives in the sidebar; account/admin actions live in the profile menu. A control's home reflects what the user is trying to do, not where there was room.
2. **One identity anchor** — the user sees their account in exactly one place (top-right). No duplicate name/sign-out across sidebar footer and header.
3. **Layered top, not stacked clutter** — the global bar is thin and constant; page filter bars remain page-owned beneath it. Two bars only where filters exist, never competing for the same role.

## Aesthetic Direction

- **Philosophy**: Quiet operational dashboard — functional, dense-but-calm, the existing FrostLink look. Chrome recedes; data leads.
- **Tone**: Clinical, trustworthy, unobtrusive.
- **Reference points**: Linear / Vercel top bars, shadcn dashboard header + avatar dropdown, current FrostLink sidebar styling.
- **Anti-references**: Heavy colored app bars, marketing-style mega headers, duplicated navigation, anything that adds vertical weight above the data.

## Existing Patterns

Must respect the current system (see `docs/DESIGN.md`).

- **Typography**: Inter; titles `text-2xl`/`font-semibold text-slate-900`; body/labels `text-sm text-slate-600`.
- **Colors**: brand `#006aea` (active state `bg-[#006aea]/10 text-[#006aea]`); surfaces white on `slate-50`; borders `slate-200`; text `slate-900`/`slate-600`/`slate-500`.
- **Spacing**: page container `mx-auto max-w-[1440px]`, padding `p-4 md:p-6 lg:p-8`; bars use `border-b border-slate-200 bg-white px-4 py-3 md:px-6`; sidebar header is `h-18`.
- **Components**: `Button` (CVA variants), `Card`, `Badge`, `Select`; icons from `lucide-vue-next`. Sidebar already uses `cn()` + collapse state. Permission checks via `hasPermission` from `utils/permissionPolicy.ts`.
- **Auth/data**: `useAuth().session.user` provides `full_name`, `username`, `permissions`, `organisation_id`. No avatar image — derive initials from `full_name` (fallback `username`).

## Component Inventory

| Component | Status | Notes |
| --- | --- | --- |
| `layouts/dashboard.vue` | Modify | Re-enable/replace the commented header with the new `AppHeader`; keep sidebar + `<main>` + AI drawer. |
| `components/layout/AppHeader.vue` | New | Global top bar: brand (left) + `UserMenu` (right). Holds the mobile hamburger trigger. `h-14`-ish, `border-b border-slate-200 bg-white`. |
| `components/layout/UserMenu.vue` | New | Avatar/initials + name button → dropdown: identity block (avatar + name + email) then Workspace (if `workspace.view`), Settings, Sign out. Built on radix-vue `DropdownMenu` (keyboard roving, focus management, Escape, click-outside). _Note: identity block kept at all breakpoints — overrides the original "no identity header" interview decision (confirmed 2026-06-15)._ |
| `components/layout/Sidebar.vue` | Modify | Remove `Workspace` & `Settings` nav items. Remove footer identity + Sign out (now in `UserMenu`). Keep logo, operational nav, collapse. Move/retire the floating mobile menu button (now in `AppHeader`). |
| `components/ui/Avatar.vue` | New (small) | Initials avatar (circle, brand-tinted) — or inline in `UserMenu` if not reused. |
| `pages/performance-report.vue` | Modify (minimal) | No change to its filter bar except it now renders beneath the global bar. Verify spacing/sticky behavior. |
| `pages/unit/[unitId].vue` | Modify (minimal) | Same as above. |

## Key Interactions

- **Open profile menu**: click avatar/name (top-right) → dropdown opens below, right-aligned. Click-outside, Escape, or selecting an item closes it. Trigger has visible focus ring (`ring-blue-500`) and `aria-expanded`.
- **Navigate to Workspace/Settings**: selecting routes via `NuxtLink` to `/workspace` / `/settings`; menu closes; active page reflected (optional checkmark or no special state).
- **Permission gating**: `Workspace` item only renders when `hasPermission(level, 'workspace.view')` — mirrors current sidebar logic so non-privileged users never see it.
- **Sign out**: from the menu → `auth.logout()` + `navigateTo('/login')` (same as today).
- **Mobile**: hamburger in the global bar toggles the sidebar drawer (replaces the current floating top-left button). Profile menu trigger collapses to avatar-only (no name) on narrow widths.
- **Sidebar collapse**: unchanged (w-64 ↔ w-20); brand in the global bar means the sidebar logo can stay or simplify (keep for now).

## Responsive Behavior

- **≥ lg**: global bar full width above the content column (right of the sidebar) OR full-width above everything — default to **above the content area, right of sidebar**, so the sidebar logo + bar don't both span. (Resolve in IA step.) Profile shows avatar + name + chevron.
- **< lg**: global bar spans full width with hamburger (left) + brand + profile avatar (right). Sidebar becomes the existing overlay drawer. Page filter bars stack vertically (already `flex-col`).
- Dropdown never exceeds viewport; right-aligned, repositions on small screens.

## Accessibility Requirements

- Menu trigger: `button` with `aria-haspopup="menu"`, `aria-expanded`; dropdown uses `role="menu"`/`menuitem`. Prefer a radix-vue dropdown primitive for focus management if added.
- Full keyboard support: open on Enter/Space, arrow-key item movement, Escape to close returning focus to trigger.
- Contrast ≥ 4.5:1 for text (slate-900/600 on white passes); focus rings visible (existing `ring-blue-500`).
- Initials avatar has an accessible label (full name) via `aria-label`/`title`; decorative only otherwise.

## Out of Scope

- Redesign of the page filter bars themselves (date/tenant/action controls) — only their position relative to the new global bar.
- The Performance Report data/visualization upgrade and the Unit Detail rewrite (separate briefs/tickets).
- Adding real avatar image upload — initials only.
- Changes to Workspace or Settings page internals.
- Re-introducing the AI Assistant header/drawer feature.
- Backend/auth changes — purely a frontend navigation/layout restructure.
- Fixing the unrelated `Unit Detail` sidebar link (`/unit/[unitId]` literal href) — note it exists, but handle outside this brief unless folded into the sidebar edit.
