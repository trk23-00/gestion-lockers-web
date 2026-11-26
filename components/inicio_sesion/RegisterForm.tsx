"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
  telefono: "",
  password: "",
};

const destino =
  "/paneles/administrador?seccion=usuarios&vista=Usuarios%20registrados";

const RegisterForm = ({
  sucursales,
  puedeCrearAdministrador = false,
}: {
  sucursales: { id: string; nombre: string }[];
  puedeCrearAdministrador?: boolean;
}) => {
  const router = useRouter();
  const [sucursal, setSucursal] = useState(sucursales[0]?.id ?? "");
  const [formulario, setFormulario] = useState(FORMULARIO_INICIAL);
  const [nivel, setNivel] = useState<number>(NIVEL_ROL.RECEPCIONISTA);
  const [errorMessage, setErrorMessage] = useState("");
  const [cargando, setCargando] = useState(false);

  function actualizar(campo: keyof typeof FORMULARIO_INICIAL) {
    return (e: ChangeEvent<HTMLInputElement>) =>
      setFormulario((actual) => ({ ...actual, [campo]: e.target.value }));
  }

  async function register() {
    const error = validarUsuario(formulario, false);

    if (error) {
      setErrorMessage(error);
      return;
    }

    if (!sucursal) {
      setErrorMessage("Seleccione la sucursal del empleado");
      return;
    }

    setErrorMessage("");
    setCargando(true);

    const respuesta = await postJson("/api/auth/register-empleado", {
      ...formulario,
      nivel,
      id_sucursal: sucursal,
    });

    setCargando(false);

    if (!respuesta.ok) {
      setErrorMessage(respuesta.message);
      return;
    }

    router.push(destino);
  }

  return (
    <AuthLayout
      title="CREAR CUENTA DE EMPLEADO"
      onSubmit={register}
      variant="wide"
      centered
      showWelcome={false}
    >
      <div className={styles.fieldsGrid}>
        <div className={styles.inputGroup}>
          <label className={styles.label} htmlFor="nombre">
            Nombre
          </label>
          <input
            id="nombre"
            type="text"
            placeholder="Nombres"
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
            placeholder="Apellidos"
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
            placeholder="CI del empleado"
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
            placeholder="ejemplo@ejemplo.com"
            value={formulario.correo}
            onChange={actualizar("correo")}
          />
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.label} htmlFor="cargo">
            Cargo
          </label>
          <select
            id="cargo"
            value={nivel}
            onChange={(e) => setNivel(Number(e.target.value))}
          >
            {puedeCrearAdministrador && (
              <option value={NIVEL_ROL.ADMINISTRADOR}>Administrador</option>
            )}
            <option value={NIVEL_ROL.RECEPCIONISTA}>Recepcionista</option>
            <option value={NIVEL_ROL.ALMACENERO}>Almacenero</option>
          </select>
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.label} htmlFor="sucursal">
            Sucursal
          </label>
          <select
            id="sucursal"
            value={sucursal}
            onChange={(e) => setSucursal(e.target.value)}
            required
          >
            {sucursales.map(({ id, nombre }) => (
              <option key={id} value={id}>
                {nombre}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.label} htmlFor="telefono">
            Teléfono (opcional)
          </label>
          <input
            id="telefono"
            type="tel"
            autoComplete="tel"
            value={formulario.telefono}
            onChange={actualizar("telefono")}
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
            placeholder="••••••••••••"
            value={formulario.password}
            onChange={actualizar("password")}
          />
        </div>
      </div>

      {errorMessage && <p className={styles.errorText}>{errorMessage}</p>}

      {!sucursales.length && (
        <p className={styles.errorText}>No hay sucursales activas.</p>
      )}

      <AuthButton
        text="Crear Cuenta"
        type="submit"
        disabled={cargando || !sucursal}
      />
      <Link href={destino}>Regresar</Link>
    </AuthLayout>
  );
};

export default RegisterForm;
