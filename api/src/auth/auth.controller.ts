import { Controller, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Workspace } from './workspace.decorator';

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('me')
  me(@Workspace() workspaceId: string) {
    return this.auth.me(workspaceId);
  }
}
