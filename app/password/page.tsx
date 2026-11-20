import PasswordForm from "@/components/inicio_sesion/PasswordForm";
import { obtenerUsuarioSesion } from "@/lib/sesion";
import { rutaPanel } from "@/lib/paneles";

export default async function PasswordPage() {
  const usuario = await obtenerUsuarioSesion();

  return (
    <main className="authPage">
      <PasswordForm
        correoCuenta={usuario?.correo}
        volver={usuario ? `${rutaPanel(usuario.rol.nivel)}?seccion=cuenta` : "/login"}
      />
    </main>
  );
}
