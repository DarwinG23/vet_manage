# Design: HU-03 Configurar stock mínimo

## Context

El módulo `inventory` ya expone el catálogo de productos (HU-01) y la entrada de
lotes (HU-02). El modelo `Product` (`vet-manage-api/prisma/schema/inventory.prisma`)
tiene `stock` (existencias actuales) pero no un umbral de stock mínimo. El
diagrama del módulo (`docs/modulo-3-Tienda-productos/diagramas/clases.md`)
define `Producto.stockMinimo` como `Integer`, y la HU-03 pide configurarlo o
actualizarlo con validación de entero positivo.

El actor es Gerente o Bodeguero. Ambos roles ya poseen el permiso
`inventory:manage-products` (`vet-manage-api/src/config/roles.catalog.ts`), por
lo que no se requieren permisos nuevos.

Restricciones del proyecto: NestJS + Prisma 7 sobre PostgreSQL, arquitectura de
monolito modular, TypeScript ESM con imports `.js`, y frontend React/Vite con
Tailwind. La validación de entrada con mensajes exactos por campo ya se resolvió
en HU-02 con un DTO permisivo y un servicio de validación puro
(`batch-entry-input.service.ts`); se reutiliza ese patrón.

## Goals / Non-Goals

**Goals:**

- Persistir un stock mínimo por producto, distinto de las existencias actuales.
- Permitir configurarlo por primera vez y actualizarlo después.
- Aceptar solo enteros positivos y devolver los mensajes exactos de la HU para
  valores vacíos, con letras/símbolos, decimales y negativos.
- Exponer el valor configurado en la interfaz y confirmar el resultado.
- Reutilizar el módulo `inventory`, el permiso `inventory:manage-products`, el
  envelope de respuesta y el toast existentes.

**Non-Goals:**

- Generar, evaluar o enviar alertas de reabastecimiento (otra funcionalidad).
- Modificar existencias, lotes o movimientos de stock.
- Cambiar la creación de productos de HU-01 ni el alcance de HU-02.
- Introducir permisos, roles, módulos, puertos o variables de entorno nuevos.

## Decisions

### 1. Nuevo campo `minimumStock` en `Product`

Se agrega `minimumStock Int? @map("minimum_stock")` a `Product`, con migración
Prisma aditiva sobre `products`. Se elige nullable porque los productos creados
antes de HU-03 no tienen umbral; `null` representa «sin configurar». Se descarta
`Int @default(0)` porque la HU exige un entero positivo y `0` no está confirmado
como valor válido.

- Alternativa considerada: reutilizar `stock`. Se descarta porque `stock` son
  las existencias actuales y el stock mínimo es un umbral independiente.
- Alternativa considerada: `@default(0)`. Se descarta para no asumir que `0` es
  un umbral válido y para distinguir «no configurado» de un valor real.

### 2. Endpoint dedicado para el stock mínimo

Se agrega `PATCH /api/v1/inventory/products/:id/minimum-stock` con cuerpo
`{ minimumStock }`, protegido por `inventory:manage-products` y con el envelope
`{ statusCode, success, message, data }`. Los endpoints de lectura de productos
(`GET /inventory/products`, `GET /inventory/products/:id`) incluyen
`minimumStock`.

- Alternativa considerada: incluirlo en `PATCH /inventory/products/:id`. Se
  descarta porque obligaría a reenviar y revalidar todos los campos del
  producto para cambiar solo el umbral, y mezclaría el alcance de HU-03 con la
  edición de productos.
- El endpoint responde `404` si el producto no existe o está inactivo, `403`
  sin permiso y `401` sin sesión, igual que el resto del módulo.

### 3. Validación con mensajes exactos

El DTO usa `@Allow()` para recibir el valor sin transformarlo y un servicio puro
`validateMinimumStockInput` devuelve el mensaje de la HU. Reglas:

| Entrada | Mensaje |
| --- | --- |
| vacía / ausente / letras / símbolos | `El stock mínimo debe ser un número entero positivo` |
| negativa (p. ej. `-5`) | `El stock mínimo no puede ser negativo` |
| decimal positiva (p. ej. `2.5`) | `El stock mínimo debe ser un número entero positivo` |

Se verifica primero el signo negativo y luego la integralidad, para que un
negativo use el mensaje de la HU (Escenario 4). El límite superior es el de una
columna `INTEGER` de PostgreSQL. Con datos inválidos no se actualiza la fila.

### 4. Interfaz en el módulo de inventario

- En la página de edición de producto se agrega una sección «Stock mínimo» con
  el valor actual y una acción de guardado que llama al endpoint dedicado.
- El detalle del producto muestra el stock mínimo (`Sin configurar` si es
  `null`).
- Se reutiliza el toast global: éxito «Stock mínimo registrado correctamente» o
  «Stock mínimo actualizado correctamente»; los errores muestran el mensaje de
  la API.
- Alternativa considerada: edición inline en la tabla de productos. Se descarta
  para mantener una única superficie de edición por producto.

### 5. Trazabilidad con los escenarios de la HU

| Escenario | Elemento de diseño |
| --- | --- |
| 1. Configurar stock mínimo | `PATCH .../minimum-stock` con entero positivo; mensaje de registro |
| 2. Actualizar stock mínimo | Mismo endpoint; respuesta devuelve el nuevo valor |
| 3. Valor inválido (vacío/letras/símbolos) | `validateMinimumStockInput` → mensaje de entero positivo |
| 4. Valor negativo | `validateMinimumStockInput` → mensaje de negativo |
| 5. Decimal o letras (`2.5`, `abc`) | `validateMinimumStockInput` → mensaje de entero positivo |

## Risks / Trade-offs

- **[`null` vs `0` como «no configurado»]** → Se documenta como pregunta abierta;
  si el negocio acepta `0`, se ajusta la validación y el valor por defecto.
- **[Decimales negativos (`-2.5`) son negativos y no enteros]** → Se prioriza el
  mensaje de negativo; se valida con pruebas para fijar el comportamiento.
- **[El umbral no dispara alertas todavía]** → Fuera de alcance; HU-03 solo deja
  el dato configurado para una funcionalidad posterior.
- **[Permiso amplio]** → `inventory:manage-products` también permite editar el
  producto; coincide con el actor Gerente/Bodeguero. Si se requiere separar,
  sería otro cambio.
- **[Migración aditiva]** → Sin backfill; los productos existentes quedan con
  `minimumStock = null` hasta que se configure.

## Migration Plan

1. Agregar la migración Prisma que crea `products.minimum_stock` (`INTEGER`,
   nullable). No requiere backfill.
2. La API aplica la migración al iniciar (`npx prisma migrate deploy` en el
   comando del servicio `api`).
3. Despliegue con `make up` (o `make up-seed` para datos de prueba). Sin cambios
   de puertos ni variables de entorno: API `3080`, frontend `5174`, PostgreSQL
   `55432` en la red interna.
4. Rollback: revertir el cambio de código y eliminar la columna con una
   migración descendente; al ser aditiva y nullable, no afecta datos existentes.
5. Verificación: `make test`, `make lint` y `make build`.

## Open Questions

- ¿`0` es un stock mínimo válido o debe rechazarse? La HU dice «entero
  positivo» y solo ejemplifica negativos.
- ¿El stock mínimo debe configurarse también durante la creación del producto o
  solo sobre un producto existente? La HU indica seleccionar un producto.
- ¿El stock mínimo debe mostrarse o filtrarse en el listado de productos? No lo
  exige ningún criterio de aceptación.
