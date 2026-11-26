"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "@/components/inicio_sesion/LoginForm.module.css";
import AuthButton from "./AuthButton";
import AuthLayout from "./AuthLayout";
import Captcha from "./Captcha";
import { postJson } from "@/lib/api";
import { rutaPanel } from "@/lib/paneles";

const LoginForm = () => {
  const router = useRouter();

  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
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

    const respuesta = await postJson<{ usuario: { nivel: number } }>(
      "/api/auth/login",
      {
        correo,
        password,
        captcha: captchaToken,
      },
    );

    setCargando(false);

    if (!respuesta.ok) {
      setErrorMessage(respuesta.message);
      refrescarCaptcha();
      return;
    }

    router.push(rutaPanel(respuesta.data?.usuario.nivel ?? 0));
    router.refresh();
  }

  return (
    <AuthLayout
      title="INICIAR SESIÓN"
      onSubmit={login}
      showWelcome
      showPublicHeader
      centered={false}
    >
      <p className={styles.intro}>¡Bienvenido de nuevo!</p>
      <div className={styles.inputGroup}>
        <label className={styles.label} htmlFor="correo">
          Correo Electrónico
        </label>
        <input
          id="correo"
          type="email"
          placeholder="ejemplo@ejemplo.com"
          autoComplete="email"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
        />
      </div>
      <div className={styles.inputGroup}>
        <label className={styles.label} htmlFor="password">
          Contraseña
        </label>
        <div className={styles.passwordField}>
          <input
            id="password"
            type={mostrarPassword ? "text" : "password"}
            placeholder="••••••••••••"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            className={styles.passwordToggle}
            aria-label={
              mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"
            }
            aria-pressed={mostrarPassword}
            aria-controls="password"
            onClick={() => setMostrarPassword((visible) => !visible)}
          >
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
              <circle cx="12" cy="12" r="3" />
              {mostrarPassword && <path d="m3 3 18 18" />}
            </svg>
          </button>
        </div>
      </div>
      <p className={styles.textoEnlace}>
        <span>¿Olvidaste tu contraseña?</span>
        <Link className={styles.enlace} href="/password">
          Recuperar Contraseña
        </Link>
      </p>
      <Captcha onChange={setCaptchaToken} refreshKey={captchaKey} />
      {errorMessage && (
        <p role="alert" className={styles.errorText}>
          {errorMessage}
        </p>
      )}
      <AuthButton text="Iniciar Sesión" type="submit" disabled={cargando} />
    </AuthLayout>
  );
};
export default LoginForm;
