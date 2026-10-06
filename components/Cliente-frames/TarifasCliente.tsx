import styles from "../paneles-compartidos/Paneles.module.css";
export default function TarifasCliente({ weeklyRate = 2 }: { weeklyRate?: number }) {
  return <section id="pagos" className={styles.pricing} aria-label="Información de pagos">
    <article className={styles.priceNote}><p>El pago del locker se define al registrar el paquete</p><strong>Cada paquete muestra claramente si debe pagar el comerciante o el comprador.</strong></article>
    <div className={styles.priceMeter}><div><span>Precio</span><span>+{weeklyRate} Bs</span></div><i aria-hidden="true" /></div>
    <article className={styles.priceNote}><p>Tarifa de servicio semanal</p><strong>Al utilizar el servicio de recojo y entrega, se establece una tarifa operativa semanal de {weeklyRate} Bs.</strong><p className={styles.demoLabel}>Tarifa de ejemplo según el diseño de referencia.</p></article>
  </section>;
}
