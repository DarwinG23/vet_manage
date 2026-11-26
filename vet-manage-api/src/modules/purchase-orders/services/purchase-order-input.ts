// HU-27: reglas de validación de una orden de compra. Se valida aquí, y no con decoradores del DTO,
// para indicar con un mensaje claro qué dato de qué producto debe corregirse.

export type PurchaseOrderItemInput = {
  productId?: unknown;
  quantity?: unknown;
  unitPrice?: unknown;
};

export type PurchaseOrderInput = {
  supplierId?: unknown;
  items?: unknown;
};

export type ValidPurchaseOrderItem = {
  productId: string;
  quantity: number;
  // Precio y subtotal en centavos para calcular sin errores de redondeo.
  unitPriceCents: bigint;
  subtotalCents: bigint;
};

export type ValidPurchaseOrder = {
  supplierId: string;
  items: ValidPurchaseOrderItem[];
  totalCents: bigint;
};

export type PurchaseOrderValidation =
  | { valid: true; value: ValidPurchaseOrder; errors: [] }
  | { valid: false; value: null; errors: string[] };

export const PURCHASE_ORDER_MAX_ITEMS = 100;
export const PURCHASE_ORDER_MAX_QUANTITY = 1_000_000;
// Límites de las columnas DECIMAL(12,2) del precio y DECIMAL(14,2) del total.
const MAX_UNIT_PRICE_CENTS = 999_999_999_999n;
const MAX_TOTAL_CENTS = 99_999_999_999_999n;

export const PURCHASE_ORDER_MESSAGES = {
  supplierRequired: 'Debe seleccionar un proveedor',
  supplierNotFound: 'El proveedor seleccionado no existe',
  supplierInactive: 'El proveedor seleccionado está inactivo',
  itemsRequired: 'Debe agregar al menos un producto',
  tooManyItems: `La orden admite como máximo ${PURCHASE_ORDER_MAX_ITEMS} productos`,
  totalTooLarge: 'El total de la orden excede el máximo permitido',
  invalid: 'Revisa los datos de la orden de compra',
  productRequired: (line: number) => `Producto ${line}: debe seleccionar un producto`,
  productDuplicated: (line: number) => `Producto ${line}: el producto ya fue agregado a la orden`,
  productUnavailable: (line: number) => `Producto ${line}: el producto seleccionado no existe o está inactivo`,
  quantityInvalid: (line: number) =>
    `Producto ${line}: la cantidad debe ser un número entero mayor que cero`,
  quantityTooLarge: (line: number) =>
    `Producto ${line}: la cantidad no puede superar ${PURCHASE_ORDER_MAX_QUANTITY.toLocaleString('es-EC')}`,
  priceInvalid: (line: number) => `Producto ${line}: el precio unitario debe ser mayor que cero`,
  priceFormat: (line: number) => `Producto ${line}: el precio unitario admite como máximo dos decimales`,
} as const;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INTEGER_PATTERN = /^\d+$/;
const NUMBER_PATTERN = /^[-+]?(\d+\.?\d*|\.\d+)$/;
const PRICE_PATTERN = /^(\d+)(?:\.(\d{1,2}))?$/;

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '');

function parseQuantity(value: unknown, line: number): { quantity?: number; error?: string } {
  const raw = text(value);
  if (!INTEGER_PATTERN.test(raw)) return { error: PURCHASE_ORDER_MESSAGES.quantityInvalid(line) };
  const quantity = Number(raw);
  if (quantity <= 0) return { error: PURCHASE_ORDER_MESSAGES.quantityInvalid(line) };
  if (quantity > PURCHASE_ORDER_MAX_QUANTITY) return { error: PURCHASE_ORDER_MESSAGES.quantityTooLarge(line) };
  return { quantity };
}

function parsePriceCents(value: unknown, line: number): { cents?: bigint; error?: string } {
  const raw = text(value);
  if (!NUMBER_PATTERN.test(raw) || raw.startsWith('-') || Number(raw) <= 0) {
    return { error: PURCHASE_ORDER_MESSAGES.priceInvalid(line) };
  }
  const match = PRICE_PATTERN.exec(raw.replace(/^\+/, ''));
  if (!match) return { error: PURCHASE_ORDER_MESSAGES.priceFormat(line) };
  const cents = BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0'));
  if (cents > MAX_UNIT_PRICE_CENTS) return { error: PURCHASE_ORDER_MESSAGES.priceInvalid(line) };
  return { cents };
}

export function validatePurchaseOrderInput(input: PurchaseOrderInput): PurchaseOrderValidation {
  const errors: string[] = [];
  const supplierId = text(input.supplierId);
  if (!supplierId || !UUID_PATTERN.test(supplierId)) errors.push(PURCHASE_ORDER_MESSAGES.supplierRequired);

  const rawItems = Array.isArray(input.items) ? input.items : [];
  if (rawItems.length === 0) errors.push(PURCHASE_ORDER_MESSAGES.itemsRequired);
  if (rawItems.length > PURCHASE_ORDER_MAX_ITEMS) errors.push(PURCHASE_ORDER_MESSAGES.tooManyItems);

  const items: ValidPurchaseOrderItem[] = [];
  const seen = new Set<string>();
  rawItems.slice(0, PURCHASE_ORDER_MAX_ITEMS).forEach((rawItem: unknown, index) => {
    const line = index + 1;
    const item = (rawItem && typeof rawItem === 'object' ? rawItem : {}) as PurchaseOrderItemInput;
    const productId = text(item.productId);
    let lineValid = true;

    if (!productId || !UUID_PATTERN.test(productId)) {
      errors.push(PURCHASE_ORDER_MESSAGES.productRequired(line));
      lineValid = false;
    } else if (seen.has(productId.toLowerCase())) {
      errors.push(PURCHASE_ORDER_MESSAGES.productDuplicated(line));
      lineValid = false;
    } else {
      seen.add(productId.toLowerCase());
    }

    const { quantity, error: quantityError } = parseQuantity(item.quantity, line);
    if (quantityError) { errors.push(quantityError); lineValid = false; }

    const { cents, error: priceError } = parsePriceCents(item.unitPrice, line);
    if (priceError) { errors.push(priceError); lineValid = false; }

    if (lineValid && quantity !== undefined && cents !== undefined) {
      items.push({ productId, quantity, unitPriceCents: cents, subtotalCents: cents * BigInt(quantity) });
    }
  });

  const totalCents = items.reduce((sum, item) => sum + item.subtotalCents, 0n);
  if (errors.length === 0 && totalCents > MAX_TOTAL_CENTS) errors.push(PURCHASE_ORDER_MESSAGES.totalTooLarge);

  if (errors.length > 0) return { valid: false, value: null, errors };
  return { valid: true, value: { supplierId, items, totalCents }, errors: [] };
}

// Convierte centavos a texto decimal con dos posiciones, apto para Prisma.Decimal.
export function centsToDecimalString(cents: bigint): string {
  const whole = cents / 100n;
  const fraction = (cents % 100n).toString().padStart(2, '0');
  return `${whole}.${fraction}`;
}

// Número visible de la orden, por ejemplo OC-000001.
export function formatPurchaseOrderCode(number: number): string {
  return `OC-${String(number).padStart(6, '0')}`;
}
