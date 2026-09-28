import { Injectable, Logger } from '@nestjs/common';
import { Provider } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { decryptJson, encryptJson } from './crypto.util';

export type WooCreds = { storeUrl: string; consumerKey: string; consumerSecret: string };

/**
 * Resolves the WooCommerce credentials to use for a workspace:
 *   1. per-workspace credentials saved from the dashboard (encrypted on the Integration row), else
 *   2. the host env vars (WOO_STORE_URL / WOO_CONSUMER_KEY / WOO_CONSUMER_SECRET) as a fallback.
 * This is what lets each workspace point at a different store.
 */
@Injectable()
export class WooCredentialsService {
  private readonly logger = new Logger(WooCredentialsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private fromEnv(): WooCreds | null {
    const { WOO_STORE_URL, WOO_CONSUMER_KEY, WOO_CONSUMER_SECRET } = process.env;
    if (WOO_STORE_URL && WOO_CONSUMER_KEY && WOO_CONSUMER_SECRET) {
      return { storeUrl: WOO_STORE_URL, consumerKey: WOO_CONSUMER_KEY, consumerSecret: WOO_CONSUMER_SECRET };
    }
    return null;
  }

  /** Credentials for a workspace: its saved store first, then env fallback. */
  async resolve(workspaceId: string): Promise<WooCreds | null> {
    try {
      const row = await this.prisma.integration.findUnique({
        where: { workspaceId_provider: { workspaceId, provider: Provider.WOOCOMMERCE } },
      });
      if (row?.encryptedTokens) {
        const creds = decryptJson<WooCreds>(row.encryptedTokens);
        if (creds?.storeUrl && creds.consumerKey && creds.consumerSecret) return creds;
      }
    } catch (err) {
      this.logger.warn(`Could not read saved WooCommerce creds: ${(err as Error).message}`);
    }
    return this.fromEnv();
  }

  /** Persist per-workspace store credentials (encrypted). Store URL is also kept in `meta` for display. */
  async save(workspaceId: string, creds: WooCreds) {
    const clean: WooCreds = {
      storeUrl: creds.storeUrl.trim().replace(/\/+$/, ''),
      consumerKey: creds.consumerKey.trim(),
      consumerSecret: creds.consumerSecret.trim(),
    };
    await this.prisma.integration.upsert({
      where: { workspaceId_provider: { workspaceId, provider: Provider.WOOCOMMERCE } },
      update: { encryptedTokens: encryptJson(clean), meta: { storeUrl: clean.storeUrl } },
      create: {
        workspaceId,
        provider: Provider.WOOCOMMERCE,
        encryptedTokens: encryptJson(clean),
        meta: { storeUrl: clean.storeUrl },
      },
    });
    return clean;
  }
}
