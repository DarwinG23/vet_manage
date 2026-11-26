import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { success } from '../../common/errors/api-response.js';
import { RequirePermissions } from '../identity/decorators/require-permissions.decorator.js';
import type { AuthenticatedRequest } from '../identity/types/authenticated-request.js';
import { CreateSaleDto } from './dtos/create-sale.dto.js';
import { SalesService } from './services/sales.service.js';

@Controller('inventory/sales')
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Post()
  @RequirePermissions('inventory:register-exit')
  async create(@Body() input: CreateSaleDto, @Req() request: AuthenticatedRequest) {
    if (!request.user) throw new Error('Authenticated user missing');
    return success(await this.sales.create(input, request.user.id), 'Venta registrada correctamente', 201);
  }

  @Get()
  @RequirePermissions('inventory:read')
  async list() {
    return success(await this.sales.list());
  }
}
