import { Prisma } from "@prisma/client";

function registro(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

export function respuestaErrorPrisma(
  error: Prisma.PrismaClientKnownRequestError,
  consultando: boolean,
) {
  // Prisma con adapter-pg entrega el SQLSTATE dentro del error del adaptador.
  const causa = registro(registro(error.meta?.driverAdapterError).cause);
  const codigo = causa.originalCode ?? causa.code ?? error.meta?.code;
  if (
    ["42883", "42P01", "42703"].includes(String(codigo)) ||
    ["P2021", "P2022"].includes(error.code)
  ) {
    console.error("SGAP: estructura o reglas de PostgreSQL incompletas", {
      prisma: error.code,
      sqlstate: codigo,
    });
    return Response.json(
      {
        code: "DB_SCHEMA_INCOMPLETE",
        message:
          "La base de datos está incompleta. Solicite al administrador aplicar las migraciones del proyecto.",
      },
      { status: 503 },
    );
  }

  const errores: Record<string, string> = {
    P2002: "Ya existe un registro con ese código, CI o correo.",
    P2003: "El registro tiene historial asociado. Puede desactivarlo.",
    P2025: "Registro inexistente.",
  };
  const mensajeRegla =
    codigo === "P0001"
      ? String(causa.originalMessage ?? causa.message ?? "")
          .replace(/^ERROR:\s*/, "")
          .split("\n")[0]
      : "";
  const message = errores[error.code] || mensajeRegla;
  if (message) return Response.json({ message }, { status: 409 });

  console.error("SGAP: error de PostgreSQL", {
    prisma: error.code,
    sqlstate: codigo,
  });
  return Response.json(
    {
      message: consultando
        ? "No se pudo cargar la información. Inténtelo nuevamente o contacte al administrador."
        : "No se pudo guardar. Revise los datos y vuelva a intentarlo.",
    },
    { status: consultando ? 500 : 409 },
  );
}
