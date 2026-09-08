import { Provider } from '@prisma/client';

/** Normalized shapes every connector maps its vendor data into (see MASTER_PLAN §3.2). */
export interface NormalizedProduct {
  externalId: string;
  name: string;
  revenue: number;
  orders: number;
  conversionRt: number;
  stock: number;
  aiScore: number;
}

export interface NormalizedKpi {
  key: string; // revenue | orders | profit | roas | aov | cr | ltv | returning
  cur: number;
  prev: number;
}

export interface SyncResult {
  products: NormalizedProduct[];
  kpis: NormalizedKpi[];
  revenueSeries: { d: string; rev: number; prev: number }[];
  /** Optional daily history (date YYYY-MM-DD → revenue + order count) for period filtering. */
  dailySeries?: { date: string; rev: number; orders: number }[];
}

/**
 * A data-source connector. Real connectors (Shopify, GA4, Meta …) fetch via OAuth and map the
 * vendor payload into the normalized shapes above; the ingestion layer persists them uniformly.
 */
export interface Connector {
  provider: Provider;
  label: string;
  /** Fetch + normalize the latest data for a workspace. */
  sync(): Promise<SyncResult>;
}
