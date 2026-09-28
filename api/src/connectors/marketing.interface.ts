import { Provider } from '@prisma/client';

/** One marketing channel's 30-day performance (a row in the Marketing tab). */
export interface MarketingChannel {
  name: string; // e.g. "Email", "Meta Ads"
  spend: number; // ad spend in the period (0 for email)
  revenue: number; // attributed revenue
  conversions: number; // orders/placed-order events
  clicks: number;
  impressions: number; // sends/opens for email; ad impressions for paid
  rec?: string; // short AI-style recommendation label
}

export interface MarketingResult {
  channels: MarketingChannel[];
}

/** A connector that reports marketing-channel performance (vs. a store connector's products/KPIs). */
export interface MarketingConnector {
  provider: Provider;
  label: string;
  /** Fetch + normalize channel performance for a workspace using the given credentials. */
  syncMarketing(creds: Record<string, string>): Promise<MarketingResult>;
}
