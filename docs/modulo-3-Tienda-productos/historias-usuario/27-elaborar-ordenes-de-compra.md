# HU-27 – Elaborar órdenes de compra

## Información general

| Campo | Información |
|---|---|
| Nombre | Elaborar órdenes de compra |
| Número | HU-27 |
| Actor | Gerente |
| Requerimientos vinculados | Gestión de órdenes de compra |
| Módulo responsable | Tienda / Inventario |
| Dependencias | HU-26 |
| Estimación | 8 puntos |
| Sprint | Sprint 2 |
| Responsable | Santiago |

## Descripción

Como gerente, quiero crear órdenes de compra con un proveedor activo, productos, cantidades y precios unitarios para registrar el abastecimiento solicitado antes de recibir los productos.

## Criterios de aceptación (Gherkin)

**Escenario: Crear una orden**

- Dado que el gerente seleccionó un proveedor activo y agregó al menos un producto con cantidad y precio unitario mayores que cero
- Cuando guarda la orden
- Entonces el sistema genera un número único, registra la fecha, el proveedor, los productos, las cantidades y los precios, calcula el total y asigna el estado “Pendiente”.

**Escenario: Rechazar una orden incompleta**

- Dado que falta un proveedor activo, un producto, una cantidad o un precio válido
- Cuando el gerente intenta guardar la orden
- Entonces el sistema no la crea e indica qué dato debe corregirse.

**Escenario: Consultar una orden**

- Dado que existe una orden de compra
- Cuando el gerente la consulta
- Entonces el sistema muestra su número, fecha, proveedor, productos, cantidades, precios, total y estado.

**Escenario: No actualizar existencias al crear la orden**

- Dado que se creó una orden de compra pendiente
- Cuando el sistema la guarda
- Entonces las existencias de los productos no cambian hasta que se registre la recepción.

## Tareas de desarrollo

**Diseño**

- Diseñar el formulario de orden de compra con proveedor, productos, cantidades y precios.
- Definir número único, fecha, total y estado «Pendiente».
- Contemplar la selección de un proveedor activo y al menos un producto.
- Definir validaciones de cantidades y precios mayores que cero.
- Considerar la consulta de órdenes y la conservación del stock al crearlas.

**Implementación y pruebas**

- Implementar la creación de órdenes con proveedor activo y productos.
- Calcular el total y registrar número único, fecha y estado «Pendiente».
- Rechazar órdenes incompletas y cantidades o precios inválidos.
- Permitir consultar una orden registrada.
- Comprobar que una orden pendiente no modifica el inventario.
- Ejecutar los cuatro escenarios y registrar resultados.

## Resultado esperado

El gerente registra y consulta órdenes de compra con proveedor activo, productos y totales válidos, sin modificar existencias antes de recibir la orden.

## Implementación

**Modelo de datos** (`prisma/schema/suppliers.prisma`, migración `20261126160000_add_purchase_orders`)

| Entidad | Campos principales |
|---|---|
| `PurchaseOrder` (`purchase_orders`) | `number` (secuencial y único, se muestra como `OC-000001`), `orderDate`, `supplierId`, `status` (`PENDING` = «Pendiente»), `total` |
| `PurchaseOrderItem` (`purchase_order_items`) | `purchaseOrderId`, `productId`, `quantity`, `unitPrice`, `subtotal`; un producto no se repite en la misma orden |

**API** (módulo `purchase-orders`)

| Método y ruta | Permiso | Descripción |
|---|---|---|
| `POST /api/v1/purchase-orders` | `purchase-orders:create` | Crea la orden en estado «Pendiente» |
| `GET /api/v1/purchase-orders` | `purchase-orders:read` | Lista las órdenes paginadas (`page`, `pageSize`, `supplierId`, `status`) |
| `GET /api/v1/purchase-orders/:id` | `purchase-orders:read` | Consulta una orden con sus productos |

Ambos permisos se asignan al Gerente; el Superadministrador de pruebas los recibe automáticamente.

**Reglas**

- El proveedor debe existir (`404`) y estar activo (`409`).
- Debe haber al menos un producto; cada producto debe existir, estar activo y no repetirse.
- La cantidad es un entero entre 1 y 1 000 000; el precio unitario es mayor que cero con hasta dos decimales.
- Los errores indican la línea afectada, por ejemplo «Producto 2: la cantidad debe ser un número entero mayor que cero».
- El servidor calcula subtotales y total en centavos; el total enviado por el cliente no se usa.
- Crear la orden solo escribe en las tablas de órdenes: `products.stock` y los lotes no cambian.
- `PurchaseOrdersService.hasPendingOrders(supplierId)` queda disponible para la desactivación de proveedores de HU-26.

**Frontend** (`Inventario › Órdenes de compra`)

- `/inventory/purchase-orders`: listado con número, fecha, proveedor, cantidad de productos, total y estado.
- `/inventory/purchase-orders/new`: formulario con proveedor activo y filas de producto, cantidad y precio (sugiere el precio de catálogo); muestra subtotales y total en vivo.
- `/inventory/purchase-orders/:id`: consulta de la orden.

## Resultados de los escenarios de aceptación

Ejecutados el 2026-11-26 contra Docker Compose con el usuario `gerente@vetmanage.local`.

| Escenario | Resultado |
|---|---|
| Crear una orden | ✅ `201` «Orden de compra registrada correctamente»: `OC-000001`, fecha registrada, estado `PENDING`, 10 × 12.50 + 3 × 4.10 = total `137.30`. La segunda orden recibió `OC-000002`. |
| Rechazar una orden incompleta | ✅ Sin proveedor `400` «Debe seleccionar un proveedor»; proveedor inactivo `409`; sin productos `400` «Debe agregar al menos un producto»; línea sin producto, cantidad `0` o `2.5`, precio `0` o `-3` → `400` con la línea y el dato a corregir. No se creó ninguna orden. |
| Consultar una orden | ✅ `GET /purchase-orders/:id` devolvió número, fecha, proveedor y RUC, productos, cantidades, precios, total y estado. |
| No actualizar existencias | ✅ «Alimento para perro» mantuvo 55 unidades y «Suplemento» 0 después de crear dos órdenes. |

Control de acceso: Bodeguero `403`, sin sesión `401`.
