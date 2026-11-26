import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { ApiException } from '../../common/errors/api-exception.js';
import { success } from '../../common/errors/api-response.js';
import { RequirePermissions } from '../identity/decorators/require-permissions.decorator.js';
import type { AuthenticatedRequest } from '../identity/types/authenticated-request.js';
import { ListInventoryMovementsQueryDto } from './dtos/list-inventory-movements-query.dto.js';
import { RegisterBatchWriteOffDto } from './dtos/register-batch-write-off.dto.js';
import { InventoryMovementsService } from './services/inventory-movements.service.js';

@Controller('inventory')
export class InventoryMovementsController {
  constructor(private readonly movements: InventoryMovementsService) {}

  @Post('write-offs')
  @RequirePermissions('inventory:register-exit')
  async registerWriteOff(@Body() input: RegisterBatchWriteOffDto, @Req() request: AuthenticatedRequest) {
    if (!request.user) throw ApiException.unauthorized();
    return success(await this.movements.registerWriteOff(input, request.user.id), 'Baja registrada correctamente', 201);
  }

  @Get('movements')
  @RequirePermissions('inventory:read-reports')
  async listMovements(@Query() query: ListInventoryMovementsQueryDto) {
    const result = await this.movements.listMovements(query);
    return success(result, result.total === 0 ? 'No existen movimientos registrados' : undefined);
  }
}
