import type { FormEvent, ReactNode } from "react";
import PublicHeader from "@/components/General-frames/PublicHeader";
import styles from "./AuthLayout.module.css";
import Logo from "./Logo";

type Props = {
  title: string;
  children: ReactNode;
  onSubmit?: () => void;
  variant?: "default" | "wide";
  showWelcome?: boolean;
  showPublicHeader?: boolean;
  centered?: boolean;
};

export default function AuthLayout({
  title,
  children,
  onSubmit,
  variant = "default",
  showWelcome = false,
  showPublicHeader = false,
  centered = true,
}: Props) {
  function manejarEnvio(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onSubmit?.();
  }

  const pageClasses = [
    styles.authPage,
    showPublicHeader ? styles.pageWithHeader : "",
    centered ? styles.centered : "",
  ]
    .filter(Boolean)
    .join(" ");

  const formAreaClasses = [
    styles.formArea,
    variant === "wide" ? styles.formAreaWide : "",
    centered ? styles.formAreaCentered : "",
    centered && variant === "wide" ? styles.formAreaCenteredWide : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={styles.authShell}>
      {showPublicHeader && (
        <div className={styles.publicHeaderScope}>
          <PublicHeader section="inicio" basePath="/" />
        </div>
      )}
      <main className={pageClasses}>
        {showWelcome && (
          <aside
            className={styles.illustration}
            aria-label="Sistema de almacenamiento de paquetes"
          >
            <div className={styles.welcome}>
              <span className={styles.eyebrow}>BIENVENIDOS</span>
              <h2>AL SISTEMA DE GESTIÓN DE ALMACENAMIENTO DE PAQUETES</h2>
              <p>
                Organiza, almacena y administra cada entrega con confianza.
              </p>
            </div>
          </aside>
        )}
        <section className={formAreaClasses}>
          <Logo />
          <form
            className={`${styles.authContainer} ${variant === "wide" ? styles.wide : ""}`}
            onSubmit={manejarEnvio}
            noValidate
          >
            <h1 className={styles.tituloAuth}>{title}</h1>
            {children}
          </form>
        </section>
      </main>
    </div>
  );
}
