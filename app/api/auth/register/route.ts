import { respuestaError } from "@/lib/api";
import { registrarUsuario } from "@/lib/usuarios";
import { leerDatosUsuario, NIVEL_ROL } from "@/lib/validaciones";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    return await registrarUsuario(leerDatosUsuario(body), NIVEL_ROL.CLIENTE);
  } catch (error) {
    console.log(error);

    return respuestaError("Error interno del servidor", 500);
  }
}
