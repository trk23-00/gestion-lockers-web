import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { respuestaError, respuestaOk } from "@/lib/api";
import { verificarCaptcha } from "@/lib/captcha";
import { iniciarSesion } from "@/lib/sesion";
import { leerCorreo, leerPassword, texto } from "@/lib/validaciones";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const correo = leerCorreo(body.correo);
    const password = leerPassword(body.password);
    const captcha = texto(body.captcha);

    if (!correo || !password) {
      return respuestaError("Debe llenar todos los campos", 400);
    }

    if (!captcha) {
      return respuestaError("Debe completar el captcha", 400);
    }

    if (!(await verificarCaptcha(captcha))) {
      return respuestaError("El captcha es incorrecto o venció", 400);
    }

    const usuario = await prisma.usuario.findUnique({
      where: { correo },
      include: { rol: true },
    });

    if (!usuario || !(await bcrypt.compare(password, usuario.password))) {
      return respuestaError("Correo o contraseña incorrectos", 401);
    }

    await iniciarSesion(usuario.id);

    return respuestaOk("Inicio exitoso", {
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        correo: usuario.correo,
        rol: usuario.rol.nombre_rol,
        nivel: usuario.rol.nivel,
      },
    });
  } catch (error) {
    console.log(error);

    return respuestaError("Error interno", 500);
  }
}