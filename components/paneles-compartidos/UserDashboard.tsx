"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { type PanelRole } from "@/lib/paneles";
import { usePanelData } from "./usePanelData";
import { navigation } from "./sgap-navigation";
import Workspace from "./Workspace";
import styles from "./UserDashboard.module.css";

export default function UserDashboard({ role }: { role: PanelRole }) {
  const router = useRouter();
  const modules = navigation(role);
  const { data, error, loading, refresh, setError } = usePanelData(role);
  const [notice, setNotice] = useState("");
  const [section, setSection] = useState("general"),
    [tab, setTab] = useState(""),
    [branch, setBranch] = useState(""),
    [mobileOpen, setMobileOpen] = useState(false);
  const current = modules.find((m) => m.id === section);
  const title =
    section === "cuenta" ? "Mi cuenta" : current?.label || "Panel general";
  useEffect(() => {
    const sync = () => {
      const p = new URLSearchParams(window.location.search);
      const id = p.get("seccion") || "general";
      const mod = navigation(role).find((m) => m.id === id);
      setSection(mod ? id : id === "cuenta" ? "cuenta" : "general");
      const wanted = p.get("vista") || "";
      setTab(mod?.tabs.includes(wanted) ? wanted : mod?.tabs[0] || "");
    };
    queueMicrotask(sync);
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [role]);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(id);
  }, [notice]);
  function navigate(id: string, wanted?: string) {
    const m = modules.find((x) => x.id === id);
    const nextTab =
      wanted && m?.tabs.includes(wanted) ? wanted : m?.tabs[0] || "";
    setSection(id);
    setTab(nextTab);
    setMobileOpen(false);
    const p = new URLSearchParams({ seccion: id });
    if (nextTab) p.set("vista", nextTab);
    window.history.pushState(null, "", `${window.location.pathname}?${p}`);
    document.getElementById("workspace")?.focus();
  }
  async function mutate(
    resource: string,
    method: string,
    body: Record<string, unknown>,
  ) {
    let res: Response;
    try {
      res = await fetch(`/api/sgap/${resource}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      throw new Error(
        "No hay conexión. Compruebe la red y vuelva a intentarlo.",
      );
    }
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || "No se pudo guardar.");
    setNotice(result.message);
    // El fallo de lectura no debe invitar a repetir una operación confirmada.
    try {
      await refresh({ force: true });
    } catch {
      setError(
        "El cambio se guardó. No se pudo actualizar la vista; pulse Actualizar.",
      );
    }
  }
  async function logout() {
    const res = await fetch("/api/auth/logout", { method: "POST" });
    if (res.ok) {
      router.replace("/login");
      router.refresh();
    } else setError("No se pudo cerrar la sesión. Inténtelo nuevamente.");
  }
  const name = data
    ? `${data.usuario.nombre} ${data.usuario.apellido}`
    : "Cargando…";
  return (
    <div className={styles.shell}>
      <a className={styles.skip} href="#workspace">
        Saltar al contenido
      </a>
      {mobileOpen && (
        <button
          className={styles.scrim}
          onClick={() => setMobileOpen(false)}
          aria-label="Cerrar navegación"
        />
      )}
      <aside
        className={`${styles.sidebar} ${mobileOpen ? styles.open : ""}`}
        aria-label="Navegación principal"
      >
        <div className={styles.brand}>
          <Image
            src="/figma/imgIconoDeCajaFelinaBrillante2.png"
            alt=""
            width={44}
            height={44}
            priority
          />
          <div>
            <strong>SGAP</strong>
            <small>Gestión de paquetes</small>
          </div>
          <button
            className={styles.mobileClose}
            onClick={() => setMobileOpen(false)}
            aria-label="Cerrar menú"
          >
            ×
          </button>
        </div>
        <nav>
          {modules.map((m, i) => (
            <div key={m.id}>
              {(i === 0 || modules[i - 1].group !== m.group) && (
                <p className={styles.navGroup}>{m.group}</p>
              )}
              <button
                className={`${styles.navItem} ${section === m.id ? styles.active : ""}`}
                onClick={() => navigate(m.id)}
                aria-current={section === m.id ? "page" : undefined}
              >
                <Image src={`/figma/${m.icon}`} alt="" width={20} height={20} />
                {m.label}
              </button>
            </div>
          ))}
        </nav>
        <div className={styles.sidebarFooter}>
          <button
            className={styles.secondary}
            onClick={() => navigate("cuenta")}
          >
            Mi cuenta
          </button>
          <button className={styles.softButton} onClick={logout}>
            Cerrar sesión
          </button>
          <small>SGAP · Cofre Express</small>
        </div>
      </aside>
      <div className={styles.main}>
        <header className={styles.topbar}>
          <button
            className={styles.mobileToggle}
            aria-label="Abrir menú"
            onClick={() => setMobileOpen(true)}
          >
            ☰
          </button>
          <p>
            Mi espacio <span>/</span> {title}
          </p>
          <div className={styles.userMenu}>
            {modules.some((m) => m.id === "notificaciones") && (
              <button
                className={styles.softButton}
                onClick={() => navigate("notificaciones")}
              >
                Avisos
              </button>
            )}
            <button
              className={styles.profile}
              onClick={() => navigate("cuenta")}
            >
              <span className={styles.avatar}>
                {data?.usuario.nombre.charAt(0) || "…"}
              </span>
              <span>
                <strong>{name}</strong>
                <small>{data?.usuario.rol || "Comprobando sesión"}</small>
              </span>
            </button>
          </div>
        </header>
        <main className={styles.content} id="workspace" tabIndex={-1}>
          <div className={styles.pageHeading}>
            <div>
              <p className={styles.eyebrow}>{data?.usuario.rol || role}</p>
              <h1>{title}</h1>
              <p>
                {section === "cuenta"
                  ? "Consulta y actualiza tus datos personales."
                  : current?.description}
              </p>
            </div>
            <div className={styles.branchFilter}>
              {data?.usuario.nivel === 1 && (
                <>
                  <label className={styles.srOnly} htmlFor="branch-filter">
                    Filtrar sucursal
                  </label>
                  <select
                    id="branch-filter"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                  >
                    <option value="">Todas las sucursales</option>
                    {data.sucursales.map((b) => (
                      <option value={b.id_sucursal} key={b.id_sucursal}>
                        {b.nombre}
                      </option>
                    ))}
                  </select>
                </>
              )}
              <small>
                {data?.usuario.id_sucursal
                  ? data.sucursales.find(
                      (b) => b.id_sucursal === data.usuario.id_sucursal,
                    )?.nombre
                  : "Información actualizada"}{" "}
                · {new Date().toLocaleDateString("es-BO")}
              </small>
            </div>
          </div>
          {current?.tabs.length ? (
            <div
              className={styles.tabs}
              role="tablist"
              aria-label={`Vistas de ${title}`}
            >
              {current.tabs.map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  className={tab === t ? styles.selectedTab : ""}
                  onClick={() => navigate(section, t)}
                >
                  {t}
                </button>
              ))}
            </div>
          ) : null}
          {notice && (
            <p role="status" className={styles.notice}>
              {notice}
            </p>
          )}
          {error && (
            <div role="alert" className={styles.error}>
              {error}{" "}
              <button
                onClick={() => {
                  void refresh({ force: true }).catch(() => {});
                }}
              >
                Actualizar
              </button>
            </div>
          )}
          {loading ? (
            <div className={styles.loading} role="status">
              Cargando tu espacio de trabajo…
            </div>
          ) : (
            data && (
              <Workspace
                key={`${section}-${tab}`}
                data={data}
                section={section}
                tab={tab}
                branch={branch}
                mutate={mutate}
                navigate={navigate}
              />
            )
          )}
        </main>
      </div>
    </div>
  );
}
