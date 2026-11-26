# Diseño técnico de HU-19a

## Organización y persistencia

`InventoryMovementsController` se ubica en la raíz de `modules/inventory`,
como el controlador actual. `InventoryMovementsService` queda en `services/`
para no ampliar el servicio del catálogo con otra responsabilidad.
Los DTOs están en `dtos/` y las pruebas HTTP/SQL en `test/inventory/`.

Tras integrar HU-08 desde `development`, se reutilizan `InventoryMovement` y
`InventoryMovementType`, ya usados por ventas, para representar el movimiento
del diagrama. Se conserva una única tabla `inventory_movements`, con las
columnas `stock_before` y `stock_after` del modelo compartido. Se añade
`observation` para HU-19a y la relación con `User` para la trazabilidad.
La respuesta HTTP mantiene `previousBalance`, `resultingBalance` y los demás
campos de HU-19a, sin obligar a cambiar su interfaz. No hay rutas para editar
o eliminar movimientos.

La operación valida los campos y, en una transacción `ReadCommitted`:

1. Comprueba que exista el lote, su producto esté activo y tenga unidades.
2. Descuenta del lote mediante un UPDATE condicionado por saldo suficiente.
3. Descuenta del producto con la misma condición sobre su stock.
4. Inserta el movimiento `BAJA` con los saldos que devolvió el UPDATE.

Si falla cualquier paso, se revierte toda la transacción. Las condiciones de
los UPDATE protegen también el stock compartido por distintos lotes.
`initialQuantity` no cambia. El usuario se obtiene de la sesión, nunca del
cuerpo enviado por el cliente. La fecha/hora se asigna en la base de datos.

