import { Injectable, Logger } from '@nestjs/common';
import { Provider } from '@prisma/client';
import { MarketingChannel, MarketingConnector, MarketingResult } from './marketing.interface';

const KLAVIYO_BASE = 'https://a.klaviyo.com/api';
const KLAVIYO_REVISION = '2024-10-15';
const DAY = 86_400_000;

/**
 * Klaviyo connector — reports the "Email" marketing channel from a store's Klaviyo account using a
 * private API key (pk_...). Uses the Metric Aggregates API to sum the last 30 days of:
 *   Placed Order  -> revenue + conversions,  Opened Email -> impressions,  Clicked Email -> clicks.
 * Email has no ad spend, so ROAS is effectively infinite (shown as revenue with ~0 spend).
 */
@Injectable()
export class KlaviyoConnector implements MarketingConnector {
  readonly provider = Provider.KLAVIYO;
  readonly label = 'Klaviyo';
  private readonly logger = new Logger(KlaviyoConnector.name);

  private headers(apiKey: string) {
    return {
      Authorization: `Klaviyo-API-Key ${apiKey}`,
      revision: KLAVIYO_REVISION,
      accept: 'application/json',
      'content-type': 'application/json',
    };
  }

  /** Map of metric name -> id for this account (Placed Order, Opened Email, Clicked Email, …). */
  private async metricIds(apiKey: string): Promise<Map<string, string>> {
    const ids = new Map<string, string>();
    let url: string | null = `${KLAVIYO_BASE}/metrics/`;
    for (let page = 0; page < 10 && url; page++) {
      const res = await fetch(url, { headers: this.headers(apiKey) });
      if (!res.ok) throw new Error(`Klaviyo /metrics ${res.status}: ${(await res.text()).slice(0, 140)}`);
      const body = (await res.json()) as {
        data: { id: string; attributes: { name: string } }[];
        links?: { next: string | null };
      };
      for (const m of body.data) ids.set(m.attributes.name, m.id);
      url = body.links?.next ?? null;
    }
    return ids;
  }

  /** Sum a metric's value + count over the last 30 days via the Metric Aggregates API. */
  private async aggregate(apiKey: string, metricId: string): Promise<{ sum: number; count: number }> {
    const now = Date.now();
    const since = new Date(now - 30 * DAY).toISOString();
    const until = new Date(now).toISOString();
    const res = await fetch(`${KLAVIYO_BASE}/metric-aggregates/`, {
      method: 'POST',
      headers: this.headers(apiKey),
      body: JSON.stringify({
        data: {
          type: 'metric-aggregate',
          attributes: {
            metric_id: metricId,
            measurements: ['sum_value', 'count'],
            interval: 'day',
            page_size: 500,
            timezone: 'UTC',
            // Klaviyo requires BOTH a lower and upper datetime bound on the filter.
            filter: `and(greater-or-equal(datetime,${since}),less-than(datetime,${until}))`,
          },
        },
      }),
    });
    if (!res.ok) throw new Error(`Klaviyo /metric-aggregates ${res.status}: ${(await res.text()).slice(0, 140)}`);
    const body = (await res.json()) as {
      data: { attributes: { data: { measurements: { sum_value?: number[]; count?: number[] } }[] } };
    };
    const rows = body.data?.attributes?.data ?? [];
    let sum = 0;
    let count = 0;
    for (const r of rows) {
      sum += (r.measurements.sum_value ?? []).reduce((a, b) => a + (b || 0), 0);
      count += (r.measurements.count ?? []).reduce((a, b) => a + (b || 0), 0);
    }
    return { sum, count };
  }

  async syncMarketing(creds: Record<string, string>): Promise<MarketingResult> {
    const apiKey = (creds.apiKey || '').trim();
    if (!apiKey) throw new Error('Klaviyo not configured — add a private API key (pk_...).');

    const ids = await this.metricIds(apiKey);
    const placedId = ids.get('Placed Order');
    const openedId = ids.get('Opened Email');
    const clickedId = ids.get('Clicked Email');

    const [placed, opened, clicked] = await Promise.all([
      placedId ? this.aggregate(apiKey, placedId) : Promise.resolve({ sum: 0, count: 0 }),
      openedId ? this.aggregate(apiKey, openedId) : Promise.resolve({ sum: 0, count: 0 }),
      clickedId ? this.aggregate(apiKey, clickedId) : Promise.resolve({ sum: 0, count: 0 }),
    ]);

    const email: MarketingChannel = {
      name: 'Email',
      spend: 0,
      revenue: Math.round(placed.sum),
      conversions: placed.count,
      clicks: clicked.count,
      impressions: opened.count,
      rec: clicked.count && placed.count / Math.max(1, clicked.count) < 0.05 ? 'Add flow' : 'Scale flows',
    };

    this.logger.log(`Klaviyo sync: email rev=$${email.revenue}, orders=${email.conversions}, opens=${email.impressions}.`);
    return { channels: [email] };
  }
}
