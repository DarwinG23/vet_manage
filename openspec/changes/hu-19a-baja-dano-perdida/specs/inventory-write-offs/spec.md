## ADDED Requirements

### Requirement: Registrar bajas de forma transaccional

El Bodeguero autorizado MUST registrar bajas por `Daño` o `Pérdida` sobre un
lote existente. MUST descontar la misma cantidad del lote y del producto y
guardar el movimiento en una sola transacción. MUST conservar la cantidad
inicial del lote y no permitir saldos negativos.

#### Scenario: Daño

- GIVEN un lote con 20 unidades y un Bodeguero autorizado.
- WHEN confirma 3 unidades por Daño con observación.
- THEN quedan 17 unidades y se guarda la trazabilidad con mensaje de éxito.

#### Scenario: Pérdida

- GIVEN un lote con 8 unidades.
- WHEN confirma 2 unidades por Pérdida sin observación.
- THEN quedan 6 unidades y la observación se conserva como nula.

### Requirement: Validar campos y conservar existencias ante errores

El sistema MUST rechazar cantidades cero, negativas, decimales, letras,
exceso de existencias, lote vacío y campos obligatorios incompletos sin
guardar cambios parciales. `Vencimiento` no está habilitado en HU-19a.

#### Scenario: Fallo al insertar el movimiento

- GIVEN una baja válida que alcanza a descontar lote y producto.
- WHEN falla la inserción del movimiento.
- THEN la transacción revierte ambos descuentos y responde que no pudo registrar la baja.

#### Scenario: Concurrencia

- GIVEN un lote con 20 unidades y dos solicitudes simultáneas de 15 unidades.
- WHEN se procesan ambas solicitudes.
- THEN solo una se confirma, quedan 5 unidades y existe un único movimiento.

### Requirement: Consultar trazabilidad con los permisos del usuario

El Gerente con permiso de reportes MUST consultar los movimientos con
producto, lote, tipo, cantidad, motivo, observación, saldos, fecha/hora y
usuario responsable. El cliente MUST NOT elegir el usuario del movimiento.
Las consultas MUST NOT descontar existencias ni registrar borradores.

#### Scenario: Consulta del Gerente

- GIVEN una baja confirmada por el Bodeguero.
- WHEN el Gerente autorizado consulta los movimientos del lote.
- THEN visualiza el producto, lote, motivo, cantidad, observación, saldos, fecha/hora y usuario responsable.

#### Scenario: No confirmar una baja

- GIVEN que todavía no se envió el POST de registro.
- WHEN se consulta el lote o su historial.
- THEN no se descuentan existencias ni se guarda un movimiento.

### Requirement: Confirmar y cancelar desde la interfaz

El formulario MUST permitir seleccionar producto y lote, ingresar cantidad,
motivo y observación opcional. MUST validar los campos antes de confirmar,
mostrar el saldo previsto y esperar una confirmación explícita antes del POST.
MUST impedir envíos duplicados durante el registro y permitir reintentar
errores de carga. MUST mostrar los saldos reales devueltos por el servidor.

#### Scenario: Cancelar el formulario

- GIVEN un borrador de baja todavía no confirmado.
- WHEN el Bodeguero pulsa Cancelar y vuelve a abrir el registro.
- THEN el formulario está vacío y no se envió la baja.

#### Scenario: Saldo cambiado en otra operación

- GIVEN una cantidad que era válida cuando se cargó el lote.
- WHEN el servidor rechaza la baja por insuficiencia del saldo actual.
- THEN se informa el error, se conservan los datos y se vuelven a cargar las existencias del producto.
