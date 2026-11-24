export type Person = {
  usuario?: { id: number } | null;
  id_persona: string;
  nombre: string;
  ci: string | null;
  telefono: string | null;
  correo: string | null;
  activo: boolean;
};
export type Branch = {
  id_sucursal: string;
  nombre: string;
  direccion: string | null;
  activa: boolean;
};
export type Client = {
  id_cliente: string;
  persona: Person;
  observaciones: string | null;
};
export type Staff = {
  id: number;
  id_persona: string;
  nombre: string;
  apellido: string;
  correo: string;
  ci: string;
  telefono: string | null;
  activo: boolean;
  rol: { nivel: number; nombre_rol: string };
  persona: { empleado: { id_sucursal: string } };
};
export type Pending = {
  id_pago_pendiente: string;
  id_paquete: string;
  concepto: string;
  numero_periodo: number;
  monto: string;
  vence_en: string;
  movimiento: { id_movimiento: string; fecha: string } | null;
};
export type Detail = {
  id_documento: string;
  tipo_documento: string;
  nombre_destinatario: string | null;
  ci_destinatario: string | null;
  telefono_destinatario: string | null;
  documento: { id_cliente: string | null; fecha: string };
};
export type Package = {
  id_paquete: string;
  codigo: string;
  descripcion: string;
  tamanio: number;
  peso_kg: string | null;
  fecha_ingreso: string;
  fecha_limite: string;
  fecha_entrega: string | null;
  estado: string;
  id_sucursal_actual: string | null;
  id_locker: string | null;
  id_destinatario: string | null;
  modalidad_pago: string;
  importe_inicial: string;
  recargo_semanal: string;
  sucursal: Branch | null;
  locker: { codigo: string } | null;
  detalle_documento: Detail[];
  pago_pendiente: Pending[];
  pago_anticipado: {
    monto: string;
    fecha: string;
    movimiento?: unknown;
  } | null;
  devolucion: { monto: string; fecha: string; motivo: string } | null;
};
export type Locker = {
  id_locker: string;
  id_sucursal: string;
  codigo: string;
  tamanio: number;
  habilitado: boolean;
  sucursal: Branch;
  paquete: { id_paquete: string; codigo: string } | null;
};
export type Transfer = {
  id_traslado: string;
  id_sucursal_origen: string;
  id_sucursal_destino: string;
  estado: string;
  creado_en: string;
  fecha_salida: string | null;
  fecha_recepcion: string | null;
  observaciones: string | null;
  detalle_traslado: {
    id_detalle_traslado: string;
    recibido_en: string | null;
    paquete: { id_paquete: string; codigo: string; tamanio: number };
  }[];
};
export type Notice = {
  id_notificacion: string;
  tipo: string;
  contenido: string;
  telefono: string;
  realizado_en: string;
  pago_pendiente: { id_paquete: string };
  notificacion_lectura: { leido_en: string; oculta: boolean }[];
};
export type Alert = {
  id_pago_pendiente: string;
  id_paquete: string;
  codigo: string;
  nombre_destinatario: string | null;
  telefono: string;
  monto: string;
  vence_en: string;
  tipo: string;
};
export type Movement = {
  id_operacion: string;
  anulado_en: string | null;
  observaciones: string | null;
  empleado?: { persona: { nombre: string } };
  paquete?: { codigo: string };
  id_movimiento: string;
  id_paquete: string;
  id_sucursal: string;
  tipo: string;
  monto: string;
  medio: string;
  pagador: string;
  fecha: string;
  id_devolucion: string | null;
};
export type Document = {
  id_empleado: string;
  empleado?: { persona: { nombre: string } };
  id_documento: string;
  tipo: string;
  fecha: string;
  id_sucursal: string;
  observaciones: string | null;
  cliente: Client | null;
  detalle_documento: {
    id_detalle: string;
    id_paquete: string;
    anulado_en: string | null;
    nombre_destinatario: string | null;
    observaciones: string | null;
    paquete: { codigo: string; id_paquete: string };
    ci_destinatario: string | null;
    telefono_destinatario: string | null;
  }[];
};
export type OperationAudit = {
  entidad: string;
  id_registro: string;
  accion: string;
  motivo: string;
  fecha: string;
  empleado?: { persona: { nombre: string } };
};
export type Balance = {
  id_sucursal: string;
  fecha?: string;
  periodo?: string;
  total_entradas: string;
  total_salidas: string;
  saldo: string;
  cantidad_cobros: number;
  cantidad_devoluciones: number;
};
export type DashboardData = {
  auditorias: OperationAudit[];
  usuario: {
    id: number;
    id_persona: string;
    nombre: string;
    apellido: string;
    correo: string;
    ci: string;
    telefono: string | null;
    nivel: number;
    rol: string;
    id_sucursal?: string;
  };
  paquetes: Package[];
  lockers: Locker[];
  sucursales: Branch[];
  clientes: Client[];
  personal: Staff[];
  traslados: Transfer[];
  documentos: Document[];
  movimientos: Movement[];
  notificaciones: Notice[];
  avisos: Alert[];
  configuracion: {
    importe_inicial: string;
    recargo_semanal: string;
    dias_iniciales: number;
  };
  diarios: Balance[];
  mensuales: Balance[];
};
export const money = (v: unknown) =>
  `Bs ${Number(v || 0).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const date = (v: string | null | undefined) =>
  v
    ? new Date(v).toLocaleString("es-BO", {
        timeZone: "America/La_Paz",
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";
export const debt = (p: Package) =>
  p.pago_pendiente
    .filter((x) => !x.movimiento)
    .reduce((a, x) => a + Number(x.monto), 0);
export const sizeName = (n: number) => ["", "Pequeño", "Mediano", "Grande"][n];
export const statusName = (s: string) =>
  ({
    recibido: "Por ubicar",
    almacenado: "Almacenado",
    en_traslado: "En traslado",
    entregado: "Entregado",
    preparado: "Preparado",
    recibido_traslado: "Recibido",
  })[s] || s.replaceAll("_", " ");
