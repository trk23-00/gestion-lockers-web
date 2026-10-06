"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/components/inicio_sesion/RecuperarContraseña.module.css";
import AuthButton from "./AuthButton";
import AuthLayout from "./AuthLayout";
import { postJson } from "@/lib/api";
import { validarPassword } from "@/lib/validaciones";

const RecuperarContraseña = () => {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [cargando, setCargando] = useState(false);

  const passwordsMatch = password === confirmPassword;

  async function recuperarContraseña() {
    if (!password || !confirmPassword) {
      setErrorMessage("Debe llenar todos los campos");
      return;
    }

    if (!passwordsMatch) {
      setErrorMessage("Las contraseñas no coinciden");
      return;
    }

    const errorPassword = validarPassword(password);

    if (errorPassword) {
      setErrorMessage(errorPassword);
      return;
    }

    setErrorMessage("");
    setCargando(true);

    const respuesta = await postJson("/api/auth/recuperar", { password });

    setCargando(false);

    if (!respuesta.ok) {
      setErrorMessage(respuesta.message);
      return;
    }

    router.push("/login");
  }

  return (
    <AuthLayout title="NUEVA CONTRASEÑA" onSubmit={recuperarContraseña}>
      <div className={styles.inputGroup}>
        <label className={styles.label} htmlFor="password">
          Contraseña Nueva
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          placeholder="Ingresa tu nueva contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <div className={styles.inputGroup}>
        <label className={styles.label} htmlFor="confirmPassword">
          Confirmar Contraseña
        </label>
        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          placeholder="Confirma tu nueva contraseña"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </div>

      {confirmPassword.length > 0 && !passwordsMatch && (
        <p className={styles.errorText}>Las contraseñas no coinciden</p>
      )}

      {confirmPassword.length > 0 && passwordsMatch && (
        <p className={styles.successText}>Las contraseñas coinciden</p>
      )}

      {errorMessage && <p className={styles.errorText}>{errorMessage}</p>}

      <AuthButton text="Actualizar Contraseña" type="submit" disabled={cargando} />
    </AuthLayout>
  );
};

export default RecuperarContraseña;
