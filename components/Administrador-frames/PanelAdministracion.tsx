import { HeroCopy, NoticeCard, PanelLayout, ProfileSummary } from "../paneles-compartidos/PanelLayout";
import Icon from "../paneles-compartidos/Icon";
import PackageWorkspace from "../paneles-compartidos/PackageWorkspace";
import styles from "../paneles-compartidos/Paneles.module.css";
import GestionEmpleados from "./GestionEmpleados";

export default function PanelAdministracion() {
  return <>
    <PanelLayout user={{ name: "Administrador", detail: "Gestión general", initial: "A" }} navigation={[{ label: "Inicio", href: "#inicio" }, { label: "Empleados", href: "#empleados" }, { label: "Paquetes", href: "#paquetes" }, { label: "Sucursales", href: "#sucursales" }]} indicators={[{ value: 2, label: "Sucursales" }, { value: 8, label: "Empleados activos" }, { value: 27, label: "Paquetes en custodia" }, { value: 26, label: "Entregas de hoy" }]}>
      <HeroCopy title="Todo tu equipo, bien conectado" description="Administra a tus empleados, supervisa las sucursales y consulta la operación de Cofre Express desde un mismo lugar."><a href="#empleados" className={styles.primary}>Gestionar empleados</a><a href="#sucursales" className={styles.secondary}><span className={styles.play} aria-hidden="true">▶</span>Ver sucursales</a></HeroCopy>
      <div className={styles.visual}><NoticeCard className={styles.publicDate} icon={<Icon name="users" />} title="Un equipo, dos funciones" detail="Almacenes y recepción / entrega" /><NoticeCard className={styles.publicPackage} icon={<Icon name="truck" />} title="Sucursales conectadas" detail="Supervisa el movimiento de paquetes" /><NoticeCard className={styles.publicReady} icon={<Icon name="check" />} title="Control de accesos" detail="Crea las cuentas de tu personal"><a href="#empleados" className={styles.pinkButton}>Ver empleados</a></NoticeCard></div>
    </PanelLayout>
    <GestionEmpleados />
    <section id="sucursales" className={styles.section}><span className={styles.eyebrow}>OPERACIÓN</span><h2>Resumen de sucursales</h2><span className={styles.demoLabel}>Información de ejemplo</span><div className={styles.infoGrid}><article className={styles.infoCard}><Icon name="door" /><h3>Sucursal central</h3><p>18 paquetes en custodia</p><p>Personal de almacenes y recepción</p></article><article className={styles.infoCard}><Icon name="door" /><h3>Sucursal destino</h3><p>9 paquetes en custodia</p><p>Traslado TR-0009 en camino</p></article></div></section>
    <PackageWorkspace role="administrador" />
    <ProfileSummary role="Cuenta de administrador" description="Esta cuenta se crea directamente desde la base de datos. Desde este panel se gestionarán las cuentas de los dos tipos de empleados; no se ofrece registro de administradores." />
  </>;
}
