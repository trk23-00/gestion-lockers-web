import { type PanelRole } from "@/lib/paneles";

type Section = {
  id: string;
  label: string;
  icon: string;
  group: string;
  tabs: string[];
  description: string;
};

const sections: Record<string, Section> = {
  general: {
    id: "general",
    label: "Panel general",
    icon: "imgSvg1.svg",
    group: "GENERAL",
    tabs: [],
    description: "La información que necesitas para continuar tu jornada.",
  },
  recepcion: {
    id: "recepcion",
    label: "Recepción",
    icon: "imgSvg.svg",
    group: "OPERACIÓN",
    tabs: ["Nueva recepción", "Documentos registrados", "Corregir recepción"],
    description:
      "Registra paquetes, consulta sus documentos y corrige los datos permitidos.",
  },
  entregas: {
    id: "entregas",
    label: "Entrega",
    icon: "imgSvg3.svg",
    group: "OPERACIÓN",
    tabs: [],
    description:
      "Verifica los paquetes y registra su entrega al destinatario.",
  },
  almacenes: {
    id: "almacenes",
    label: "Almacenes y lockers",
    icon: "imgSvg2.svg",
    group: "OPERACIÓN",
    tabs: [
      "Ocupación",
      "Por ubicar",
      "Reubicaciones",
      "Administración de lockers",
      "Sucursales",
    ],
    description:
      "Consulta la disponibilidad y organiza las ubicaciones de los paquetes.",
  },
  traslados: {
    id: "traslados",
    label: "Traslados",
    icon: "imgSvg3.svg",
    group: "OPERACIÓN",
    tabs: ["Preparación", "Despachos", "Recepciones", "Historial"],
    description:
      "Prepara, despacha y confirma cada paquete en su sucursal de destino.",
  },
  pagos: {
    id: "pagos",
    label: "Pagos",
    icon: "imgSvg4.svg",
    group: "GESTIÓN",
    tabs: ["Por cobrar", "Cobros", "Devoluciones", "Tarifas"],
    description: "Consulta saldos y registra cobros y devoluciones completas.",
  },
  usuarios: {
    id: "usuarios",
    label: "Usuarios",
    icon: "imgSvg5.svg",
    group: "GESTIÓN",
    tabs: ["Nuevo usuario", "Usuarios registrados", "Actualizar usuario", "Cargos y accesos"],
    description: "Administra clientes, personal y accesos al sistema.",
  },
  clientes: {
    id: "clientes",
    label: "Clientes",
    icon: "imgSvg5.svg",
    group: "GESTIÓN",
    tabs: ["Directorio", "Historial"],
    description:
      "Consulta los datos de contacto y los paquetes de cada cliente.",
  },
  notificaciones: {
    id: "notificaciones",
    label: "Notificaciones",
    icon: "imgSvg6.svg",
    group: "GESTIÓN",
    tabs: ["Por realizar", "Realizadas"],
    description:
      "Registra los avisos realizados cuando existe un teléfono del destinatario.",
  },
  reportes: {
    id: "reportes",
    label: "Reportes",
    icon: "imgSvg7.svg",
    group: "GESTIÓN",
    tabs: ["Operación", "Ocupación", "Traslados", "Caja"],
    description:
      "Consulta los resultados de la operación y exporta la información.",
  },
  paquetes: {
    id: "paquetes",
    label: "Mis paquetes",
    icon: "imgSvg.svg",
    group: "MI ACTIVIDAD",
    tabs: ["Activos", "Historial", "Traslados"],
    description:
      "Sigue tus paquetes y consulta su ubicación y sus movimientos.",
  },
};

export function navigation(role: PanelRole): Section[] {
  const ids =
    role === "administrador"
      ? [
          "general",
          "recepcion",
          "entregas",
          "almacenes",
          "traslados",
          "pagos",
          "usuarios",
          "notificaciones",
          "reportes",
        ]
      : role === "empleado"
        ? ["general", "recepcion", "entregas", "almacenes", "traslados", "clientes"]
        : role === "almacenes"
          ? ["general", "almacenes", "traslados", "clientes"]
          : ["general", "paquetes", "pagos", "notificaciones"];

  return ids.map((id) => {
    const item = { ...sections[id], tabs: [...sections[id].tabs] };

    if (role === "empleado" && id === "almacenes")
      item.tabs = ["Disponibilidad", "Ubicación de paquetes", "Por ubicar"];
    if (role === "empleado" && id === "traslados")
      item.tabs = ["En curso", "Historial"];
    if (role === "almacenes" && id === "almacenes")
      item.tabs = item.tabs.filter((t) => t !== "Sucursales");
    if (role === "cliente" && id === "pagos") {
      item.label = "Mis pagos";
      item.tabs = ["Pendientes", "Realizados"];
      item.description =
        "Consulta tus saldos y el historial de pagos de tus paquetes.";
    }
    if (role === "cliente" && id === "notificaciones") {
      item.label = "Mis notificaciones";
      item.tabs = ["Recibidas"];
      item.description =
        "Consulta los recordatorios que se realizaron para tus paquetes.";
    }
    return item;
  });
}
