import { HeroCopy, NoticeCard, PanelLayout, ProfileSummary } from "../paneles-compartidos/PanelLayout";
import Icon from "../paneles-compartidos/Icon";
import LockerMap from "../paneles-compartidos/LockerMap";
import PackageWorkspace from "../paneles-compartidos/PackageWorkspace";
import styles from "../paneles-compartidos/Paneles.module.css";
import GestionClientes from "./GestionClientes";

export default function PanelEmpleado() {
  return <>
    <PanelLayout user={{ name: "Recepcionista", detail: "Recepción y entrega", initial: "R" }} navigation={[{ label: "Inicio", href: "#inicio" }, { label: "Paquetes", href: "#paquetes" }, { label: "Clientes", href: "#clientes" }, { label: "Entregas", href: "#entregas" }]} indicators={[{ value: 18, label: "Recibidos hoy" }, { value: 9, label: "Por entregar" }, { value: 26, label: "Entregados hoy" }, { value: 3, label: "Clientes nuevos" }]}>
      <HeroCopy title="Cada paquete, en buenas manos" description="Recibe paquetes, registra a tus clientes y confirma cada entrega. Todo lo que necesitas para atender tu sucursal."><a href="#paquetes" className={styles.primary}>Registrar un paquete</a><a href="#clientes" className={styles.secondary}><span className={styles.play} aria-hidden="true">＋</span>Registrar cliente</a></HeroCopy>
      <div className={styles.visual}><LockerMap compact /><NoticeCard className={styles.noticeTop} icon={<Icon name="check" />} title="Entrega confirmada" detail="Un cliente más, un paquete entregado" /><NoticeCard className={styles.noticeLeft} icon={<Icon name="package" />} title="9 por entregar" detail="Verifica al destinatario al recoger" /><NoticeCard className={styles.noticeBottom} icon={<Icon name="users" />} title="Atención al cliente" detail="Una cuenta para comprar y vender" /></div>
    </PanelLayout>
    <PackageWorkspace role="empleado" />
    <section id="entregas" className={styles.section}><h2>Recepción y entrega</h2><div className={styles.infoGrid}><article className={styles.infoCard}><h3>1. Recibe y registra</h3><p>Identifica al cliente y registra quién paga el servicio.</p></article><article className={styles.infoCard}><h3>2. Verifica al destinatario</h3><p>Confirma los datos del cliente antes de entregar el paquete.</p></article><article className={styles.infoCard}><h3>3. Confirma la entrega</h3><p>Usa la acción de la tabla para probar la entrega de un paquete listo.</p></article></div></section>
    <GestionClientes />
    <ProfileSummary role="Personal de recepción y entrega" description="Recepciona y entrega paquetes, y crea cuentas de cliente. Tu cuenta de empleado es creada por un administrador." />
  </>;
}
