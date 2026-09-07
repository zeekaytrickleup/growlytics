import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const DEFAULT_WORKSPACE_ID = 'demo-workspace';

/**
 * Resolves the active workspace for the request.
 *
 * DEV MODE (current): reads the `x-workspace-id` header, falling back to the demo workspace.
 * With real auth (Clerk), a guard would verify the JWT and the user's membership in this
 * workspace before the request reaches the handler — the decorator's return value stays the same.
 */
export const Workspace = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest<{
    headers: Record<string, string | undefined>;
    query: Record<string, string | undefined>;
  }>();
  const header = req.headers['x-workspace-id'];
  // Query param fallback so header-less requests (e.g. a PDF download link) can still scope.
  const query = req.query?.workspaceId;
  return (header && header.trim()) || (query && query.trim()) || DEFAULT_WORKSPACE_ID;
});
