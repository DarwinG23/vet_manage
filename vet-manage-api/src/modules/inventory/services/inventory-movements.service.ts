import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import { ApiException } from '../../../common/errors/api-exception.js';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service.js';
import type { ListInventoryMovementsQueryDto } from '../dtos/list-inventory-movements-query.dto.js';
import type { RegisterBatchWriteOffDto } from '../dtos/register-batch-write-off.dto.js';
import { validateBatchWriteOffInput } from './batch-write-off-input.service.js';

const movementInclude = {
  batch: { select: { id: true, code: true, product: { select: { id: true, code: true, name: true } } } },
  user: { select: { id: true, person: { select: { firstName: true, lastName: true } } } },
} as const;

type MovementWithReferences = Prisma.InventoryMovementGetPayload<{ include: typeof movementInclude }>;

@Injectable()
export class InventoryMovementsService {
  private readonly logger = new Logger(InventoryMovementsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async registerWriteOff(input: RegisterBatchWriteOffDto, userId: string) {
    const validation = validateBatchWriteOffInput(input);
    if (!validation.valid) {
      const errors = Object.values(validation.errors);
      throw ApiException.badRequest(errors.length === 1 ? errors[0] : 'Revisa los datos de la baja', errors);
    }
    const { batchId, quantity, reason, observation } = validation.value;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.batch.findUnique({
          where: { id: batchId },
          select: { id: true, availableQuantity: true, expirationDate: true, product: { select: { isActive: true } } },
        });
        if (!existing) throw ApiException.notFound('Lote no encontrado');
        if (!existing.product.isActive) throw ApiException.conflict('El producto del lote está inactivo');
        if (validation.value.reason === 'Vencimiento') {
          const today = new Date().toISOString().slice(0, 10);
          const expirationDate = existing.expirationDate.toISOString().slice(0, 10);
          if (expirationDate >= today) throw ApiException.conflict('El lote todavía no ha caducado');
        }
        if (existing.availableQuantity === 0) throw ApiException.conflict('El lote no tiene unidades disponibles');
        if (quantity > existing.availableQuantity) {
          throw ApiException.conflict('La cantidad solicitada supera las existencias disponibles');
        }

        // El UPDATE condicional vuelve a comprobar el saldo bajo el bloqueo de la fila.
        // El saldo devuelto incluye cualquier descuento concurrente que ya se confirmó.
        const [batch] = await tx.batch.updateManyAndReturn({
          where: { id: batchId, availableQuantity: { gte: quantity }, product: { isActive: true } },
          data: { availableQuantity: { decrement: quantity } },
          select: { id: true, productId: true, availableQuantity: true },
        });
        if (!batch) throw ApiException.conflict('La cantidad solicitada supera las existencias disponibles');

        const [product] = await tx.product.updateManyAndReturn({
          where: { id: batch.productId, stock: { gte: quantity }, isActive: true },
          data: { stock: { decrement: quantity } },
          select: { id: true, stock: true },
        });
        if (!product) throw ApiException.conflict('Las existencias del producto no permiten registrar la baja');

        const movement = await tx.inventoryMovement.create({
          data: {
            batchId: batch.id,
            type: 'BAJA',
            quantity,
            stockBefore: batch.availableQuantity + quantity,
            stockAfter: batch.availableQuantity,
            reason,
            observation: observation,
            userId,
          },
          include: movementInclude,
        });
        return { batch, product, movement: this.toResponse(movement) };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
    } catch (error) {
      if (error instanceof ApiException) throw error;
      this.logger.error('No se pudo registrar la baja', error);
      throw ApiException.internalServerError('No se pudo registrar la baja');
    }
  }

  async listMovements({ batchId, page = 1, pageSize = 20 }: Partial<ListInventoryMovementsQueryDto>) {
    const skip = (page - 1) * pageSize;
    if (!Number.isSafeInteger(skip) || skip > 2_147_483_647) {
      throw ApiException.badRequest('La página solicitada excede el límite permitido');
    }
    const where: Prisma.InventoryMovementWhereInput = batchId ? { batchId } : {};
    const { items, total } = await this.prisma.$transaction(async (tx) => ({
      items: await tx.inventoryMovement.findMany({
        where,
        include: movementInclude,
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        skip,
        take: pageSize,
      }),
      total: await tx.inventoryMovement.count({ where }),
    }), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });

    return {
      items: items.map((item) => this.toResponse(item)),
      page, pageSize, total, totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  private toResponse(movement: MovementWithReferences) {
    return {
      id: movement.id,
      type: movement.type,
      quantity: movement.quantity,
      reason: movement.reason ?? 'Sin motivo',
      observation: movement.observation,
      previousBalance: movement.stockBefore,
      resultingBalance: movement.stockAfter,
      occurredAt: movement.occurredAt.toISOString(),
      batch: movement.batch,
      user: { id: movement.user.id, ...movement.user.person },
    };
  }
}
