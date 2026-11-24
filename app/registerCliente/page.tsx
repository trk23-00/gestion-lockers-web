import RegisterClientForm from "@/components/inicio_sesion/RegisterClientForm";
import { obtenerUsuarioSesion } from "@/lib/sesion";
import { rutaPanel } from "@/lib/paneles";
import { NIVEL_ROL } from "@/lib/validaciones";

export default async function RegistroCliente() {
  const usuario = await obtenerUsuarioSesion();
  const nivel = usuario?.rol.nivel;
  const panel = nivel ? rutaPanel(nivel) : "/login";
  const volver = nivel === NIVEL_ROL.ADMINISTRADOR
    ? `${panel}?seccion=usuarios&vista=Usuarios%20registrados`
    : nivel === NIVEL_ROL.RECEPCIONISTA ? `${panel}?seccion=clientes` : panel;

  return <RegisterClientForm volver={volver} />;
}
