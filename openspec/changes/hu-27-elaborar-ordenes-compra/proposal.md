## Why

HU-26 dejó registrados los proveedores, pero no hay forma de solicitarles productos. Este cambio implementa la HU-27 · Elaborar órdenes de compra (Módulo 3 – Tienda, Sprint 2): el Gerente crea órdenes con un proveedor activo, productos, cantidades y precios unitarios, y las consulta, sin modificar existencias hasta la recepción.

## What Changes

- **Base de datos**: enum `PurchaseOrderStatus` (`PENDING`), tablas `purchase_orders` y `purchase_order_items` en `prisma/schema/suppliers.prisma`; migración `20261126160000_add_purchase_orders`.
- **Backend (`vet-manage-api/`, nuevo módulo `purchase-orders`)**: `POST /api/v1/purchase-orders`, `GET /api/v1/purchase-orders` y `GET /api/v1/purchase-orders/:id`, con validación por línea, número secuencial único, total calculado en el servidor y estado «Pendiente».
- **RBAC**: catálogo `purchase-orders.permissions.ts` con `purchase-orders:create` y `purchase-orders:read`, asignados al Gerente.
- **Frontend (`vet-manage-frontend/`, nuevo módulo `purchase-orders`)**: `Inventario › Órdenes de compra` con listado, formulario y consulta.
- **Integración HU-26**: `PurchaseOrdersService.hasPendingOrders(supplierId)` exportado.

## Capabilities

### New Capabilities
- `purchase-orders`: elaboración y consulta de órdenes de compra a proveedores.

## Impact

- **APIs**: tres endpoints nuevos bajo `/api/v1/purchase-orders`.
- **Dependencias**: HU-26 (modelo `Supplier`) y HU-01 (modelo `Product`).
- **Fuera de alcance**: recepción de órdenes y actualización de existencias, edición o anulación de órdenes, y la desactivación de proveedores con órdenes pendientes (HU-26).
