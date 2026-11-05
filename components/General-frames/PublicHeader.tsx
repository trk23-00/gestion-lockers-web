import Image from "next/image";
import Link from "next/link";
import type { PublicSection } from "./PanelGeneral";
import styles from "./PublicSite.module.css";

const sections: { id: PublicSection; label: string }[] = [
  { id: "inicio", label: "Inicio" },
  { id: "servicios", label: "Servicios" },
  { id: "nosotros", label: "Nosotros" },
];

export default function PublicHeader({ section }: { section: PublicSection }) {
  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <a href="#inicio" className={styles.brand} aria-label="Cofre Express, inicio">
          <Image src="/cofre/logo.png" width={137} height={137} alt="" preload />
          <span>COFRE<br />EXPRESS</span>
        </a>
        <nav className={styles.navigation} aria-label="Navegación principal">
          {sections.map(({ id, label }) => (
            <a key={id} href={`#${id}`} aria-current={section === id ? "page" : undefined}>{label}</a>
          ))}
        </nav>
        <div className={styles.authLinks}>
          <Link href="/login" className={styles.login}>Iniciar sesión</Link>
          <Link href="/registerCliente" className={styles.register}>Registrarse</Link>
        </div>
      </div>
    </header>
  );
}
