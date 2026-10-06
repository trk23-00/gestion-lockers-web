"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/components/inicio_sesion/Perfil.module.css";
import AuthButton from "./AuthButton";
import { getJson, postJson } from "@/lib/api";

type UsuarioPerfil = {
  nombre: string;
  apellido: string;
  ci: string;
  correo: string;
  telefono: string | null;
  rol: string;
};

type Props = {
  onClose: () => void;
};

const Perfil = ({ onClose }: Props) => {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);

  const [usuario, setUsuario] = useState<UsuarioPerfil | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function cargarPerfil() {
      const respuesta = await getJson<{ usuario: UsuarioPerfil }>("/api/auth/me");

      if (!respuesta.ok || !respuesta.data) {
        setErrorMessage(respuesta.message);
        return;
      }

      setUsuario(respuesta.data.usuario);
    }

    cargarPerfil();
  }, []);

  useEffect(() => {
    function cerrarAlHacerClickFuera(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    function cerrarConEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    const temporizador = setTimeout(() => {
      document.addEventListener("click", cerrarAlHacerClickFuera);
    }, 0);

    document.addEventListener("keydown", cerrarConEscape);

    return () => {
      clearTimeout(temporizador);
      document.removeEventListener("click", cerrarAlHacerClickFuera);
      document.removeEventListener("keydown", cerrarConEscape);
    };
  }, [onClose]);

  async function cerrarSesion() {
    await postJson("/api/auth/logout", {});

    router.push("/login");
    router.refresh();
  }

  function modificarContraseña() {
    router.push("/password");
  }

  const datos = usuario
    ? [
        { etiqueta: "Carnet de Identidad", valor: usuario.ci },
        { etiqueta: "Correo Electrónico", valor: usuario.correo },
        ...(usuario.telefono ? [{ etiqueta: "Número de Celular", valor: usuario.telefono }] : []),
      ]
    : [];

  return (
    <div className={styles.perfil} ref={panelRef} role="dialog" aria-label="Perfil de usuario">
      <div className={styles.cabecera}>
        <div className={styles.avatar}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21a8 8 0 0 1 16 0" />
          </svg>
        </div>

        {usuario && (
          <>
            <h2 className={styles.nombre}>
              {usuario.nombre} {usuario.apellido}
            </h2>
            <span className={styles.rol}>{usuario.rol}</span>
          </>
        )}
      </div>

      {!usuario && !errorMessage && <p className={styles.cargando}>Cargando...</p>}

      {errorMessage && <p className={styles.errorText}>{errorMessage}</p>}

      {usuario && (
        <>
          <div className={styles.datos}>
            {datos.map((dato) => (
              <div className={styles.dato} key={dato.etiqueta}>
                <span className={styles.etiqueta}>{dato.etiqueta}</span>
                <span className={styles.valor}>{dato.valor}</span>
              </div>
            ))}
          </div>

          <div className={styles.acciones}>
            <AuthButton text="Modificar contraseña" onClick={modificarContraseña} />
            <AuthButton text="Cerrar sesión" onClick={cerrarSesion} />
          </div>
        </>
      )}
    </div>
  );
};

export default Perfil;
