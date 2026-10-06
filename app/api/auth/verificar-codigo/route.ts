import { cookies } from "next/headers";
import { respuestaError, respuestaOk } from "@/lib/api";
import { COOKIES, crearTokenConDato, opcionesCookie, tokenValido } from "@/lib/seguridad";
import { leerCorreo, texto } from "@/lib/validaciones";

const VIGENCIA_RESET_SEGUNDOS = 600;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const correo = leerCorreo(body.correo);
    const codigo = texto(body.codigo);

    if (!correo || !codigo) {
      return respuestaError("Datos incompletos", 400);
    }

    const cookieStore = await cookies();

    if (!tokenValido(cookieStore.get(COOKIES.CODIGO)?.value, "codigo", `${correo}\n${codigo}`)) {
      return respuestaError("Código incorrecto o vencido", 401);
    }

    cookieStore.delete(COOKIES.CODIGO);

    cookieStore.set(
      COOKIES.RESET,
      crearTokenConDato("reset", correo, VIGENCIA_RESET_SEGUNDOS),
      opcionesCookie(VIGENCIA_RESET_SEGUNDOS)
    );

    return respuestaOk("Código correcto");
  } catch (error) {
    console.log(error);

    return respuestaError("Error interno", 500);
  }
}
