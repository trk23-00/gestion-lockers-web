import { randomInt } from "crypto";
import nodemailer from "nodemailer";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { respuestaError, respuestaOk } from "@/lib/api";
import { COOKIES, crearToken, opcionesCookie } from "@/lib/seguridad";
import { obtenerUsuarioSesion } from "@/lib/sesion";
import { leerCorreo } from "@/lib/validaciones";

const VIGENCIA_CODIGO_SEGUNDOS = 600;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const correo = leerCorreo(body.correo);

    if (!correo) {
      return respuestaError("Debe ingresar un correo", 400);
    }

    const sesion = await obtenerUsuarioSesion();
    if (sesion && sesion.correo !== correo) {
      return respuestaError("Use el correo de su cuenta", 403);
    }

    const usuario = await prisma.usuario.findUnique({
      where: { correo },
      select: { id: true, password: true },
    });

    if (!usuario) {
      return respuestaError("No existe una cuenta con ese correo", 404);
    }

    const codigo = randomInt(100000, 1000000).toString();

    const transporter = process.env.SMTP_URL ? nodemailer.createTransport(process.env.SMTP_URL) : nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: correo,
      subject: "Código de recuperación",
      html: `
        <h2>Recuperación de contraseña</h2>
        <p>Tu código es:</p>
        <h1>${codigo}</h1>
        <p>Vence en 10 minutos.</p>
      `,
    });

    const cookieStore = await cookies();

    cookieStore.delete(COOKIES.RESET);
    cookieStore.set(
      COOKIES.CODIGO,
      crearToken("codigo", `${usuario.id}\n${usuario.password}\n${codigo}`, VIGENCIA_CODIGO_SEGUNDOS),
      opcionesCookie(VIGENCIA_CODIGO_SEGUNDOS)
    );

    return respuestaOk("Código enviado correctamente");
  } catch (error) {
    console.error("Error al enviar el código", error instanceof Error ? error.name : "desconocido");

    return respuestaError("Error al enviar el código", 500);
  }
}
