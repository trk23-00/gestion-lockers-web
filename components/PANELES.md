# Paneles Generales de SGAP

La página pública conserva el diseño de Cofre Express. Las cuatro rutas de usuarios usan `paneles-compartidos/UserDashboard`, con barra lateral, cuenta actual, indicadores y tarjetas de resumen, basados en `Frames/REF_UI_USERS.png`. Se reutiliza `/Logo.svg` y la paleta naranja, crema y marrón.

| Ruta | Tipo de usuario | Menús del Panel General |
| --- | --- | --- |
| `/paneles/administrador` | Administrador | Recepción y entregas, almacenes y lockers, traslados, usuarios, pagos, notificaciones, reportes |
| `/paneles/empleado` | Recepcionista | Recepción y entregas, almacenes y lockers, traslados, clientes |
| `/paneles/almacenes` | Almacenero | Almacenes y lockers, traslados, usuarios del almacén |
| `/paneles/cliente` | Cliente: comprador y comerciante | Mis paquetes (seguimiento y traslados), mis pagos, mis notificaciones |

Los menús corresponden a las conexiones de `Frames/D_CASOS_DE_USO.jpeg`. El modelo actual reúne comprador y comerciante en un solo rol Cliente. Registro y entrega se agrupan en un menú; seguimiento y traslados se agrupan como Mis paquetes para clientes. Todos incluyen Panel General. Los enlaces llevan al resumen correspondiente dentro del panel: no se han implementado páginas completas para cada módulo.

## Sesión y alcance

El encabezado consulta `/api/auth/me` y muestra nombre, apellido y rol de la sesión. Incluye correo y acciones de cuenta en su desplegable. Una sesión de otro rol se dirige a su propio panel. El inicio de sesión dirige al panel según el nivel del usuario, definido en `lib/paneles.ts`.

Sin sesión, las rutas siguen disponibles como vistas previas explícitas, sin datos privados. La comprobación en la interfaz no sustituye la autorización en el servidor al integrar módulos privados.

Los indicadores, paquetes, pagos, avisos y mapa son datos de ejemplo, identificados en pantalla. Los indicadores muestran resúmenes de toda la operación; la tabla muestra únicamente tres paquetes recientes, no sus totales. No se consultan ni modifican paquetes reales. La búsqueda y los filtros operan sobre esta tabla; el mapa permite consultar el estado de cada locker de ejemplo. No se ofrecen registros, cobros ni cambios de estado dentro del Panel General. Los componentes anteriores de gestión permanecen en sus carpetas para una futura implementación de los módulos.

No hay suscripciones, planes comerciales ni elementos ajenos a SGAP. El menú puede contraerse en escritorio y abrirse en móvil; se puede cerrar con Escape. Incluye enlaces de salto, nombres accesibles, estados que no dependen solo del color y soporte para movimiento reducido.
