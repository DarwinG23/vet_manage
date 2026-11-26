// Reglas de validación del stock mínimo (HU-03). Se valida aquí, y no con
// decoradores del DTO, para devolver el mensaje exacto de cada escenario.

export const MINIMUM_STOCK_MESSAGES = {
  notPositiveInteger: 'El stock mínimo debe ser un número entero positivo',
  negative: 'El stock mínimo no puede ser negativo',
} as const;

// Límite de una columna INTEGER de PostgreSQL.
const MAX_STOCK = 2_147_483_647;
const NUMBER_PATTERN = /^[-+]?(\d+\.?\d*|\.\d+)$/;

export type MinimumStockValidation =
  | { valid: true; value: number; error: null }
  | { valid: false; value: null; error: string };

export function validateMinimumStockInput(input: unknown): MinimumStockValidation {
  if (input === undefined || input === null || (typeof input === 'string' && input.trim() === '')) {
    return { valid: false, value: null, error: MINIMUM_STOCK_MESSAGES.notPositiveInteger };
  }

  const raw = typeof input === 'number' ? String(input) : typeof input === 'string' ? input.trim() : '';
  if (!NUMBER_PATTERN.test(raw)) {
    return { valid: false, value: null, error: MINIMUM_STOCK_MESSAGES.notPositiveInteger };
  }

  const value = Number(raw);
  // Se prioriza el mensaje de negativo (Escenario 4) antes de la integralidad.
  if (value < 0) {
    return { valid: false, value: null, error: MINIMUM_STOCK_MESSAGES.negative };
  }
  // Se acepta 0 como umbral válido; solo se rechazan negativos, decimales y valores
  // fuera del rango de la columna.
  if (!Number.isInteger(value) || value > MAX_STOCK) {
    return { valid: false, value: null, error: MINIMUM_STOCK_MESSAGES.notPositiveInteger };
  }

  return { valid: true, value, error: null };
}
