import { respuestaOk } from "@/lib/api";
import { cerrarSesion } from "@/lib/sesion";

export async function POST() {
  await cerrarSesion();

  return respuestaOk("Sesión cerrada");
}
