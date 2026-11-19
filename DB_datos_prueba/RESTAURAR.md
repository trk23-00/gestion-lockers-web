# Entrega de la base de datos de prueba

El archivo **sgap_completo_2026-11-19.bkp** es un respaldo completo en formato Custom de PostgreSQL, generado con `pg_dump` 18.3. Incluye todas las tablas y sus datos, secuencias e identidades, índices, claves y restricciones, vistas, funciones, triggers y el historial de migraciones de Prisma. También conserva las funciones adicionales que ya existían en la DB de origen. La DB actual utiliza funciones de PostgreSQL; no tiene objetos `CREATE PROCEDURE` separados.

La DB contiene 22 tablas de aplicación con registros, más la tabla técnica `_prisma_migrations`. No es una exportación de Prisma ni un respaldo solo de datos: incluye las reglas SQL que necesita la aplicación para recepciones, entregas, recargos, cobros, traslados y caja.

## Archivos de la carpeta

- `sgap_completo_2026-11-19.bkp`: respaldo completo para restaurar.
- `CUENTAS.md`: los dos listados solicitados, Clientes y Empleados, con sus correos y contraseñas verificadas.
- `contenido.json`: conteos de registros y ejemplos de estados presentes en el respaldo.
- `VERIFICACION.json`: resultado de restaurar el archivo en una base vacía y comparar sus datos, reglas, restricciones y secuencias con el origen.
- `SHA256.txt`: huella del archivo para comprobar que se copió correctamente.
- `indice_respaldo.txt`: inventario de objetos obtenido con `pg_restore --list`.
- `generar-datos.mjs`: generador de los ejemplos. No es necesario ejecutarlo al restaurar: los datos ya están en el respaldo. En la misma DB no duplica sus 24 paquetes ni cambia las contraseñas existentes.
- `verificar-restauracion.mjs`: comprobación del respaldo restaurado en una DB temporal de verificación.

## Restauración recomendada con Docker

Utilice el proyecto completo `web-lockers` y PostgreSQL 18. Los comandos siguientes se ejecutan **desde la carpeta `web-lockers`**, donde están `package.json` y `compose.yaml`. Docker Desktop debe estar iniciado.

En una copia nueva del proyecto, prepare `.env` a partir de `.env.example`. No sobrescriba una configuración local que quiera conservar.

```powershell
Copy-Item .env.example .env
npm ci
docker compose up -d --wait
docker compose cp DB_datos_prueba/sgap_completo_2026-11-19.bkp db:/tmp/sgap_pruebas.bkp
docker compose exec -T db createdb -U lockers lockers_prueba
docker compose exec -T db pg_restore -U lockers --dbname=lockers_prueba --no-owner --no-privileges --exit-on-error /tmp/sgap_pruebas.bkp
```

En Linux/macOS cambie `Copy-Item .env.example .env` por `cp .env.example .env`. El usuario `lockers` y el puerto 5433 son los valores de `.env.example`; si configuró otros, adapte los comandos. Si el puerto está ocupado por otro PostgreSQL, cambie `POSTGRES_PORT` y el puerto de `DATABASE_URL` de forma consistente.

La base `lockers_prueba` debe ser **nueva y vacía**. Si ya existe, elija otro nombre para una restauración nueva. Estos comandos no limpian ni reemplazan una DB existente.

Después de restaurar, configure la aplicación para utilizar esa base:

```dotenv
DATABASE_URL="postgresql://lockers:lockers_local@localhost:5433/lockers_prueba?schema=public"
CAPTCHA_MODE=local
NEXT_PUBLIC_CAPTCHA_MODE=local
```

Guarde estos valores en `.env`. Si existe `.env.local`, revise su `DATABASE_URL`, porque tiene prioridad sobre `.env`. No copie las credenciales de PostgreSQL del equipo original: cada ordenador usa las de su propio contenedor.

```powershell
npm run setup
npm run dev
```

`setup` sustituye el marcador de `AUTH_SECRET` por una clave local de sesión, verifica/aplica migraciones y genera Prisma Client. Reconoce las cuentas y los datos iniciales ya restaurados. En otra terminal ejecute:

```powershell
npm run jobs
```

Abra [http://localhost:3000/login](http://localhost:3000/login) y use una cuenta de `CUENTAS.md`. La verificación local de acceso funciona durante `npm run dev`. Para ejecutar una compilación de producción se necesitan claves reales de reCAPTCHA, según `DESARROLLO.md` en la raíz del proyecto.

## Restauración con pgAdmin o herramientas locales

1. Cree una DB vacía en PostgreSQL 18, con un usuario local que pueda crear tablas, funciones y triggers.
2. En pgAdmin seleccione esa DB y la opción Restore. Use formato Custom y el archivo `.bkp`. Restaure las secciones Pre-data, Data y Post-data completas.
3. Excluya propietario y privilegios si no existe el usuario `admin` del equipo original. Con terminal, el equivalente es:

```powershell
pg_restore --host=localhost --port=5433 --username=TU_USUARIO --dbname=TU_DB_NUEVA --no-owner --no-privileges --exit-on-error DB_datos_prueba/sgap_completo_2026-11-19.bkp
```

4. Configure `DATABASE_URL` con los datos de esa DB y ejecute `npm run setup`, `npm run dev` y `npm run jobs`.

No abra el archivo con `psql` como si fuera texto SQL: el formato Custom se restaura con `pg_restore` o Restore de pgAdmin. Los usuarios del sistema, sus roles y sus hashes de contraseña están en las tablas del respaldo; las cuentas de acceso al servidor PostgreSQL se configuran en cada ordenador. El respaldo es de la DB, no de las credenciales del sistema operativo ni de `.env`.

## Escenarios incluidos

- 10 cuentas: 5 clientes y 5 empleados, con administrador y personal de Central y Norte.
- 24 paquetes: almacenados, por ubicar, entregados y en tránsito; de los tres tamaños.
- Documentos de recepción y entrega con varios paquetes y destinatarios diferentes; también un destinatario sin cuenta ni teléfono.
- Pagos anticipados, pendientes sin vencer, recargos pendientes, cobros completos por efectivo/QR/transferencia y una devolución monetaria total.
- Traslados preparados, uno completado, uno en camino y otro con recepción parcial de sus paquetes.
- Avisos pendientes de realizar, avisos registrados, un aviso leído, otro sin leer y uno ocultado por el cliente.
- Lockers ocupados, disponibles y deshabilitados.
- Caja diaria y mensual con movimientos del mes actual y del mes anterior. Los balances fueron generados por los triggers, no insertados como cifras ficticias independientes.

Los códigos de los paquetes comienzan por `DEMO-COMPARTIR-`. Las notificaciones de ejemplo están identificadas como ficticias: no se enviaron mensajes a teléfonos reales. Las fechas corresponden al 19 de noviembre de 2026; al utilizar el respaldo otro día, los avisos y los recargos se adaptarán al calendario real. El generador se puede usar sobre una instalación nueva para crear una demostración con fechas relativas al día en que se ejecute.

## Comprobación de integridad del archivo

En PowerShell, desde `web-lockers`:

```powershell
Get-FileHash DB_datos_prueba/sgap_completo_2026-11-19.bkp -Algorithm SHA256
Get-Content DB_datos_prueba/SHA256.txt
```

Ambas huellas deben coincidir. La restauración de este archivo se verificó en una DB temporal separada antes de entregar la carpeta; los resultados están en `VERIFICACION.json`.
