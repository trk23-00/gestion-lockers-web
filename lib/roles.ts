export const NIVEL_SUPERADMINISTRADOR = 5;

export function esAdministrador(nivel: number) {
  return nivel === 1 || nivel === NIVEL_SUPERADMINISTRADOR;
}

export function nivelOperativo(nivel: number) {
  return nivel === NIVEL_SUPERADMINISTRADOR ? 1 : nivel;
}
