"use client";
import { useState, type FormEvent } from "react";
import styles from "../paneles-compartidos/Paneles.module.css";

type Employee = { name: string; email: string; role: string; branch: string };
export default function GestionEmpleados() {
  const [employees, setEmployees] = useState<Employee[]>([
    { name: "Lucía Pérez", email: "lucia@example.com", role: "Recepción y entrega", branch: "Central" },
    { name: "Diego Flores", email: "diego@example.com", role: "Almacenes", branch: "Destino" },
  ]);
  const [message, setMessage] = useState("");
  function addEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email")).trim().toLowerCase();
    if (employees.some(employee => employee.email.toLowerCase() === email)) { setMessage("Ya existe un empleado de ejemplo con este correo."); return; }
    setEmployees(current => [...current, { name: String(data.get("name")).trim(), email, role: String(data.get("role")), branch: String(data.get("branch")) }]);
    setMessage("Empleado añadido a la lista de ejemplo. No se ha creado una cuenta real.");
    event.currentTarget.reset();
  }
  return <section id="empleados" className={styles.section}><span className={styles.eyebrow}>ADMINISTRACIÓN</span><h2>Gestión de empleados</h2><p>Solo un administrador puede crear cuentas de almacenes o de recepción y entrega.</p><span className={styles.demoLabel}>Formulario de demostración · sin conexión al registro de cuentas</span>
    <form className={styles.form} onSubmit={addEmployee}><label>Nombre completo<input name="name" required maxLength={80} pattern=".*\S.*" /></label><label>Correo electrónico<input name="email" type="email" required maxLength={120} /></label><label>Tipo de empleado<select name="role"><option>Recepción y entrega</option><option>Almacenes</option></select></label><label>Sucursal<select name="branch"><option>Central</option><option>Destino</option></select></label><button type="submit" className={styles.primary}>Añadir empleado de ejemplo</button></form>
    <div className={styles.tableScroll}><table className={styles.table}><thead><tr><th>Empleado</th><th>Correo</th><th>Función</th><th>Sucursal</th></tr></thead><tbody>{employees.map(employee => <tr key={employee.email}><td>{employee.name}</td><td>{employee.email}</td><td><span className={styles.badge}>{employee.role}</span></td><td>{employee.branch}</td></tr>)}</tbody></table></div><p role="status" className={styles.feedback}>{message}</p>
  </section>;
}
