import { Prisma } from "@prisma/client";
import { obtenerUsuarioSesion } from "@/lib/sesion";
import { respuestaErrorPrisma } from "@/lib/errores-db";
import {
  consultarDatos,
  modificar,
  serializar,
  ErrorOperacion,
} from "@/lib/operacion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function atender(
  req: Request,
  ctx: { params: Promise<{ recurso: string }> },
) {
  try {
    const sesion = await obtenerUsuarioSesion();
    if (!sesion)
      return Response.json(
        { message: "Inicie sesión para continuar." },
        { status: 401 },
      );
    const { recurso } = await ctx.params;
    if (req.method === "GET") {
      if (recurso !== "datos")
        throw new ErrorOperacion("Recurso inexistente.", 404);
      return Response.json(serializar(await consultarDatos(sesion)), {
        headers: { "Cache-Control": "no-store" },
      });
    }
    const origin = req.headers.get("origin");
    // Next puede normalizar req.url al host interno del servidor.
    // Host conserva el origen que el navegador utiliza para esta petición.
    if (origin && new URL(origin).host !== req.headers.get("host"))
      throw new ErrorOperacion("Origen no permitido.", 403);
    if (!req.headers.get("content-type")?.includes("application/json"))
      throw new ErrorOperacion("Envíe un formulario JSON.", 415);
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new ErrorOperacion("Formulario inválido.");
    const result = await modificar(sesion, recurso, req.method, body);
    return Response.json({
      message: "Operación guardada correctamente.",
      result: serializar(result),
    });
  } catch (e) {
    if (e instanceof ErrorOperacion)
      return Response.json({ message: e.message }, { status: e.status });
    if (e instanceof SyntaxError)
      return Response.json(
        { message: "Formulario inválido." },
        { status: 400 },
      );
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      return respuestaErrorPrisma(e, req.method === "GET");
    }
    console.error("Error en SGAP", e instanceof Error ? e.name : "desconocido");
    return Response.json(
      {
        message:
          "No se pudo completar la operación. Compruebe la conexión con la base de datos.",
      },
      { status: 500 },
    );
  }
}
export { atender as GET, atender as POST, atender as PATCH, atender as DELETE };
