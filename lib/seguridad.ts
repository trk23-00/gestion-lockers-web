import { createHmac, timingSafeEqual } from "crypto";

export const COOKIES = {
  SESION: "usuario",
  CODIGO: "recuperacion_codigo",
  RESET: "recuperacion_reset",
} as const;

function obtenerSecreto() {
  const secreto = process.env.AUTH_SECRET;

  if (!secreto) {
    throw new Error("La variable de entorno AUTH_SECRET no está definida");
  }

  return secreto;
}

function firmar(valor: string) {
  return createHmac("sha256", obtenerSecreto()).update(valor).digest("hex");
}

function firmasIguales(a: string, b: string) {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);

  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
}

export function crearToken(dominio: string, datos: string, vigenciaSegundos: number) {
  const expira = Date.now() + vigenciaSegundos * 1000;

  return `${expira}.${firmar(`${dominio}:${datos}:${expira}`)}`;
}

export function tokenValido(token: string | undefined, dominio: string, datos: string) {
  if (!token) return false;

  const [expiraTexto, firma] = token.split(".");
  const expira = Number(expiraTexto);

  if (!firma || !Number.isFinite(expira) || expira < Date.now()) return false;

  return firmasIguales(firma, firmar(`${dominio}:${datos}:${expira}`));
}

export function crearTokenConDato(dominio: string, dato: string, vigenciaSegundos: number) {
  const codificado = Buffer.from(dato).toString("base64url");

  return `${codificado}.${crearToken(dominio, dato, vigenciaSegundos)}`;
}

export function leerTokenConDato(valor: string | undefined, dominio: string) {
  if (!valor) return null;

  const separador = valor.indexOf(".");

  if (separador < 1) return null;

  const dato = Buffer.from(valor.slice(0, separador), "base64url").toString();

  return tokenValido(valor.slice(separador + 1), dominio, dato) ? dato : null;
}

export function opcionesCookie(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}