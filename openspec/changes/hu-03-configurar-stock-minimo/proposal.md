# Proposal: HU-03 Configurar stock mínimo

## Contexto de la HU

| Campo | Valor |
| --- | --- |
| **Historia** | HU-03 · Configurar stock mínimo |
| **Actor** | Gerente o bodeguero |
| **Requerimiento vinculado** | RF-08 |
| **Módulo** | Tienda de Productos |
| **Dependencia** | HU-01 (catálogo de productos) |
| **Sprint** | Sprint 1 |

## Why

El catálogo de inventario ya registra productos y sus existencias, pero no
permite definir el umbral por debajo del cual un producto se considera con
inventario bajo. Sin ese umbral el sistema no puede determinar cuándo
corresponde una alerta de reabastecimiento. HU-03 permite al Gerente o
Bodeguero configurar y actualizar el stock mínimo de cada producto, dejando
preparado el dato que consumirán las alertas de inventario.

## What Changes

- Incorporar el stock mínimo como atributo configurable del producto,
  expresado como un número entero positivo.
- Permitir configurar el stock mínimo de un producto del inventario y
  actualizarlo cuando ya tiene un valor definido.
- Rechazar los valores inválidos conservando los criterios de aceptación de la
  HU: campo vacío, letras o símbolos, valores decimales y valores negativos.
- Confirmar que el stock mínimo quedó registrado correctamente y mostrar el
  nuevo valor configurado tras una actualización.
- Cubrir la configuración y actualización con pruebas, siguiendo los patrones
  existentes del módulo de inventario.

## Resultados esperados

- Un usuario autorizado configura el stock mínimo de un producto con un entero
  positivo y el valor queda registrado.
- Una actualización con un valor válido reemplaza el stock mínimo anterior y
  muestra el nuevo valor.
- Los valores vacíos, con letras o símbolos, decimales o negativos se rechazan
  con los mensajes definidos en la HU, sin modificar el producto.

## Capabilities

### New Capabilities

- `inventory-stock-minimum`: configuración y actualización del stock mínimo por
  producto como umbral de inventario bajo, con validación de enteros positivos.

### Modified Capabilities

Ninguna.

## Impact

- **Backend (`vet-manage-api/`, módulo `inventory`)**: extiende la gestión de
  productos del inventario para aceptar, validar y devolver el stock mínimo.
  Reutiliza el permiso existente `inventory:manage-products`, que ya poseen
  Gerente y Bodeguero; no se requieren permisos nuevos.
- **Persistencia**: nuevo atributo de stock mínimo en el modelo `Product` y su
  migración Prisma. Las existencias actuales (`Product.stock`) se mantienen sin
  cambios.
- **Frontend (`vet-manage-frontend/`, módulo `inventory`)**: control para
  configurar y actualizar el stock mínimo desde la gestión del producto, junto
  con la visualización del valor configurado y la confirmación de éxito.
- **APIs**: se amplía el contrato de productos del inventario para incluir el
  stock mínimo.
- **Dependencias**: HU-01 (modelo `Product` y catálogo) ya integrado.
- **Fuera de alcance**: generación o envío de alertas de reabastecimiento,
  notificaciones, movimientos de stock y funcionalidades de otras HU.
