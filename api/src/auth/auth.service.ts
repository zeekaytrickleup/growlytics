import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
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

  /** Permanently delete a workspace (store) and all its data (cascades via the schema). */
  async deleteWorkspace(workspaceId: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: DEMO_USER_EMAIL },
      include: { memberships: true },
    });
    const count = user?.memberships.length ?? 0;
    if (count <= 1) {
      throw new BadRequestException('You cannot remove your only store.');
    }
    try {
      await this.prisma.workspace.delete({ where: { id: workspaceId } });
    } catch {
      throw new NotFoundException('Store not found.');
    }
    return { id: workspaceId, deleted: true };
  }

  /** Create a new workspace (one per store) and make the current demo user its owner. */
  async createWorkspace(name: string) {
    const clean = (name || '').trim() || 'New Store';
    const user = await this.prisma.user.upsert({
      where: { email: DEMO_USER_EMAIL },
      update: {},
      create: { email: DEMO_USER_EMAIL, name: 'Demo User' },
    });
    const ws = await this.prisma.workspace.create({ data: { name: clean } });
    await this.prisma.membership.create({
      data: { userId: user.id, workspaceId: ws.id, role: Role.OWNER },
    });
    return { id: ws.id, name: ws.name, role: Role.OWNER };
  }
}
