"use client";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { panelPorNivel, rutaPanel, type PanelRole } from "@/lib/paneles";
import { type DashboardData } from "./sgap-types";
import { navigation } from "./sgap-navigation";
import { esAdministrador } from "@/lib/roles";
import Workspace from "./Workspace";
import PublicFooter from "@/components/General-frames/PublicFooter";
import styles from "./UserDashboard.module.css";

const submenuSections = [
  "recepcion",
  "entregas",
  "pagos",
  "usuarios",
  "almacenes",
];
const legacyStorageViews: Record<string, string> = {
  Ocupación: "Nuevo locker",
  Reubicaciones: "Por ubicar",
  "Ubicación de paquetes": "Por ubicar",
  "Administración de lockers": "Actualizar lockers",
};
const legacyPaymentViews: Record<string, string> = {
  "Por cobrar": "Registrar cobro",
  Cobros: "Cobros realizados",
  Devoluciones: "Corregir pagos",
};

export default function UserDashboard({ role }: { role: PanelRole }) {
  const router = useRouter();
  const modules = navigation(role);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState("general"),
    [tab, setTab] = useState(""),
    [branch, setBranch] = useState(""),
    [mobileOpen, setMobileOpen] = useState(false),
    [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const current = modules.find((m) => m.id === section);
  const title =
    section === "cuenta"
      ? "Mi cuenta"
      : ["recepcion", "entregas", "pagos", "almacenes"].includes(section)
        ? `${current?.label || ""} / ${tab || current?.tabs[0] || ""}`
        : section === "usuarios"
          ? tab || "Usuarios"
          : current?.label || "Panel general";
  const refresh = useCallback(async () => {
    const res = await fetch("/api/sgap/datos", { cache: "no-store" });
    const result = await res.json();
    if (res.status === 401) {
      router.replace("/login");
      throw new Error(result.message);
    }
    if (!res.ok)
      throw new Error(result.message || "No se pudo cargar la información.");
    if (panelPorNivel[result.usuario.nivel] !== role) {
      router.replace(rutaPanel(result.usuario.nivel));
      return;
    }
    setData(result);
    setError("");
  }, [role, router, setData, setError]);
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve()
      .then(refresh)
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);
  useEffect(() => {
    queueMicrotask(() => {
      if (submenuSections.includes(section))
        setExpanded((value) => ({ ...value, [section]: true }));
    });
  }, [section]);
  useEffect(() => {
    const sync = () => {
      const p = new URLSearchParams(window.location.search);
      const requestedId = p.get("seccion") || "general";
      const requestedTab = p.get("vista") || "";
      const id =
        requestedId === "recepcion" && requestedTab === "Entregas"
          ? "entregas"
          : requestedId;
      const wanted =
        id === "recepcion" && requestedTab === "Documentos"
          ? "Documentos registrados"
          : id === "recepcion" && requestedTab === "Recepción"
            ? "Nueva recepción"
            : id === "usuarios" &&
                ["Personal", "Clientes", "Cargos y accesos"].includes(
                  requestedTab,
                )
              ? "Usuarios registrados"
              : id === "pagos"
                ? legacyPaymentViews[requestedTab] || requestedTab
                : id === "almacenes"
                  ? legacyStorageViews[requestedTab] || requestedTab
                  : requestedTab;
      const mod = navigation(role).find((m) => m.id === id);
      setSection(mod ? id : id === "cuenta" ? "cuenta" : "general");
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
      await refresh();
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
              {submenuSections.includes(m.id) ? (
                <>
                  <button
                    className={`${styles.navItem} ${section === m.id ? styles.active : ""}`}
                    onClick={() =>
                      setExpanded((value) => ({
                        ...value,
                        [m.id]: !value[m.id],
                      }))
                    }
                    aria-expanded={!!expanded[m.id]}
                    aria-controls={`submenu-${m.id}`}
                    aria-current={section === m.id ? "page" : undefined}
                  >
                    <Image
                      src={`/figma/${m.icon}`}
                      alt=""
                      width={20}
                      height={20}
                    />
                    <span className={styles.navItemLabel}>{m.label}</span>
                    <svg
                      className={`${styles.navChevron} ${expanded[m.id] ? styles.chevronOpen : ""}`}
                      viewBox="0 0 16 16"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="m3.5 6 4.5 4 4.5-4"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  {expanded[m.id] && (
                    <div className={styles.submenu} id={`submenu-${m.id}`}>
                      {m.tabs.map((item) => {
                        const active = section === m.id && tab === item;
                        return (
                          <button
                            key={item}
                            className={`${styles.submenuItem} ${active ? styles.submenuItemActive : ""}`}
                            onClick={() => navigate(m.id, item)}
                            aria-current={active ? "page" : undefined}
                          >
                            {item}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <button
                  className={`${styles.navItem} ${section === m.id ? styles.active : ""}`}
                  onClick={() => navigate(m.id)}
                  aria-current={section === m.id ? "page" : undefined}
                >
                  <Image
                    src={`/figma/${m.icon}`}
                    alt=""
                    width={20}
                    height={20}
                  />
                  {m.label}
                </button>
              )}
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
              {data && esAdministrador(data.usuario.nivel) && (
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
          {current &&
          current.tabs.length > 0 &&
          !submenuSections.includes(section) ? (
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
                  setLoading(true);
                  refresh()
                    .catch((e) => setError(e.message))
                    .finally(() => setLoading(false));
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
        <PublicFooter variant="sgap" />
      </div>
    </div>
  );
}
