## ADDED Requirements

### Requirement: Configure and update minimum stock

The system MUST allow a user logged in as Gerente or Bodeguero to configure the
minimum stock of an existing product with a positive integer value, and MUST
allow updating that value later. The configured value MUST be stored as the
product's restock threshold and returned as the new configured value.

#### Scenario: Configure the minimum stock

- **GIVEN** the user is logged in as Gerente or Bodeguero
- **WHEN** the user selects a product in the inventory and configures its
  minimum stock with a positive integer value
- **THEN** the system updates the product configuration
- **AND** indicates that the minimum stock was registered correctly

#### Scenario: Update the minimum stock

- **GIVEN** the user is authorized to modify the minimum stock of a product
- **WHEN** the user enters a new valid value
- **THEN** the system updates the minimum stock correctly
- **AND** shows the new configured value

### Requirement: Reject invalid minimum stock values

The system MUST reject empty values, letters, symbols, decimals, and negative
values without changing the product's configured minimum stock, and MUST show
the message defined for each case.

#### Scenario: Reject letters, symbols, or an empty value

- **GIVEN** the user attempts to enter the minimum stock value
- **WHEN** the user enters letters, symbols, or leaves the field empty
- **THEN** the system rejects the entered value
- **AND** shows the message `El stock mínimo debe ser un número entero positivo`

#### Scenario: Reject a negative value

- **GIVEN** the user attempts to configure the minimum stock
- **WHEN** the user enters a negative value
- **THEN** the system rejects the change
- **AND** shows the message `El stock mínimo no puede ser negativo`

#### Scenario: Reject a decimal value or letters

- **GIVEN** the user attempts to configure the minimum stock
- **WHEN** the user enters `2.5` or `abc` as the minimum stock
- **THEN** the system rejects the change
- **AND** shows the message `El stock mínimo debe ser un número entero positivo`
