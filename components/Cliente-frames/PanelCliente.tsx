import { PanelLayout, ProfileSummary } from "../paneles-compartidos/PanelLayout";
import PackageWorkspace from "../paneles-compartidos/PackageWorkspace";
import styles from "../paneles-compartidos/Paneles.module.css";
import TarifasCliente from "./TarifasCliente";

export default function PanelCliente() {
  return <>
    <PanelLayout variant="cliente" user={{ name: "Cliente", detail: "Compras y envíos", initial: "C" }} navigation={[{ label: "Inicio", href: "#inicio" }, { label: "Paquetes", href: "#paquetes" }, { label: "Pagos", href: "#pagos" }, { label: "Avisos", href: "#avisos" }]} indicators={[{ value: 18, label: "Mis compras" }, { value: 9, label: "Mis envíos" }]}>
      <div><div className={styles.clientIntro}><span className={styles.clientKicker}>Una sola cuenta · dos roles</span><h1>TU CENTRO DE GESTIÓN INTEGRAL</h1><p>Administra todas tus compras y envíos desde un solo perfil unificado. Ahorra tiempo y simplifica la logística de tus paquetes.</p></div><div className={styles.clientAction}><a href="#paquetes" className={styles.primary}>Mis paquetes</a></div></div>
      <TarifasCliente />
    </PanelLayout>
    <PackageWorkspace role="cliente" />
    <section id="avisos" className={styles.section}><h2>Mis avisos</h2><div className={styles.infoGrid}><article className={styles.infoCard}><h3>CE-0018 está listo</h3><p>Tu compra está disponible para recoger en la sucursal central.</p></article><article className={styles.infoCard}><h3>CE-0020 en traslado</h3><p>Tu paquete se dirige a la sucursal de destino.</p></article></div></section>
    <ProfileSummary role="Tu cuenta de cliente" description="Con una sola cuenta puedes comprar y vender. El personal de recepción y entrega es el encargado de crear tu cuenta." />
  </>;
}
