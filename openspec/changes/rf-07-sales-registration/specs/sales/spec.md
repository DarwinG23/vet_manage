# Especificación: registro de ventas

## ADDED Requirements

### Requirement: Confirmar ventas con trazabilidad

El sistema MUST confirmar una venta completa en una transacción y conservar el
precio, lote y movimiento de existencias de cada detalle.

#### Scenario: Venta válida

**Dado** un producto con precio 10 y 20 unidades disponibles
**Cuando** el cajero agrega 3 unidades y confirma
**Entonces** se guarda una venta por 30, el stock queda en 17 y el detalle
conserva lote, precio, hora, cajero y existencias antes/después.

#### Scenario: Venta de varios productos

**Dado** productos de precio 10 y 8
**Cuando** el cajero agrega 2 y 1 unidades
**Entonces** se muestran subtotales 20 y 8 y total 28.

### Requirement: Validar cantidades y existencias

El sistema MUST rechazar cantidades inválidas y evitar cualquier modificación
cuando no exista stock suficiente.

#### Scenario: Stock insuficiente

**Cuando** se intenta vender más unidades que las disponibles
**Entonces** la API rechaza con un mensaje de stock insuficiente y no modifica
existencias ni crea la venta.

#### Scenario: Cantidad inválida

**Dado** que el cajero prepara una venta

**Cuando** la cantidad es cero, negativa, decimal o no numérica
**Entonces** no se puede confirmar y se informa que debe ser un entero mayor
que cero.

### Requirement: Conservar el precio histórico

El sistema MUST conservar el precio cobrado en cada venta aunque el precio del
catálogo cambie posteriormente.

#### Scenario: Precio histórico

**Dado** que ya se confirmó una venta a precio 10
**Cuando** cambia el precio del catálogo después de esa venta

**Entonces** el historial conserva el precio cobrado originalmente.
