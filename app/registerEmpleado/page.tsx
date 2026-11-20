import { redirect } from "next/navigation";
import RegisterForm from "@/components/inicio_sesion/RegisterForm";
import { prisma } from "@/lib/prisma";
import { obtenerUsuarioSesion } from "@/lib/sesion";
import { rutaPanel } from "@/lib/paneles";
import { NIVEL_ROL } from "@/lib/validaciones";

export default async function RegistroEmpleado() {
  const usuario = await obtenerUsuarioSesion();
  if (!usuario) redirect("/login");
  if (usuario.rol.nivel !== NIVEL_ROL.ADMINISTRADOR) redirect(rutaPanel(usuario.rol.nivel));

  const sucursales = await prisma.sucursal.findMany({
    where: { activa: true },
    select: { id_sucursal: true, nombre: true },
    orderBy: { nombre: "asc" },
  });

  return (
    <main className="authPage">
      <RegisterForm sucursales={sucursales.map(({ id_sucursal, nombre }) => ({
        id: String(id_sucursal),
        nombre,
      }))} />
    </main>
  );
}
