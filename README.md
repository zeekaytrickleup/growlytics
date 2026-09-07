# Growlytics AI System

> Your AI Co-Pilot for Smarter E-commerce Growth

AI-powered e-commerce growth intelligence platform that consolidates data from Shopify/Woo, Google
Ads, Meta Ads, GA4, Klaviyo and Search Console into one dashboard, then uses AI to interpret the
numbers and recommend concrete next steps.

- **Plan:** see [MASTER_PLAN.md](MASTER_PLAN.md) — the build spec (phases, architecture, deadlines).
- **UX blueprint:** the original single-file prototype (`GrowthOS-AI.jsx`), now ported into `web/`.
- **App:** `web/` — Next.js 16 (App Router) + TypeScript + Tailwind, Recharts, lucide-react.

## Run the app

**One command (recommended)** — from the project root:
```bash
npm run install:all  # install both apps
# set DATABASE_URL in api/.env (a free Neon Postgres string works), then:
npm run setup        # install + push the schema to your database
npm run dev          # starts API (:4000) + web (:3000); API self-seeds an empty DB on first boot
npm test             # run the API unit tests
```
See [DEMO.md](DEMO.md) for a 5-minute walkthrough script, and **[DEPLOY.md](DEPLOY.md) to host it
free** (Neon + Render + Vercel).

> Uses **PostgreSQL** (free on Neon/Supabase). The API self-seeds demo data on first boot, so no
> manual seed step is needed. Point `api/.env`'s `DATABASE_URL` at your Neon string and run
> `npm run dev` — no local database required.

<details><summary>Or run each app separately</summary>

**Frontend**
```bash
cd web && npm install && npm run dev          # http://localhost:3000
```

**Backend (API)**
```bash
cd api && npm install && npx prisma generate && npm run start:dev   # http://localhost:4000/api
```
</details>

Health check: `GET http://localhost:4000/api/health` ·
Dashboard data: `GET http://localhost:4000/api/dashboard/overview`

### Database — PostgreSQL (Neon free tier, or any Postgres)
Set `DATABASE_URL` in `api/.env` to your Postgres connection string (a free
[Neon](https://neon.tech) database works for both local dev and production). The app **self-seeds**
demo data on first boot. Useful commands (run in `api/`):

```bash
npm run db:push      # apply the schema to the database (creates tables)
npm run db:seed      # (re)seed the two demo workspaces — idempotent
npm run db:studio    # open Prisma Studio to browse the data
```

## Status

- ✅ **Phase 0** — Next.js scaffold + full prototype UI ported (all 14 screens, dark design system,
  ⌘K command bar, AI assistant with mock data).
- 🟡 **Phase 1 (in progress)** — Backend **decided: Node + NestJS + Prisma + PostgreSQL**. NestJS
  scaffolded and building; Prisma **schema v1** (workspaces, integrations, metrics, products,
  customers, segments, insights, chat) generated; `/api/dashboard/overview` serves the UI contract.
  **Frontend Dashboard now fetches live from the API** (KPIs, insights, revenue, traffic, top
  products) with a Live/Demo badge and graceful fallback to mock data if the API is down.
- ✅ **Database live** — PostgreSQL via Prisma, self-seeded with two demo workspaces.
  `/api/dashboard/overview` returns `source:"live"` built entirely from DB rows (KPI deltas
  computed from stored current/previous values, revenue series and product trends reconstructed
  from the data). The full stack is real: **Postgres → Prisma → NestJS → Next.js**.
- ✅ **AI Growth Assistant** — `POST /api/assistant/ask` answers questions **grounded on the
  workspace's real DB snapshot** and returns the structured `{analysis, reason, confidence, actions,
  impact}` shape via Claude (`claude-opus-4-8`, structured outputs). An `AiService` abstraction
  swaps between live Claude and **grounded mock answers** when `ANTHROPIC_API_KEY` is unset, so it
  always works. Exchanges persist to the `ChatMessage` table. The frontend chat calls it live with a
  local fallback.
- ✅ **AI insight engine** — a rules engine over the real metric snapshots detects revenue moves,
  ROAS decline, trending products, and low-stock risk, and writes them as `Insight` rows with real
  numbers and confidence scores. Runs **nightly (cron)**, on first startup, and on demand via
  `POST /api/insights/generate` (`GET /api/insights` to list). The dashboard's "What should you do
  today?" cards read straight from these rows — regenerating the insights as the data changes.
- ✅ **Connector / ETL backbone** — a `Connector` interface + `IngestionService` (the metrics-sync
  layer). A **demo Shopify connector** produces a realistic store payload that ingests into the
  normalized tables (`Product`, `MetricSnapshot`) and auto-refreshes insights. The **Integrations
  page is live**: `GET /api/integrations` (status per provider), `POST /api/integrations/:provider/
  connect|sync|disconnect`. Connecting Shopify runs the real pipeline; other providers flip status
  (their connectors are stubs). Swapping in real Shopify OAuth = replacing one `sync()` method.
- ✅ **Reports** — `GET /api/reports/summary` composes an Executive Summary from live metrics +
  insights; `GET /api/reports/summary.pdf` streams a real generated **PDF** (pdfkit). The Reports
  screen generates the summary on demand and the PDF button downloads the file.
- ✅ **Multi-tenant workspaces + auth** — every service is workspace-scoped (no more hardcoded
  workspace). A `@Workspace()` decorator resolves the tenant from the `x-workspace-id` header
  (query-param fallback for downloads); `GET /api/me` returns the user + their workspaces. The
  frontend has a **workspace switcher** in the topbar that re-scopes the whole app live. Seeded with
  two workspaces (Northwind Goods, Aurora Labs) + a demo user. **Dev-mode auth** (no keys needed);
  swap in Clerk by validating the token in the decorator — the response shapes don't change.
- ⏭️ **Next (needs external credentials)** — real **Shopify OAuth**, **Clerk** JWT validation, and
  optional LLM copy-polishing of insight/report text. See MASTER_PLAN.md §4.

### Enable live Claude
Add `ANTHROPIC_API_KEY=sk-ant-...` to `api/.env` and restart the API. The assistant flips from
`source:"mock"` to `source:"llm"` automatically (nothing else to change).

## Structure

```
Growlytics AI System/
├── MASTER_PLAN.md      # build spec
├── README.md           # this file
├── web/                # Next.js frontend (prototype ported here)
│   └── app/
│       ├── components/GrowthOS.tsx   # the full UI
│       ├── page.tsx / layout.tsx
└── api/                # NestJS backend
    ├── prisma/schema.prisma          # data model v1
    └── src/
        ├── prisma/                   # PrismaModule + graceful service
        ├── dashboard/                # /api/dashboard/overview (UI contract)
        └── app.controller.ts         # /api/health
```
