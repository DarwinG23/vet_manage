# HU-11 · Ajuste manual de existencias

| Campo | Descripción |
| --- | --- |
| **Nombre** | Ajuste manual de existencias |
| **Número** | HU-11 |
| **Actor** | Gerente, Bodeguero |
| **Requerimientos vinculados** | RF-10, RF-11, RNF-08 |
| **Módulo responsable** | Tienda de Productos |
| **Dependencia** | HU-02 · Registro de entrada de lote |
| **Estimación** | 8 puntos de historia |
| **Sprint planificado** | Sprint 2 |
| **Responsable** | Walter |

**Historia**

> Como gerente o bodeguero, quiero corregir las existencias registradas de un lote cuando no coincidan con el conteo físico, indicando el nuevo saldo y el motivo, para mantener actualizado el inventario y consultar el movimiento realizado.

## Criterios de aceptación

### Escenario 1: Ajustar el saldo de un lote a una cantidad menor

```gherkin
Dado que el lote «L-2026-001» tiene 20 unidades registradas
Cuando el usuario ingresa 18 como nuevo saldo, escribe el motivo «Diferencia detectada en conteo físico» y confirma el ajuste
Entonces el sistema actualiza el saldo del lote a 18 unidades
Y registra el saldo anterior (20), el nuevo saldo (18), la diferencia (-2), el motivo, la fecha y el usuario responsable
```

### Escenario 2: Ajustar el saldo de un lote a una cantidad mayor

```gherkin
Dado que el lote «L-2026-001» tiene 18 unidades registradas
Cuando el usuario ingresa 20 como nuevo saldo, escribe el motivo «Diferencia detectada en conteo físico» y confirma el ajuste
Entonces el sistema actualiza el saldo del lote a 20 unidades
Y registra el saldo anterior (18), el nuevo saldo (20), la diferencia (+2), el motivo, la fecha y el usuario responsable
```

### Escenario 3: Permitir establecer el saldo en cero

```gherkin
Dado que el lote «L-2026-001» tiene 10 unidades registradas
Cuando el usuario ingresa 0 como nuevo saldo, escribe el motivo «Conteo físico sin unidades» y confirma el ajuste
Entonces el sistema actualiza el saldo del lote a 0 unidades
Y registra el saldo anterior (10), el nuevo saldo (0), la diferencia (-10), el motivo, la fecha y el usuario responsable
```

### Escenario 4: Rechazar un saldo negativo

```gherkin
Dado que el lote «L-2026-001» tiene 10 unidades registradas
Cuando el usuario ingresa -3 como nuevo saldo e intenta confirmar el ajuste
Entonces el sistema rechaza el ajuste y conserva las 10 unidades registradas
Y indica que el saldo debe ser un número entero mayor o igual a cero
```

### Escenario 5: Rechazar un saldo decimal

```gherkin
Dado que el usuario está ajustando las existencias de un lote
Cuando ingresa 5,5 como nuevo saldo e intenta confirmar el ajuste
Entonces el sistema rechaza el ajuste y conserva el saldo anterior
Y indica que el saldo debe ser un número entero mayor o igual a cero
```

### Escenario 6: Rechazar un saldo que contiene letras

```gherkin
Dado que el usuario está ajustando las existencias de un lote
Cuando ingresa «abc» como nuevo saldo e intenta confirmar el ajuste
Entonces el sistema rechaza el ajuste y conserva el saldo anterior
Y indica que debe ingresar un número entero mayor o igual a cero
```

### Escenario 7: Impedir el ajuste si falta el motivo

```gherkin
Dado que el lote «L-2026-001» tiene 10 unidades registradas
Cuando el usuario ingresa un nuevo saldo válido, deja vacío el motivo y confirma el ajuste
Entonces el sistema no modifica las existencias
Y solicita ingresar el motivo del ajuste
```

### Escenario 8: Impedir el ajuste si falta el nuevo saldo

```gherkin
Dado que el usuario seleccionó un lote e ingresó el motivo del ajuste
Cuando deja vacío el campo del nuevo saldo e intenta confirmar
Entonces el sistema no modifica las existencias
Y solicita ingresar el nuevo saldo del lote
```

### Escenario 9: Consultar un ajuste en el historial

```gherkin
Dado que existe un ajuste confirmado para el lote «L-2026-001»
Cuando el gerente o bodeguero consulta el historial de movimientos de ese lote
Entonces el sistema muestra el saldo anterior, el nuevo saldo, la diferencia, el motivo, la fecha y el usuario responsable
```

## Tareas de desarrollo

### Diseño

- Diseñar el ajuste de un lote indicando el nuevo saldo y el motivo.
- Definir el cálculo de la diferencia entre el saldo anterior y el nuevo saldo.
- Contemplar saldos mayores, menores o iguales a cero.
- Diseñar validaciones para negativos, decimales, letras y datos vacíos.
- Definir los datos que quedarán registrados en el historial del ajuste.

### Implementación y pruebas

- Implementar el ajuste de existencias estableciendo el nuevo saldo del lote.
- Calcular y registrar la diferencia y los saldos anterior y posterior.
- Rechazar cantidades inválidas o ajustes sin motivo.
- Comprobar que los intentos rechazados no alteren las existencias.
- Verificar el registro del ajuste en el historial.
- Ejecutar y documentar los nueve escenarios de aceptación.

## Resultado esperado

El inventario refleja el nuevo saldo contado en cada lote y registra la diferencia, el motivo y el responsable, rechazando ajustes inválidos.
