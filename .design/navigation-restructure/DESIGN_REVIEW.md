# Design Review: Navigation Restructure — Top App Bar & Profile Menu

Reviewed against: `.design/navigation-restructure/DESIGN_BRIEF.md`
Philosophy: Quiet operational dashboard (existing FrostLink system — Inter, brand `#006aea`, slate palette)
Date: 2026-06-15

## Screenshots Captured

Captured live via the Claude Preview MCP against `http://localhost:<port>` (HTTP dev via `NUXT_DEV_HTTPS=false`). The preview tool returns images inline rather than writing PNGs, so these were analyzed in-session (not persisted to `screenshots/`). Session run as a synthetic Admin (and Basic) user.

| View | Breakpoint | What it shows |
|---|---|---|
| Performance Report | Desktop 1280×800 | Sidebar (Performance/Unit Detail/Asset Manager) + top bar right of sidebar, user menu top-right |
| Performance Report | Tablet 768×1024 | Hamburger + user menu (name+role), sidebar drawered |
| Performance Report | Mobile 375×812 | Hamburger + avatar-only menu, no overflow |
| User menu (open) | Desktop + Mobile | Identity block + Workspace/Settings/Sign out; fits viewport (left 119 / right 359 at 375px) |
| Mobile drawer | Mobile 375 | Sidebar slides in over dimmed overlay, X close |
| Basic-user menu | Desktop | Workspace hidden → Settings + Sign out only |

## Summary

The build matches the brief closely and is functionally complete: account destinations moved out of the sidebar into a top-right profile menu, sidebar trimmed to operational nav, global bar sits right of the sidebar, curved-square initials avatar, permission-gated Workspace, mobile drawer driven from the bar, and the broken `/unit/[unitId]` link replaced by a real `/unit` landing. Two items need attention: an **identity block was added to the dropdown that the brief explicitly excluded**, and **keyboard support is partial** versus the brief's own accessibility requirement.

## Must Fix

_None — no broken functionality, no contrast/landmark failures. Verified: clean compile, zero console errors, zero typecheck errors in new files._

## Should Fix

1. **Dropdown identity block contradicts an explicit brief decision.** In the design-brief interview, "Account identity header" was **not** selected — menu items were limited to Workspace, Settings, Sign out. `UserMenu.vue` adds an avatar+name+email header at the top of the dropdown. _Fix: remove the identity block to honor the decision — OR keep it only at mobile widths (where the trigger hides the name) and confirm with the user. Recommend confirming, since it's genuinely useful on mobile but violates the stated scope._

2. **Partial keyboard support vs. brief A11y requirement.** Brief specifies: "open on Enter/Space, **arrow-key item movement**, Escape to close **returning focus to trigger**." Implemented: Escape + click-outside close, native button tab order. Missing: focus does not move into the menu on open, arrow-key roving between items, and focus isn't explicitly returned to the trigger on close. _Fix: move focus to the first `menuitem` on open, implement ArrowUp/Down roving, restore focus to the trigger on close — or adopt a radix-vue `DropdownMenu` primitive (already a dependency) which provides this for free._

3. **No `prefers-reduced-motion` handling.** The dropdown `Transition` and sidebar slide always animate. _Fix: wrap/guard transitions in a `prefers-reduced-motion: reduce` query (skill checklist requirement; cheap to add)._

## Could Improve

1. **Avatar color hardcoded.** `Avatar.vue` uses `bg-[#006aea]` literally — consistent with the rest of the codebase but extends the token-vs-utility debt noted in `docs/DESIGN.md`. _Suggestion: when the token cleanup happens, route brand through a CSS var._
2. **Desktop header left is empty.** On `lg+` the bar's left side is a blank spacer (sidebar owns the brand). _Suggestion: optionally host a page title or breadcrumb there to use the space and aid orientation._
3. **Email truncation in identity block.** `jane.maartens@frostlink.t…` truncates — fine, but moot if the identity block is removed per Should-Fix #1.
4. **Unit Detail active state.** `isActive('/unit')` uses `startsWith`, so `/unit/:mac` correctly keeps the nav item active — good. Just confirm no other `/unit*` routes appear later that shouldn't highlight it.

## What Works Well

- **Brief adherence (layout):** global bar right of sidebar, profile menu top-right, page filter bars beneath it, sidebar trimmed to operational items, no duplicated identity/sign-out — exactly as specified.
- **Permission gating verified live:** Admin sees Workspace; Basic does not (Settings + Sign out only). Mirrors `hasPermission(level, 'workspace.view')` from the policy.
- **Responsive behavior is real, not just shrink:** desktop persistent sidebar → tablet/mobile drawer; hamburger correctly relocated into the bar; user-menu label collapses to avatar-only on narrow; dropdown stays within the 375px viewport.
- **Avatar:** curved-square (not circle) as requested, rendered locally from initials — no external API, no PII leak, works offline; `src` escape hatch left for later.
- **Accessibility baseline:** `aria-haspopup`/`aria-expanded` on trigger, `role="menu"`/`menuitem`, visible focus rings (`ring-blue-500`), avatar `aria-label`/`role="img"`, proper `header`/`nav`/`complementary`/`main` landmarks.
- **Bug fixed in passing:** the long-standing sidebar link to literal `/unit/[unitId]` now routes to a working `/unit` picker.
- **Clean state management:** shared `useSidebar` composable lets the bar's hamburger and the sidebar drawer stay in sync without prop drilling.
