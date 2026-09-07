# Growlytics AI System — Master Plan

> **Tagline:** Your AI Co-Pilot for Smarter E-commerce Growth
> **Owner (PM):** Majid Ali — Pod DUSK · **Developer:** Zardad — Pod DUSK
> **MVP Deadline:** 1 October 2026 · **Plan authored:** 24 July 2026 (~10 weeks runway)
> **Status:** Planning → Build

---

## 1. What This Is (Understanding)

Growlytics AI is an **AI-powered e-commerce growth intelligence platform**. It pulls fragmented data
from the platforms an online store already uses (Google Ads, Meta Ads, GA4, Shopify/WooCommerce,
Klaviyo, Google Search Console) into **one dashboard**, then goes a step further than analytics: an
AI layer interprets the numbers, flags opportunities and risks, and produces **actionable
recommendations** — where to move ad budget, which products to scale, who is about to churn, what to
do this week.

The attached `GrowthOS-AI.jsx` prototype is the **visual + UX blueprint**. It is a single-file React
mock with realistic fake data. The job of this project is to turn that blueprint into a real,
data-connected product with a working AI assistant.

### The core value proposition (why it matters)
- **Consolidation** — stop tab-switching across 6 dashboards.
- **Interpretation** — AI explains *why* a metric moved, not just *that* it moved.
- **Action** — every insight ends in a concrete, one-click-ish next step with an expected impact.

### Primary users
1. **Agency PMs / marketers** (Trickle Up internal) — manage many client stores.
2. **E-commerce store owners** — single store, want plain-English guidance.

---

## 2. Prototype → Product Map

The prototype already defines the full surface area. Each screen becomes a feature with a real data
source behind it.

| Prototype screen | Real data source(s) | MVP? |
|---|---|---|
| **Dashboard** (KPIs, insights, revenue chart, traffic, top products, heatmap) | Shopify + GA4 + Ads (aggregated) | ✅ Core |
| **AI Growth Assistant** (chat: analysis → reason → confidence → actions → impact) | OpenAI/Claude over connected data | ✅ Core |
| **Revenue** | Shopify/Woo orders | ✅ Core |
| **Products** (intelligence, competitors, AI price/bundle recs) | Shopify products + orders | ✅ Core |
| **Customers** (segments, churn risk, win-back) | Shopify customers + orders | ✅ Core |
| **Marketing** (channel performance table, ROAS) | Google Ads + Meta Ads + GA4 | ✅ Core |
| **SEO** | Google Search Console | 🟡 Stretch |
| **Email** | Klaviyo | 🟡 Stretch |
| **Inventory** | Shopify inventory | 🟡 Stretch |
| **Forecasting** | Computed from historical revenue | 🟡 Stretch |
| **Automations** (visual workflow) | Internal rules engine | 🔵 Post-MVP |
| **Reports** (PDF/CSV/PPTX exports) | Generated from stored metrics | 🟡 Stretch (PDF only) |
| **Integrations** (connect/status cards) | OAuth connection manager | ✅ Core |
| **Settings** | User/workspace config | ✅ Core |
| **Command bar (⌘K)**, mobile nav, skeletons | Frontend UX | ✅ Core |

**MVP definition (per the feasibility statement):** unified dashboard, AI insights, marketing
analytics, product intelligence, customer segmentation, AI Growth Assistant, recommendation engine.
Everything marked ✅ + at least one 🟡 to prove breadth.

---

## 3. Architecture

### 3.1 Recommended stack (from proposal, with a decision)

**DECIDED (2026-07-24):** single **Node + NestJS + Prisma + PostgreSQL** backend (chosen over the
Laravel alternative the proposal also listed). One language across the whole stack, least
context-switching for a 10-week MVP. Scaffolded in `api/`. Laravel is off the table — do not split.

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend — Next.js (App Router) + TypeScript + Tailwind      │
│  Recharts · Clerk/Auth.js · port the GrowthOS-AI.jsx UI       │
└───────────────┬─────────────────────────────────────────────┘
                │ REST / server actions
