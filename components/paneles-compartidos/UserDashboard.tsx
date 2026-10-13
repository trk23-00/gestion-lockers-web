"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getJson, postJson } from "@/lib/api";
import { panelPorNivel, rutaPanel, type PanelRole } from "@/lib/paneles";
import Icon, { type IconName } from "./Icon";
import LockerMap from "./LockerMap";
import { dashboards, packageSummary } from "./dashboard-data";
import styles from "./UserDashboard.module.css";

type SessionUser = { nombre: string; apellido: string; correo: string; rol: string; nivel: number };

function Card({ id, icon, title, subtitle, children, wide = false }: { id: string; icon: IconName; title: string; subtitle?: string; children: ReactNode; wide?: boolean }) {
  return <section id={id} tabIndex={-1} className={`${styles.card} ${wide ? styles.wide : ""}`}>
    <div className={styles.cardHeading}><div><h2><Icon name={icon} />{title}</h2>{subtitle && <p>{subtitle}</p>}</div></div>
    {children}
  </section>;
}

function TransferSummary() {
  return <Card id="traslados" title="Seguimiento de traslados" icon="truck" subtitle="Movimiento entre sucursales"><div className={styles.transferHeading}><span className={styles.noticeIcon}><Icon name="truck" /></span><div><strong>TR-0009</strong><p>CE-0020 · En camino</p></div><span className={`${styles.badge} ${styles.transit}`}>En traslado</span></div><div className={styles.route}><div><i /><span>Origen<strong>Sucursal central</strong></span></div><div><i /><span>Destino<strong>Sucursal destino</strong></span></div></div></Card>;
}

function PaymentSummary({ client = false }: { client?: boolean }) {
  return <Card id="pagos" title={client ? "Mis pagos" : "Responsables de pago"} icon="wallet" subtitle="El responsable se indica al registrar cada paquete"><div className={styles.paymentList}>{packageSummary.map(item => <div key={item.code}><span className={styles.noticeIcon}><Icon name="wallet" /></span><div><strong>{item.code}</strong><p>Paga el {item.payer.toLocaleLowerCase()}</p></div><span className={styles.paymentType}>{item.type}</span></div>)}</div><p className={styles.cardFootnote}>Consulta los importes y el estado del pago con recepción.</p></Card>;
}

