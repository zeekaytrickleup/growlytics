import { Controller, Get } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { Workspace } from '../auth/workspace.decorator';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  segments(@Workspace() workspaceId: string) {
    return this.customers.segments(workspaceId);
  }
}
