# RF-07 Registro de ventas

Implementar el flujo inicial de ventas para el rol Cajero: seleccionar uno o
varios productos, indicar cantidades enteras positivas, validar existencias,
calcular subtotales y total, confirmar la operación de forma atómica y
conservar el precio cobrado y el movimiento de inventario.

El alcance no define aún la priorización avanzada de lotes ni la exclusión
completa de lotes caducados; esa regla queda para HU-08b. La implementación
elige un lote disponible para dejar trazabilidad desde la primera venta.