┌───────────────▼─────────────────────────────────────────────┐
│  Backend — NestJS (or Express) + Prisma                       │
│  ┌─────────────┐ ┌──────────────┐ ┌────────────────────────┐ │
│  │ Auth /       │ │ Integration  │ │ AI / Insight Engine    │ │
│  │ Workspaces   │ │ Connectors   │ │ (LLM + recommendation) │ │
│  └─────────────┘ └──────┬───────┘ └───────────┬────────────┘ │
│  ┌───────────────────────▼────────────────────▼────────────┐ │
│  │ Metrics service — normalize, cache, aggregate            │ │
│  └───────────────────────┬─────────────────────────────────┘ │
└──────────────────────────┼───────────────────────────────────┘
              ┌────────────▼───────────┐   ┌───────────────────┐
              │ PostgreSQL (Prisma)     │   │ Redis (cache/jobs)│
              └─────────────────────────┘   └───────────────────┘
                           │
        ┌──────────────────┼──────────────────────────────┐
        ▼                  ▼                               ▼
   Shopify / Woo      Google/Meta Ads, GA4          Klaviyo, GSC
```

### 3.2 Key architectural decisions
- **Multi-tenant from day one.** `Workspace` → many `Integrations` → many users. Agencies need this.
- **ETL / sync layer.** Connectors fetch on a schedule (cron/queue) into a normalized `metrics`
  schema. The UI and AI read normalized data, **never** call vendor APIs live per request (rate
  limits + latency). Use Redis + a job queue (BullMQ) for scheduled syncs.
- **AI grounding.** The assistant does **not** free-form guess. It receives a structured snapshot of
  the workspace's normalized metrics as context, and returns the prototype's structured shape:
  `{ analysis, reason, confidence, actions[], impact }`. Enforce with a JSON schema / function
  calling so the UI stays exactly as designed.
- **Use latest Claude models** (Opus 4.8 / Sonnet 5) or OpenAI per proposal — abstract behind one
  `AIProvider` interface so the model is swappable.
- **Secrets & tokens** encrypted at rest (per-integration OAuth tokens). Never log them.

### 3.3 Data model (first cut)
`Workspace`, `User`, `Membership(role)`, `Integration(provider, status, encryptedTokens)`,
`MetricSnapshot(workspaceId, source, metric, value, dimension, ts)`, `Product`, `Customer`,
`Segment`, `Insight(type, payload, confidence, status)`, `Recommendation`, `ChatMessage`.

---

## 4. Delivery Plan — 10 Weeks to MVP (by 1 Oct 2026)

Each phase ends with something demoable. Frontend and backend run in parallel where possible.

### Phase 0 — Foundations (Week 1: Jul 24 – Jul 31)
- [ ] Lock stack decision (Node vs Laravel) — **do this first**.
- [ ] Monorepo (Turborepo) or two repos: `apps/web`, `apps/api`.
- [ ] Auth (Clerk recommended for speed) + Workspace/Membership model.
- [ ] Postgres + Prisma schema v1; Redis; local `.env` + secrets handling.
- [ ] Port `GrowthOS-AI.jsx` into the Next.js app as real routed pages (split the single file into
      components, wire navigation to routes instead of `useState`). Keep the dark design system.
- [ ] CI + deploy pipeline to Vercel (web) + Railway (api).

### Phase 1 — Data In: first real integration (Weeks 2–3)
- [ ] **Shopify** connector (OAuth + orders/products/customers) — richest single source, unblocks
      Dashboard, Revenue, Products, Customers.
- [ ] Metrics service: normalize into `MetricSnapshot`; scheduled sync via BullMQ.
- [ ] Wire **Dashboard KPIs + Revenue chart** to real data (replace mock arrays).
- [ ] Integrations page connect/disconnect/status flow (real for Shopify, stubs for rest).

### Phase 2 — Data In: marketing sources (Weeks 3–4)
- [ ] **Google Ads** + **Meta Ads** connectors → channel performance (spend, ROAS, CPA, CTR).
- [ ] **GA4** connector → traffic sources + sessions.
- [ ] Wire **Marketing** screen and Dashboard traffic donut to real data.

### Phase 3 — The AI Layer (Weeks 4–6) — the differentiator
- [ ] `AIProvider` abstraction + prompt templates.
- [ ] **Insight engine:** nightly job scans normalized metrics, detects notable changes
      (revenue swings, ROAS drops, trending products, low stock, churn signals), writes `Insight`
      rows → feeds the Dashboard "What should you do today?" cards.
- [ ] **Growth Assistant chat:** grounded Q&A returning the structured `{analysis, reason,
      confidence, actions, impact}` shape. Start with the 4 canned questions from the prototype,
      then open to free text.
- [ ] **Recommendation engine:** rules + LLM hybrid (e.g. "ROAS < 2 for 3 days → refresh creative").

### Phase 4 — Intelligence screens (Weeks 6–8)
- [ ] **Products** intelligence (scoring, price/bundle recs).
- [ ] **Customers** segmentation (RFM-style: VIP, Loyal, Repeat, One-Time, Dormant, Churn Risk) +
      churn-risk detection + win-back action.
- [ ] Pick **one stretch** screen to make real: **Inventory** (easiest, from Shopify) or **Email**
      (Klaviyo) or **Forecasting** (compute from history).

### Phase 5 — Polish, Reports, Hardening (Weeks 8–10)
- [ ] **Reports:** generate a real Executive Summary PDF from stored metrics.
- [ ] Empty/loading/error states (prototype already designs these — keep them).
- [ ] Command bar (⌘K), mobile responsiveness, skeletons — port faithfully.
- [ ] Perf: caching, pagination; security pass (token encryption, authz on every workspace query).
- [ ] Seed a **demo workspace** with realistic data so the MVP always demos well even if a live
      connector is down.
- [ ] Rehearse the demo; write a short loom/deck.

### Cut lines (if behind)
Post-MVP: Automations workflow builder, SEO screen, PPTX/CSV export, additional integrations
(TikTok, Pinterest, PayPal, WooCommerce). Ship the demo workspace + Shopify + one ad platform +
working AI assistant before anything else.

---

## 5. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| OAuth/API approval delays (Meta, Google) | High — blocks marketing data | Apply for dev access **Week 1**; use sandbox/test accounts; demo workspace fallback |
| Scope creep — 14 screens in prototype | High | MVP cut lines above; ✅ screens only |
| AI gives wrong/ungrounded advice | Med | Ground on real snapshots, show confidence, JSON-schema output, human-in-loop "Apply" |
| Two-backend indecision (Node vs Laravel) | Med | Decide Week 0, single backend |
| Rate limits / sync cost | Med | Scheduled ETL + cache, never live per-request vendor calls |
| Small team (2 people) over 10 weeks | Med | PM owns integrations/OAuth + demo data; Dev owns app + AI; reuse prototype UI as-is |

---

## 6. Immediate Next Actions (this week)
1. **Decide the backend** (Node/NestJS recommended) and initialize the repos + deploy pipeline.
2. **Register developer apps** for Shopify, Google, Meta now (approval lead time).
3. **Scaffold Next.js app** and port `GrowthOS-AI.jsx` into routed components with the dark theme.
4. **Prisma schema v1** for Workspace/User/Integration/MetricSnapshot.
5. **Shopify connector spike** — get one real order feed into `MetricSnapshot`.

---

## 7. Definition of Done (MVP)
- A user signs up, creates a workspace, connects **Shopify + at least one ad platform**.
- Dashboard, Revenue, Marketing, Products, Customers show **real connected data**.
- The **Growth Assistant** answers questions grounded in that data with actions + confidence.
- Dashboard surfaces **AI insights** and at least one **recommendation** the user can act on.
- One stretch screen is live; a **demo workspace** guarantees a clean presentation.
- Deployed, authenticated, multi-tenant, secrets encrypted.

---

*This plan turns the `GrowthOS-AI.jsx` prototype into a shippable MVP. The prototype is the UX spec;
this document is the build spec. Revisit cut lines weekly against the 1 Oct 2026 deadline.*
