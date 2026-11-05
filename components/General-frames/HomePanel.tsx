import Image from "next/image";
import styles from "./PublicSite.module.css";

const features = [
  { title: "Vigilancia 24/7", detail: "Cámaras y acceso controlado", image: "security", tone: "orange" },
  { title: "Avisos al instante", detail: "Te notificamos al llegar", image: "alert", tone: "orange" },
  { title: "Retiro con QR", detail: "Sin filas ni papeleo", image: "qr", tone: "ochre" },
  { title: "Espacios a medida", detail: "Pequeños, medianos y XL", image: "size", tone: "ochre" },
];

export default function HomePanel() {
  return (
    <div>
      <section className={styles.hero} aria-labelledby="home-title">
        <div className={styles.heroCopy}>
          <h1 id="home-title">Tus paquetes,<br />y siempre a tu<br />alcance</h1>
          <p>Guardamos, protegemos y te avisamos al instante cuando tu paquete está listo para retirar.</p>
        </div>
        <div className={styles.heroIllustration} role="img" aria-label="Seguimiento de paquetes, casilleros y retiro con QR">
          <Image src="/cofre/hero.svg" width={854} height={591} className={styles.heroArtwork} alt="" preload unoptimized />
          <Image src="/cofre/hero-qr.png" width={38} height={38} className={styles.heroQr} alt="" />
          <Image src="/cofre/hero-lockers.png" width={96} height={96} className={styles.heroLockers} alt="" />
          <Image src="/cofre/hero-send.png" width={98} height={98} className={styles.heroSend} alt="" />
        </div>
      </section>
      <section className={styles.features} aria-label="Ventajas del servicio">
        {features.map(feature => (
          <article className={styles.feature} key={feature.title}>
            <span className={`${styles.featureIcon} ${feature.tone === "ochre" ? styles.ochre : styles.orange}`}>
              <Image src={`/cofre/feature-${feature.image}.png`} width={51} height={51} alt="" />
            </span>
            <div><h2>{feature.title}</h2><p>{feature.detail}</p></div>
          </article>
        ))}
      </section>
      <section className={styles.introduction} aria-labelledby="intro-title">
        <Image className={styles.storefront} src="/cofre/storefront.png" width={585} height={696} alt="Local de Cofre Express en la calle Oruro #110, La Paz" sizes="(max-width: 700px) 85vw, 31vw" />
        <div className={styles.introCard}>
          <h2 id="intro-title">Quiénes somos</h2>
          <p>Somos un servicio de lockers que guarda tu paquete por semana hasta que lo puedan recoger. Puedes dejar tu paquete o recogerlo; somos una paquetería accesible y confiable. Únete a nuestros servicios.</p>
        </div>
      </section>
    </div>
  );
}
