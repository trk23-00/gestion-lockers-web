import type { PanelRole } from "@/lib/paneles";
import type { IconName } from "./Icon";

type Module = { id: string; label: string; icon: IconName; group: string; description: string };
type Metric = { label: string; value: string; detail: string; icon: IconName; target: string };
type PanelConfig = { role: string; description: string; greeting: string; modules: Module[]; metrics: Metric[] };

const packages: Module = { id: "paquetes", label: "Recepción y entregas", icon: "package", group: "OPERACIÓN", description: "Registro de paquetes y verificación de las entregas en sucursal." };
const storage: Module = { id: "almacenes", label: "Almacenes y lockers", icon: "door", group: "OPERACIÓN", description: "Disponibilidad de espacios y organización del almacenamiento." };
const transfers: Module = { id: "traslados", label: "Traslados", icon: "truck", group: "OPERACIÓN", description: "Seguimiento de paquetes entre la sucursal de origen y su destino." };
const users: Module = { id: "usuarios", label: "Usuarios", icon: "users", group: "GESTIÓN", description: "Resumen de las cuentas y funciones del equipo y los clientes." };
const payments: Module = { id: "pagos", label: "Pagos", icon: "wallet", group: "GESTIÓN", description: "Importes del servicio y responsables del pago de cada paquete." };
const notices: Module = { id: "avisos", label: "Notificaciones", icon: "bell", group: "GESTIÓN", description: "Avisos sobre recepción, traslados y disponibilidad de paquetes." };
const reports: Module = { id: "reportes", label: "Reportes", icon: "chart", group: "GESTIÓN", description: "Vista conjunta del estado de los paquetes y de las sucursales." };

export const dashboards: Record<PanelRole, PanelConfig> = {
  administrador: {
    role: "Administrador", description: "Una mirada general a tus sucursales, tu equipo y la operación.", greeting: "Toda la operación, en un solo lugar.",
    modules: [packages, storage, transfers, users, payments, notices, reports],
    metrics: [
      { label: "Paquetes en custodia", value: "27", detail: "Distribuidos en 2 sucursales", icon: "package", target: "reportes" },
      { label: "Entregas de hoy", value: "26", detail: "Resumen de recepción y entrega", icon: "check", target: "paquetes" },
      { label: "Empleados activos", value: "8", detail: "Almacenes y recepción", icon: "users", target: "usuarios" },
      { label: "Sucursales", value: "2", detail: "Central y destino", icon: "door", target: "almacenes" },
    ],
  },
  empleado: {
    role: "Recepcionista", description: "Organiza la atención, la recepción y las entregas de tu sucursal.", greeting: "Cada entrega empieza con una buena atención.",
    modules: [packages, storage, transfers, { ...users, label: "Clientes", description: "Resumen de los clientes atendidos y las cuentas registradas." }],
    metrics: [
      { label: "Recibidos hoy", value: "18", detail: "Paquetes registrados en sucursal", icon: "package", target: "paquetes" },
      { label: "Por entregar", value: "9", detail: "Pendientes de retiro", icon: "clock", target: "paquetes" },
      { label: "Entregados hoy", value: "26", detail: "Entregas confirmadas", icon: "check", target: "paquetes" },
      { label: "Clientes nuevos", value: "3", detail: "Cuentas registradas hoy", icon: "users", target: "usuarios" },
    ],
  },
  almacenes: {
    role: "Almacenero", description: "Consulta los espacios disponibles y el movimiento de los paquetes.", greeting: "Un lugar para cada paquete. Todo bajo control.",
    modules: [storage, transfers, { ...users, label: "Usuarios del almacén" }],
    metrics: [
      { label: "Por ingresar", value: "18", detail: "Pendientes de ubicación", icon: "package", target: "almacenes" },
      { label: "En traslado", value: "9", detail: "En camino a su destino", icon: "truck", target: "traslados" },
      { label: "Lockers disponibles", value: "5", detail: "Mapa de ejemplo · 9 espacios", icon: "door", target: "almacenes" },
      { label: "Vencen hoy", value: "3", detail: "Requieren revisión del almacén", icon: "clock", target: "almacenes" },
    ],
  },
  cliente: {
    role: "Cliente · Comprador / Comerciante", description: "Sigue tus compras y envíos, consulta tus pagos y mantente al tanto.", greeting: "Tus paquetes, siempre cerca de ti.",
    modules: [{ ...transfers, label: "Mis paquetes", description: "Seguimiento de tus compras, envíos y traslados entre sucursales." }, { ...payments, label: "Mis pagos" }, { ...notices, label: "Mis notificaciones" }],
    metrics: [
      { label: "Mis compras", value: "18", detail: "Historial de compras", icon: "package", target: "traslados" },
      { label: "Mis envíos", value: "9", detail: "Historial de envíos", icon: "truck", target: "traslados" },
      { label: "Listos para recoger", value: "1", detail: "CE-0018 · Sucursal central", icon: "check", target: "traslados" },
      { label: "Avisos recientes", value: "2", detail: "Novedades de tus paquetes", icon: "bell", target: "avisos" },
    ],
  },
};

export const packageSummary = [
  { code: "CE-0018", contact: "María López", type: "Compra", status: "Listo para recoger", branch: "Central", payer: "Comprador", tone: "ready" },
  { code: "CE-0019", contact: "Carlos Rojas", type: "Envío", status: "En almacén", branch: "Central", payer: "Comerciante", tone: "stored" },
  { code: "CE-0020", contact: "Ana Vargas", type: "Compra", status: "En traslado", branch: "Destino", payer: "Comerciante", tone: "transit" },
];
