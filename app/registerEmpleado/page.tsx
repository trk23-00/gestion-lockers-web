import { redirect } from "next/navigation";
import RegisterForm from "@/components/inicio_sesion/RegisterForm";
import { prisma } from "@/lib/prisma";
import { obtenerUsuarioSesion } from "@/lib/sesion";
import { rutaPanel } from "@/lib/paneles";
import { esAdministrador, NIVEL_SUPERADMINISTRADOR } from "@/lib/roles";

export default async function RegistroEmpleado() {
  const usuario = await obtenerUsuarioSesion();
  if (!usuario) redirect("/login");
  if (!esAdministrador(usuario.rol.nivel))
    redirect(rutaPanel(usuario.rol.nivel));

  const sucursales = await prisma.sucursal.findMany({
    where: { activa: true },
    select: { id_sucursal: true, nombre: true },
    orderBy: { nombre: "asc" },
  });

  return (
    <RegisterForm
      puedeCrearAdministrador={usuario.rol.nivel === NIVEL_SUPERADMINISTRADOR}
      sucursales={sucursales.map(({ id_sucursal, nombre }) => ({
        id: String(id_sucursal),
        nombre,
      }))}
    />
  );
}
