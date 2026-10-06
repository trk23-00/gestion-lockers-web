"use client";

import { useState, type ChangeEvent } from "react";
import styles from "@/components/inicio_sesion/RegisterForm.module.css";
import AuthButton from "./AuthButton";
import AuthLayout from "./AuthLayout";
import { postJson } from "@/lib/api";
import { NIVEL_ROL, validarUsuario } from "@/lib/validaciones";

const FORMULARIO_INICIAL = {
  nombre: "",
  apellido: "",
  ci: "",
  correo: "",
  password: "",
};

const RegisterForm = () => {
  const [formulario, setFormulario] = useState(FORMULARIO_INICIAL);
  const [nivel, setNivel] = useState<number>(NIVEL_ROL.RECEPCIONISTA);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [cargando, setCargando] = useState(false);

  function actualizar(campo: keyof typeof FORMULARIO_INICIAL) {
    return (e: ChangeEvent<HTMLInputElement>) =>
      setFormulario((actual) => ({ ...actual, [campo]: e.target.value }));
  }

  async function register() {
    setSuccessMessage("");

    const error = validarUsuario(formulario, false);

    if (error) {
      setErrorMessage(error);
      return;
    }

    setErrorMessage("");
    setCargando(true);

    const respuesta = await postJson("/api/auth/register-empleado", { ...formulario, nivel });

    setCargando(false);

    if (!respuesta.ok) {
      setErrorMessage(respuesta.message);
      return;
    }

    setSuccessMessage("Cuenta registrada correctamente");
    setFormulario(FORMULARIO_INICIAL);
  }

  return (
    <AuthLayout title="CREAR CUENTA DE EMPLEADO" onSubmit={register}>
      <div className={styles.inputGroup}>
        <label className={styles.label} htmlFor="nombre">
          Nombre
        </label>
        <input
          id="nombre"
          type="text"
          placeholder="Ingresa nombre del empleado"
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
          placeholder="Ingresa los apellidos del empleado"
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
          placeholder="Ingresa el número de CI del empleado"
          value={formulario.ci}
          onChange={actualizar("ci")}
        />
      </div>

      <div className={styles.inputGroup}>
        <label className={styles.label} htmlFor="correo">
          Correo Electrónico
        </label>
        <input
          id="correo"
          type="email"
          placeholder="Ingresa el correo electrónico del empleado"
          value={formulario.correo}
          onChange={actualizar("correo")}
        />
      </div>

      <div className={styles.inputGroup}>
        <label className={styles.label} htmlFor="cargo">
          Cargo
        </label>
        <select id="cargo" value={nivel} onChange={(e) => setNivel(Number(e.target.value))}>
          <option value={NIVEL_ROL.RECEPCIONISTA}>Recepcionista</option>
          <option value={NIVEL_ROL.ALMACENERO}>Almacenero</option>
        </select>
      </div>

      <div className={styles.inputGroup}>
        <label className={styles.label} htmlFor="password">
          Contraseña
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          placeholder="Ingresa una contraseña para el empleado"
          value={formulario.password}
          onChange={actualizar("password")}
        />
      </div>

      {errorMessage && <p className={styles.errorText}>{errorMessage}</p>}

      {successMessage && <p className={styles.successText}>{successMessage}</p>}

      <AuthButton text="Registrarse" type="submit" disabled={cargando} />
    </AuthLayout>
  );
};

export default RegisterForm;