Referencia: [transacciones de Prisma 7](https://www.prisma.io/docs/orm/v7/prisma-client/queries/transactions).

## Contrato HTTP

API local: `http://localhost:3080/api/v1`. Se mantienen las variables de
Docker Compose (`DATABASE_URL`, `JWT_SECRET`, Redis y RabbitMQ). No se agregan
servicios, puertos ni dependencias de paquetes.

### Registrar una baja

`POST /api/v1/inventory/write-offs`, permiso `inventory:register-write-off`.
Se asigna al Bodeguero; el Superadministrador de pruebas ya recibe el catálogo
completo. Los demás roles operativos no registran bajas por defecto. Este
permiso se separó de `inventory:register-exit`, utilizado por el Cajero en
ventas, para conservar la restricción de actor de HU-19a.

```json
{
  "batchId": "123e4567-e89b-42d3-a456-426614174000",
  "quantity": 3,
  "reason": "Daño",
  "observation": "Envase roto"
}
```

`reason` admite `Daño` o `Pérdida`. `quantity` debe ser un entero positivo que
quepa en INTEGER de PostgreSQL; también admite texto compuesto por dígitos.
`observation` es texto opcional y sus espacios exteriores se eliminan.
Campos desconocidos, incluido `userId`, se rechazan mediante la validación
global. No existe un endpoint de borrador o cancelación.

Respuesta `201`: envelope compartido, mensaje `Baja registrada correctamente`
y `data` con `batch`, `product` y `movement`. El movimiento contiene `type`,
`quantity`, `reason`, `observation`, `previousBalance`, `resultingBalance`,
`occurredAt` (ISO), `batch.product` y `user` (id y nombres, sin credenciales).

Errores: `400` campos inválidos, `401` sin sesión, `403` sin permiso, `404`
lote inexistente, `409` sin existencias suficientes o producto inactivo,
`500` fallo de persistencia con `No se pudo registrar la baja`.

### Consultar trazabilidad

`GET /api/v1/inventory/movements?batchId=<uuid>&page=1&pageSize=20`, permiso
existente `inventory:read-reports`, asignado al Gerente. `batchId` es opcional;
`pageSize` está entre 1 y 100. Devuelve `items`, `page`, `pageSize`, `total`,
`totalPages`, del más reciente al más antiguo. No implementa los demás filtros
de HU-05. La consulta vacía informa `No existen movimientos registrados`.

## Ejecución y pruebas

### Organización de la interfaz

Se mantiene React, Vite y el módulo `src/modules/inventory` existente:

- `components/batch-write-off-form.tsx`: selección de producto/lote, detalle,
  validación y confirmación de la baja.
- `schemas/batch-write-off.ts`: reglas del formulario sin llamadas HTTP.
- `pages/batch-write-off-page.tsx`: carga del catálogo y resultado de registro.
- `pages/inventory-movements-page.tsx`: historial paginado con todos los datos
  del escenario 10.
- `services/inventory-api.ts` y `types.ts`: amplían el cliente y los tipos del
  módulo, reutilizando el cliente HTTP y su manejo de sesión.

Las rutas son `/inventory/write-offs/new` y `/inventory/movements`, protegidas
por `inventory:register-write-off` e `inventory:read-reports`. El menú filtra las
entradas con esos mismos permisos. No se agregan bibliotecas ni componentes
globales nuevos: se reutilizan `RequirePermission`, `useToast`, la confirmación
existente, los enlaces y los estilos del módulo.

La selección de otro producto descarta el lote y la cantidad anteriores;
respuestas obsoletas de carga se ignoran. Los fallos de carga permiten
reintentar. Antes de enviar se valida el saldo conocido y se muestra el saldo
previsto; la transacción del servidor sigue siendo la protección definitiva
ante bajas simultáneas. Durante la confirmación y el envío se bloquean nuevos
envíos. Cancelar el formulario descarta el borrador, y rechazar la confirmación
no llama al endpoint. Tras un error se conservan los campos y se actualizan
las existencias desde la API. Tras el éxito se usan los saldos de la respuesta.

### Comandos

Desde la raíz del repositorio, con Docker iniciado:

```powershell
docker compose up -d
docker compose exec -T api npx prisma migrate deploy
docker compose exec -T api npx prisma generate
docker compose exec -T api npm test -- batch-write-off-input inventory-movements.service
docker compose exec -T api npm run test:e2e -- write-offs.e2e-spec.ts
docker compose exec -T api npm run build
docker compose exec -T api npm run lint
docker compose exec -T frontend npm test -- batch-write-off inventory-movements-page inventory-api.test
docker compose exec -T frontend npm test
docker compose exec -T frontend npm run build
docker compose exec -T frontend npm run lint
```

Los primeros tests usan mocks para aislar reglas y permisos. Las pruebas
PostgreSQL requieren una URL explícita `INVENTORY_TEST_DATABASE_URL` de una
base aislada. Sin ella se omiten y nunca usan la base de la aplicación.
En este entorno quedó preparada `vet_manage_hu19a_test`, con el esquema actual:

```powershell
docker compose exec -T -e INVENTORY_TEST_DATABASE_URL=postgresql://vetmanage:vetmanage_dev_password@postgres:55432/vet_manage_hu19a_test?schema=public api npm run test:e2e -- write-offs.postgres
```

Esta base es exclusiva de pruebas; los fixtures se eliminan al terminar.
Los tests verifican descuentos, saldos cero, rechazo de entradas inválidas,
rollback por error de FK, concurrencia del mismo lote y de distintos lotes,
la consulta HU-20 y la trazabilidad paginada.

Verificación del 26/11/2026: 49 pruebas unitarias de HU-19a, 22 pruebas HTTP
y 13 pruebas PostgreSQL aprobadas. La regresión HTTP/SQL de inventario aprobó
76 pruebas. La compilación terminó correctamente; el lint de los archivos
nuevos no presentó errores ni advertencias. El lint general tiene una
advertencia previa por `ownerId` sin uso en pruebas de citas. La API real
rechazó una cantidad cero con el mensaje esperado y permitió al Gerente
consultar el historial.

La segunda etapa añadió 49 pruebas del frontend: 19 de validación, 21 del flujo
de baja, 7 del historial y 2 del contrato HTTP. La ejecución focalizada incluye
7 pruebas previas del cliente de inventario y aprobó 56 en total. La regresión
completa del frontend aprobó 392 pruebas en 45 archivos. Compilación correcta;
lint sin errores ni advertencias en los archivos nuevos. El lint general
mantiene dos advertencias previas en páginas de agenda; Vite advierte sobre
el tamaño del bundle principal (>500 kB), sin impedir la compilación.

Comprobación de desarrollo en el navegador con API y PostgreSQL reales:
cantidad cero rechazada, confirmación cancelada sin registrar, daño de 20 a 17,
pérdida de 8 a 6 sin observación, total del producto de 28 a 23 e historial
accesible al Gerente con ambos movimientos y su responsable. El acceso del
Gerente al formulario de bajas se rechazó por falta de permiso. Se usó un
producto temporal y sus dos lotes; se verificaron los dos movimientos y se
eliminaron únicamente esos fixtures al terminar. La evaluación manual y sus
evidencias por Esteban siguen pendientes.

### Limitación previa de instalación desde cero

La migración existente `20261119222634_agendamiento_citas` referencia
`patients` antes de su migración de renombre, por lo que `migrate deploy`
falla en una base completamente vacía. La base local de la aplicación ya
tenía `patients`, y las migraciones pendientes, incluida HU-19a, se aplicaron.
La base aislada se preparó con el esquema actual de Prisma y la secuencia
`patient_code_seq` que usa el módulo de pacientes. No se corrigieron archivos
de otros módulos ni se usó `db push` sobre la base de trabajo.

### Integración con development del 26/11/2026

Se integró `fabf2bc` conservando las rutas, servicios y tipos de ventas y
órdenes de compra. Las dos historias creaban `inventory_movements`; se adaptó
HU-19a al modelo compartido de HU-08. La migración de HU-19a omite la creación
si ventas ya creó la tabla; la nueva migración `reconcile_inventory_movements`
renombra las columnas legadas, convierte el enum y conserva los registros.
Las restricciones de saldo de HU-19a se aplican únicamente a `BAJA`.

La migración de ventas permite encontrar la tabla e índices ya creados por
HU-19a, y las dos migraciones que añaden `minimum_stock` evitan duplicar esa
columna. Son ajustes de compatibilidad de la unión; no cambian la lógica de
ventas. Se verificaron ambos recorridos en bases aisladas: HU-19a aplicada
antes de traer ventas y ventas aplicada antes de HU-19a. Ambos completaron
las migraciones y las 14 pruebas PostgreSQL, incluida una venta de 2 unidades
seguida de una baja de 3 sobre el mismo lote (20 → 18 → 15).

Antes de actualizar la base local se guardó un respaldo. Después se comprobó
que su baja de 50 unidades mantiene el identificador, motivo, observación y
saldos 60 → 10. La regresión completa aprobó 916 pruebas del backend y 541 del
frontend; las pruebas HTTP focalizadas aprobaron 50. Las compilaciones de
ambos proyectos terminaron correctamente.
La API real confirmó el acceso del Gerente al historial, una validación 400
para cantidad cero del Bodeguero y un rechazo 403 al Cajero al intentar una
baja. La base vacía `vet_manage_hu19a_test` quedó sincronizada con el esquema
compartido y sus restricciones de baja; aprobó las 14 pruebas PostgreSQL.
