import type { FormEvent, ReactNode } from "react";
import styles from "@/components/inicio_sesion/AuthLayout.module.css";
import Logo from "@/components/inicio_sesion/Logo";

type Props = {
  title: string;
  children: ReactNode;
  onSubmit?: () => void;
};

const AuthLayout = ({ title, children, onSubmit }: Props) => {
  function manejarEnvio(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit?.();
  }

  return (
    <main className={styles.authPage}>
      <Logo />
      <form className={styles.authContainer} onSubmit={manejarEnvio} noValidate>
        <h1 className={styles.tituloAuth}>{title}</h1>
        {children}
      </form>
    </main>
  );
};

export default AuthLayout;
