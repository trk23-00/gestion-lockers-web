import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { respuestaError, respuestaOk } from "@/lib/api";
import { type DatosUsuario, NIVEL_ROL, validarUsuario } from "@/lib/validaciones";

export async function registrarUsuario(datos: DatosUsuario, nivel: number) {
  const error = validarUsuario(datos, nivel === NIVEL_ROL.CLIENTE);

  if (error) return respuestaError(error, 400);

  const existente = await prisma.usuario.findFirst({
    where: { OR: [{ correo: datos.correo }, { ci: datos.ci }] },
    select: { correo: true },
  });

  if (existente) {
    return respuestaError(
      existente.correo === datos.correo
        ? "El correo ya tiene una cuenta registrada"
        : "El carnet de identidad ya tiene una cuenta registrada",
      409
    );
  }

  const rol = await prisma.rol.findUnique({ where: { nivel } });

  if (!rol) return respuestaError("El rol no existe", 500);

  const usuario = await prisma.usuario.create({
    data: {
      nombre: datos.nombre,
      apellido: datos.apellido,
      ci: datos.ci,
      correo: datos.correo,
      telefono: datos.telefono || null,
      password: await bcrypt.hash(datos.password, 10),
      rolId: rol.id_rol,
    },
    select: { id: true, nombre: true, apellido: true, correo: true },
  });

  return respuestaOk("Cuenta registrada correctamente", { usuario }, 201);
}
