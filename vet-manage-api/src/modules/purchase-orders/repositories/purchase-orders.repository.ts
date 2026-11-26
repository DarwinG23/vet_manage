import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service.js';
import type { PurchaseOrderStatusFilter } from '../dtos/list-purchase-orders-query.dto.js';

const supplierSelection = { id: true, businessName: true, ruc: true } as const;

const orderSelection = {
  id: true,
  number: true,
  orderDate: true,
  status: true,
  total: true,
  supplier: { select: supplierSelection },
  items: {
    select: {
      id: true,
      quantity: true,
      unitPrice: true,
      subtotal: true,
      product: { select: { id: true, code: true, name: true } },
    },
    orderBy: { product: { name: 'asc' } },
  },
} as const satisfies Prisma.PurchaseOrderSelect;

const summarySelection = {
  id: true,
  number: true,
  orderDate: true,
  status: true,
  total: true,
  supplier: { select: supplierSelection },
  _count: { select: { items: true } },
} as const satisfies Prisma.PurchaseOrderSelect;

export type PurchaseOrderRecord = Prisma.PurchaseOrderGetPayload<{ select: typeof orderSelection }>;
export type PurchaseOrderSummaryRecord = Prisma.PurchaseOrderGetPayload<{ select: typeof summarySelection }>;

export type CreatePurchaseOrderData = {
  supplierId: string;
  total: string;
  items: { productId: string; quantity: number; unitPrice: string; subtotal: string }[];
};

export type ListPurchaseOrdersInput = {
  page: number;
  pageSize: number;
  supplierId?: string;
  status?: PurchaseOrderStatusFilter;
};

@Injectable()
export class PurchaseOrdersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findSupplier(id: string): Promise<{ id: string; isActive: boolean } | null> {
    return this.prisma.supplier.findUnique({ where: { id }, select: { id: true, isActive: true } });
  }

  async findActiveProductIds(ids: string[]): Promise<Set<string>> {
    const products = await this.prisma.product.findMany({
      where: { id: { in: ids }, isActive: true },
      select: { id: true },
    });
    return new Set(products.map(({ id }) => id));
  }

  // Crea la orden y sus productos en una sola operación. Solo escribe en las tablas
  // de órdenes: las existencias se actualizan al registrar la recepción, no aquí.
  create(data: CreatePurchaseOrderData): Promise<PurchaseOrderRecord> {
    return this.prisma.purchaseOrder.create({
      data: {
        supplierId: data.supplierId,
        status: 'PENDING',
        total: new Prisma.Decimal(data.total),
        items: {
          create: data.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: new Prisma.Decimal(item.unitPrice),
            subtotal: new Prisma.Decimal(item.subtotal),
          })),
        },
      },
      select: orderSelection,
    });
  }

  findById(id: string): Promise<PurchaseOrderRecord | null> {
    return this.prisma.purchaseOrder.findUnique({ where: { id }, select: orderSelection });
  }

  async findMany(query: ListPurchaseOrdersInput): Promise<{ orders: PurchaseOrderSummaryRecord[]; total: number }> {
    const where = {
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
      ...(query.status ? { status: query.status } : {}),
    } satisfies Prisma.PurchaseOrderWhereInput;

    const [orders, total] = await this.prisma.$transaction([
      this.prisma.purchaseOrder.findMany({
        where,
        select: summarySelection,
        orderBy: { number: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);
    return { orders, total };
  }

  // Integración pedida por HU-26 para bloquear la desactivación de proveedores con órdenes pendientes.
  async hasPendingOrders(supplierId: string): Promise<boolean> {
    const count = await this.prisma.purchaseOrder.count({ where: { supplierId, status: 'PENDING' } });
    return count > 0;
  }
}
