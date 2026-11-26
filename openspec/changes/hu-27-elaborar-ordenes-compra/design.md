## Modelo

- `PurchaseOrder`: `number Int @unique @default(autoincrement())` (visible como `OC-000001`), `orderDate` (default `now()`), `supplierId` (FK `Restrict`), `status PurchaseOrderStatus @default(PENDING)`, `total Decimal(14,2)`.
- `PurchaseOrderItem`: `purchaseOrderId` (FK `Cascade`), `productId` (FK `Restrict`), `quantity Int`, `unitPrice Decimal(12,2)`, `subtotal Decimal(14,2)`, `@@unique([purchaseOrderId, productId])`.
- La secuencia de PostgreSQL garantiza el número único aun con creaciones simultáneas.

## Flujo de creación

1. `CreatePurchaseOrderDto` acepta `supplierId` e `items` con `@Allow()`, como `RegisterBatchEntryDto` (HU-02), para que `validatePurchaseOrderInput` indique qué dato de qué línea corregir.
2. Datos inválidos → `400` (`message` = único error o «Revisa los datos de la orden de compra», `errors` = lista) sin consultar la base.
3. Proveedor inexistente → `404`; inactivo → `409`. Productos inexistentes o inactivos → `400` con la línea.
4. Subtotales y total se calculan en centavos (`bigint`) y se guardan como `Decimal`.
5. La orden y sus productos se crean con un único `create` anidado. No se escribe en `products` ni en `batches` (escenario 4).

## Validación por línea

| Dato | Regla | Mensaje |
|---|---|---|
| Proveedor | UUID presente | Debe seleccionar un proveedor |
| Productos | al menos 1, máximo 100 | Debe agregar al menos un producto |
| Producto | UUID presente y no repetido | Producto N: debe seleccionar un producto / el producto ya fue agregado a la orden |
| Cantidad | entero 1–1 000 000 | Producto N: la cantidad debe ser un número entero mayor que cero |
| Precio | > 0, hasta 2 decimales | Producto N: el precio unitario debe ser mayor que cero / admite como máximo dos decimales |

## Frontend

- Formulario con proveedores activos (`GET /suppliers?status=ACTIVE`) y productos activos (`GET /inventory/products`); al elegir un producto sugiere su precio de catálogo.
- La misma validación se repite en el cliente; los errores de la API «Producto N: …» se ubican en la fila N.
- Cantidad y precio usan inputs de texto para poder avisar cuando se escriben decimales o letras.

## Migración

`prisma migrate dev` falla en la base temporal (shadow) por un problema previo del repositorio: `20261119222634_agendamiento_citas` referencia `patients` antes de `20261119230000_rename_pets_to_patients`. La migración se generó con `prisma migrate diff --from-config-datasource --to-schema prisma/schema --script` y se aplicó con `migrate deploy`; el diff posterior quedó vacío.
