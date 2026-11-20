import bcrypt from "bcrypt";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { respuestaError, respuestaOk } from "@/lib/api";
import { COOKIES, leerTokenConDato, tokenValido } from "@/lib/seguridad";
import { cerrarSesion, obtenerUsuarioSesion } from "@/lib/sesion";
import { leerPassword, validarPassword } from "@/lib/validaciones";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const password = leerPassword(body?.password);
    const cookieStore = await cookies();
    const verificacion = leerTokenConDato(cookieStore.get(COOKIES.RESET)?.value, "reset");
    const [id, prueba] = verificacion?.split(":") ?? [];
    const vencido = () => respuestaError("La verificación venció, solicite un nuevo código", 401);

    if (!id || !prueba) return vencido();

    const sesion = await obtenerUsuarioSesion();
    if (sesion && String(sesion.id) !== id) {
      return respuestaError("La verificación corresponde a otra cuenta", 403);
    }

    const errorPassword = validarPassword(password);
    if (errorPassword) return respuestaError(errorPassword, 400);

    const usuario = await prisma.usuario.findUnique({
      where: { id: Number(id) },
      select: { id: true, password: true, id_persona: true, rol: { select: { nivel: true } } },
    });

    if (!usuario || !tokenValido(prueba, "reset-vigente", `${usuario.id}\n${usuario.password}`)) {
      return vencido();
    }

    const hash = await bcrypt.hash(password, 10);
    const actualizada = await prisma.$transaction(async (tx) => {
      const { count } = await tx.usuario.updateMany({
        where: { id: usuario.id, password: usuario.password },
        data: { password: hash },
      });

      if (count && usuario.rol.nivel !== 4) {
        await tx.empleado.update({
          where: { id_empleado: usuario.id_persona },
          data: { password_hash: hash },
        });
      }

      return count > 0;
    });

    if (!actualizada) return vencido();

    cookieStore.delete(COOKIES.RESET);
    if (sesion) await cerrarSesion();

    return respuestaOk("Contraseña actualizada");
  } catch (error) {
    if (error instanceof SyntaxError) return respuestaError("Formulario inválido", 400);
    console.error("Error al actualizar la contraseña");
    return respuestaError("Error interno", 500);
  }
}
