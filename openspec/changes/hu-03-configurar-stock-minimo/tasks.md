## 1. Persistencia

- [x] 1.1 Agregar `minimumStock Int? @map("minimum_stock")` al modelo `Product` en `vet-manage-api/prisma/schema/inventory.prisma`.
- [x] 1.2 Generar y versionar la migración Prisma que agrega la columna nullable `minimum_stock` a `products`.

## 2. Backend: validación y endpoint

- [x] 2.1 Crear `dtos/update-minimum-stock.dto.ts` que reciba `minimumStock` mediante `@Allow()`.
- [x] 2.2 Crear `services/minimum-stock-input.service.ts` con `validateMinimumStockInput` y los mensajes exactos de la HU (vacío/letras/símbolos, negativo, decimal).
- [x] 2.3 Agregar `updateProductMinimumStock(id, value)` en `InventoryService`: validar, actualizar solo `minimumStock` y responder `404` si el producto no existe o está inactivo.
- [x] 2.4 Exponer `PATCH /inventory/products/:id/minimum-stock` en `InventoryController` con el permiso `inventory:manage-products` y el mensaje de éxito.
- [x] 2.5 Verificar que `GET /inventory/products` y `GET /inventory/products/:id` devuelven `minimumStock`.

## 3. Backend: pruebas

- [x] 3.1 Pruebas unitarias de `validateMinimumStockInput`: positivo válido, vacío, letras, símbolos, `2.5`, `abc` y negativo, con el mensaje esperado.
- [x] 3.2 Pruebas del servicio/controlador: actualización válida, valor inválido sin persistir y producto inexistente (`404`).
- [x] 3.3 Pruebas e2e del endpoint: `401` sin sesión, `403` sin permiso, configuración/actualización correcta y rechazos con los mensajes de la HU.

## 4. Frontend

- [x] 4.1 Agregar `minimumStock: number | null` al tipo `Product` en `vet-manage-frontend/src/modules/inventory/types.ts`.
- [x] 4.2 Agregar `updateProductMinimumStock(id, value)` a `inventory-api.ts`.
- [x] 4.3 Agregar la sección «Stock mínimo» en `product-form-page.tsx` (solo edición) con validación local, mensajes de la HU, toast y valor actual.
- [x] 4.4 Mostrar el stock mínimo en `product-detail-page.tsx`, con «Sin configurar» cuando sea `null`.
- [x] 4.5 Pruebas de interfaz para configuración válida, actualización y mensajes de error.

## 5. Verificación

- [x] 5.1 Ejecutar `make lint` y corregir hallazgos.
- [ ] 5.2 Ejecutar `cd vet-manage-api && npm test -- --run` y `npm run test:e2e`.
- [x] 5.3 Ejecutar `cd vet-manage-frontend && npm test`.
- [x] 5.4 Ejecutar `make build`.
- [x] 5.5 Ejecutar `openspec validate hu-03-configurar-stock-minimo --strict`.
