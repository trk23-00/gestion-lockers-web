"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "@/components/inicio_sesion/PasswordForm.module.css";
import AuthButton from "./AuthButton";
import AuthLayout from "./AuthLayout";
import { postJson } from "@/lib/api";

const PasswordForm = () => {
  const router = useRouter();

  const [correo, setCorreo] = useState("");
  const [codigo, setCodigo] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [cargando, setCargando] = useState(false);

  async function enviarCodigo() {
    setSuccessMessage("");

    if (!correo.trim()) {
      setErrorMessage("Debe ingresar su correo electrónico");
      return;
    }

    setErrorMessage("");
    setCargando(true);

    const respuesta = await postJson("/api/auth/forgot-password", { correo });

    setCargando(false);

    if (!respuesta.ok) {
      setErrorMessage(respuesta.message);
      return;
    }

    setSuccessMessage(respuesta.message);
  }

  async function verificarCodigo() {
    setSuccessMessage("");

    if (!correo.trim() || !codigo.trim()) {
      setErrorMessage("Debe ingresar su correo y el código");
      return;
    }

    setErrorMessage("");
    setCargando(true);

    const respuesta = await postJson("/api/auth/verificar-codigo", { correo, codigo });

    setCargando(false);

    if (!respuesta.ok) {
      setErrorMessage(respuesta.message);
      return;
    }

    router.push("/recuperar");
  }

  return (
    <AuthLayout title="RECUPERAR CONTRASEÑA">
      <div className={styles.inputGroup}>
        <label className={styles.label} htmlFor="correo">
          Correo Electrónico
        </label>
        <input
          id="correo"
          type="email"
          autoComplete="email"
          placeholder="Ingresa tu correo electrónico"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
        />
      </div>

      <div className={styles.inputGroup}>
        <label className={styles.label} htmlFor="codigo">
          Código
        </label>
        <input
          id="codigo"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="Ingresa el código"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
        />
      </div>

      {errorMessage && <p className={styles.errorText}>{errorMessage}</p>}

      {successMessage && <p className={styles.successText}>{successMessage}</p>}

      <AuthButton text="Enviar Código" onClick={enviarCodigo} disabled={cargando} />

      <AuthButton text="Verificar Código" onClick={verificarCodigo} disabled={cargando} />

      <Link className={styles.enlace} href="/login">
        Regresar
      </Link>
    </AuthLayout>
  );
};

export default PasswordForm;
