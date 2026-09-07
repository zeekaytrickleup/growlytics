# Deploy Growlytics AI for free

Free stack: **Neon** (Postgres DB) + **Render** (NestJS API) + **Vercel** (Next.js web).
Total cost: **$0**. You'll need free accounts on GitHub, Neon, Render, and Vercel.

> The database is Postgres. The API **self-seeds** demo data on first boot, so there's no manual
> seed step. The frontend fails soft — if the API is still cold-starting, it shows demo data until
> the API responds.

---

## 1. Push the repo to GitHub

The project is already committed locally. Create an **empty** GitHub repo (no README), then:

```bash
git remote add origin https://github.com/<you>/growlytics-ai-system.git
git branch -M main
git push -u origin main
```

(Or with the GitHub CLI: `gh repo create growlytics-ai-system --private --source . --push`.)

## 2. Database — Neon (Postgres)

1. Go to **https://neon.tech** → new project.
2. Copy the **connection string** (looks like `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require`).
3. Keep it handy — it's your `DATABASE_URL`.

## 3. API — Render

1. Go to **https://render.com** → **New + → Blueprint** → connect your GitHub repo.
2. Render reads [`render.yaml`](render.yaml) and proposes the `growlytics-api` web service (free plan).
3. When prompted for env vars, set:
   - `DATABASE_URL` = your Neon string from step 2
   - `WEB_ORIGIN` = `*` (tighten to your Vercel URL later)
   - `ANTHROPIC_API_KEY` = *(optional)* your Anthropic key for live Claude answers
4. Deploy. Build runs `prisma generate` + `nest build`; start runs `prisma db push` (creates the
   tables) then boots — the app **self-seeds** on first run.
5. When it's live, note the URL, e.g. `https://growlytics-api.onrender.com`.
   Test it: open `https://growlytics-api.onrender.com/api/health` → `{"status":"ok",...}`.

> ⚠️ Render's free tier **spins down after ~15 min idle**; the next request cold-starts in ~50s.
> That's fine for a demo — the UI shows demo data until the API wakes.

## 4. Web — Vercel

1. Go to **https://vercel.com** → **Add New → Project** → import your GitHub repo.
2. **Root Directory:** set to `web`.
3. **Environment Variable:**
   - `NEXT_PUBLIC_API_URL` = `https://growlytics-api.onrender.com/api` (your Render URL + `/api`)
4. Deploy. You'll get a URL like `https://growlytics-ai.vercel.app`.

## 5. (Optional) Tighten CORS

Back in Render → the service → Environment → set `WEB_ORIGIN` to your exact Vercel URL
(`https://growlytics-ai.vercel.app`) and redeploy. Leaving it `*` also works.

---

## Done ✅

Open your Vercel URL. First load may take ~1 min while the Render API cold-starts and seeds the DB;
after that it's instant. Use the topbar **workspace switcher** to flip between the two demo stores.

### Enable live Claude answers
Set `ANTHROPIC_API_KEY` in Render → redeploy. The assistant flips from mock to live automatically.

### Local development against the cloud DB
Put your Neon `DATABASE_URL` in `api/.env`, then `npm run dev` from the repo root — the API seeds
the same cloud DB on first boot. No local database required.
