import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  COOKIES,
  crearTokenConDato,
  leerTokenConDato,
  opcionesCookie,
} from "@/lib/seguridad";

const VIGENCIA_SESION_SEGUNDOS = 60 * 60 * 24;

export async function iniciarSesion(id: number) {
  const cookieStore = await cookies();

  cookieStore.set(
    COOKIES.SESION,
    crearTokenConDato("sesion", String(id), VIGENCIA_SESION_SEGUNDOS),
    opcionesCookie(VIGENCIA_SESION_SEGUNDOS),
  );
}

export async function cerrarSesion() {
  const cookieStore = await cookies();

  cookieStore.delete(COOKIES.SESION);
}

export async function obtenerUsuarioSesion() {
  const cookieStore = await cookies();
  const dato = leerTokenConDato(
    cookieStore.get(COOKIES.SESION)?.value,
    "sesion",
  );
  const id = Number(dato);

  if (!dato || !Number.isInteger(id)) return null;

  const usuario = await prisma.usuario.findUnique({
    where: { id },
    select: {
      id: true,
      nombre: true,
      apellido: true,
      ci: true,
      correo: true,
      telefono: true,
      activo: true,
      id_persona: true,
      persona: {
        select: {
          activo: true,
          empleado: { select: { id_sucursal: true, activo: true } },
        },
      },
      rol: { select: { nombre_rol: true, nivel: true } },
    },
  });
  return usuario?.activo &&
    usuario.persona.activo &&
    (usuario.rol.nivel === 4 || usuario.persona.empleado?.activo)
    ? usuario
    : null;
}
