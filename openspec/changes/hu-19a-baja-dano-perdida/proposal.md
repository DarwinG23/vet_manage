# HU-19a · Baja por daño o pérdida

## Motivo

El inventario permite ingresar lotes y consultar sus existencias, pero no
retirar unidades dañadas o perdidas conservando el movimiento. HU-19a es la
parte asignada a Elias en Sprint 2 (5 puntos, revisión de Esteban).

## Alcance

- Actor: Bodeguero; consulta de trazabilidad por Gerente.
- Requisitos: RF-11 y RF-16. Dependencia: HU-02, ya integrada.
- Descontar la cantidad del lote y del total del producto en una transacción.
- Guardar motivo, observación, saldos, fecha/hora, lote y usuario autenticado.
- Rechazar cantidades inválidas, exceso de existencias, lote vacío y datos
  obligatorios incompletos sin guardar cambios parciales.
- Permitir al Gerente consultar los movimientos guardados por lote.
- Implementar primero backend y pruebas, según la solicitud de Elias.
- Conectar después el formulario React con confirmación, cancelación y saldos
  actualizados, más la consulta de trazabilidad para el Gerente.

## Organización

Se conserva la organización real de `inventory`: controladores y módulo en
su raíz, DTOs en `dtos/`, servicios y sus pruebas en `services/`. Los servicios
usan Prisma como los flujos existentes del equipo. No se reorganizan otras HU.
El movimiento del diagrama se representa con el modelo compartido
`InventoryMovement` y su enum `InventoryMovementType`, incorporados por HU-08
en `development`. Se agrega `observation`, exigida por HU-19, sin duplicar la
tabla de movimientos. El permiso propio de bajas conserva el acceso del
Bodeguero sin ampliar el permiso de ventas del Cajero.

## Límites

Vencimiento corresponde a HU-19b, Sprint 3, responsable Walter.
No se agregan filtros del historial general
HU-05, nuevos movimientos para entradas anteriores ni cambios en ventas,
ajustes o funcionalidades de otros integrantes.

## Capabilities

### New Capabilities

- `inventory-write-offs`: bajas por daño o pérdida con persistencia atómica y trazabilidad.

### Modified Capabilities

Ninguna.
