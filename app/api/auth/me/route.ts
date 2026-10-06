import { respuestaError, respuestaOk } from "@/lib/api";
import { obtenerUsuarioSesion } from "@/lib/sesion";

export async function GET() {
  try {
    const usuario = await obtenerUsuarioSesion();

    if (!usuario) {
      return respuestaError("No hay sesión", 401);
    }

    return respuestaOk("Sesión activa", {
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        ci: usuario.ci,
        correo: usuario.correo,
        telefono: usuario.telefono,
        rol: usuario.rol.nombre_rol,
        nivel: usuario.rol.nivel,
      },
    });
  } catch (error) {
    console.log(error);

    return respuestaError("Error interno", 500);
  }
}
