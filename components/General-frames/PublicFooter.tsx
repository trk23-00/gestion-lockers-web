import Image from "next/image";
import styles from "./PublicSite.module.css";

export default function PublicFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerGrid}>
        <div className={styles.footerIdentity}>
          <a href="#inicio" className={`${styles.brand} ${styles.footerBrand}`} aria-label="Cofre Express, inicio">
            <Image src="/cofre/logo.png" width={137} height={137} alt="" />
            <span>COFRE<br />EXPRESS</span>
          </a>
          <p>Almacenamiento de paquetes seguro, rápido y moderno</p>
        </div>
        <div className={styles.branches}>
          <h2>Sucursales</h2>
          <ul>
            <li>Av. Mariscal Santa Cruz, calle Oruro #110</li>
            <li>Av. 6 de Marzo, entre calles 1 y 2</li>
          </ul>
        </div>
        <div className={styles.social}>
          <h2>Síguenos</h2>
          <div className={styles.socialItems}>
            <div><span><Image src="/cofre/tiktok.png" width={36} height={36} alt="" /></span><p>TIK TOK</p></div>
            <div><span><Image src="/cofre/facebook.png" width={36} height={36} alt="" /></span><p>FACEBOOK</p></div>
          </div>
        </div>
      </div>
      <p className={styles.copyright}>© 2026 Cofre Express. Todos los derechos reservados.</p>
    </footer>
  );
}
