import { redirect } from "next/navigation";
import { obtenerUsuarioSesion } from "@/lib/sesion";
import { rutaPanel } from "@/lib/paneles";

export default async function RegistroEmpleado() {
  const usuario = await obtenerUsuarioSesion();
  if (!usuario) redirect("/login");
  if (usuario.rol.nivel !== 1) redirect(rutaPanel(usuario.rol.nivel));
  redirect("/paneles/administrador?seccion=usuarios&vista=Personal");
}
