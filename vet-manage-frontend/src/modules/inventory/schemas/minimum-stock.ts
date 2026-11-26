// Reglas de validación del stock mínimo en la interfaz (HU-03). Los mensajes
// coinciden con los de la historia y con los del backend.
export const MINIMUM_STOCK_MESSAGES = {
  notPositiveInteger: 'El stock mínimo debe ser un número entero positivo',
  negative: 'El stock mínimo no puede ser negativo',
} as const;

// Límite de una columna INTEGER de PostgreSQL.
const MAX_STOCK = 2_147_483_647;
// Mismo patrón que el backend, para que los mensajes coincidan con la API.
const NUMBER_PATTERN = /^[-+]?(\d+\.?\d*|\.\d+)$/;

export type MinimumStockValidation =
  | { valid: true; value: number; error: null }
  | { valid: false; value: null; error: string };

export function validateMinimumStockInput(input: string): MinimumStockValidation {
  const raw = input.trim();
  if (raw === '' || !NUMBER_PATTERN.test(raw)) {
    return { valid: false, value: null, error: MINIMUM_STOCK_MESSAGES.notPositiveInteger };
  }

  const value = Number(raw);
  // Se prioriza el mensaje de negativo (Escenario 4) antes de la integralidad.
  if (value < 0) {
    return { valid: false, value: null, error: MINIMUM_STOCK_MESSAGES.negative };
  }
  // Se acepta 0 como umbral válido; solo se rechazan negativos y fuera de rango.
  if (!Number.isInteger(value) || value > MAX_STOCK) {
    return { valid: false, value: null, error: MINIMUM_STOCK_MESSAGES.notPositiveInteger };
  }

  return { valid: true, value, error: null };
}

export function formatMinimumStock(value: number | null | undefined): string {
  return value === null || value === undefined ? 'Sin configurar' : String(value);
}
