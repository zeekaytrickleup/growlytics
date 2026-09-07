# Growlytics AI — Demo Walkthrough

A 5-minute script for showing the MVP. Everything runs on real data from the database.

## 0. Start it

```bash
# one-time
npm run setup        # installs both apps, migrates + seeds the DB (needs XAMPP MySQL running)

# every run
npm run dev          # starts API (:4000) + web (:3000)
```

Open **http://localhost:3000**. (If you started the web app manually on another port, use that.)

> The API boots even without a database or AI key — it falls back gracefully. For the full demo,
> make sure **XAMPP MySQL is running** and the DB is seeded (`npm run seed`).

## 1. The pitch (10s)
> "E-commerce teams juggle Shopify, Google/Meta Ads, GA4, Klaviyo… Growlytics pulls it into one
> dashboard and, more importantly, an AI that tells you *what to do* — not just what happened."

## 2. Dashboard — "What should you do today?"
- The four insight cards at the top are **generated from real data** by the insight engine, each with
  a confidence score. Point out the **● Live data** badge — these come from the API/DB, not mock.
- KPIs, the revenue chart, traffic mix, top products, customer growth — all DB-backed.

## 3. AI Growth Assistant (the headline feature)
- Sidebar → **AI Growth Assistant**. Click a suggested question, e.g. *"What should I do this week?"*
- Show the structured answer: **analysis → reason → confidence ring → recommended actions →
  expected impact**. It's grounded on the workspace's connected data.
- Mention: with an `ANTHROPIC_API_KEY` set, this is live Claude (`claude-opus-4-8`); without one it
  returns grounded fallback answers so the demo always works.

## 4. Integrations — the ETL pipeline is real
- Sidebar → **Integrations**. Pick an *Available* source and click **Connect**.
- It runs the connector → ingests data → **regenerates insights** (watch the spinner, then the
  status flips to Connected). This is the real sync pipeline; Shopify has a full demo connector.

## 5. Reports — one-click PDF
- Sidebar → **Reports** → **Generate report**. A live executive summary appears (KPIs + narrative +
  AI recommendations). Click **PDF** to download a real generated PDF.

## 6. Multi-tenant — the "agency" story
- Topbar → **workspace switcher** → switch from *Northwind Goods* to *Aurora Labs*.
- The **entire app re-scopes**: different revenue, different top products, different AI insights
  (Aurora flags a different low-stock product and, because its ROAS rose, shows no ROAS-drop card).
- This is the agency/SaaS angle: one login, many client stores.

## 7. Close
> "Real stack — MariaDB → Prisma → NestJS → Next.js — multi-tenant, with a grounded AI assistant and
> a self-updating recommendation engine. Live integrations (Shopify OAuth) and Clerk auth are a
> credentials-swap away; the architecture is already in place."

---

## Handy API calls (for a technical audience)

```bash
curl localhost:4000/api/health
curl localhost:4000/api/me
curl localhost:4000/api/dashboard/overview
curl -H "x-workspace-id: aurora-labs" localhost:4000/api/dashboard/overview   # different tenant
curl -X POST localhost:4000/api/insights/generate
curl -X POST -H "Content-Type: application/json" -d '{"question":"What should I do this week?"}' \
  localhost:4000/api/assistant/ask
curl -L localhost:4000/api/reports/summary.pdf -o summary.pdf
```
