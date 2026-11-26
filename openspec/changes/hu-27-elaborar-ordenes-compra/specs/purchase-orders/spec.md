## Purpose

Órdenes de compra del Módulo 3 (Tienda): el Gerente registra el abastecimiento solicitado a un proveedor activo y lo consulta, sin modificar existencias antes de la recepción.

## ADDED Requirements

### Requirement: Crear una orden de compra
El sistema SHALL permitir a un usuario con `purchase-orders:create` crear una orden con un proveedor activo y al menos un producto con cantidad y precio unitario mayores que cero, y SHALL generar un número único, registrar la fecha, calcular el total y asignar el estado «Pendiente».

#### Scenario: Crear una orden
- **WHEN** el Gerente envía `POST /api/v1/purchase-orders` con un proveedor activo y productos con cantidades y precios válidos
- **THEN** el sistema responde 201 «Orden de compra registrada correctamente» con número `OC-NNNNNN`, fecha, proveedor, productos, cantidades, precios, subtotales, total y estado `PENDING`

#### Scenario: Usuario sin permiso
- **WHEN** un usuario sin `purchase-orders:create` intenta crear una orden
- **THEN** el sistema responde 403 y no crea la orden

### Requirement: Rechazar una orden incompleta
El sistema SHALL rechazar la orden, sin crearla, cuando falte un proveedor activo, un producto, una cantidad o un precio válido, e indicar qué dato debe corregirse.

#### Scenario: Falta el proveedor o no está activo
- **WHEN** no se envía proveedor, no existe o está inactivo
- **THEN** el sistema responde 400 «Debe seleccionar un proveedor», 404 «El proveedor seleccionado no existe» o 409 «El proveedor seleccionado está inactivo»

#### Scenario: Faltan productos
- **WHEN** la orden no tiene productos
- **THEN** el sistema responde 400 «Debe agregar al menos un producto»

#### Scenario: Cantidad o precio inválidos
- **WHEN** una línea tiene cantidad vacía, cero, negativa, decimal o con letras, o precio vacío, cero o negativo
- **THEN** el sistema responde 400 indicando la línea y el dato, por ejemplo «Producto 1: la cantidad debe ser un número entero mayor que cero»

### Requirement: Consultar una orden de compra
El sistema SHALL permitir a un usuario con `purchase-orders:read` consultar una orden y el listado de órdenes.

#### Scenario: Consultar una orden
- **WHEN** el Gerente solicita `GET /api/v1/purchase-orders/:id` de una orden existente
- **THEN** el sistema responde 200 con número, fecha, proveedor, productos, cantidades, precios, total y estado

#### Scenario: Orden inexistente
- **WHEN** la orden no existe
- **THEN** el sistema responde 404 «Orden de compra no encontrada»

### Requirement: Conservar las existencias al crear la orden
El sistema SHALL NOT modificar el stock de los productos al crear una orden de compra pendiente.

#### Scenario: No actualizar existencias al crear la orden
- **WHEN** se guarda una orden de compra pendiente
- **THEN** el stock de sus productos permanece igual hasta que se registre la recepción
