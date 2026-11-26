import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma/prisma.module.js';
import { IdentityModule } from '../identity/identity.module.js';
import { PurchaseOrdersRepository } from './repositories/purchase-orders.repository.js';
import { PurchaseOrdersController } from './routes/purchase-orders.controller.js';
import { PurchaseOrdersService } from './services/purchase-orders.service.js';

@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [PurchaseOrdersController],
  providers: [PurchaseOrdersRepository, PurchaseOrdersService],
  exports: [PurchaseOrdersService],
})
export class PurchaseOrdersModule {}
