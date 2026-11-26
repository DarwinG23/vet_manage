import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import { ApiException } from '../../../common/errors/api-exception.js';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service.js';
import { validateSaleInput } from './sale-input.service.js';

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: unknown, cashierId: string) {
    const validation = validateSaleInput(input);
    if (!validation.valid) throw ApiException.badRequest(validation.message);

    return this.prisma.$transaction(async (tx) => {
      const lines: Array<{
        productId: string;
        batchId: string;
        quantity: number;
        unitPrice: Prisma.Decimal;
        subtotal: Prisma.Decimal;
        stockBefore: number;
        stockAfter: number;
      }> = [];
      let total = new Prisma.Decimal(0);

      for (const requested of validation.items) {
        const product = await tx.product.findFirst({
          where: { id: requested.productId, isActive: true },
          include: { batches: { where: { availableQuantity: { gt: 0 } }, orderBy: [{ expirationDate: 'asc' }, { createdAt: 'asc' }] } },
        });
        if (!product) throw ApiException.notFound('Producto no encontrado');

        const batch = product.batches.find((candidate) => candidate.availableQuantity >= requested.quantity);
        if (!batch) {
          throw ApiException.badRequest(`Stock insuficiente: solo hay ${product.stock} unidades disponibles de ${product.name}`);
        }

        const stockBefore = product.stock;
        const stockAfter = stockBefore - requested.quantity;
        if (stockAfter < 0) {
          throw ApiException.badRequest(`Stock insuficiente: solo hay ${product.stock} unidades disponibles de ${product.name}`);
        }

        const updatedBatch = await tx.batch.updateMany({
          where: { id: batch.id, availableQuantity: { gte: requested.quantity } },
          data: { availableQuantity: { decrement: requested.quantity } },
        });
        if (updatedBatch.count !== 1) {
          throw ApiException.badRequest(`Stock insuficiente: solo hay ${batch.availableQuantity} unidades disponibles de ${product.name}`);
        }
        const updatedProduct = await tx.product.updateMany({
          where: { id: product.id, stock: { gte: requested.quantity } },
          data: { stock: { decrement: requested.quantity } },
        });
        if (updatedProduct.count !== 1) {
          throw ApiException.badRequest(`Stock insuficiente: solo hay ${product.stock} unidades disponibles de ${product.name}`);
        }

        const unitPrice = new Prisma.Decimal(product.unitPrice);
        const subtotal = unitPrice.mul(requested.quantity);
        total = total.plus(subtotal);
        lines.push({ productId: product.id, batchId: batch.id, quantity: requested.quantity, unitPrice, subtotal, stockBefore, stockAfter });
      }

      const sale = await tx.sale.create({ data: { status: 'PAID', subtotal: total, discount: new Prisma.Decimal(0), total } });
      await tx.saleDetail.createMany({ data: lines.map((line) => ({
        saleId: sale.id,
        productId: line.productId,
        batchId: line.batchId,
        quantity: line.quantity,
        appliedUnitPrice: line.unitPrice,
        discountPercentage: new Prisma.Decimal(0),
        subtotal: line.subtotal,
      })) });
      await tx.inventoryMovement.createMany({ data: lines.map((line) => ({
        batchId: line.batchId,
        type: 'VENTA',
        quantity: line.quantity,
        stockBefore: line.stockBefore,
        stockAfter: line.stockAfter,
        reason: 'Venta registrada',
        userId: cashierId,
      })) });
      return this.serializeSale(await tx.sale.findUniqueOrThrow({
        where: { id: sale.id },
        include: { details: { include: { product: true, batch: true } } },
      }));
    });
  }

  async list() {
    const sales = await this.prisma.sale.findMany({
      take: 50,
      orderBy: { occurredAt: 'desc' },
      include: { details: { include: { product: true, batch: true } } },
    });
    return sales.map((sale) => this.serializeSale(sale));
  }

  private serializeSale(sale: any) {
    return {
      id: sale.id,
      total: sale.total.toString(),
      createdAt: sale.occurredAt.toISOString(),
      cashier: 'Usuario registrado en movimiento de inventario',
      items: sale.details.map((item: any) => ({
        id: item.id,
        productId: item.productId,
        productName: item.product.name,
        batchCode: item.batch.code,
        quantity: item.quantity,
        unitPrice: item.appliedUnitPrice.toString(),
        subtotal: item.subtotal.toString(),
      })),
    };
  }
}
