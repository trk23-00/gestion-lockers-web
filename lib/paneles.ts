export type PanelRole = "administrador" | "empleado" | "almacenes" | "cliente";

export const panelPorNivel: Record<number, PanelRole> = {
  1: "administrador", 2: "empleado", 3: "almacenes", 4: "cliente",
};

export function rutaPanel(nivel: number) {
  const role = panelPorNivel[nivel];
  return role ? `/paneles/${role}` : "/login";
}
