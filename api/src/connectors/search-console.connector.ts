import { Injectable, Logger } from '@nestjs/common';
import { getGoogleAccessToken, ServiceAccount } from './google-auth.util';

const DAY = 86_400_000;
const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';

export interface SeoAgg { clicks: number; impressions: number; ctr: number; position: number }
export interface SeoResult {
  cur: SeoAgg; // most-recent ~45 days
  prev: SeoAgg; // prior ~45 days (for deltas)
  daily: { date: string; clicks: number }[]; // ~90 days
  keywords: { query: string; clicks: number; impressions: number; ctr: number; position: number }[];
}

type SCRow = { keys?: string[]; clicks: number; impressions: number; ctr: number; position: number };

/**
 * Google Search Console connector — pulls a site's organic search performance (clicks, impressions,
 * CTR, average position + top keywords) via the Search Analytics API, authenticated with a
 * service-account key. The service-account email must be added as a user on the SC property.
 * Credentials: { serviceAccountJson (the key file's contents), siteUrl (SC property) }.
 */
@Injectable()
export class SearchConsoleConnector {
  private readonly logger = new Logger(SearchConsoleConnector.name);

  private async query(
    token: string,
    siteUrl: string,
    body: Record<string, unknown>,
  ): Promise<SCRow[]> {
    const res = await fetch(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      throw new Error(`Search Console query failed (${res.status}): ${(await res.text()).slice(0, 180)}`);
    }
    const json = (await res.json()) as { rows?: SCRow[] };
    return json.rows ?? [];
  }

  async sync(creds: Record<string, string>): Promise<SeoResult> {
    const siteUrl = (creds.siteUrl || '').trim();
    if (!siteUrl) throw new Error('Search Console not configured — add the site URL (SC property).');
    let sa: ServiceAccount;
    try {
      sa = JSON.parse(creds.serviceAccountJson || '') as ServiceAccount;
    } catch {
      throw new Error('Service account key is not valid JSON.');
    }

    const token = await getGoogleAccessToken(sa, SCOPE);
    const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
    const now = Date.now();
    // Search Console data lags ~2-3 days; query the last 90 days ending 2 days ago.
    const endDate = iso(now - 2 * DAY);
    const startDate = iso(now - 92 * DAY);

    const [byDate, byQuery] = await Promise.all([
      this.query(token, siteUrl, { startDate, endDate, dimensions: ['date'], rowLimit: 200 }),
      this.query(token, siteUrl, { startDate, endDate, dimensions: ['query'], rowLimit: 10 }),
    ]);

    // byDate is ordered oldest→newest; split into prior half (prev) and recent half (cur).
    const sorted = [...byDate].sort((a, b) => (a.keys?.[0] ?? '').localeCompare(b.keys?.[0] ?? ''));
    const daily = sorted.map((r) => ({ date: r.keys?.[0] ?? '', clicks: Math.round(r.clicks) })).filter((d) => d.date);
    const mid = Math.floor(sorted.length / 2);
    const agg = (rows: SCRow[]): SeoAgg => {
      const clicks = rows.reduce((s, r) => s + r.clicks, 0);
      const impressions = rows.reduce((s, r) => s + r.impressions, 0);
      const position = impressions ? rows.reduce((s, r) => s + r.position * r.impressions, 0) / impressions : 0;
      return {
        clicks: Math.round(clicks),
        impressions: Math.round(impressions),
        ctr: impressions ? +((clicks / impressions) * 100).toFixed(1) : 0,
        position: +position.toFixed(1),
      };
    };
    const prev = agg(sorted.slice(0, mid));
    const cur = agg(sorted.slice(mid));

    const keywords = byQuery.map((r) => ({
      query: r.keys?.[0] ?? '',
      clicks: Math.round(r.clicks),
      impressions: Math.round(r.impressions),
      ctr: +(r.ctr * 100).toFixed(1),
      position: +r.position.toFixed(1),
    }));

    this.logger.log(`Search Console sync: ${cur.clicks} clicks (recent), ${keywords.length} keywords (${startDate}..${endDate}).`);
    return { cur, prev, daily, keywords };
  }
}
