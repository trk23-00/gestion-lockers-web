import Image from "next/image";
import publicStyles from "./PublicSite.module.css";
import sgapStyles from "./SgapFooter.module.css";

export default function PublicFooter({
  variant = "public",
}: {
  variant?: "public" | "sgap";
}) {
  const styles = variant === "sgap" ? sgapStyles : publicStyles;
  const mapStyle = {
    color: variant === "sgap" ? "var(--brand)" : "#0000FF",
    textDecoration: "underline",
  };
  return (
    <footer className={styles.footer}>
      <div className={styles.footerGrid}>
        <div className={styles.footerIdentity}>
          <a
            href={variant === "sgap" ? "/" : "#inicio"}
            className={`${styles.brand} ${styles.footerBrand}`}
            aria-label="Cofre Express, inicio"
          >
            <Image src="/cofre/logo.png" width={137} height={137} alt="" />
            <span>
              COFRE
              <br />
              EXPRESS
            </span>
          </a>
          <p>Almacenamiento de paquetes seguro, rápido y moderno</p>
        </div>
        <div className={styles.branches}>
          <h2>Sucursales</h2>
          <ul>
            <li>Av. Mariscal Santa Cruz, calle Oruro #110</li>
            <a
              href="https://maps.app.goo.gl/tpNdXHxQxD8dFU6Q7"
              target="_blank"
              rel="noopener noreferrer"
              style={mapStyle}
            >
              Ver Mapa
            </a>
            <li>Av. 6 de Marzo, entre calles 2 y 3</li>
            <a
              href="https://maps.app.goo.gl/yXKMzWohVQL6E2xf8"
              target="_blank"
              rel="noopener noreferrer"
              style={mapStyle}
            >
              Ver Mapa
            </a>
          </ul>
        </div>
        <div className={styles.social}>
          <h2>Síguenos</h2>
          <div className={styles.socialItems}>
            <a
              href="https://www.tiktok.com/@el.cofre.express?is_from_webapp=1&sender_device=pc"
              target="_blank"
            >
              <div>
                <span>
                  <Image
                    src="/cofre/tiktok.png"
                    width={36}
                    height={36}
                    alt=""
                  />
                </span>
                <p>TIK TOK</p>
              </div>
            </a>
            <a href="https://wa.me/64282126" target="_blank">
              <div>
                <span>
                  <Image
                    src="/cofre/whatsapp.png"
                    width={36}
                    height={36}
                    alt=""
                  />
                </span>
                <p>LA PAZ</p>
              </div>
            </a>
            <a href="https://wa.me/57014955" target="_blank">
              <div>
                <span>
                  <Image
                    src="/cofre/whatsapp.png"
                    width={36}
                    height={36}
                    alt=""
                  />
                </span>
                <p>EL ALTO</p>
              </div>
            </a>
          </div>
        </div>
      </div>
      <p className={styles.copyright}>
        © 2026 Cofre Express. Todos los derechos reservados.
      </p>
    </footer>
  );
}
