"use client";
import { useState, type FormEvent } from "react";
import styles from "../paneles-compartidos/Paneles.module.css";

export default function GestionClientes() {
  const [clients, setClients] = useState([{ name: "María López", contact: "maria@example.com" }]);
  const [message, setMessage] = useState("");
  function addClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const contact = String(data.get("contact")).trim().toLowerCase();
    if (clients.some(client => client.contact.toLowerCase() === contact)) { setMessage("Ya existe un cliente de ejemplo con este correo."); return; }
    setClients(current => [...current, { name: String(data.get("name")).trim(), contact }]);
    setMessage("Cliente añadido a la lista de ejemplo. No se ha creado una cuenta real.");
    event.currentTarget.reset();
  }
  return <section id="clientes" className={styles.section}><span className={styles.eyebrow}>ATENCIÓN EN SUCURSAL</span><h2>Gestión de clientes</h2><p>Una misma cuenta permite comprar y vender. Solo el personal de recepción y entrega puede crear cuentas de cliente.</p><span className={styles.demoLabel}>Formulario de demostración · sin conexión al registro de cuentas</span>
    <form className={styles.form} onSubmit={addClient}><label>Nombre completo<input name="name" autoComplete="name" required maxLength={80} pattern=".*\S.*" /></label><label>Correo electrónico<input name="contact" type="email" autoComplete="email" required maxLength={120} /></label><button type="submit" className={styles.primary}>Añadir cliente de ejemplo</button></form>
    <div className={styles.tableScroll}><table className={styles.table}><thead><tr><th>Cliente</th><th>Correo</th><th>Perfil</th></tr></thead><tbody>{clients.map(client => <tr key={client.contact}><td>{client.name}</td><td>{client.contact}</td><td>Comprador y comerciante</td></tr>)}</tbody></table></div><p role="status" className={styles.feedback}>{message}</p>
  </section>;
}
