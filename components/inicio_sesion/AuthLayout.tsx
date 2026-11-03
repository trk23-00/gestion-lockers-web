import type { FormEvent, ReactNode } from "react";
import styles from "./AuthLayout.module.css";
import Logo from "./Logo";

type Props = { title: string; children: ReactNode; onSubmit?: () => void; variant?: "default" | "wide" };
export default function AuthLayout({ title, children, onSubmit, variant = "default" }: Props) {
  function manejarEnvio(e: FormEvent<HTMLFormElement>) { e.preventDefault(); onSubmit?.(); }
  return (
    <main className={styles.authPage}>
      <aside className={styles.illustration} aria-label="Sistema de almacenamiento de paquetes">
        <div className={styles.welcome}>
          <span className={styles.eyebrow}>BIENVENIDOS</span>
          <h2>AL SISTEMA DE GESTIÓN DE ALMACENAMIENTO DE PAQUETES</h2>
          <p>Organiza, almacena y administra cada entrega con confianza.</p>
        </div>
      </aside>
      <section className={styles.formArea}>
        <Logo />
        <form className={`${styles.authContainer} ${variant === "wide" ? styles.wide : ""}`} onSubmit={manejarEnvio} noValidate>
          <h1 className={styles.tituloAuth}>{title}</h1>
          {children}
        </form>
      </section>
    </main>
  );
}
