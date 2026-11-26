# HU-19a · Baja por daño o pérdida

| Campo | Descripción |
| --- | --- |
| Historia de origen | HU-19 · Baja de productos por daño, pérdida o vencimiento |
| Actor | Bodeguero |
| Requerimientos vinculados | RF-11, RF-16 |
| Módulo responsable | Tienda de Productos |
| Dependencia de esta parte | HU-02 |
| Estimación | 5 puntos |
| Sprint | Sprint 2 |
| Responsable | Elias |
| Revisa las pruebas | Esteban |

Como bodeguero, quiero registrar la baja de unidades de un lote por daño o
pérdida, indicando la cantidad, el motivo y una observación cuando corresponda,
para actualizar las existencias, retirar esas unidades de la disponibilidad
para la venta y conservar el historial de los movimientos.

La planificación actualizada de 28 HU divide la historia original de 8 puntos:
HU-19a corresponde a daño y pérdida en el Sprint 2; HU-19b corresponde a
vencimiento en el Sprint 3, a cargo de Walter. Los escenarios originales 3 y 4
quedan en HU-19b. La API de esta parte acepta únicamente «Daño» y «Pérdida».

## Criterios de aceptación aplicables de HU-19

### Escenario 1: Registrar una baja por daño

```gherkin
Dado que el bodeguero inició sesión, tiene permisos para gestionar el inventario y existe un lote con 20 unidades disponibles
Cuando selecciona el lote, ingresa 3 unidades, elige el motivo «Daño», escribe una observación y confirma la baja
Entonces el sistema deja 17 unidades disponibles en el lote y retira las 3 unidades de la disponibilidad para la venta
Y registra el movimiento con el motivo «Daño» y muestra «Baja registrada correctamente».
```

### Escenario 2: Registrar una baja por pérdida

```gherkin
Dado que el bodeguero inició sesión, tiene permisos para gestionar el inventario y existe un lote con 8 unidades disponibles
Cuando selecciona el lote, ingresa 2 unidades, elige el motivo «Pérdida» y confirma la baja
Entonces el sistema deja 6 unidades disponibles en el lote
Y registra el movimiento con el motivo «Pérdida» y muestra «Baja registrada correctamente».
```

### Escenario 5: Rechazar una cantidad superior a las existencias

```gherkin
Dado que existe un lote con 4 unidades disponibles
Cuando el bodeguero intenta registrar una baja de 6 unidades
Entonces el sistema rechaza la operación y conserva las 4 unidades disponibles
Y informa que la cantidad solicitada supera las existencias disponibles.
```

### Escenario 6: Rechazar cantidades inválidas

```gherkin
Dado que el bodeguero está registrando una baja
Cuando ingresa una cantidad igual a cero, negativa, decimal o con letras y confirma la operación
Entonces el sistema rechaza el registro e indica que la cantidad debe ser un número entero mayor que cero
Y no modifica las existencias.
```

### Escenario 7: Impedir el registro con datos obligatorios incompletos

```gherkin
Dado que el bodeguero está en el formulario de baja de productos
Cuando confirma sin seleccionar un lote o sin elegir un motivo permitido
Entonces el sistema no registra la baja, indica los campos pendientes y no modifica las existencias.
```

En esta parte, los motivos permitidos son «Daño» y «Pérdida». La observación
se conserva cuando se informa; no se exige para la pérdida porque el escenario
2 no la requiere ni el escenario 7 la identifica como obligatoria.

### Escenario 8: Impedir la baja de un lote sin existencias

```gherkin
Dado que el lote seleccionado tiene cero unidades disponibles
Cuando el bodeguero intenta registrar una baja
Entonces el sistema rechaza la operación e informa que el lote no tiene unidades disponibles.
```

### Escenario 9: Cancelar la operación antes de confirmar

```gherkin
Dado que el bodeguero ingresó los datos de una baja, pero todavía no la confirmó
Cuando cancela la operación
Entonces el sistema descarta los datos ingresados y no registra el movimiento ni modifica las existencias.
```

### Escenario 10: Registrar la trazabilidad de la baja

```gherkin
Dado que se confirmó una baja por daño o pérdida
Cuando el gerente consulta el historial de movimientos
Entonces el sistema muestra el producto, el lote, el tipo de movimiento, la cantidad, el motivo, la observación, el saldo anterior, el saldo resultante, la fecha, la hora y el usuario responsable.
```

### Escenario 11: Mantener la consistencia si ocurre un error

```gherkin
Dado que el bodeguero confirma una baja válida
Cuando ocurre un error que impide completar el registro del movimiento
Entonces el sistema no deja descontadas parcialmente las unidades, conserva las existencias anteriores o completa íntegramente la operación
Y informa que no se pudo registrar la baja.
```

## Entrega por etapas

Primera etapa: backend, persistencia, permisos y pruebas automatizadas.
Segunda etapa: interfaz React integrada, confirmación y cancelación visual,
validación de campos, actualización de saldos e historial paginado del Gerente.
El backend no guarda borradores: solo el POST confirmado descuenta unidades.

El Bodeguero accede desde **Inventario → Baja de lotes**
(`/inventory/write-offs/new`). Selecciona producto y lote, ingresa cantidad,
motivo y observación opcional, revisa el saldo y confirma. «No» cierra la
confirmación sin enviar la baja; «Cancelar» sale y descarta el formulario.
El Gerente consulta **Inventario → Historial de movimientos**
(`/inventory/movements`). Cada acceso requiere su permiso correspondiente.

La evaluación manual y las evidencias de aceptación a cargo de Esteban siguen
pendientes; las comprobaciones de desarrollo no sustituyen ese registro.

El contrato y los comandos de prueba están en el
[diseño técnico de HU-19a](../../../openspec/changes/hu-19a-baja-dano-perdida/design.md).
