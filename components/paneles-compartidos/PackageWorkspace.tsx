"use client";
import { useState, type FormEvent } from "react";
import styles from "./Paneles.module.css";

type Package = { code: string; person: string; type: "Compra" | "Envío"; status: string; locker: string; payer: string };
export const examplePackages: Package[] = [
  { code: "CE-0018", person: "María López", type: "Compra", status: "Listo para recoger", locker: "02", payer: "Comprador" },
  { code: "CE-0019", person: "Carlos Rojas", type: "Envío", status: "En almacén", locker: "06", payer: "Comerciante" },
  { code: "CE-0020", person: "Ana Vargas", type: "Compra", status: "En traslado", locker: "Pendiente", payer: "Comerciante" },
];

export default function PackageWorkspace({ role }: { role: "cliente" | "almacenes" | "empleado" | "administrador" }) {
  const [packages, setPackages] = useState(examplePackages);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("Todos");
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const canRegister = role === "empleado";
  function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const code = `CE-${String(21 + packages.length - examplePackages.length).padStart(4, "0")}`;
    setPackages(current => [...current, { code, person: String(data.get("person")).trim(), type: "Envío", status: "Recibido", locker: "Pendiente", payer: String(data.get("payer")) }]);
    setMessage(`${code} registrado en esta demostración. Pendiente de asignación de locker.`);
    setShowForm(false);
  }
  function update(code: string, status: string) {
    setPackages(current => current.map(item => item.code === code ? { ...item, status, locker: status === "Entregado" || status === "En traslado" ? "Liberado" : item.locker } : item));
    setMessage(`${code}: ${status.toLowerCase()} en esta demostración.`);
  }
  const visible = packages.filter(item => (filter === "Todos" || item.type === filter) && `${item.code} ${item.person} ${item.status}`.toLowerCase().includes(query.toLowerCase()));
  return <section id="paquetes" className={styles.section}>
    <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>SEGUIMIENTO</span><h2>{role === "cliente" ? "Mis paquetes" : "Gestión de paquetes"}</h2><p>{role === "cliente" ? "Tus compras y envíos, reunidos en un solo lugar." : "Consulta los paquetes y su estado en la sucursal."}</p></div>{canRegister && <button type="button" className={styles.primary} onClick={() => setShowForm(!showForm)} aria-expanded={showForm}>{showForm ? "Cancelar" : "Registrar un paquete"}</button>}</div>
    <span className={styles.demoLabel}>Datos de ejemplo · los cambios solo duran mientras esta vista está abierta</span>
    {showForm && <form className={styles.form} onSubmit={register}><label>Nombre del cliente<input name="person" required maxLength={80} pattern=".*\S.*" /></label><label>Responsable del pago<select name="payer"><option>Comerciante</option><option>Comprador</option></select></label><button className={styles.primary} type="submit">Registrar en demostración</button></form>}
    <div className={styles.toolbar}><div className={styles.tabs} aria-label="Filtrar paquetes">{["Todos", "Compra", "Envío"].map(value => <button type="button" key={value} aria-pressed={filter === value} className={filter === value ? styles.activeTab : ""} onClick={() => setFilter(value)}>{value === "Compra" ? "Compras" : value === "Envío" ? "Envíos" : value}</button>)}</div><label className={styles.search}>Buscar paquete<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Código, cliente o estado" type="search" /></label></div>
    <div className={styles.tableScroll}><table className={styles.table}><caption className={styles.srOnly}>Paquetes de ejemplo y responsables del pago</caption><thead><tr><th>Código</th><th>{role === "cliente" ? "Contacto" : "Cliente"}</th><th>Tipo</th><th>Estado</th><th>Locker</th><th>Paga</th>{(role === "empleado" || role === "almacenes") && <th>Acción</th>}</tr></thead><tbody>{visible.map(item => <tr key={item.code}><td><strong>{item.code}</strong></td><td>{item.person}</td><td>{item.type}</td><td><span className={styles.badge}>{item.status}</span></td><td>{item.locker}</td><td>{item.payer}</td>{role === "empleado" && <td>{item.status === "Listo para recoger" ? <button type="button" className={styles.smallButton} onClick={() => update(item.code, "Entregado")}>Confirmar entrega</button> : "—"}</td>}{role === "almacenes" && <td>{item.status === "En almacén" ? <button type="button" className={styles.smallButton} onClick={() => update(item.code, "En traslado")}>Preparar traslado</button> : "—"}</td>}</tr>)}</tbody></table></div>
    {visible.length === 0 && <p className={styles.empty}>No se encontraron paquetes para esta búsqueda.</p>}
    <p role="status" className={styles.feedback}>{message}</p>
  </section>;
}
