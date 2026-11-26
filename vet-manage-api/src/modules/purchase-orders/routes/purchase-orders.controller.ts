import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { success } from '../../../common/errors/api-response.js';
import { RequirePermissions } from '../../identity/decorators/require-permissions.decorator.js';
import { CreatePurchaseOrderDto } from '../dtos/create-purchase-order.dto.js';
import { ListPurchaseOrdersQueryDto } from '../dtos/list-purchase-orders-query.dto.js';
import { PurchaseOrdersService } from '../services/purchase-orders.service.js';

// HU-27: órdenes de compra elaboradas por el Gerente.
@Controller('purchase-orders')
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrders: PurchaseOrdersService) {}

  @Get()
  @RequirePermissions('purchase-orders:read')
  async list(@Query() query: ListPurchaseOrdersQueryDto) {
    return success(await this.purchaseOrders.list(query));
  }

  @Get(':id')
  @RequirePermissions('purchase-orders:read')
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return success(await this.purchaseOrders.findById(id));
  }

  @Post()
  @RequirePermissions('purchase-orders:create')
  async create(@Body() input: CreatePurchaseOrderDto) {
    return success(await this.purchaseOrders.create(input), 'Orden de compra registrada correctamente', 201);
  }
}
