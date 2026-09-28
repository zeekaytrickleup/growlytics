import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { WooCommerceConnector } from '../connectors/woocommerce.connector';
import { WooCredentialsService } from '../connectors/woo-credentials.service';

@Module({
  controllers: [CustomersController],
  providers: [CustomersService, WooCommerceConnector, WooCredentialsService],
})
export class CustomersModule {}
