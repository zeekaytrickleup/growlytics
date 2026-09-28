import { Injectable, Logger } from '@nestjs/common';
import { Prisma, Provider } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { decryptJson, encryptJson } from './crypto.util';

/**
 * Generic per-workspace credential storage for any provider (encrypted at rest on the
 * Integration row). Store connectors (WooCommerce) have their own resolver; this covers the
 * marketing providers (Klaviyo, and later Meta/Google Ads).
 */
@Injectable()
export class CredentialsStore {
  private readonly logger = new Logger(CredentialsStore.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Save encrypted credentials for a provider; `publicMeta` (non-secret) is stored in clear for display. */
  async save(workspaceId: string, provider: Provider, secret: Record<string, string>, publicMeta?: Prisma.InputJsonValue) {
    await this.prisma.integration.upsert({
      where: { workspaceId_provider: { workspaceId, provider } },
      update: { encryptedTokens: encryptJson(secret), ...(publicMeta ? { meta: publicMeta } : {}) },
      create: { workspaceId, provider, encryptedTokens: encryptJson(secret), meta: publicMeta ?? {} },
    });
  }

  /** Read + decrypt a provider's stored credentials for a workspace (null if none/undecryptable). */
  async resolve<T = Record<string, string>>(workspaceId: string, provider: Provider): Promise<T | null> {
    try {
      const row = await this.prisma.integration.findUnique({
        where: { workspaceId_provider: { workspaceId, provider } },
      });
      if (row?.encryptedTokens) return decryptJson<T>(row.encryptedTokens);
    } catch (err) {
      this.logger.warn(`Could not read ${provider} creds: ${(err as Error).message}`);
    }
    return null;
  }
}
