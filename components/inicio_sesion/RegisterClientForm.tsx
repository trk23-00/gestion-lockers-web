"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "@/components/inicio_sesion/RegisterClientForm.module.css";
import AuthButton from "./AuthButton";
import AuthLayout from "./AuthLayout";
import { postJson } from "@/lib/api";
import { validarUsuario } from "@/lib/validaciones";

const FORMULARIO_INICIAL = {
  nombre: "",
  apellido: "",
  ci: "",
  telefono: "",
  correo: "",
  password: "",
};

const RegisterClientForm = () => {
  const router = useRouter();

  const [formulario, setFormulario] = useState(FORMULARIO_INICIAL);
  const [errorMessage, setErrorMessage] = useState("");
  const [cargando, setCargando] = useState(false);

  function actualizar(campo: keyof typeof FORMULARIO_INICIAL) {
    return (e: ChangeEvent<HTMLInputElement>) =>
      setFormulario((actual) => ({ ...actual, [campo]: e.target.value }));
  }

  async function register() {
    const error = validarUsuario(formulario, true);

    if (error) {
      setErrorMessage(error);
      return;
    }

    setErrorMessage("");
    setCargando(true);

    const respuesta = await postJson("/api/auth/register", formulario);

    setCargando(false);

    if (!respuesta.ok) {
      setErrorMessage(respuesta.message);
      return;
    }

    router.push("/login");
  }

  return (
    <AuthLayout title="CREAR CUENTA" onSubmit={register}>
      <div className={styles.inputGroup}>
        <label className={styles.label} htmlFor="nombre">
          Nombre
        </label>
        <input
          id="nombre"
          type="text"
          autoComplete="given-name"
          placeholder="Ingresa tu nombre"
          value={formulario.nombre}
          onChange={actualizar("nombre")}
        />
      </div>

      <div className={styles.inputGroup}>
        <label className={styles.label} htmlFor="apellido">
          Apellidos
        </label>
        <input
          id="apellido"
          type="text"
          autoComplete="family-name"
          placeholder="Ingresa tus apellidos"
          value={formulario.apellido}
          onChange={actualizar("apellido")}
        />
      </div>

      <div className={styles.inputGroup}>
        <label className={styles.label} htmlFor="ci">
          Carnet de Identidad
        </label>
        <input
          id="ci"
          type="text"
          inputMode="numeric"
          placeholder="Ingresa tu número de CI"
          value={formulario.ci}
          onChange={actualizar("ci")}
        />
      </div>

      <div className={styles.inputGroup}>
        <label className={styles.label} htmlFor="telefono">
          Número de Celular
        </label>
        <input
          id="telefono"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="Ingresa tu número de celular"
          value={formulario.telefono}
          onChange={actualizar("telefono")}
        />
      </div>

      <div className={styles.inputGroup}>
        <label className={styles.label} htmlFor="correo">
          Correo Electrónico
        </label>
        <input
          id="correo"
          type="email"
          autoComplete="email"
          placeholder="Ingresa tu correo electrónico"
          value={formulario.correo}
          onChange={actualizar("correo")}
        />
      </div>

      <div className={styles.inputGroup}>
        <label className={styles.label} htmlFor="password">
          Contraseña
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          placeholder="Ingresa una contraseña"
          value={formulario.password}
          onChange={actualizar("password")}
        />
      </div>

      {errorMessage && <p className={styles.errorText}>{errorMessage}</p>}

      <p className={styles.textoEnlace}>
        ¿Ya tienes una cuenta?
        <Link className={styles.enlace} href="/login">
          Inicia sesión
        </Link>
      </p>

      <AuthButton text="Registrarse" type="submit" disabled={cargando} />
    </AuthLayout>
  );
};

export default RegisterClientForm;
