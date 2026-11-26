## 1. Modelo de datos

- [x] 1.1 Agregar `PurchaseOrderStatus`, `PurchaseOrder` y `PurchaseOrderItem` en `prisma/schema/suppliers.prisma` y las relaciones inversas en `Supplier` y `Product`.
- [x] 1.2 Generar `20261126160000_add_purchase_orders` y verificar que solo crea el enum, las dos tablas y sus FK.

## 2. Backend

- [x] 2.1 `config/permissions/purchase-orders.permissions.ts`, agregado al catálogo y asignado al Gerente; specs de RBAC actualizadas.
- [x] 2.2 `services/purchase-order-input.ts` + spec (validación por línea, total en centavos, formato `OC-000001`).
- [x] 2.3 `repositories/purchase-orders.repository.ts` (crear, consultar, listar, `hasPendingOrders`).
- [x] 2.4 `services/purchase-orders.service.ts` + spec (proveedor 404/409, productos no disponibles, consulta 404, listado).
- [x] 2.5 `routes/purchase-orders.controller.ts` y `purchase-orders.module.ts`, registrado en `AppModule`.
- [x] 2.6 `test/purchase-orders/purchase-orders.e2e-spec.ts`: los 4 escenarios, 401 y 403.

## 3. Frontend

- [x] 3.1 `types.ts`, `services/purchase-orders-api.ts` y `schemas/purchase-order.ts` + test.
- [x] 3.2 Páginas de listado, formulario y consulta, con tests del formulario y la consulta.
- [x] 3.3 Rutas protegidas y enlace «Órdenes de compra» en el menú Inventario.

## 4. Documentación y verificación

- [x] 4.1 `docs/modulo-3-Tienda-productos/historias-usuario/27-elaborar-ordenes-de-compra.md` y diagrama de clases.
- [x] 4.2 API: build, 860 tests unitarios y e2e de HU-27 en verde; frontend: `tsc -b`, lint y 492 tests en verde.
- [x] 4.3 Ejecutar los 4 escenarios contra Docker Compose con el Gerente y registrar resultados.
