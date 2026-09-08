import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { WooCommerceConnector } from '../connectors/woocommerce.connector';

@Module({
  controllers: [CustomersController],
  providers: [CustomersService, WooCommerceConnector],
})
export class CustomersModule {}
