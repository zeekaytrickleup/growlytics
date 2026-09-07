import { Injectable } from '@nestjs/common';
import { Provider } from '@prisma/client';
import { Connector, SyncResult } from './connector.interface';

/**
 * Shopify connector.
 *
 * DEMO MODE (current): returns a realistic sample store payload so the full ETL pipeline runs
 * end-to-end without OAuth credentials. To go live, replace `sync()` with real Shopify Admin API
 * calls (GET /admin/api/orders, /products, /customers) using the stored OAuth token and map the
 * response into the same normalized shapes — the ingestion layer downstream does not change.
 */
@Injectable()
export class ShopifyConnector implements Connector {
  readonly provider = Provider.SHOPIFY;
  readonly label = 'Shopify';

  async sync(): Promise<SyncResult> {
    return {
      products: [
        { externalId: 'p1', name: 'Aurora Wireless Buds', revenue: 48200, orders: 812, conversionRt: 4.8, stock: 340, aiScore: 0.9 },
        { externalId: 'p2', name: 'Nimbus Hoodie', revenue: 31700, orders: 640, conversionRt: 3.9, stock: 88, aiScore: 0.8 },
        { externalId: 'p3', name: 'Flux Smart Bottle', revenue: 22400, orders: 511, conversionRt: 3.1, stock: 12, aiScore: 0.2 },
        { externalId: 'p4', name: 'Lumen Desk Lamp', revenue: 18900, orders: 402, conversionRt: 2.7, stock: 205, aiScore: 0.75 },
        { externalId: 'p5', name: 'Terra Yoga Mat', revenue: 14100, orders: 388, conversionRt: 2.2, stock: 61, aiScore: 0.5 },
      ],
      kpis: [
        { key: 'revenue', cur: 81200, prev: 68814 },
        { key: 'orders', cur: 1942, prev: 1782 },
        { key: 'profit', cur: 29400, prev: 25789 },
        { key: 'roas', cur: 3.8, prev: 4.32 },
        { key: 'aov', cur: 41.8, prev: 40.6 },
        { key: 'cr', cur: 3.4, prev: 3.21 },
        { key: 'ltv', cur: 186, prev: 172 },
        { key: 'returning', cur: 42, prev: 41.2 },
      ],
      revenueSeries: [
        { d: 'Mon', rev: 8200, prev: 7100 }, { d: 'Tue', rev: 9100, prev: 8300 },
        { d: 'Wed', rev: 7600, prev: 8000 }, { d: 'Thu', rev: 11200, prev: 9200 },
        { d: 'Fri', rev: 14800, prev: 10100 }, { d: 'Sat', rev: 16900, prev: 12400 },
        { d: 'Sun', rev: 13400, prev: 11800 },
      ],
    };
  }
}
