export const NIVEL_ROL = {
  ADMINISTRADOR: 1,
  RECEPCIONISTA: 2,
  ALMACENERO: 3,
  CLIENTE: 4,
} as const;

export const MIN_PASSWORD = 6;

const REGEX_CI = /^\d{5,10}$/;
const REGEX_TELEFONO = /^[67]\d{7}$/;
const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type DatosUsuario = {
  nombre: string;
  apellido: string;
  ci: string;
  correo: string;
  password: string;
  telefono?: string;
};

export function texto(valor: unknown) {
  return typeof valor === "string" ? valor.trim() : "";
}

export function leerCorreo(valor: unknown) {
  return texto(valor).toLowerCase();
}

export function leerPassword(valor: unknown) {
  return typeof valor === "string" ? valor : "";
}

export function leerDatosUsuario(body: Record<string, unknown>): DatosUsuario {
  return {
    nombre: texto(body.nombre),
    apellido: texto(body.apellido),
    ci: texto(body.ci),
    correo: leerCorreo(body.correo),
    telefono: texto(body.telefono),
    password: leerPassword(body.password),
  };
}

export function validarPassword(password: string) {
  if (password.length < MIN_PASSWORD) {
    return `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres`;
  }

  return null;
}

export function validarUsuario(datos: DatosUsuario, requiereTelefono: boolean) {
  const nombre = datos.nombre.trim();
  const apellido = datos.apellido.trim();
  const ci = datos.ci.trim();
  const correo = datos.correo.trim();
  const telefono = (datos.telefono ?? "").trim();

  if (!nombre || !apellido || !ci || !correo || !datos.password || (requiereTelefono && !telefono)) {
    return "Debe llenar todos los campos";
  }

  if (!REGEX_CI.test(ci)) {
    return "El carnet de identidad debe tener entre 5 y 10 dígitos";
  }

  if (requiereTelefono && !REGEX_TELEFONO.test(telefono)) {
    return "El número de celular debe tener 8 dígitos y empezar con 6 o 7";
  }

  if (!REGEX_CORREO.test(correo)) {
    return "El correo electrónico no es válido";
  }

  return validarPassword(datos.password);
}
