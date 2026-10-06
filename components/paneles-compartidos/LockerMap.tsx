"use client";
import { useState } from "react";
import styles from "./Paneles.module.css";

const lockers = ["Disponible", "Ocupado", "Disponible", "Reservado", "Disponible", "Ocupado", "Disponible", "Reservado", "Disponible"] as const;
export default function LockerMap({ compact = false }: { compact?: boolean }) {
  const [selected, setSelected] = useState<number | null>(null);
  return <div className={compact ? styles.lockerIllustration : styles.lockerSection}>
    <div className={styles.lockerGrid} aria-label="Mapa de lockers de ejemplo">
      {lockers.map((state, index) => <button key={index} type="button" className={`${styles.locker} ${state === "Ocupado" ? styles.occupied : state === "Reservado" ? styles.reserved : ""}`} aria-label={`Locker ${String(index + 1).padStart(2, "0")}: ${state}`} aria-pressed={selected === index} onClick={() => setSelected(index)}><span>{!compact && String(index + 1).padStart(2, "0")}</span><i /></button>)}
    </div>
    <p className={styles.lockerStatus} aria-live="polite">{selected !== null ? `Locker ${String(selected + 1).padStart(2, "0")} · ${lockers[selected]}` : "Selecciona un locker para ver su estado"}</p>
    {!compact && <div className={styles.legend}><span><i />Disponible</span><span><i className={styles.reserved} />Reservado</span><span><i className={styles.occupied} />Ocupado</span></div>}
  </div>;
}
