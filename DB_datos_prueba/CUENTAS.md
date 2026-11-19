# Cuentas de prueba de SGAP

Generado: 19/11/2026, 7:29:35 p. m. (America/La_Paz).

Todas las personas, paquetes y operaciones agregados por esta demostración son ficticios. Las contraseñas de este documento son para compartir el prototipo local; en PostgreSQL se guardan como hashes bcrypt. Las cuentas iniciales conservaron sus claves.

## Clientes

- **Cliente Demo**
  - Correo: `cliente@lockers.local`
  - Contraseña: `LockersDemo2026!`
  - CI: `90000004`

- **María Fernández**
  - Correo: `comerciante.maria@lockers.local`
  - Contraseña: `PruebaLockers2026!`
  - CI: `91000001`

- **Jorge Rojas**
  - Correo: `comerciante.jorge@lockers.local`
  - Contraseña: `PruebaLockers2026!`
  - CI: `91000002`

- **Ana Gómez**
  - Correo: `compradora.ana@lockers.local`
  - Contraseña: `PruebaLockers2026!`
  - CI: `91000003`

- **Luis Quispe**
  - Correo: `comprador.luis@lockers.local`
  - Contraseña: `PruebaLockers2026!`
  - CI: `91000004`

María y Jorge actúan como comerciantes/remitentes; Ana y Luis como compradores/destinatarios. La cuenta Cliente Demo permite probar seguimiento, pagos y un aviso sin leer. Una cuenta de cliente puede consultar sus paquetes tanto como remitente como destinatario.

## Empleados

- **Administrador Demo** — Administrador, sucursal Central
  - Correo: `admin@lockers.local`
  - Contraseña: `LockersDemo2026!`
  - CI: `90000001`

- **Recepción Demo** — Recepcionista, sucursal Central
  - Correo: `recepcion@lockers.local`
  - Contraseña: `LockersDemo2026!`
  - CI: `90000002`

- **Sofía Méndez** — Recepcionista, sucursal Norte
  - Correo: `recepcion.norte@lockers.local`
  - Contraseña: `PruebaLockers2026!`
  - CI: `91000005`

- **Almacén Demo** — Almacenero, sucursal Central
  - Correo: `almacen@lockers.local`
  - Contraseña: `LockersDemo2026!`
  - CI: `90000003`

- **Diego Paredes** — Almacenero, sucursal Norte
  - Correo: `almacen.norte@lockers.local`
  - Contraseña: `PruebaLockers2026!`
  - CI: `91000006`

El administrador consulta todas las sucursales. Los recepcionistas registran recepciones y entregas de su sucursal; los almaceneros administran ubicaciones y traslados en su sucursal.

## Uso

Abra /login y utilice el correo y la contraseña indicados. Para configurar otro ordenador y restaurar el respaldo completo consulte RESTAURAR.md de esta misma carpeta. Los recordatorios y recargos cambian con la fecha real del equipo: este respaldo conserva las fechas de su generación.
