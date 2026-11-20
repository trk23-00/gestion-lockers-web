import { Prisma } from "@prisma/client";
import { respuestaErrorPrisma } from "@/lib/errores-db";
import { respuestaError } from "@/lib/api";
import { obtenerUsuarioSesion } from "@/lib/sesion";
import { registrarUsuario } from "@/lib/usuarios";
import { leerDatosUsuario, NIVEL_ROL } from "@/lib/validaciones";

export async function POST(req: Request) {
  try {
    const sesion = await obtenerUsuarioSesion();

    if (!sesion) {
      return respuestaError("No hay sesión", 401);
    }

    if (sesion.rol.nivel !== NIVEL_ROL.ADMINISTRADOR) {
      return respuestaError("No tiene permisos para registrar empleados", 403);
    }

    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return respuestaError("Formulario inválido", 400);
    }
    const nivel = Number(body.nivel);

    if (nivel !== NIVEL_ROL.ADMINISTRADOR && nivel !== NIVEL_ROL.RECEPCIONISTA && nivel !== NIVEL_ROL.ALMACENERO) {
      return respuestaError("El cargo no es válido", 400);
    }

    return await registrarUsuario(leerDatosUsuario(body), nivel, String(body.id_sucursal || ""));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return respuestaErrorPrisma(error, false);
    }
    if (error instanceof SyntaxError) return respuestaError("Formulario inválido", 400);
    console.error("Error al registrar la cuenta");

    return respuestaError("Error interno del servidor", 500);
  }
}
