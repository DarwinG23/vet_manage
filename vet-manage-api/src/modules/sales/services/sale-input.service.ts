export type SaleLineInput = { productId: string; quantity: number };

export function validateSaleInput(input: unknown): { valid: true; items: SaleLineInput[] } | { valid: false; message: string } {
  if (!input || typeof input !== 'object' || !Array.isArray((input as { items?: unknown }).items) || (input as { items: unknown[] }).items.length === 0) {
    return { valid: false, message: 'Agrega al menos un producto a la venta' };
  }

  const items = (input as { items: unknown[] }).items;
  const seen = new Set<string>();
  const normalized: SaleLineInput[] = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') return { valid: false, message: 'Cada línea de venta no es válida' };
    const productId = (item as { productId?: unknown }).productId;
    const quantity = (item as { quantity?: unknown }).quantity;
    if (typeof productId !== 'string' || productId.trim() === '') return { valid: false, message: 'Selecciona un producto válido' };
    if (seen.has(productId)) return { valid: false, message: 'No repitas productos en la venta' };
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity <= 0) {
      return { valid: false, message: 'La cantidad debe ser un número entero mayor que cero' };
    }
    seen.add(productId);
    normalized.push({ productId, quantity });
  }
  return { valid: true, items: normalized };
}
