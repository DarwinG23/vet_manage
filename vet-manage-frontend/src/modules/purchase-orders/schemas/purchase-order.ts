import { ApiError } from '../../../infrastructure/api/http-client';
import type { PurchaseOrderInput } from '../types';

// Mismos límites y mensajes que la API (HU-27).
export const PURCHASE_ORDER_MAX_QUANTITY = 1_000_000;

export type PurchaseOrderLineDraft = { key: string; productId: string; quantity: string; unitPrice: string };
export type PurchaseOrderDraft = { supplierId: string; lines: PurchaseOrderLineDraft[] };
export type PurchaseOrderLineErrors = Partial<Record<'productId' | 'quantity' | 'unitPrice', string>>;
export type PurchaseOrderErrors = { supplierId?: string; items?: string; lines: Record<string, PurchaseOrderLineErrors> };

const INTEGER_PATTERN = /^\d+$/;
const NUMBER_PATTERN = /^\+?(\d+\.?\d*|\.\d+)$/;
const PRICE_PATTERN = /^(\d+)(?:\.(\d{1,2}))?$/;

export const PURCHASE_ORDER_MESSAGES = {
  supplierRequired: 'Debe seleccionar un proveedor',
  itemsRequired: 'Debe agregar al menos un producto',
  productRequired: 'Debe seleccionar un producto',
  productDuplicated: 'El producto ya fue agregado a la orden',
  quantityInvalid: 'La cantidad debe ser un número entero mayor que cero',
  quantityTooLarge: `La cantidad no puede superar ${PURCHASE_ORDER_MAX_QUANTITY.toLocaleString('es-EC')}`,
  priceInvalid: 'El precio unitario debe ser mayor que cero',
  priceFormat: 'El precio unitario admite como máximo dos decimales',
} as const;

export function hasPurchaseOrderErrors(errors: PurchaseOrderErrors) {
  return Boolean(errors.supplierId || errors.items || Object.keys(errors.lines).length > 0);
}

// Precio en centavos; null si no es un importe válido mayor que cero.
export function priceToCents(value: string): number | null {
  const raw = value.trim();
  if (!NUMBER_PATTERN.test(raw) || Number(raw) <= 0) return null;
  const match = PRICE_PATTERN.exec(raw.replace(/^\+/, ''));
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
}

export function validatePurchaseOrderDraft(draft: PurchaseOrderDraft): PurchaseOrderErrors {
  const errors: PurchaseOrderErrors = { lines: {} };
  if (!draft.supplierId) errors.supplierId = PURCHASE_ORDER_MESSAGES.supplierRequired;
  if (draft.lines.length === 0) errors.items = PURCHASE_ORDER_MESSAGES.itemsRequired;

  const seen = new Set<string>();
  for (const line of draft.lines) {
    const lineErrors: PurchaseOrderLineErrors = {};
    if (!line.productId) lineErrors.productId = PURCHASE_ORDER_MESSAGES.productRequired;
    else if (seen.has(line.productId)) lineErrors.productId = PURCHASE_ORDER_MESSAGES.productDuplicated;
    else seen.add(line.productId);

    const quantity = line.quantity.trim();
    if (!INTEGER_PATTERN.test(quantity) || Number(quantity) <= 0) lineErrors.quantity = PURCHASE_ORDER_MESSAGES.quantityInvalid;
    else if (Number(quantity) > PURCHASE_ORDER_MAX_QUANTITY) lineErrors.quantity = PURCHASE_ORDER_MESSAGES.quantityTooLarge;

    const price = line.unitPrice.trim();
    if (!NUMBER_PATTERN.test(price) || Number(price) <= 0) lineErrors.unitPrice = PURCHASE_ORDER_MESSAGES.priceInvalid;
    else if (priceToCents(price) === null) lineErrors.unitPrice = PURCHASE_ORDER_MESSAGES.priceFormat;

    if (Object.keys(lineErrors).length > 0) errors.lines[line.key] = lineErrors;
  }
  return errors;
}

// Subtotal de una línea en centavos (0 mientras sus datos no sean válidos).
export function lineSubtotalCents(line: PurchaseOrderLineDraft): number {
  const cents = priceToCents(line.unitPrice);
  const quantity = line.quantity.trim();
  if (cents === null || !INTEGER_PATTERN.test(quantity)) return 0;
  return cents * Number(quantity);
}

export function draftTotalCents(draft: PurchaseOrderDraft): number {
  return draft.lines.reduce((total, line) => total + lineSubtotalCents(line), 0);
}

export function buildPurchaseOrderInput(draft: PurchaseOrderDraft): PurchaseOrderInput {
  return {
    supplierId: draft.supplierId,
    items: draft.lines.map((line) => ({
      productId: line.productId,
      quantity: Number(line.quantity.trim()),
      unitPrice: line.unitPrice.trim().replace(/^\+/, ''),
    })),
  };
}

export function formatMoney(value: number | string, fromCents = false): string {
  const amount = fromCents ? Number(value) / 100 : Number(value);
  return new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(amount);
}

export function formatOrderDate(iso: string): string {
  return new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

export function purchaseOrderApiErrorMessage(cause: unknown, fallback: string): string {
  if (!(cause instanceof ApiError)) return cause instanceof Error ? cause.message : fallback;
  if (cause.status === 403) return 'No tiene permisos para realizar esta acción.';
  if (cause.status === 404 && !cause.message) return 'No se encontró la orden de compra.';
  return cause.message || fallback;
}

// Errores de la API («Producto N: …») ubicados en la línea correspondiente del formulario.
export function purchaseOrderApiErrors(cause: unknown, draft: PurchaseOrderDraft): PurchaseOrderErrors {
  const errors: PurchaseOrderErrors = { lines: {} };
  if (!(cause instanceof ApiError)) return errors;
  const messages = cause.errors.length > 0 ? cause.errors : [cause.message];
  for (const message of messages) {
    const match = /^Producto (\d+): (.+)$/.exec(message);
    if (match) {
      const line = draft.lines[Number(match[1]) - 1];
      if (!line) continue;
      const text = match[2].charAt(0).toUpperCase() + match[2].slice(1);
      const field = text.includes('cantidad') ? 'quantity' : text.includes('precio') ? 'unitPrice' : 'productId';
      errors.lines[line.key] = { ...errors.lines[line.key], [field]: text };
    } else if (message.toLowerCase().includes('proveedor')) {
      errors.supplierId = message;
    } else if (message.includes('al menos un producto')) {
      errors.items = message;
    }
  }
  return errors;
}
