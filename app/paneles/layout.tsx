import { redirect } from "next/navigation";
import { obtenerUsuarioSesion } from "@/lib/sesion";

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await obtenerUsuarioSesion())) redirect("/login");
  return children;
}
