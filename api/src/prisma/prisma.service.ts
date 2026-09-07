import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    // Connect lazily/gracefully so the API still boots (health, mock endpoints)
    // even before a database is provisioned. See MASTER_PLAN §Phase 1.
    try {
      await this.$connect();
      this.logger.log('Connected to database.');
    } catch (err) {
      this.logger.warn(
        `Database not reachable yet — running without DB. (${(err as Error).message})`,
      );
    }
  }
}
