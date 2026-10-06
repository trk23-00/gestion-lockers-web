"use client";
import { useState } from "react";
import styles from "../paneles-compartidos/Paneles.module.css";
export default function TrasladosAlmacenes() {
  const [received, setReceived] = useState(false);
  return <section id="envios" className={styles.section}><span className={styles.eyebrow}>ENTRE SUCURSALES</span><h2>Control de traslados</h2><span className={styles.demoLabel}>Traslado de ejemplo · confirmación local</span><div className={styles.infoGrid}><article className={styles.infoCard}><h3>TR-0009</h3><p>Sucursal central → Sucursal destino</p><p>Paquete CE-0020 · {received ? "Recibido en destino" : "En traslado"}</p><button type="button" className={styles.smallButton} disabled={received} onClick={() => setReceived(true)}>{received ? "Recepción confirmada" : "Confirmar recepción de CE-0020"}</button><p role="status">{received ? "Recepción simulada. El paquete queda pendiente de asignación de locker en destino." : ""}</p></article></div></section>;
}
