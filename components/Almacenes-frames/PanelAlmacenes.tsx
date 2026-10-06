import { HeroCopy, NoticeCard, PanelLayout, ProfileSummary } from "../paneles-compartidos/PanelLayout";
import Icon from "../paneles-compartidos/Icon";
import LockerMap from "../paneles-compartidos/LockerMap";
import PackageWorkspace from "../paneles-compartidos/PackageWorkspace";
import styles from "../paneles-compartidos/Paneles.module.css";
import TrasladosAlmacenes from "./TrasladosAlmacenes";

export default function PanelAlmacenes() {
  return <>
    <PanelLayout user={{ name: "Encargado", detail: "Almacén central", initial: "E" }} navigation={[{ label: "Inicio", href: "#inicio" }, { label: "Paquetes", href: "#paquetes" }, { label: "Lockers", href: "#lockers" }, { label: "Envíos", href: "#envios" }]} indicators={[{ value: 18, label: "Por ingresar" }, { value: 9, label: "En traslados" }, { value: 26, label: "Entregas de hoy" }, { value: 3, label: "Vencen hoy" }]}>
      <HeroCopy title="Tu almacén, en orden y al día" description="Organiza los paquetes en sus lockers y coordina los traslados entre sucursales sin perder de vista lo que vence hoy."><a href="#paquetes" className={styles.primary}>Gestionar paquetes</a><a href="#lockers" className={styles.secondary}><span className={styles.play} aria-hidden="true">▶</span>Ver el mapa de lockers</a></HeroCopy>
      <div className={styles.visual}><LockerMap compact /><NoticeCard className={styles.noticeTop} icon={<Icon name="check" />} title="Entrega completada" detail="Locker 07 liberado" /><NoticeCard className={styles.noticeLeft} icon={<Icon name="door" />} title="18 por ingresar" detail="Llegaron esta mañana" /><NoticeCard className={styles.noticeBottom} icon={<Icon name="clock" />} title="Retiros pendientes" detail="3 paquetes vencen hoy"><a href="#envios" className={styles.smallButton}>Ver actividad</a></NoticeCard></div>
    </PanelLayout>
    <PackageWorkspace role="almacenes" />
    <section id="lockers" className={styles.section}><span className={styles.eyebrow}>ALMACÉN CENTRAL</span><h2>Mapa de lockers</h2><p>Disponibilidad de ejemplo de los compartimientos de la sucursal.</p><LockerMap /></section>
    <TrasladosAlmacenes />
    <ProfileSummary role="Personal de almacenes" description="Organiza el almacenamiento y el traslado de paquetes entre sucursales. Tu cuenta es creada por un administrador." />
  </>;
}
