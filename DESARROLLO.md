# Puesta en marcha local de SGAP

Esta guía permite instalar una copia funcional del repositorio con PostgreSQL, Prisma y los cuatro paneles. Cada colaborador utiliza su propia base de datos y sus propios datos locales.

## Requisitos

- Git, Node.js 24 LTS con npm y Docker Desktop iniciado. En Linux puede utilizarse Docker Engine con Compose.
- Puertos 3000 para la aplicación y 5433 para PostgreSQL. Se pueden cambiar si están ocupados.
- Acceso a Internet durante la instalación de dependencias y la primera compilación de la fuente Sansation.

## Primera instalación

Abra una terminal dentro de `web-lockers`. En PowerShell:

```powershell
Copy-Item .env.example .env
npm ci
docker compose up -d --wait
npm run setup
npm run dev
```

En Linux/macOS use `cp .env.example .env` en lugar de `Copy-Item`. Abra [http://localhost:3000/login](http://localhost:3000/login). Mantenga una segunda terminal en la misma carpeta:

```powershell
npm run jobs
```

`setup` genera una clave de sesión aleatoria si encuentra el marcador de `.env.example`, aplica migraciones, genera Prisma Client y crea los datos iniciales. No reinicia la base de datos ni cambia contraseñas existentes. El proceso `jobs` revisa los recargos cada minuto, incluso sin usuarios conectados. Los cobros, las entregas y la carga de los paneles también los comprueban.

El modo CAPTCHA local muestra una casilla de verificación durante `npm run dev`. Se habilita con ambas variables `CAPTCHA_MODE=local` y `NEXT_PUBLIC_CAPTCHA_MODE=local`; el servidor nunca acepta ese modo cuando `NODE_ENV=production`.

### Cuentas iniciales de desarrollo

| Perfil        | Correo                    | Panel                    |
| ------------- | ------------------------- | ------------------------ |
| Administrador | `admin@lockers.local`     | `/paneles/administrador` |
| Recepcionista | `recepcion@lockers.local` | `/paneles/empleado`      |
| Almacenero    | `almacen@lockers.local`   | `/paneles/almacenes`     |
| Cliente       | `cliente@lockers.local`   | `/paneles/cliente`       |

La contraseña inicial es el valor de `DEV_SEED_PASSWORD`; el ejemplo usa `LockersDemo2026!`. Cambie esa variable **antes** de ejecutar `setup` por primera vez si desea otra contraseña. Cambiarla posteriormente no cambia cuentas existentes; use Mi cuenta o la edición de personal. Son cuentas para desarrollo local.

Se crean dos sucursales, Central y Norte, con doce lockers cada una. El personal inicial pertenece a Central. No se inventan paquetes ni movimientos de dinero. Para probar una recepción registre un cliente desde Usuarios/Clientes, o seleccione la cuenta cliente inicial. Para probar la recepción de un traslado en Norte, cree un almacenero asignado a Norte o utilice el administrador.

## Configuración de la conexión

`.env.example` contiene valores locales de ejemplo. `.env` y `.env.local` quedan fuera de Git. La prioridad es: variables del proceso, `.env.local`, `.env`. Tanto Next como los comandos de Prisma y los scripts siguen esa prioridad; una `.env.local` antigua puede sobrescribir lo que cambie en `.env`.

| Variable                                                             | Uso                                                                                                                                 |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                       | Conexión de la aplicación, Prisma, seed y jobs. Ejemplo: `postgresql://lockers:lockers_local@localhost:5433/lockers?schema=public`. |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` | Creación del contenedor de Compose; los cambios de credenciales no modifican un volumen ya inicializado.                            |
| `AUTH_SECRET`                                                        | Firma de cookies de sesión y recuperación. `setup` sustituye el marcador por una clave aleatoria local.                             |
| `DEV_SEED_PASSWORD`                                                  | Contraseña para las cuentas nuevas creadas por seed.                                                                                |
| `CAPTCHA_MODE`, `NEXT_PUBLIC_CAPTCHA_MODE`                           | `local` para el prototipo durante desarrollo; reinicie Next después de cambiarlas.                                                  |
| `RECAPTCHA_SECRET_KEY`, `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`             | Par real de claves de reCAPTCHA para usar el acceso fuera del modo local.                                                           |
| `EMAIL_USER`, `EMAIL_PASS`                                           | Cuenta Gmail y contraseña de aplicación para la recuperación de contraseña por correo.                                              |

El acceso y los módulos funcionan localmente sin configurar correo. La recuperación por correo requiere configurar las variables de Gmail; el prototipo no simula envíos ni muestra códigos de recuperación en pantalla. Las notificaciones de pagos se registran después de comunicar el aviso por un canal externo; no hay un proveedor de WhatsApp/SMS integrado.

Si 5433 está ocupado, cambie `POSTGRES_PORT` y el puerto dentro de `DATABASE_URL` al mismo valor, por ejemplo 5434, antes de crear el contenedor. Para cambiar el puerto de la web:

```powershell
npm run dev -- --port 3001
```

### Usar la DB de Docker que ya existía

En el equipo original se utiliza el contenedor `ejemplo`, base `db_ejemplo`, publicada en 5433. Sus credenciales permanecen en la configuración local; no están en el repositorio. Si esa DB ya está iniciada, conserve su `DATABASE_URL` y **no levante otro contenedor sobre el mismo puerto**. Ejecute `npm ci` y `npm run setup`.

La migración `0_operacion` reproduce el SQL del prototipo ubicado en `Docs/lockers-prototipo.sql` en el repositorio superior. `setup` reconoce las tablas de ese prototipo y registra esa migración como aplicada antes de agregar las tablas de cuentas/configuración. Si detecta una base con tablas distintas, se detiene sin borrar datos. Para una instalación nueva utilice una DB vacía y deje que las migraciones creen todo; no es necesario ejecutar el SQL manualmente.

## Trabajo diario y cambios del equipo

```powershell
git pull
npm ci
npm run setup
npm run dev
```

Mantenga `npm run jobs` abierto en otra terminal. `setup` es repetible y solo completa los datos iniciales que faltan. Para separar tareas use `npm run db:migrate` para aplicar migraciones y `npm run db:seed` para datos iniciales.

Al modificar el modelo agregue una **nueva migración SQL** que incluya las restricciones, funciones, vistas y triggers necesarios; después actualice `prisma/schema.prisma` y genere el cliente con `npx prisma generate`. Las reglas monetarias y de ocupación viven también en PostgreSQL. No use `prisma db push` como sustituto de las migraciones: no reproduce esos procedimientos. No use `migrate reset` sobre una DB con información que deba conservarse.

Para apagar la DB conservando la información:

```powershell
docker compose stop
```

Para volver a iniciarla: `docker compose start`. El volumen `lockers_postgres` conserva los datos. No elimine el volumen para una actualización ordinaria.

## Qué permite cada panel

| Módulo                 | Administrador                                                                               | Recepcionista                                                                      | Almacenero                                                   | Cliente                                |
| ---------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------- |
| Recepción y documentos | Registrar varios paquetes, consultar documentos y corregir descripción/peso                 | Mismas tareas en su sucursal                                                       | Sin escritura                                                | Consulta de sus paquetes               |
| Entrega                | Entregar varios paquetes con saldo cero                                                     | Entregar en su sucursal                                                            | Sin escritura                                                | Seguimiento                            |
| Sucursales             | Crear, consultar, editar y eliminar si no tienen referencias; activar/desactivar            | Consulta                                                                           | Consulta                                                     | Nombres de sucursales para seguimiento |
| Lockers                | Crear, consultar, editar, eliminar si están libres y sin historial                          | Disponibilidad y ubicación, consulta                                               | Gestión en su sucursal y ubicación/reubicación de paquetes   | Ubicación de sus paquetes              |
| Traslados              | Preparar, editar/eliminar preparados, despachar y recibir cada paquete                      | Consulta de traslados de su sucursal                                               | Preparar/despachar desde su sucursal; recibir en su sucursal | Seguimiento de sus paquetes            |
| Clientes               | Crear, consultar, editar y eliminar fichas sin historial; desactivar                        | Crear/editar fichas y consultar                                                    | Consulta de clientes vinculados a su sucursal                | Mi cuenta                              |
| Personal               | Crear/editar cuentas, cargo, sucursal, contraseña y estado; eliminar si no tiene historial  | Sin acceso                                                                         | Sin acceso                                                   | Sin acceso                             |
| Pagos                  | Cobrar todo el saldo, devolver todo lo cobrado, consultar historial, editar tarifas futuras | Cobrar y devolver importes completos; consultar historial y tarifas de su sucursal | Sin acceso                                                   | Consulta de sus cargos y movimientos   |
| Notificaciones         | Consultar candidatos y registrar avisos realmente realizados                                | Sin acceso                                                                         | Sin acceso                                                   | Leer/ocultar sus avisos                |
| Reportes               | Operación, ocupación, traslados, caja diaria y mensual; exportar CSV                        | Sin acceso                                                                         | Sin acceso                                                   | Sin acceso                             |

Los permisos se comprueban en el servidor, aunque se invoque la API directamente. El recepcionista no despacha ni confirma traslados. El almacenero no modifica cuentas ni roles. El cliente solo ve paquetes en los que figura como remitente o como destinatario explícitamente vinculado; coincidir en teléfono o CI no concede acceso. El nombre visible Clientes del panel de almacenes sigue el diseño actualizado de Figma.

Los documentos emitidos, los cobros, los avisos realizados y los balances conservan su historial. No tienen edición/eliminación arbitraria: se utilizan entrega, devolución total, desactivación o lectura/ocultación según el proceso. La eliminación de un paquete solo está disponible para el administrador, antes de entrega/traslado/cobro/aviso y sin historial asociado. Las tarifas se guardan por paquete, por lo que editar la configuración no cambia cargos anteriores.

El administrador puede habilitar una cuenta para una ficha de cliente existente con **Usuarios → Clientes → Crear acceso**, verificando primero su identidad. Esto conserva su historial y evita duplicar el CI. Si una persona se registra por sí misma antes de tener ficha, se crean su cuenta y ficha juntas. El registro público no reclama fichas existentes.

## Recorrido mínimo para comprobar la instalación

1. Entre como administrador o recepcionista y cree una ficha de cliente.
2. Registre una recepción con varios paquetes: para probar el panel del cliente, seleccione `Cliente Demo` como cuenta destinataria en uno de ellos. Los destinatarios sin cuenta siguen guardándose como datos generales del detalle.
3. Entre como almacenero y asigne lockers disponibles del tamaño adecuado. En Traslados puede preparar/despachar hacia Norte.
4. Si el paquete tiene pago pendiente, entre como administrador o recepcionista y registre el cobro en Pagos o con Cobrar para entregar, después de recibir el dinero. El recepcionista opera únicamente en su sucursal y consulta las tarifas; su edición corresponde al administrador.
5. Entregue el paquete desde Recepción y entregas. El locker queda libre. Revise Documentos y Reportes/Caja.
6. Entre como cliente para consultar exclusivamente sus envíos, pagos y avisos registrados.

No se requiere una pasarela para registrar efectivo/QR/transferencia: el prototipo registra el movimiento después del pago externo. No cobra tarjetas ni procesa dinero por Internet.

## Verificaciones automáticas

```powershell
npm run typecheck
npm run lint
npm run build
npx playwright install chromium
npm test
```

Las pruebas crean una DB temporal llamada `lockers_test_...`, aplican las migraciones desde cero, prueban la API con los cuatro perfiles y abren los paneles en escritorio y móvil. Al finalizar eliminan **solo esa DB temporal**; no usan los datos del prototipo para las pruebas. El usuario PostgreSQL de `DATABASE_URL` necesita permiso para crear bases; el usuario local de Compose lo tiene. El puerto 3117 debe estar libre. Las capturas y trazas se guardan en `test-results/`, fuera de Git.

Para utilizar Chrome instalado en lugar del Chromium descargado, en PowerShell:

```powershell
$env:PLAYWRIGHT_CHANNEL = "chrome"
npm test
```

La compilación utiliza Webpack para evitar que la generación de enlaces de Turbopack con Prisma requiera permisos adicionales en Windows. Para ejecutar la compilación con `npm start`, configure claves reales de reCAPTCHA antes de `npm run build`; el modo local no funciona en producción.

## Ubicación del código

- `components/paneles-compartidos/`: interfaz, navegación por subsecciones, tablas, formularios y estilos basados en Figma.
- `public/figma/`: recursos originales descargados del diseño; no dependen de enlaces temporales de Figma.
- `app/api/sgap/[recurso]/route.ts`: API autenticada de los módulos.
- `lib/operacion.ts`: validaciones, ámbitos por usuario y transacciones de negocio.
- `lib/sesion.ts`, `lib/usuarios.ts`: cuentas y sesiones vinculadas a personas/empleados/clientes.
- `prisma/schema.prisma`, `prisma/migrations/`: modelo y evolución reproducible de PostgreSQL.
- `scripts/`: instalación, seed, recargos y ejecución aislada de pruebas.

Diseño de referencia: [SisLckers en Figma](https://www.figma.com/design/kRKhxYJzGEv3tlGXJFn5jt/SisLckers?node-id=263-805). El traslado implementa los módulos como vistas funcionales reutilizables; los números de ejemplo de Figma se sustituyen por consultas de la DB.
