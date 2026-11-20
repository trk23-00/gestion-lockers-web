import { cookies } from "next/headers";
import { respuestaError, respuestaOk } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { obtenerUsuarioSesion } from "@/lib/sesion";
import { COOKIES, crearToken, crearTokenConDato, opcionesCookie, tokenValido } from "@/lib/seguridad";
import { leerCorreo, texto } from "@/lib/validaciones";

const VIGENCIA_RESET_SEGUNDOS = 600;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const correo = leerCorreo(body.correo);
    const codigo = texto(body.codigo);

    if (!correo || !/^\d{6}$/.test(codigo)) {
      return respuestaError("Datos incompletos", 400);
    }

    const sesion = await obtenerUsuarioSesion();
    if (sesion && sesion.correo !== correo) {
      return respuestaError("Use el correo de su cuenta", 403);
    }

    const cookieStore = await cookies();
    const tokenCodigo = cookieStore.get(COOKIES.CODIGO)?.value;
    const usuario = tokenCodigo && await prisma.usuario.findUnique({
      where: { correo },
      select: { id: true, password: true },
    });

    if (!usuario || !tokenValido(tokenCodigo, "codigo", `${usuario.id}\n${usuario.password}\n${codigo}`)) {
      return respuestaError("Código incorrecto o vencido", 401);
    }

    cookieStore.delete(COOKIES.CODIGO);

    const prueba = crearToken("reset-vigente", `${usuario.id}\n${usuario.password}`, VIGENCIA_RESET_SEGUNDOS);
    cookieStore.set(
      COOKIES.RESET,
      crearTokenConDato("reset", `${usuario.id}:${prueba}`, VIGENCIA_RESET_SEGUNDOS),
      opcionesCookie(VIGENCIA_RESET_SEGUNDOS)
    );

    return respuestaOk("Código correcto");
  } catch (error) {
    console.log(error);

    return respuestaError("Error interno", 500);
  }
}
