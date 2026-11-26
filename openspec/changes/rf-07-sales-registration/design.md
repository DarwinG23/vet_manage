# Diseño

## API y persistencia

- `POST /inventory/sales` recibe `{ items: [{ productId, quantity }] }`.
- `GET /inventory/sales` devuelve el historial más reciente con total y detalles.
- `Sale`, `SaleDetail` e `InventoryMovement` viven en el esquema de Inventory,
  siguiendo el UML de la tienda.
- `SaleDetail` conserva producto, lote, cantidad, precio aplicado y subtotal.
- `InventoryMovement` conserva lote, tipo, cantidad, saldos anterior/posterior,
  motivo, fecha y `userId` externo.
- La confirmación usa una transacción: valida todos los productos, selecciona
  un lote con saldo, crea venta y detalles y actualiza lote/producto. Si una
  línea falla, no se persiste ningún cambio.

## Permisos

- `inventory:register-exit`: confirmar ventas.
- `inventory:read`: consultar historial.
- El rol `cashier` recibe ambos permisos; `superadmin` los hereda del catálogo.
- La interfaz oculta navegación y acciones sin permiso y conserva la defensa
  en API con guards.

## Interfaz

La ruta `/inventory/sales/new` muestra una búsqueda de catálogo, tarjetas de productos
con precio y existencias, carrito editable, mensajes junto al campo inválido,
resumen de subtotales/total y confirmación clara. La ruta `/inventory/sales` muestra el
historial. El estado vacío, carga, error, éxito y falta de permisos son
explícitos para el cajero.
