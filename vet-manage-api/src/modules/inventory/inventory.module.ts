import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma/prisma.module.js';
import { IdentityModule } from '../identity/identity.module.js';
import { InventoryController } from './inventory.controller.js';
import { InventoryService } from './services/inventory.service.js';
import { InventoryMovementsController } from './inventory-movements.controller.js';
import { InventoryMovementsService } from './services/inventory-movements.service.js';

@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [InventoryController, InventoryMovementsController],
  providers: [InventoryService, InventoryMovementsService],
})
export class InventoryModule {}
