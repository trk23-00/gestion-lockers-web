import Image from "next/image";
import styles from "./PublicSite.module.css";

export default function AboutPanel() {
  return (
    <section className={styles.about} aria-labelledby="about-title">
      <div className={`${styles.sectionHeading} ${styles.aboutHeading}`}>
        <span className={styles.eyebrow}><Image src="/cofre/contact.svg" alt="" width={32} height={32} />Contáctanos</span>
        <h1 id="about-title">Estamos para <span>ayudarte</span></h1>
        <p>Escríbenos, llámanos o visítanos. Resolvemos tus dudas sobre casilleros, retiros y espacios a medida.</p>
      </div>
      <div className={styles.contacts}>
        <h2>Contáctanos</h2>
        <div className={styles.contactGrid}>
          <a className={styles.contactCard} href="tel:+59174271630">
            <span className={`${styles.contactIcon} ${styles.orange}`}><Image src="/cofre/contact-person.png" alt="" width={59} height={36} /></span>
            <span><small>Num1</small><strong>Tel: 74271630</strong></span>
          </a>
          <a className={styles.contactCard} href="tel:+59175214830">
            <span className={`${styles.contactIcon} ${styles.yellow}`}><Image src="/cofre/contact-person.png" alt="" width={59} height={36} /></span>
            <span><small>Num2</small><strong>Tel: 75214830</strong></span>
          </a>
        </div>
        <h2>Escríbenos</h2>
        <div className={`${styles.contactGrid} ${styles.addressGrid}`}>
          <a className={styles.contactCard} href="tel:+59164282126">
            <span className={`${styles.contactIcon} ${styles.orange}`}><Image src="/cofre/phone.svg" alt="" width={32} height={32} /></span>
            <span><small>Teléfono</small><strong>+64282126</strong></span>
          </a>
          <div className={`${styles.contactCard} ${styles.addressCard}`}>
            <span className={`${styles.contactIcon} ${styles.yellow}`}><Image src="/cofre/location.svg" alt="" width={32} height={32} /></span>
            <span><small>Dirección</small><address>Av. Mariscal Santa Cruz, calle Oruro #110</address></span>
          </div>
        </div>
      </div>
      <div className={styles.purpose}>
        <section className={styles.mission} aria-labelledby="mission-title">
          <div><h2 id="mission-title">Misión</h2><p>Brindar un servicio confiable de resguardo temporal de mercancías para comerciantes y compradores mediante puntos de recepción seguros y una plataforma web con códigos QR, garantizando la trazabilidad de cada paquete y una gestión eficiente de los espacios.</p></div>
          <Image src="/cofre/mission.png" alt="Entrega de un paquete a una clienta" width={482} height={244} sizes="(max-width: 700px) 85vw, 26vw" />
        </section>
        <section className={styles.vision} aria-labelledby="vision-title">
          <Image src="/cofre/vision.png" alt="Gestión de paquetes y existencias en un almacén" width={600} height={330} sizes="(max-width: 700px) 85vw, 32vw" />
          <div><h2 id="vision-title">Visión</h2><p>Convertirse en la empresa líder en soluciones de almacenamiento temporal y logística de último tramo para el comercio digital, destacando por su modernización tecnológica, seguridad y optimización en la entrega de encomiendas.</p></div>
        </section>
      </div>
    </section>
  );
}
