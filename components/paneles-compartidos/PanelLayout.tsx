import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./Paneles.module.css";

export type NavItem = { label: string; href: string };
export type Indicator = { label: string; value: number | string };

export function PanelHeader({ navigation, user }: { navigation: NavItem[]; user?: { name: string; detail: string; initial: string } }) {
  return <header className={styles.header}>
    <Link href={user ? "#inicio" : "/"} className={styles.brand} aria-label="Cofre Express, inicio">
      <Image src="/Logo.svg" alt="" width={92} height={114} priority />
      <span>COFRE<br />EXPRESS</span>
    </Link>
    <nav aria-label="Navegación principal" className={styles.navigation}>
      {navigation.map(item => <a key={item.href} href={item.href}>{item.label}</a>)}
    </nav>
    {user ? <a href="#perfil" className={styles.user}><span className={styles.avatar}>{user.initial}</span><span><strong>{user.name}</strong><small>{user.detail}</small></span></a> : <Link className={styles.login} href="/login">Iniciar sesión</Link>}
  </header>;
}

export function PanelLayout({ navigation, user, children, indicators, variant = "operativo" }: {
  navigation: NavItem[]; user?: { name: string; detail: string; initial: string };
  children: ReactNode; indicators?: Indicator[]; variant?: "publico" | "cliente" | "operativo";
}) {
  return <div className={`${styles.page} ${styles[variant]}`}>
    <a href="#contenido" className={styles.skip}>Saltar al contenido</a>
    <div id="inicio" className={styles.top}>
      <PanelHeader navigation={navigation} user={user} />
      <main id="contenido" className={styles.hero}>{children}</main>
      {indicators && <section className={styles.indicators} aria-label="Resumen de actividad">{indicators.map(item => <article className={styles.indicator} key={item.label}><strong>{item.value}</strong><span>{item.label}</span></article>)}</section>}
    </div>
  </div>;
}

export function HeroCopy({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return <div className={styles.heroCopy}><h1>{title}</h1><p>{description}</p><div className={styles.actions}>{children}</div></div>;
}

export function NoticeCard({ icon, title, detail, children, className = "" }: { icon: ReactNode; title: string; detail: string; children?: ReactNode; className?: string }) {
  return <article className={`${styles.notice} ${className}`}><span className={styles.noticeIcon} aria-hidden="true">{icon}</span><div><h3>{title}</h3><p>{detail}</p>{children}</div></article>;
}

export function ProfileSummary({ role, description }: { role: string; description: string }) {
  return <section id="perfil" className={styles.profile}><h2>{role}</h2><p>{description}</p><span className={styles.demoLabel}>Vista de demostración · datos de ejemplo</span></section>;
}