export default function UserDashboard({ role }: { role: PanelRole }) {
  const config = dashboards[role];
  const router = useRouter();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [sessionState, setSessionState] = useState("Consultando sesión…");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [active, setActive] = useState("panel-general");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("Todos");
  const [loggingOut, setLoggingOut] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    let current = true;
    getJson<{ usuario: SessionUser }>("/api/auth/me").then(result => {
      if (!current) return;
      if (result.ok && result.data) {
        const user = result.data.usuario;
        if (panelPorNivel[user.nivel] !== role) {
          router.replace(rutaPanel(user.nivel));
          return;
        }
        setSession(user);
        setSessionState("Sesión activa");
      } else {
        setSessionState(result.message === "No hay sesión" ? "Vista previa · sin sesión" : "Sesión no disponible");
      }
    });
    return () => { current = false; };
  }, [role, router]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setMobileOpen(false); };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, []);

  async function logout() {
    setLoggingOut(true);
    const result = await postJson("/api/auth/logout", {});
    if (result.ok) { router.push("/login"); router.refresh(); }
    else { setFeedback(result.message); setLoggingOut(false); }
  }

  function navigate(id: string) {
    setActive(id);
    setMobileOpen(false);
    document.getElementById(id)?.focus({ preventScroll: true });
  }

  const has = (id: string) => config.modules.some(module => module.id === id);
  const name = session ? `${session.nombre} ${session.apellido}` : "Vista previa";
  const initial = session ? session.nombre.charAt(0).toUpperCase() : config.role.charAt(0);
  const rows = (role === "almacenes" ? packageSummary.filter(item => item.tone === "transit") : packageSummary)
    .filter(item => (filter === "Todos" || item.type === filter) && `${item.code} ${item.contact} ${item.status} ${item.branch}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const tableId = has("paquetes") ? "paquetes" : "traslados";

  return <div className={`${styles.shell} ${collapsed ? styles.collapsed : ""}`}>
    <a className={styles.skip} href="#panel-general">Saltar al Panel General</a>
    {mobileOpen && <button type="button" className={styles.backdrop} aria-label="Cerrar menú" onClick={() => setMobileOpen(false)} />}
    <aside id="menu-panel" className={`${styles.sidebar} ${mobileOpen ? styles.mobileOpen : ""}`}>
      <div className={styles.brandRow}>
        <Link href="#panel-general" className={styles.brand} onClick={() => navigate("panel-general")} aria-label="SGAP, Panel General">
          <span className={styles.logo}><Image src="/Logo.svg" alt="Logo del sistema" width={34} height={42} priority /></span>
          <span className={styles.brandText}><strong>SGAP</strong><small>Gestión de paquetes</small></span>
        </Link>
        <button className={`${styles.iconButton} ${styles.collapseButton}`} type="button" aria-label={collapsed ? "Expandir menú" : "Contraer menú"} onClick={() => setCollapsed(!collapsed)}><Icon name="menu" /></button>
      </div>
      <nav aria-label={`Menú de ${config.role}`} className={styles.nav}>
        <div className={styles.navGroup}><p className={styles.groupLabel}>GENERAL</p><a className={active === "panel-general" ? styles.active : ""} href="#panel-general" aria-current={active === "panel-general" ? "location" : undefined} onClick={() => navigate("panel-general")} title="Panel General"><Icon name="grid" /><span>Panel General</span></a></div>
        {["OPERACIÓN", "GESTIÓN"].map(group => {
          const modules = config.modules.filter(module => module.group === group);
          return modules.length > 0 && <div key={group} className={styles.navGroup}><p className={styles.groupLabel}>{group}</p>{modules.map(module => <a key={module.id} href={`#${module.id}`} title={module.label} aria-current={active === module.id ? "location" : undefined} className={active === module.id ? styles.active : ""} onClick={() => navigate(module.id)}><Icon name={module.icon} /><span>{module.label}</span></a>)}</div>;
        })}
      </nav>
      <div className={styles.sidebarBottom}><div className={styles.roleCard}><span className={styles.avatar}>{initial}</span><div><small>Tu espacio de trabajo</small><strong>{config.role}</strong></div></div><Link href="/" className={styles.publicLink} aria-label="Ir a la web principal"><Icon name="arrow" /><span>Ir a la web principal</span></Link><p className={styles.sidebarFooter}>SGAP · Cofre Express</p></div>
    </aside>

    <div className={styles.mainColumn}>
      <header className={styles.topbar}>
        <button className={`${styles.iconButton} ${styles.mobileToggle}`} type="button" aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"} aria-expanded={mobileOpen} aria-controls="menu-panel" onClick={() => setMobileOpen(!mobileOpen)}><Icon name="menu" /></button>
        <div className={styles.breadcrumb}>Mi espacio <span>/</span> <strong>Panel General</strong></div>
        <div className={styles.topbarRight}>
          {has("avisos") && <a className={styles.iconButton} href="#avisos" aria-label="Ver notificaciones" onClick={() => navigate("avisos")}><Icon name="bell" /><i className={styles.notificationDot} /></a>}
          <details className={styles.account}><summary><span className={styles.avatar}>{initial}</span><span className={styles.accountText}><strong>{name}</strong><small>{session?.rol ?? config.role}</small></span><span className={styles.chevron}>⌄</span></summary><div className={styles.accountPopover}><strong>{name}</strong><p>{session?.rol ?? config.role}</p><p>{session?.correo ?? sessionState}</p>{session ? <><Link href="/password">Modificar contraseña</Link><button type="button" disabled={loggingOut} onClick={logout}><Icon name="logout" />{loggingOut ? "Cerrando sesión…" : "Cerrar sesión"}</button></> : <Link href="/login">Iniciar sesión</Link>}<p role="status">{feedback}</p></div></details>
        </div>
      </header>

      <main id="panel-general" tabIndex={-1} className={styles.content}>
        <div className={styles.pageHeading}><div><span className={styles.eyebrow}>{config.role}</span><h1>Panel General</h1><p>{config.description}</p></div><span className={`${styles.sessionPill} ${session ? styles.online : ""}`}><i />{sessionState}</span></div>
        <div className={styles.welcome}><div><span>BIENVENIDO A SGAP</span><h2>{session ? `Hola, ${session.nombre}.` : config.greeting}</h2><p>Sistema de Gestión de Almacenamiento de Paquetes</p></div><div className={styles.welcomeIcon}><Icon name={role === "almacenes" ? "door" : role === "administrador" ? "chart" : "package"} /></div></div>
        <div className={styles.demoNote}><span className={styles.demoDot} />Datos de ejemplo · los resúmenes muestran una demostración del sistema.</div>

        <section aria-label="Indicadores generales" className={styles.metrics}>{config.metrics.map(metric => <a href={`#${metric.target}`} key={metric.label} className={styles.metric} onClick={() => navigate(metric.target)}><div className={styles.metricTitle}><span>{metric.label}</span><span className={styles.metricIcon}><Icon name={metric.icon} /></span></div><strong>{metric.value}</strong><p>{metric.detail}<Icon name="arrow" /></p></a>)}</section>

        <div className={styles.dashboardGrid}>
          {has("reportes") && <Card id="reportes" title="Paquetes por sucursal" icon="chart" subtitle="Distribución de los 27 paquetes en custodia">
            <div className={styles.distribution}><div className={styles.donut} role="img" aria-label="Sucursal central: 18 paquetes. Sucursal destino: 9 paquetes."><div><strong>27</strong><small>paquetes</small></div></div><div className={styles.distributionLegend}><div><i /><span>Sucursal central<strong>18 paquetes</strong></span><b>67%</b></div><div><i /><span>Sucursal destino<strong>9 paquetes</strong></span><b>33%</b></div></div></div>
            <p className={styles.cardFootnote}>Resumen de almacenamiento de las dos sucursales.</p>
          </Card>}

          {has("almacenes") && <Card id="almacenes" title="Disponibilidad de lockers" icon="door" subtitle="Sucursal central · selecciona un espacio para consultar su estado"><div className={styles.lockerWrapper}><LockerMap /></div></Card>}

          {role === "cliente" && <Card id="avisos" title="Novedades de tus paquetes" icon="bell" subtitle="Lo que necesitas saber antes de acercarte a la sucursal"><div className={styles.noticeList}><div><span className={`${styles.noticeIcon} ${styles.ready}`}><Icon name="check" /></span><div><strong>Tu compra está lista</strong><p>CE-0018 está disponible en la sucursal central.</p><a href="#traslados" onClick={() => navigate("traslados")}>Consultar paquete <Icon name="arrow" /></a></div></div><div><span className={styles.noticeIcon}><Icon name="truck" /></span><div><strong>Tu paquete está en camino</strong><p>CE-0020 se dirige a la sucursal de destino.</p></div></div></div></Card>}

          {has("usuarios") && <Card id="usuarios" title={role === "empleado" ? "Atención a clientes" : role === "almacenes" ? "Usuarios del almacén" : "Equipo y usuarios"} icon="users" subtitle={config.modules.find(module => module.id === "usuarios")?.description}>
            <div className={styles.userSummary}><span className={styles.bigIcon}><Icon name="users" /></span><div><strong>{role === "empleado" ? "3" : "8"}</strong><p>{role === "empleado" ? "clientes nuevos hoy" : "empleados activos en el sistema"}</p></div></div>
            <div className={styles.roleList}>{role === "empleado" ? <><span><Icon name="package" />Compradores · recepción de compras</span><span><Icon name="truck" />Comerciantes · envío de paquetes</span></> : <><span><Icon name="door" />Almaceneros</span><span><Icon name="package" />Recepcionistas</span>{role === "administrador" && <span><Icon name="users" />Clientes · compradores y comerciantes</span>}</>}</div><p className={styles.cardFootnote}>{role === "empleado" ? "Una cuenta de cliente reúne compras y envíos." : role === "almacenes" ? "Consulta de usuarios relacionados con la operación del almacén." : "Las cuentas del personal son creadas por un administrador."}</p>
          </Card>}

          {role === "cliente" && <PaymentSummary client />}
          {role === "administrador" && <TransferSummary />}

          <Card id={tableId} title={role === "cliente" ? "Mis paquetes" : role === "almacenes" ? "Traslados en curso" : "Paquetes recientes"} icon={role === "almacenes" ? "truck" : "package"} subtitle={role === "cliente" ? "Tus compras y envíos, reunidos en una sola cuenta" : "Seguimiento de ejemplo de la operación"} wide>
            <div className={styles.tableToolbar}><div className={styles.filters} aria-label="Tipo de paquete">{["Todos", "Compra", "Envío"].map(value => <button type="button" key={value} aria-pressed={filter === value} className={filter === value ? styles.selectedFilter : ""} onClick={() => setFilter(value)}>{value === "Compra" ? "Compras" : value === "Envío" ? "Envíos" : value}</button>)}</div><label className={styles.search}><Icon name="search" /><span className={styles.srOnly}>Buscar por código, contacto, estado o sucursal</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar paquete…" /></label></div>
            <div className={styles.tableScroll}><table className={styles.table}><caption className={styles.srOnly}>Resumen de paquetes de ejemplo</caption><thead><tr><th>Paquete</th><th>{role === "cliente" ? "Contacto" : "Cliente"}</th><th>Tipo</th><th>Estado</th><th>Sucursal</th></tr></thead><tbody>{rows.map(item => <tr key={item.code}><td><span className={styles.packageCode}><Icon name="package" /><strong>{item.code}</strong></span></td><td>{item.contact}</td><td>{item.type}</td><td><span className={`${styles.badge} ${styles[item.tone]}`}><i />{item.status}</span></td><td>{item.branch}</td></tr>)}</tbody></table>{rows.length === 0 && <p className={styles.empty} role="status">No hay paquetes que coincidan con esta búsqueda.</p>}</div><p className={styles.cardFootnote}>{rows.length} {rows.length === 1 ? "paquete en este resumen" : "paquetes en este resumen"} · Datos de ejemplo</p>
          </Card>

          {role === "empleado" && <TransferSummary />}

          {role === "administrador" && <PaymentSummary />}

          {role === "administrador" && <Card id="avisos" title="Avisos de la operación" icon="bell" subtitle="Información para supervisar las sucursales"><div className={styles.noticeList}><div><span className={styles.noticeIcon}><Icon name="truck" /></span><div><strong>Traslado en curso</strong><p>TR-0009 se dirige a la sucursal de destino.</p><a href="#traslados" onClick={() => navigate("traslados")}>Consultar traslado <Icon name="arrow" /></a></div></div><div><span className={`${styles.noticeIcon} ${styles.ready}`}><Icon name="check" /></span><div><strong>Equipo conectado</strong><p>8 empleados activos en las dos sucursales.</p></div></div></div></Card>}
        </div>
        <footer className={styles.footer}><span>SGAP <span>·</span> Sistema de Gestión de Almacenamiento de Paquetes</span><span>Panel General · {config.role}</span></footer>
      </main>
    </div>
  </div>;
}
