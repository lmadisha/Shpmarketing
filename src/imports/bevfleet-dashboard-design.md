Design a modern data dashboard web app UI called “Frostlink” for monitoring a fleet of fridges/units.

Goal: Phase 1 focuses on door activity ranking (Gold/Silver/Bronze tiers), regional performance (map + reporting), and fleet redistribution recommendations. Include an AI insights assistant that explains changes and answers questions in plain language.

Style & Brand:
- Clean, professional, operations/data vibe (SaaS dashboard).
- Use a neutral base (light mode default) with an optional dark mode variant if possible.
- Use tier colors for badges: Gold, Silver, Bronze. Use status colors for flags: OK/WARN/BAD.
- Typography: modern sans (Inter or similar).
- Rounded cards, subtle shadows, high readability, lots of whitespace.

Layout requirements:
- Desktop frames: 1440px width (primary).
- Include responsive variants for Tablet (834px) and Mobile (390px) for at least the main Dashboard and Fleet Ranking.
- Persistent left sidebar navigation + top header.
- Top header includes: global date range selector, quick presets (7d/30d/custom), region filter, tier filter, search by mac/outlet, and a “What’s changed since last visit” indicator.

Navigation (Sidebar):
- Overview
- Fleet Ranking
- Regional Map
- Region Detail
- Unit Detail
- Redistribution Recommendations
- Reports (Grafana embeds placeholder)
- Settings

Global components to create:
- KPI metric cards (with small sparkline placeholders)
- Data table with sorting, pagination, and sticky header
- Tier badge chips (Gold/Silver/Bronze/Insufficient Data)
- Status badges for flags (Temp OK/BAD, Power OK/WARN/BAD, Voltage OK/MED/HIGH)
- Filter bar (dropdowns, date picker, apply/reset)
- Insight cards (explain “movement” / “why changed”)
- Slide-over drawer panel for AI assistant chat + citations/evidence section
- Empty/loading/error states

Create these pages (desktop frames) with realistic dashboard patterns and placeholder data:
1) Overview Dashboard
   - KPIs: total units, total door opens (period), % temp OK, % power OK, voltage high risk %, top movers (tier changes).
   - Mini charts: door opens trend, day-of-week seasonality bar chart, tier distribution.
   - “What changed since last visit” banner with 3–5 bullet insights.

2) Fleet Ranking (Door Activity Tiers)
   - Tier summary cards (Gold/Silver/Bronze/Insufficient Data counts)
   - Ranking table with columns: Rank, Unit (MAC), Region, Door Opens (period), Avg Temp, Powered %, Voltage Risk, Tier badge, Trend arrow.
   - Right-side panel (or top section) showing percentile curve / distribution chart and seasonal trends (day-of-week).
   - Compare toggle: “Compare to previous period” shows deltas.

3) Regional Map Performance
   - Interactive map panel (placeholder map) with clustering markers.
   - Left filter panel: Province/City/Town selectors, tier filter, date range.
   - Right info panel: region KPIs + top 10 / bottom 10 lists.
   - Map legend showing tier and flag statuses.

4) Region Detail
   - Header: region name + breadcrumbs.
   - KPIs + charts: door opens trend, temp compliance trend, tier distribution, top/bottom units tables.
   - Button: “Generate Redistribution Recommendations.”

5) Unit Detail
   - Header: Unit MAC + tier + region + key flags.
   - Trend charts: door opens per day, avg temp per day, powered % per day, voltage risk timeline (placeholders).
   - “AI explanation” insight card: “Why this unit moved tiers” with evidence block.

6) Redistribution Recommendations
   - Table/list of recommended swaps within a region.
   - Each recommendation card: From Unit (high doors + bad temp) → To Unit (lower doors + good temp), score, expected impact, reason codes, and actions (Mark Reviewed, Export).
   - Right-side “Recommendation AI Agent” panel summarizing best actions for the region.

7) Reports (Grafana Embeds Placeholder)
   - Layout showing embedded dashboard cards/iframes placeholders for Performance Report and Maintenance Report.

Interactions to imply in UI:
- Filters update results.
- Clicking a unit opens Unit Detail.
- Clicking “Explain” opens AI drawer with evidence + plain-language summary.

Deliverables:
- One design system page: colors, typography, buttons, inputs, badges, cards, table styles.
- Desktop frames for all pages above.
- Responsive variants for Overview + Fleet Ranking (tablet/mobile).