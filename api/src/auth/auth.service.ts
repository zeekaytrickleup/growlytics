import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const DEMO_USER_EMAIL = 'demo@growlytics.ai';

/**
 * DEV-MODE auth. Resolves the current user + their workspaces from the seeded demo user.
 * With real auth (Clerk), `me()` would read the verified identity from the request token instead
 * of the fixed demo email — the response shape stays identical, so the frontend doesn't change.
 */
@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async me(currentWorkspaceId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email: DEMO_USER_EMAIL },
        include: { memberships: { include: { workspace: true } } },
      });
      if (user) {
        const workspaces = user.memberships.map((m) => ({
          id: m.workspace.id,
          name: m.workspace.name,
          role: m.role,
        }));
        return {
          authMode: 'dev' as const,
          user: { name: user.name ?? 'Demo User', email: user.email },
          currentWorkspaceId: workspaces.some((w) => w.id === currentWorkspaceId) ? currentWorkspaceId : workspaces[0]?.id ?? currentWorkspaceId,
          workspaces,
        };
      }
    } catch {
      /* no DB — dev fallback below */
    }
    return {
      authMode: 'dev' as const,
      user: { name: 'Demo User', email: DEMO_USER_EMAIL },
      currentWorkspaceId,
      workspaces: [{ id: 'demo-workspace', name: 'Northwind Goods', role: 'OWNER' }],
    };
  }
}
