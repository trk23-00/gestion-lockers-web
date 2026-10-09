import Link from "next/link";
import Icon from "../paneles-compartidos/Icon";
import { HeroCopy, NoticeCard, PanelLayout } from "../paneles-compartidos/PanelLayout";
import styles from "../paneles-compartidos/Paneles.module.css";

export default function PanelGeneral() {
  return <>
    <PanelLayout variant="publico" navigation={[{ label: "Inicio", href: "#inicio" }, { label: "Paquetes", href: "#servicios" }, { label: "Pagos", href: "#pagos" }, { label: "Avisos", href: "#avisos" }]}>
      <HeroCopy title="Recibe y entrega paquetes sin complicaciones" description="Una sola plataforma para clientes, almacenes y administración. Cada paquete en su locker, cada persona con lo que necesita."><Link href="/login" className={styles.primary}>Empieza ahora</Link></HeroCopy>
      <div className={styles.visual} aria-label="Ejemplos de avisos del servicio">
        <NoticeCard className={styles.publicDate} icon={<Icon name="calendar" />} title="2 días" detail="Personaliza tus plazos" />
        <NoticeCard className={styles.publicPackage} icon={<Icon name="package" />} title="Nuevo paquete" detail="Recibe un aviso cuando llegue" />
        <NoticeCard className={styles.publicReady} icon={<Icon name="check" />} title="Tu paquete está listo" detail="Consulta su estado desde tu cuenta"><Link href="/login" className={styles.pinkButton}>Recoge ahora</Link></NoticeCard>
      </div>
    </PanelLayout>
    <section id="servicios" className={styles.section}><span className={styles.eyebrow}>COFRE EXPRESS</span><h2>Todo empieza con tu paquete</h2><div className={styles.infoGrid}>
      <article className={styles.infoCard}><Icon name="package" /><h3>Entrega en sucursal</h3><p>El personal recibe tu paquete y registra los datos para su seguimiento.</p></article>
      <article className={styles.infoCard}><Icon name="door" /><h3>Un espacio seguro</h3><p>Consulta el estado del paquete y la sucursal en la que puedes recogerlo.</p></article>
      <article className={styles.infoCard}><Icon name="check" /><h3>Recoge con tranquilidad</h3><p>Acércate a la sucursal cuando tu paquete esté listo para su entrega.</p></article>
    </div></section>
    <section id="pagos" className={styles.section}><div className={styles.iconHeading}><span className={styles.sectionIcon}><Icon name="wallet" /></span><h2>Pagos claros desde el registro</h2></div><p>Al registrar cada paquete se indica si el servicio lo paga el comerciante o el comprador. Consulta el importe y el responsable con el personal de la sucursal.</p></section>
    <section id="avisos" className={styles.profile}><div className={styles.iconHeading}><span className={styles.sectionIcon}><Icon name="bell" /></span><h2>Mantente al tanto</h2></div><p>Los avisos de tu cuenta te ayudan a seguir la recepción, los traslados y la disponibilidad para recoger tus paquetes.</p><p>Para obtener una cuenta de cliente, acércate al personal de recepción y entrega.</p></section>
  </>;
}
