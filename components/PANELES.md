# Paneles de Cofre Express

Componentes React con TypeScript y CSS Modules basados en `Frames/CLIENTE.png`, `Frames/PANEL-GENERAL.png` y `Frames/PANEL-PRINCIPAL- ALMACENES.png`.

## Vistas

| Ruta | Componente | Función |
| --- | --- | --- |
| `/` | `General-frames/PanelGeneral` | Página pública |
| `/paneles/cliente` | `Cliente-frames/PanelCliente` | Compras, envíos, pagos y avisos |
| `/paneles/almacenes` | `Almacenes-frames/PanelAlmacenes` | Lockers, almacenamiento y traslados |
| `/paneles/empleado` | `Empleado-frames/PanelEmpleado` | Recepción, entrega y gestión de clientes |
| `/paneles/administrador` | `Administrador-frames/PanelAdministracion` | Empleados y supervisión de sucursales |

Los componentes compartidos están en `paneles-compartidos`. Las carpetas existentes se conservaron con sus nombres actuales. Los estilos incluyen adaptaciones para móviles, navegación con teclado, formularios etiquetados y mensajes accesibles.

## Alcance de la demostración

Las rutas de paneles son vistas públicas de demostración, sin datos privados. Las búsquedas, filtros, selección de lockers, registros de ejemplo y confirmaciones operan en memoria y se reinician al recargar. Los indicadores del encabezado son cifras estáticas de referencia, no totales calculados de las tablas. Las dos representaciones de lockers y las tarjetas de traslados son demostraciones independientes. La tarifa semanal de 2 Bs proviene de la imagen, no de una configuración comercial validada.

No se modificaron los componentes de inicio de sesión, los registros existentes, las API de autenticación ni la base de datos. Se cambió la página principal para mostrar la vista pública. Las acciones de los paneles no invocan las API de creación de cuentas existentes.

## Reglas para una futura integración

- Administrador: su cuenta se crea desde la base de datos; no existe formulario de alta de administradores en los paneles.
- Empleados de almacenes y de recepción/entrega: solo los crea un administrador.
- Cliente: un mismo perfil permite comprar y vender; solo lo crea un empleado de recepción/entrega.

Al conectar los paneles a datos reales, estas reglas deben verificarse en el servidor y las rutas privadas deben protegerse con la sesión. Mostrar un formulario solo a un rol no constituye autorización. Las confirmaciones de recepción, entrega y traslado deberán persistir y coordinarse con la disponibilidad de lockers.
