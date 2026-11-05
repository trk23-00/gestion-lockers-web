import Image from "next/image";
import styles from "./PublicSite.module.css";

const services = [
  { title: "Casilleros seguros", description: "Casilleros seguros con acceso por código o QR.", icon: "lock", isNew: true, featured: true, yellow: true },
  { title: "Recepción de paquetes", description: "Recibimos tus envíos de cualquier courier y te avisamos.", icon: "package" },
  { title: "Retiro con QR", description: "Muestra tu código y retira en segundos, sin filas.", icon: "qr", isNew: true, yellow: true },
  { title: "Espacios a medida", description: "Tamaños S, M, L y XL para cada tipo de envío.", icon: "size", yellow: true },
  { title: "Vigilancia 24/7", description: "Cámaras y acceso controlado para proteger tus cosas.", icon: "security" },
  { title: "Avisos al instante", description: "Notificaciones en tiempo real por app o WhatsApp.", icon: "bell" },
];

export default function ServicesPanel() {
  return (
    <section className={styles.services} aria-labelledby="services-title">
      <div className={styles.sectionHeading}>
        <span className={styles.eyebrow}><Image src="/cofre/sparkles.svg" alt="" width={32} height={32} />Nuestros servicios</span>
        <h1 id="services-title">Todo para cuidar tus <span>paquetes</span></h1>
        <p>Almacenamiento seguro, retiro rápido y avisos al instante, a tu medida.</p>
      </div>
      <div className={styles.serviceGrid}>
        {services.map(service => (
          <article key={service.icon} className={`${styles.serviceCard} ${service.featured ? styles.featuredCard : ""}`}>
            <span className={`${styles.serviceIcon} ${service.yellow ? styles.yellow : styles.orange}`}>
              <Image src={`/cofre/service-${service.icon}.svg`} alt="" width={39} height={39} />
            </span>
            <div className={styles.serviceContent}>
              <div className={styles.serviceTitle}><h2>{service.title}</h2>{service.isNew && <span className={styles.newBadge}>Nuevo</span>}</div>
              <p>{service.description}</p>
              <a href="#nosotros" aria-label={`Saber más sobre ${service.title.toLowerCase()}: contactar a Cofre Express`}>
                Saber más <Image src={`/cofre/arrow${service.featured ? "-yellow" : ""}.svg`} alt="" width={24} height={24} />
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
