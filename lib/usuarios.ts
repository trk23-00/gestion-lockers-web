import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { respuestaError, respuestaOk } from "@/lib/api";
import {
  type DatosUsuario,
  NIVEL_ROL,
  validarUsuario,
} from "@/lib/validaciones";

export async function registrarUsuario(
  datos: DatosUsuario,
  nivel: number,
  sucursal?: string,
) {
  const error = validarUsuario(datos, nivel === NIVEL_ROL.CLIENTE);

  if (error) return respuestaError(error, 400);
  if (`${datos.nombre} ${datos.apellido}`.length > 150)
    return respuestaError(
      "El nombre completo no debe superar 150 caracteres",
      400,
    );
  if (await prisma.persona.findUnique({ where: { ci: datos.ci } }))
    return respuestaError(
      "El CI ya tiene una ficha registrada. Solicite al administrador la habilitación de su cuenta.",
      409,
    );

  const existente = await prisma.usuario.findFirst({
    where: { OR: [{ correo: datos.correo }, { ci: datos.ci }] },
    select: { correo: true },
  });

  if (existente) {
    return respuestaError(
      existente.correo === datos.correo
        ? "El correo ya tiene una cuenta registrada"
        : "El carnet de identidad ya tiene una cuenta registrada",
      409,
    );
  }

  const rol = await prisma.rol.findUnique({ where: { nivel } });

  if (!rol) return respuestaError("El rol no existe", 500);

  if (nivel !== 4 && !sucursal)
    return respuestaError("Seleccione la sucursal del empleado", 400);
  const hash = await bcrypt.hash(datos.password, 10);
  const usuario = await prisma.$transaction(async (tx) => {
    // Una cuenta pública nunca reclama una persona registrada previamente por CI.
    const persona = await tx.persona.create({
      data: {
        nombre: `${datos.nombre} ${datos.apellido}`,
        ci: datos.ci,
        correo: datos.correo,
        telefono: datos.telefono || null,
      },
    });
    if (nivel === 4)
      await tx.cliente.create({ data: { id_cliente: persona.id_persona } });
    else {
      const cargo = await tx.cargo.findUniqueOrThrow({
        where: {
          nombre:
            nivel === 1
              ? "administrador"
              : nivel === 2
                ? "recepcionista"
                : "encargado_almacenes",
        },
      });
      await tx.empleado.create({
        data: {
          id_empleado: persona.id_persona,
          id_cargo: cargo.id_cargo,
          id_sucursal: BigInt(sucursal!),
          usuario: datos.correo,
          password_hash: hash,
        },
      });
    }
    return tx.usuario.create({
      data: {
        nombre: datos.nombre,
        apellido: datos.apellido,
        ci: datos.ci,
        correo: datos.correo,
        telefono: datos.telefono || null,
        password: hash,
        rolId: rol.id_rol,
        id_persona: persona.id_persona,
      },
      select: { id: true, nombre: true, apellido: true, correo: true },
    });
  });

  return respuestaOk("Cuenta registrada correctamente", { usuario }, 201);
}
