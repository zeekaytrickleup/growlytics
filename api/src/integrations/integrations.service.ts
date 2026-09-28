import { BadRequestException, Injectable } from '@nestjs/common';
import { IntegrationStatus, Provider } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { IngestionService } from '../connectors/ingestion.service';
import { WooCredentialsService } from '../connectors/woo-credentials.service';
import { CredentialsStore } from '../connectors/credentials.store';

/** Credentials a user can submit when connecting a data source from the dashboard. */
export type ConnectCredentials = {
  storeUrl?: string; consumerKey?: string; consumerSecret?: string; // WooCommerce
  apiKey?: string; // Klaviyo
  serviceAccountJson?: string; siteUrl?: string; // Google Search Console
};

const WORKSPACE_ID = 'demo-workspace';

const CATALOG: { provider: Provider; name: string; desc: string }[] = [
  { provider: Provider.SHOPIFY, name: 'Shopify', desc: 'Store · orders · products' },
  { provider: Provider.GA4, name: 'Google Analytics 4', desc: 'Traffic · behavior' },
  { provider: Provider.META_ADS, name: 'Meta Ads', desc: 'Campaigns · spend' },
  { provider: Provider.GOOGLE_ADS, name: 'Google Ads', desc: 'Campaigns · spend' },
  { provider: Provider.TIKTOK_ADS, name: 'TikTok Ads', desc: 'Campaigns · spend' },
  { provider: Provider.KLAVIYO, name: 'Klaviyo', desc: 'Email · flows' },
  { provider: Provider.STRIPE, name: 'Stripe', desc: 'Payments · payouts' },
  { provider: Provider.SEARCH_CONSOLE, name: 'Search Console', desc: 'Indexing · keywords' },
  { provider: Provider.WOOCOMMERCE, name: 'WooCommerce', desc: 'Store · orders · products' },
];

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ingestion: IngestionService,
    private readonly wooCreds: WooCredentialsService,
    private readonly creds: CredentialsStore,
  ) {}

  private parseProvider(raw: string): Provider {
    const key = raw.toUpperCase().replace(/[-\s]/g, '_');
    if ((Object.values(Provider) as string[]).includes(key)) return key as Provider;
    throw new BadRequestException(`Unknown provider: ${raw}`);
  }

  async list(workspaceId: string = WORKSPACE_ID) {
    let rows: { provider: Provider; status: IntegrationStatus; lastSyncedAt: Date | null; meta: unknown }[] = [];
    try {
      rows = await this.prisma.integration.findMany({ where: { workspaceId } });
    } catch {
      /* no DB — everything shows as available */
    }
    const byProvider = new Map(rows.map((r) => [r.provider, r]));
    const items = CATALOG.map((c) => {
      const row = byProvider.get(c.provider);
      const meta = (row?.meta ?? {}) as { storeUrl?: string };
      return {
        provider: c.provider,
        name: c.name,
        desc: c.desc,
        status: row?.status ?? IntegrationStatus.AVAILABLE,
        lastSyncedAt: row?.lastSyncedAt ?? null,
        hasDataConnector: this.ingestion.supports(c.provider),
        storeUrl: meta.storeUrl ?? null, // for WooCommerce: which store this workspace points at
      };
    });
    return { integrations: items };
  }

  async connect(rawProvider: string, workspaceId: string = WORKSPACE_ID, creds?: ConnectCredentials) {
    const provider = this.parseProvider(rawProvider);
    await this.prisma.workspace.upsert({
      where: { id: workspaceId },
      update: {},
      create: { id: workspaceId, name: 'Northwind Goods' },
    });
    // Save submitted credentials (encrypted) before syncing.
    if (provider === Provider.WOOCOMMERCE && creds?.storeUrl && creds.consumerKey && creds.consumerSecret) {
      await this.wooCreds.save(workspaceId, {
        storeUrl: creds.storeUrl,
        consumerKey: creds.consumerKey,
        consumerSecret: creds.consumerSecret,
      });
    } else if (provider === Provider.KLAVIYO && creds?.apiKey) {
      await this.creds.save(workspaceId, provider, { apiKey: creds.apiKey });
    } else if (provider === Provider.SEARCH_CONSOLE && creds?.serviceAccountJson && creds.siteUrl) {
      await this.creds.save(workspaceId, provider, { serviceAccountJson: creds.serviceAccountJson, siteUrl: creds.siteUrl }, { siteUrl: creds.siteUrl });
    }
    await this.upsertStatus(provider, IntegrationStatus.SYNCING, undefined, workspaceId);
    try {
      const result = this.ingestion.supportsMarketing(provider)
        ? await this.ingestion.ingestMarketing(provider, workspaceId)
        : this.ingestion.supportsSeo(provider)
          ? await this.ingestion.ingestSeo(provider, workspaceId)
          : await this.ingestion.ingest(provider, workspaceId);
      await this.upsertStatus(provider, IntegrationStatus.CONNECTED, new Date(), workspaceId);
      return { ...result, status: 'connected' };
    } catch (err) {
      await this.upsertStatus(provider, IntegrationStatus.ERROR, null, workspaceId);
      return { provider, status: 'error', error: (err as Error).message };
    }
  }

  async sync(rawProvider: string, workspaceId: string = WORKSPACE_ID) {
    const provider = this.parseProvider(rawProvider);
    try {
      const result = this.ingestion.supportsMarketing(provider)
        ? await this.ingestion.ingestMarketing(provider, workspaceId)
        : this.ingestion.supportsSeo(provider)
          ? await this.ingestion.ingestSeo(provider, workspaceId)
          : await this.ingestion.ingest(provider, workspaceId);
      await this.upsertStatus(provider, IntegrationStatus.CONNECTED, new Date(), workspaceId);
      return { ...result, status: 'synced' };
    } catch (err) {
      await this.upsertStatus(provider, IntegrationStatus.ERROR, null, workspaceId);
      return { provider, status: 'error', error: (err as Error).message };
    }
  }

  async disconnect(rawProvider: string, workspaceId: string = WORKSPACE_ID) {
    const provider = this.parseProvider(rawProvider);
    await this.upsertStatus(provider, IntegrationStatus.AVAILABLE, null, workspaceId);
    return { provider, status: 'available' };
  }

  private async upsertStatus(provider: Provider, status: IntegrationStatus, lastSyncedAt?: Date | null, workspaceId: string = WORKSPACE_ID) {
    await this.prisma.integration.upsert({
      where: { workspaceId_provider: { workspaceId, provider } },
      update: { status, ...(lastSyncedAt !== undefined ? { lastSyncedAt } : {}) },
      create: { workspaceId, provider, status, lastSyncedAt: lastSyncedAt ?? null },
    });
  }
}
