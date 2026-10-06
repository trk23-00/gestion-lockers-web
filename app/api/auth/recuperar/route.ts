import bcrypt from "bcrypt";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { respuestaError, respuestaOk } from "@/lib/api";
import { COOKIES, leerTokenConDato } from "@/lib/seguridad";
import { leerPassword, validarPassword } from "@/lib/validaciones";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const password = leerPassword(body.password);
    const cookieStore = await cookies();
    const correo = leerTokenConDato(cookieStore.get(COOKIES.RESET)?.value, "reset");

    if (!correo) {
      return respuestaError("La verificación venció, solicite un nuevo código", 401);
    }

    const errorPassword = validarPassword(password);

    if (errorPassword) {
      return respuestaError(errorPassword, 400);
    }

    const { count } = await prisma.usuario.updateMany({
      where: { correo },
      data: { password: await bcrypt.hash(password, 10) },
    });

    if (count === 0) {
      return respuestaError("Usuario no encontrado", 404);
    }

    cookieStore.delete(COOKIES.RESET);

    return respuestaOk("Contraseña actualizada");
  } catch (error) {
    console.log(error);

    return respuestaError("Error interno", 500);
  }
}
