# HU-03 · Configurar stock mínimo

| Campo | Descripción |
| --- | --- |
| **Nombre** | Configurar stock mínimo |
| **Número** | HU-03 |
| **Actor** | Gerente o bodeguero |
| **Requerimientos vinculados** | RF-08 |
| **Módulo responsable** | Tienda de Productos |
| **Dependencias** | HU-01 |
| **Estimación** | 3 puntos |
| **Sprint planificado** | Sprint 1 |

**Historia**

> Como gerente o bodeguero, quiero configurar o actualizar el stock mínimo de cada producto para establecer el umbral de inventario bajo del cual se debe activar una alerta de reabastecimiento.

## Criterios de aceptación

### Escenario 1: Configurar el stock mínimo

```gherkin
Dado que el usuario inició sesión como gerente o bodeguero
Cuando selecciona un producto en el inventario
Y configura el stock mínimo con un valor entero positivo
Entonces el sistema actualiza la configuración del producto
Y indica que el stock mínimo quedó registrado correctamente.
```

### Escenario 2: Actualizar el stock mínimo

```gherkin
Dado que el usuario autoriza la modificación del stock mínimo de un producto
Cuando ingresa un nuevo valor válido
Entonces el sistema actualiza el stock mínimo de forma correcta
Y muestra el nuevo valor configurado.
```

### Escenario 3: Impedir la configuración de un valor inválido

```gherkin
Dado que el usuario intenta ingresar el valor del stock mínimo
Cuando ingresa letras, símbolos o deja el campo vacío
Entonces el sistema rechaza el valor ingresado
Y muestra el mensaje «El stock mínimo debe ser un número entero positivo».
```

### Escenario 4: Impedir un valor negativo

```gherkin
Dado que el usuario intenta configurar el stock mínimo
Cuando ingresa un valor negativo
Entonces el sistema rechaza el cambio
Y muestra el mensaje «El stock mínimo no puede ser negativo».
```

### Escenario 5: Impedir un valor decimal o con letras

```gherkin
Dado que el usuario intenta configurar el stock mínimo
Cuando ingresa «2.5» o «abc» como stock mínimo
Entonces el sistema rechaza el cambio
Y muestra el mensaje «El stock mínimo debe ser un número entero positivo».
```