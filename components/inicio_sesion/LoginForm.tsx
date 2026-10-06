"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "@/components/inicio_sesion/LoginForm.module.css";
import AuthButton from "./AuthButton";
import AuthLayout from "./AuthLayout";
import Captcha from "./Captcha";
import { postJson } from "@/lib/api";

const LoginForm = () => {
  const router = useRouter();

  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [cargando, setCargando] = useState(false);

  function refrescarCaptcha() {
    setCaptchaToken(null);
    setCaptchaKey((key) => key + 1);
  }

  async function login() {
    if (!correo.trim() || !password) {
      setErrorMessage("Debe llenar todos los campos");
      return;
    }

    if (!captchaToken) {
      setErrorMessage("Debe completar el captcha");
      return;
    }

    setErrorMessage("");
    setCargando(true);

    const respuesta = await postJson("/api/auth/login", {
      correo,
      password,
      captcha: captchaToken,
    });

    setCargando(false);

    if (!respuesta.ok) {
      setErrorMessage(respuesta.message);
      refrescarCaptcha();
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <AuthLayout title="INICIAR SESIÓN" onSubmit={login}>
      <div className={styles.inputGroup}>
        <label className={styles.label} htmlFor="correo">
          Correo Electrónico
        </label>

        <input
          id="correo"
          type="email"
          placeholder="Ingresa tu correo electrónico"
          autoComplete="email"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
        />
      </div>

      <div className={styles.inputGroup}>
        <label className={styles.label} htmlFor="password">
          Contraseña
        </label>

        <input
          id="password"
          type="password"
          placeholder="Ingresa tu contraseña"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <Captcha onChange={setCaptchaToken} refreshKey={captchaKey} />

      {errorMessage && <p className={styles.errorText}>{errorMessage}</p>}

      <p className={styles.textoEnlace}>
        ¿Olvidaste tu contraseña?
        <Link className={styles.enlace} href="/password">
          Recuperar contraseña
        </Link>
      </p>

      <AuthButton text="Iniciar Sesión" type="submit" disabled={cargando} />
    </AuthLayout>
  );
};

export default LoginForm;