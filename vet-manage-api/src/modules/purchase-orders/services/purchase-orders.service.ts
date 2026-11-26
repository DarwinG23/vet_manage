import { Injectable } from '@nestjs/common';
import { ApiException } from '../../../common/errors/api-exception.js';
import type { CreatePurchaseOrderDto } from '../dtos/create-purchase-order.dto.js';
import type { ListPurchaseOrdersQueryDto } from '../dtos/list-purchase-orders-query.dto.js';
import type {
  PurchaseOrderListResponseDto,
  PurchaseOrderResponseDto,
  PurchaseOrderSummaryDto,
} from '../dtos/purchase-order-response.dto.js';
import {
  PurchaseOrdersRepository,
  type PurchaseOrderRecord,
  type PurchaseOrderSummaryRecord,
} from '../repositories/purchase-orders.repository.js';
import {
  PURCHASE_ORDER_MESSAGES as M,
  centsToDecimalString,
  formatPurchaseOrderCode,
  validatePurchaseOrderInput,
} from './purchase-order-input.js';

@Injectable()
export class PurchaseOrdersService {
  constructor(private readonly repository: PurchaseOrdersRepository) {}

  // HU-27: crea la orden en estado «Pendiente» con número único, fecha y total calculado.
  async create(input: CreatePurchaseOrderDto): Promise<PurchaseOrderResponseDto> {
    const validation = validatePurchaseOrderInput(input);
    if (!validation.valid) throw this.invalid(validation.errors);
    const order = validation.value;

    const supplier = await this.repository.findSupplier(order.supplierId);
    if (!supplier) throw ApiException.notFound(M.supplierNotFound);
    if (!supplier.isActive) throw ApiException.conflict(M.supplierInactive);

    const available = await this.repository.findActiveProductIds(order.items.map(({ productId }) => productId));
    const unavailable = order.items
      .map((item, index) => (available.has(item.productId) ? null : M.productUnavailable(index + 1)))
      .filter((message): message is string => message !== null);
    if (unavailable.length > 0) throw this.invalid(unavailable);

    const created = await this.repository.create({
      supplierId: order.supplierId,
      total: centsToDecimalString(order.totalCents),
      items: order.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: centsToDecimalString(item.unitPriceCents),
        subtotal: centsToDecimalString(item.subtotalCents),
      })),
    });
    return this.toResponse(created);
  }

  async list(query: ListPurchaseOrdersQueryDto): Promise<PurchaseOrderListResponseDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const { orders, total } = await this.repository.findMany({
      page,
      pageSize,
      supplierId: query.supplierId,
      status: query.status,
    });
    return {
      items: orders.map((order) => this.toSummary(order)),
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  async findById(id: string): Promise<PurchaseOrderResponseDto> {
    const order = await this.repository.findById(id);
    if (!order) throw ApiException.notFound('Orden de compra no encontrada');
    return this.toResponse(order);
  }

  // Consulta para HU-26: un proveedor con órdenes pendientes no debe desactivarse.
  hasPendingOrders(supplierId: string): Promise<boolean> {
    return this.repository.hasPendingOrders(supplierId);
  }

  private invalid(errors: string[]) {
    return ApiException.badRequest(errors.length === 1 ? errors[0] : M.invalid, errors);
  }

  private toResponse(order: PurchaseOrderRecord): PurchaseOrderResponseDto {
    return {
      id: order.id,
      number: order.number,
      code: formatPurchaseOrderCode(order.number),
      orderDate: order.orderDate.toISOString(),
      status: order.status,
      total: order.total.toFixed(2),
      supplier: order.supplier,
      items: order.items.map((item) => ({
        id: item.id,
        product: item.product,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toFixed(2),
        subtotal: item.subtotal.toFixed(2),
      })),
    };
  }

  private toSummary(order: PurchaseOrderSummaryRecord): PurchaseOrderSummaryDto {
    return {
      id: order.id,
      number: order.number,
      code: formatPurchaseOrderCode(order.number),
      orderDate: order.orderDate.toISOString(),
      status: order.status,
      total: order.total.toFixed(2),
      supplier: order.supplier,
      itemsCount: order._count.items,
    };
  }
}
