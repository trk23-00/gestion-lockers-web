"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  type DashboardData,
  type Package,
  type Locker,
  type Client,
  type Staff,
  type Branch,
  type Transfer,
  type Alert,
  type Document,
  debt,
  date,
  money,
  sizeName,
  statusName,
} from "./sgap-types";
import styles from "./UserDashboard.module.css";

type Column<T> = {
  title: string;
  value: (row: T) => ReactNode;
  search?: (row: T) => string;
};
export function Table<T>({
  rows,
  columns,
  rowKey,
  empty = "No hay registros para esta vista.",
  actions,
  exportName,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (r: T) => string;
  empty?: string;
  actions?: (r: T) => ReactNode;
  exportName?: string;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const filtered = rows.filter((r) =>
    columns
      .map((c) =>
        c.search
          ? c.search(r)
          : typeof c.value(r) === "string" || typeof c.value(r) === "number"
            ? String(c.value(r))
            : "",
      )
      .join(" ")
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 10)),
    current = Math.min(page, pages);
  function exportCSV() {
    const cell = (v: unknown) =>
      `"${String(v ?? "")
        .replace(/^[=+@\-\t\r]/, "'$&")
        .replaceAll('"', '""')}"`;
    const text = [
      columns.map((c) => cell(c.title)).join(","),
      ...filtered.map((r) =>
        columns.map((c) => cell(c.search ? c.search(r) : c.value(r))).join(","),
      ),
    ].join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", text], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportName || "registros"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <div className={styles.tableTools}>
        <label>
          Buscar
          <input
            placeholder="Código, nombre o estado…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>
        {exportName && (
          <button className={styles.secondary} onClick={exportCSV}>
            Exportar CSV
          </button>
        )}
        <span>{filtered.length} registros</span>
      </div>
      <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.title} scope="col">
                  {c.title}
                </th>
              ))}
              {actions && <th scope="col">Acción</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.slice((current - 1) * 10, current * 10).map((r) => (
              <tr key={rowKey(r)}>
                {columns.map((c) => (
                  <td key={c.title}>{c.value(r)}</td>
                ))}
                {actions && (
                  <td>
                    <div className={styles.rowActions}>{actions(r)}</div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && (
          <div className={styles.empty}>
            <strong>{empty}</strong>
            <p>
              Los registros aparecerán aquí cuando se completen las operaciones
              correspondientes.
            </p>
          </div>
        )}
      </div>
      <div className={styles.pagination}>
        <span>
          Página {current} de {pages}
        </span>
        <button disabled={current <= 1} onClick={() => setPage(current - 1)}>
          Anterior
        </button>
        <button
          disabled={current >= pages}
          onClick={() => setPage(current + 1)}
        >
          Siguiente
        </button>
      </div>
    </>
  );
}
export function Badge({ value }: { value: string }) {
  return (
    <span
      className={`${styles.badge} ${["entregado", "almacenado", "Disponible", "Pagado", "Activo", "Recibido"].includes(value) ? styles.success : value === "en_traslado" ? styles.transit : styles.warning}`}
    >
      {statusName(value)}
    </span>
  );
}
export function Card({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
type Option = { value: string; label: string };
type Field = {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: Option[];
  min?: string;
  max?: string;
  step?: string;
  help?: string;
};
type FormState = {
  title: string;
  resource: string;
  method: "POST" | "PATCH" | "DELETE";
  initial: Record<string, unknown>;
  fields: Field[];
  help?: string;
  reception?: boolean;
  packageOptions?: Package[];
};
type Action = (
  resource: string,
  method: string,
  body: Record<string, unknown>,
) => Promise<void>;
type WorkspaceProps = {
  data: DashboardData;
  section: string;
  tab: string;
  branch: string;
  mutate: Action;
  navigate: (section: string, tab?: string) => void;
};
const text = (
  name: string,
  label: string,
  required = false,
  type = "text",
): Field => ({ name, label, required, type });
const select = (
  name: string,
  label: string,
  options: Option[],
  required = true,
): Field => ({ name, label, options, required });
const sizes: Option[] = [1, 2, 3].map((n) => ({
  value: String(n),
  label: sizeName(n),
}));
const payers: Option[] = [
  { value: "destinatario", label: "Destinatario" },
  { value: "cliente", label: "Cliente que dejó el paquete" },
];
const methods: Option[] = ["efectivo", "qr", "transferencia"].map((x) => ({
  value: x,
  label: x.toUpperCase(),
}));

function FormDialog({
  form,
  data,
  close,
  mutate,
}: {
  form: FormState;
  data: DashboardData;
  close: () => void;
  mutate: Action;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(form.initial);
  const [packages, setPackages] = useState<Record<string, unknown>[]>([
    {
      descripcion: "",
      tamanio: "1",
      modalidad_pago: "pendiente",
      id_locker: "",
      id_destinatario: "",
    },
  ]);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  function control(
    field: Field,
    value: unknown,
    change: (v: string | boolean) => void,
    prefix = "",
  ) {
    const common = {
      id: `${prefix}${field.name}`,
      name: `${prefix}${field.name}`,
      required: field.required,
      disabled: busy,
    };
    return (
      <label
        className={field.type === "textarea" ? styles.fullField : ""}
        key={field.name}
        htmlFor={common.id}
      >
        <span>
          {field.label}
          {field.required ? " *" : ""}
        </span>
        {field.type === "checkbox" ? (
          <input
            {...common}
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => change(e.target.checked)}
          />
        ) : field.options ? (
          <select
            {...common}
            value={String(value ?? "")}
            onChange={(e) => change(e.target.value)}
          >
            <option value="">Seleccionar</option>
            {field.options.map((o) => (
              <option value={o.value} key={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : field.type === "textarea" ? (
          <textarea
            {...common}
            maxLength={2000}
            value={String(value ?? "")}
            onChange={(e) => change(e.target.value)}
          />
        ) : (
          <input
            {...common}
            autoComplete={field.type === "password" ? "new-password" : "off"}
            type={field.type || "text"}
            min={field.min}
            max={field.max}
            step={field.step}
            maxLength={
              field.type === "password"
                ? 200
                : field.name === "ci" || field.name.includes("telefono")
                  ? 30
                  : 150
            }
            value={String(value ?? "")}
            onChange={(e) => change(e.target.value)}
          />
        )}
        {field.help && <small>{field.help}</small>}
      </label>
    );
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await mutate(form.resource, form.method, {
        ...draft,
        ...(form.reception ? { paquetes: packages } : {}),
      });
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else close();
      }}
      aria-labelledby="dialog-title"
    >
      <form onSubmit={submit}>
        <div className={styles.dialogHeader}>
          <div>
            <p className={styles.eyebrow}>
              SGAP ·{" "}
              {form.method === "DELETE" ? "Confirmar eliminación" : "Registro"}
            </p>
            <h2 id="dialog-title">{form.title}</h2>
          </div>
          <button
            type="button"
            className={styles.iconButton}
            disabled={busy}
            onClick={close}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
        {form.help && <p className={styles.formHelp}>{form.help}</p>}
        <div className={styles.formGrid}>
          {form.fields.map((f) =>
            control(f, draft[f.name], (v) =>
              setDraft({ ...draft, [f.name]: v }),
            ),
          )}
        </div>
        {form.packageOptions && (
          <fieldset className={styles.packageSelect}>
            <legend>Paquetes *</legend>
            {form.packageOptions.length ? (
              form.packageOptions.map((p) => (
                <label key={p.id_paquete}>
                  <input
                    type="checkbox"
                    disabled={busy}
                    checked={((draft.paquetes as string[]) || []).includes(
                      p.id_paquete,
                    )}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        paquetes: e.target.checked
                          ? [
                              ...((draft.paquetes as string[]) || []),
                              p.id_paquete,
                            ]
                          : ((draft.paquetes as string[]) || []).filter(
                              (x) => x !== p.id_paquete,
                            ),
                      })
                    }
                  />
                  <span>
                    <strong>{p.codigo}</strong> · {p.descripcion}
                    <small>
                      {p.sucursal?.nombre} · {statusName(p.estado)} · Saldo{" "}
                      {money(debt(p))}
                    </small>
                  </span>
                </label>
              ))
            ) : (
              <p>No hay paquetes disponibles para esta operación.</p>
            )}
          </fieldset>
        )}
        {form.reception && (
          <div className={styles.packageDrafts}>
            {packages.map((p, index) => {
              const fields: Field[] = [
                text("codigo", "Código (vacío para generar)"),
                text("descripcion", "Descripción", true),
                select("tamanio", "Tamaño", sizes),
                {
                  ...text("peso_kg", "Peso en kg", false, "number"),
                  min: "0.001",
                  step: "0.001",
                },
                select("modalidad_pago", "Pago", [
                  { value: "pendiente", label: "Paga al recoger" },
                  {
                    value: "anticipado",
                    label: "Anticipado: efectivo recibido",
                  },
                ]),
                select(
                  "id_destinatario",
                  "Cuenta del destinatario (opcional)",
                  data.clientes
                    .filter((c) => c.persona.activo)
                    .map((c) => ({
                      value: c.id_cliente,
                      label: `${c.persona.nombre} · ${c.persona.ci || "Sin CI"}`,
                    })),
                  false,
                ),
                text("nombre_destinatario", "Nombre del destinatario"),
                text("ci_destinatario", "CI del destinatario"),
                text("telefono_destinatario", "Teléfono del destinatario"),
                select(
                  "id_locker",
                  "Locker (opcional)",
                  data.lockers
                    .filter(
                      (l) =>
                        !l.paquete &&
                        l.habilitado &&
                        l.id_sucursal === draft.id_sucursal &&
                        l.tamanio >= Number(p.tamanio) &&
                        !packages.some(
                          (other, j) =>
                            j !== index && other.id_locker === l.id_locker,
                        ),
                    )
                    .map((l) => ({
                      value: l.id_locker,
                      label: `${l.codigo} · ${sizeName(l.tamanio)}`,
                    })),
                  false,
                ),
              ];
              return (
                <fieldset key={index}>
                  <legend>Paquete {index + 1}</legend>
                  <div className={styles.formGrid}>
                    {fields.map((f) =>
                      control(
                        f,
                        p[f.name],
                        (v) =>
                          setPackages(
                            packages.map((old, j) =>
                              j === index
                                ? {
                                    ...old,
                                    [f.name]: v,
                                    ...(f.name === "tamanio"
                                      ? { id_locker: "" }
                                      : {}),
                                  }
                                : old,
                            ),
                          ),
                        `paquete-${index}-`,
                      ),
                    )}
                  </div>
                  {packages.length > 1 && (
                    <button
                      type="button"
                      className={styles.textButton}
                      onClick={() =>
                        setPackages(packages.filter((_, j) => j !== index))
                      }
                    >
                      Quitar paquete
                    </button>
                  )}
                </fieldset>
              );
            })}
            <button
              type="button"
              className={styles.secondary}
              disabled={packages.length >= 50 || busy}
              onClick={() =>
                setPackages([
                  ...packages,
                  {
                    descripcion: "",
                    tamanio: "1",
                    modalidad_pago: "pendiente",
                  },
                ])
              }
            >
              + Agregar otro paquete
            </button>
            <p className={styles.muted}>
              Cada paquete puede tener un destinatario y un locker diferentes.
              La cuenta del destinatario permite que consulte el envío en su
              panel.
            </p>
          </div>
        )}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <div className={styles.dialogFooter}>
          <button
            type="button"
            className={styles.secondary}
            disabled={busy}
            onClick={close}
          >
            Cancelar
          </button>
          <button className={styles.primary} disabled={busy}>
            {busy
              ? "Guardando…"
              : form.method === "DELETE"
                ? "Eliminar registro"
                : "Guardar"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

export default function Workspace({
  data,
  section,
  tab,
  branch,
  mutate,
  navigate,
}: WorkspaceProps) {
  const [form, setForm] = useState<FormState | null>(null);
  const [detail, setDetail] = useState<Package | Document | null>(null);
  const [qr, setQr] = useState("");
  const nivel = data.usuario.nivel,
    admin = nivel === 1,
    staffReception = nivel === 1 || nivel === 2,
    storage = nivel === 1 || nivel === 3,
    client = nivel === 4;
  const branchId =
    branch ||
    data.usuario.id_sucursal ||
    data.sucursales.find((b) => b.activa)?.id_sucursal ||
    "";
  const packages = data.paquetes.filter(
      (p) => !branch || p.id_sucursal_actual === branch,
    ),
    lockers = data.lockers.filter((l) => !branch || l.id_sucursal === branch);
  const branchOptions = data.sucursales
    .filter(
      (b) => b.activa && (admin || b.id_sucursal === data.usuario.id_sucursal),
    )
    .map((b) => ({ value: b.id_sucursal, label: b.nombre }));
  const allBranches = data.sucursales
    .filter((b) => b.activa)
    .map((b) => ({ value: b.id_sucursal, label: b.nombre }));
  const branchName = (id: string) =>
    data.sucursales.find((b) => b.id_sucursal === id)?.nombre || "—";
  const code = (id: string) =>
    data.paquetes.find((p) => p.id_paquete === id)?.codigo || `Paquete ${id}`;
  const clientName = (p: Package) =>
    data.clientes.find(
      (c) =>
        c.id_cliente ===
        p.detalle_documento.find((d) => d.tipo_documento === "recepcion")
          ?.documento.id_cliente,
    )?.persona.nombre ||
    p.detalle_documento.find((d) => d.tipo_documento === "recepcion")
      ?.nombre_destinatario ||
    "—";
  function open(
    title: string,
    resource: string,
    fields: Field[],
    initial: Record<string, unknown> = {},
    method: FormState["method"] = "POST",
    extras: Partial<FormState> = {},
  ) {
    setForm({ title, resource, fields, initial, method, ...extras });
  }
  function remove(
    title: string,
    resource: string,
    initial: Record<string, unknown>,
  ) {
    open(title, resource, [], initial, "DELETE", {
      help: "La eliminación es definitiva y se permite únicamente si el registro no tiene historial asociado. Si está en uso, desactívelo.",
    });
  }
  function reception() {
    open(
      "Nueva recepción",
      "recepciones",
      [
        select("id_sucursal", "Sucursal", branchOptions),
        select(
          "id_cliente",
          "Cliente que deja los paquetes",
          data.clientes
            .filter((c) => c.persona.activo)
            .map((c) => ({
              value: c.id_cliente,
              label: `${c.persona.nombre} · ${c.persona.ci || "Sin CI"}`,
            })),
        ),
        text("observaciones", "Observaciones", false, "textarea"),
      ],
      { id_sucursal: branchId },
      "POST",
      {
        reception: true,
        help: "Un documento agrupa todos los paquetes de esta recepción. El pago anticipado registra el ingreso efectivo de dinero.",
      },
    );
  }
  function delivery(p?: Package) {
    open(
      "Registrar entrega",
      "entregas",
      [
        select("id_sucursal", "Sucursal", branchOptions),
        text("ci_destinatario", "CI de quien recoge"),
        text("nombre_destinatario", "Nombre (opcional)"),
        text("telefono_destinatario", "Teléfono (opcional)"),
        text("observaciones", "Observaciones", false, "textarea"),
      ],
      {
        id_sucursal: p?.id_sucursal_actual || branchId,
        paquetes: p ? [p.id_paquete] : [],
      },
      "POST",
      {
        packageOptions: packages.filter((p) =>
          ["recibido", "almacenado"].includes(p.estado),
        ),
        help: "Todos los paquetes deben pertenecer a la sucursal elegida y tener saldo cero. El sistema libera sus lockers al entregar.",
      },
    );
  }
  function locate(p: Package) {
    open(
      p.id_locker ? "Reubicar paquete" : "Asignar locker",
      "ubicaciones",
      [
        select(
          "id_locker",
          "Locker compatible",
          data.lockers
            .filter(
              (l) =>
                l.id_sucursal === p.id_sucursal_actual &&
                l.habilitado &&
                (!l.paquete || l.paquete.id_paquete === p.id_paquete) &&
                l.tamanio >= p.tamanio,
            )
            .map((l) => ({
              value: l.id_locker,
              label: `${l.codigo} · ${sizeName(l.tamanio)}`,
            })),
          false,
        ),
      ],
      { id: p.id_paquete, id_locker: p.id_locker || "" },
      "PATCH",
      {
        help: "Deje el locker vacío para retirar la ubicación. El paquete permanece en la sucursal.",
      },
    );
  }
  function payment(p: Package, refund = false) {
    open(
      refund ? "Devolución monetaria total" : "Registrar cobro completo",
      refund ? "devoluciones" : "cobros",
      [
        select("id_sucursal", "Caja / sucursal", allBranches),
        select(
          "pagador",
          refund ? "Receptor del dinero" : "Quién paga",
          payers,
        ),
        select("medio", "Medio de pago", methods),
        ...(refund
          ? [text("motivo", "Motivo de devolución", true, "textarea")]
          : []),
      ],
      {
        id_paquete: p.id_paquete,
        id_sucursal: p.id_sucursal_actual || branchId,
        pagador: refund ? "cliente" : "destinatario",
        medio: "efectivo",
      },
      "POST",
      {
        help: `${p.codigo} · ${refund ? "Se devuelve la totalidad del dinero cobrado. Esta operación no devuelve físicamente el paquete." : `Saldo mostrado: ${money(debt(p))}. Los recargos se recalculan al confirmar. Registre el cobro después de recibir el dinero.`}`,
      },
    );
  }
  function createCustomerAccess(c: Client) {
    const parts = c.persona.nombre.trim().split(/\s+/);
    open(
      "Crear acceso de cliente",
      "clientes",
      [
        text("nombre", "Nombre", true),
        text("apellido", "Apellidos", true),
        text("correo", "Correo de acceso", true, "email"),
        {
          ...text("password", "Contraseña inicial", true, "password"),
          help: "Al menos 8 caracteres. Entregue estas credenciales al cliente por su canal habitual.",
        },
      ],
      {
        id: c.id_cliente,
        accion: "crear_cuenta",
        nombre: parts[0] || "",
        apellido: parts.slice(1).join(" "),
        correo: c.persona.correo || "",
      },
      "PATCH",
      {
        help: "Habilita una cuenta vinculada a esta ficha y a su historial. Verifique la identidad del cliente antes de crearla.",
      },
    );
  }
  function customer(c: Client) {
    open(
      "Editar cliente",
      "clientes",
      [
        text("nombre", "Nombre completo", true),
        text("ci", "CI"),
        text("correo", "Correo", false, "email"),
        text("telefono", "Teléfono"),
        text("observaciones", "Observaciones", false, "textarea"),
        ...(admin
          ? [text("activo", "Cliente activo", false, "checkbox")]
          : []),
      ],
      { id: c.id_cliente, ...c.persona, observaciones: c.observaciones },
      "PATCH",
      {
        help: "La ficha no crea una cuenta. El administrador puede habilitarla con Crear acceso. Si ya tiene cuenta, su nombre se modifica desde Mi cuenta y se conservan su CI y correo.",
      },
    );
  }
  function lockerForm(l?: Locker) {
    open(
      l ? "Editar locker" : "Nuevo locker",
      "lockers",
      [
        select("id_sucursal", "Sucursal", branchOptions),
        text("codigo", "Código del locker", true),
        select("tamanio", "Tamaño", sizes),
        text("habilitado", "Habilitado", false, "checkbox"),
      ],
      l
        ? {
            id: l.id_locker,
            id_sucursal: l.id_sucursal,
            codigo: l.codigo,
            tamanio: String(l.tamanio),
            habilitado: l.habilitado,
          }
        : { id_sucursal: branchId, tamanio: "1", habilitado: true },
      l ? "PATCH" : "POST",
    );
  }
  function branchForm(b?: Branch) {
    open(
      b ? "Editar sucursal" : "Nueva sucursal",
      "sucursales",
      [
        text("nombre", "Nombre", true),
        text("direccion", "Dirección"),
        text("activa", "Activa", false, "checkbox"),
      ],
      b ? { ...b, id: b.id_sucursal } : { activa: true },
      b ? "PATCH" : "POST",
    );
  }
  function staffForm(s: Staff) {
    open(
      "Editar empleado",
      "personal",
      [
        text("nombre", "Nombre", true),
        text("apellido", "Apellidos", true),
        text("ci", "CI", true),
        text("correo", "Correo", true, "email"),
        text("telefono", "Teléfono"),
        select("nivel", "Cargo", [
          { value: "1", label: "Administrador" },
          { value: "2", label: "Recepcionista" },
          { value: "3", label: "Almacenero" },
        ]),
        select("id_sucursal", "Sucursal", allBranches),
        {
          ...text(
            "password",
            "Nueva contraseña (opcional)",
            false,
            "password",
          ),
          help: "Al menos 8 caracteres.",
        },
        text("activo", "Cuenta activa", false, "checkbox"),
      ],
      {
        ...s,
        id: s.id,
        nivel: String(s.rol.nivel),
        id_sucursal: s.persona.empleado.id_sucursal,
      },
      "PATCH",
    );
  }
  function transfer(t?: Transfer) {
    open(
      t ? "Editar traslado" : "Preparar traslado",
      "traslados",
      [
        ...(!t
          ? [select("id_sucursal_origen", "Sucursal de origen", branchOptions)]
          : []),
        select("id_sucursal_destino", "Sucursal de destino", allBranches),
        text("observaciones", "Observaciones", false, "textarea"),
      ],
      t
        ? {
            id: t.id_traslado,
            id_sucursal_destino: t.id_sucursal_destino,
            observaciones: t.observaciones,
          }
        : { id_sucursal_origen: branchId, paquetes: [] },
      t ? "PATCH" : "POST",
      !t
        ? {
            packageOptions: packages.filter(
              (p) =>
                ["recibido", "almacenado"].includes(p.estado) &&
                !data.traslados.some(
                  (t) =>
                    ["preparado", "en_traslado"].includes(t.estado) &&
                    t.detalle_traslado.some(
                      (d) =>
                        d.paquete.id_paquete === p.id_paquete && !d.recibido_en,
                    ),
                ),
            ),
            help: "Seleccione paquetes de la sucursal de origen. Sus lockers se liberan al despachar.",
          }
        : {},
    );
  }
  async function packageDetail(p: Package) {
    setQr("");
    setDetail(p);
    const QRCode = (await import("qrcode")).default;
    setQr(await QRCode.toDataURL(p.codigo, { width: 180, margin: 1 }));
  }
  const packageColumns: Column<Package>[] = [
    { title: "Paquete", value: (p) => p.codigo },
    { title: "Cliente / destinatario", value: clientName },
    {
      title: "Estado",
      value: (p) => <Badge value={p.estado} />,
      search: (p) => statusName(p.estado),
    },
    {
      title: "Sucursal / locker",
      value: (p) =>
        `${p.sucursal?.nombre || "En tránsito"} · ${p.locker?.codigo || "Sin locker"}`,
    },
    { title: "Saldo", value: (p) => money(debt(p)) },
  ];
  function packageTable(rows: Package[], action?: (p: Package) => ReactNode) {
    return (
      <Table
        key={`${section}-${tab}`}
        rows={rows}
        columns={packageColumns}
        rowKey={(p) => p.id_paquete}
        exportName={admin ? "paquetes" : undefined}
        actions={(p) => (
          <>
            <button
              className={styles.textButton}
              onClick={() => packageDetail(p)}
            >
              Ver detalle →
            </button>
            {action?.(p)}
          </>
        )}
      />
    );
  }
  const scopedTransfers = data.traslados.filter(
    (t) =>
      !branch ||
      t.id_sucursal_origen === branch ||
      t.id_sucursal_destino === branch,
  );
  function transferTable(rows: Transfer[]) {
    return (
      <Table
        rows={rows}
        rowKey={(t) => t.id_traslado}
        exportName={admin ? "traslados" : undefined}
        columns={[
          { title: "Traslado", value: (t) => `TR-${t.id_traslado}` },
          { title: "Origen", value: (t) => branchName(t.id_sucursal_origen) },
          { title: "Destino", value: (t) => branchName(t.id_sucursal_destino) },
          {
            title: "Paquetes",
            value: (t) =>
              t.detalle_traslado
                .map((d) => `${d.paquete.codigo}${d.recibido_en ? " ✓" : ""}`)
                .join(", "),
          },
          {
            title: "Estado",
            value: (t) => (
              <Badge value={t.estado === "recibido" ? "Recibido" : t.estado} />
            ),
            search: (t) =>
              t.estado === "recibido" ? "Recibido" : statusName(t.estado),
          },
          { title: "Fecha", value: (t) => date(t.creado_en) },
        ]}
        actions={
          storage
            ? (t) => (
                <>
                  {t.estado === "preparado" &&
                    (admin ||
                      t.id_sucursal_origen === data.usuario.id_sucursal) && (
                      <>
                        <button
                          className={styles.textButton}
                          onClick={() => transfer(t)}
                        >
                          Editar
                        </button>
                        <button
                          className={styles.textButton}
                          onClick={() =>
                            open(
                              "Confirmar despacho",
                              "traslados",
                              [],
                              { id: t.id_traslado, accion: "despachar" },
                              "PATCH",
                              {
                                help: `Se despacharán ${t.detalle_traslado.length} paquetes hacia ${branchName(t.id_sucursal_destino)}. Sus lockers quedarán libres.`,
                              },
                            )
                          }
                        >
                          Despachar
                        </button>
                        <button
                          className={styles.textButton}
                          onClick={() =>
                            remove("Eliminar traslado preparado", "traslados", {
                              id: t.id_traslado,
                            })
                          }
                        >
                          Eliminar
                        </button>
                      </>
                    )}
                  {t.estado === "en_traslado" &&
                    (admin ||
                      t.id_sucursal_destino === data.usuario.id_sucursal) &&
                    t.detalle_traslado
                      .filter((d) => !d.recibido_en)
                      .map((d) => (
                        <button
                          key={d.id_detalle_traslado}
                          className={styles.textButton}
                          onClick={() =>
                            open(
                              `Recibir ${d.paquete.codigo}`,
                              "traslados",
                              [
                                select(
                                  "id_locker",
                                  "Locker de destino (opcional)",
                                  data.lockers
                                    .filter(
                                      (l) =>
                                        l.id_sucursal ===
                                          t.id_sucursal_destino &&
                                        !l.paquete &&
                                        l.habilitado &&
                                        l.tamanio >= d.paquete.tamanio,
                                    )
                                    .map((l) => ({
                                      value: l.id_locker,
                                      label: `${l.codigo} · ${sizeName(l.tamanio)}`,
                                    })),
                                  false,
                                ),
                              ],
                              {
                                id: t.id_traslado,
                                id_detalle: d.id_detalle_traslado,
                                accion: "recibir",
                                id_locker: "",
                              },
                              "PATCH",
                            )
                          }
                        >
                          Recibir {d.paquete.codigo}
                        </button>
                      ))}
                </>
              )
            : undefined
        }
      />
    );
  }
  function notify(a: Alert) {
    open(
      "Registrar aviso realizado",
      "notificaciones",
      [text("contenido", "Mensaje enviado / comunicado", true, "textarea")],
      {
        id_pago_pendiente: a.id_pago_pendiente,
        tipo: a.tipo,
        telefono: a.telefono,
        contenido: `Recordatorio: el paquete ${a.codigo} tiene un saldo de ${money(a.monto)} con fecha límite ${date(a.vence_en)}.`,
      },
      "POST",
      {
        help: `Destinatario: ${a.nombre_destinatario || "Sin nombre"} · ${a.telefono}. Registre únicamente después de comunicar el aviso por teléfono o su canal habitual. Este formulario no envía mensajes.`,
      },
    );
  }
  let content: ReactNode;
  if (section === "general") {
    const active = packages.filter((p) => p.estado !== "entregado"),
      unlocated = active.filter(
        (p) => !p.id_locker && p.estado !== "en_traslado",
      );
    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/La_Paz",
    });
    const deliveredToday = packages.filter(
      (p) =>
        p.fecha_entrega &&
        new Date(p.fecha_entrega).toLocaleDateString("en-CA", {
          timeZone: "America/La_Paz",
        }) === today,
    ).length;
    const stats = client
      ? [
          [
            "Mis paquetes activos",
            active.length,
            "Sigue el estado de cada envío",
          ],
          [
            "Paquetes entregados",
            packages.length - active.length,
            "Historial de entregas",
          ],
          [
            "Saldo pendiente",
            money(packages.reduce((a, p) => a + debt(p), 0)),
            "Consulta el detalle de tus cargos",
          ],
          [
            "Avisos recibidos",
            data.notificaciones.length,
            "Recordatorios registrados",
          ],
        ]
      : [
          [
            "Paquetes en custodia",
            active.length,
            "Distribuidos en tu ámbito de trabajo",
          ],
          ["Entregas de hoy", deliveredToday, "Operaciones registradas"],
          [
            "Lockers disponibles",
            lockers.filter((l) => l.habilitado && !l.paquete).length,
            "Consulta por tamaño",
          ],
          [
            "Traslados en curso",
            scopedTransfers.filter((t) => t.estado === "en_traslado").length,
            "Consulta su avance",
          ],
        ];
    content = (
      <>
        <div className={styles.banner}>
          <h2>
            {client
              ? "Tus paquetes, siempre a la vista."
              : admin
                ? "Toda la operación, en un solo lugar."
                : nivel === 3
                  ? "Cada paquete, en su lugar."
                  : "Tu jornada comienza aquí."}
          </h2>
          <p>
            {client
              ? "Consulta el seguimiento, tus pagos y los avisos de tus envíos."
              : "Accede a las tareas pendientes y al estado de tu sucursal."}
          </p>
        </div>
        <div className={styles.stats}>
          {stats.map(([label, value, help]) => (
            <section key={label} className={styles.stat}>
              <p>{label}</p>
              <strong>{value}</strong>
              <small>{help}</small>
            </section>
          ))}
        </div>
        <div className={styles.quickActions}>
          {staffReception && (
            <>
              <button className={styles.primary} onClick={reception}>
                Nueva recepción
              </button>
              <button className={styles.secondary} onClick={() => delivery()}>
                Registrar entrega
              </button>
            </>
          )}
          {nivel === 3 && (
            <button
              className={styles.primary}
              onClick={() => navigate("almacenes", "Por ubicar")}
            >
              Ubicar paquetes
            </button>
          )}
          <button
            className={styles.secondary}
            onClick={() =>
              navigate(
                client ? "paquetes" : "almacenes",
                client
                  ? "Activos"
                  : nivel === 2
                    ? "Ubicación de paquetes"
                    : "Por ubicar",
              )
            }
          >
            {client ? "Ver mis paquetes" : "Buscar paquete"}
          </button>
        </div>
        <div className={styles.twoColumns}>
          <Card title={client ? "Mis pendientes" : "Requieren atención"}>
            <div className={styles.activity}>
              <button
                onClick={() =>
                  navigate(
                    client ? "pagos" : "almacenes",
                    client ? "Pendientes" : "Por ubicar",
                  )
                }
              >
                <strong>
                  {client
                    ? `${money(packages.reduce((a, p) => a + debt(p), 0))} por pagar`
                    : `${unlocated.length} paquetes sin ubicación`}
                </strong>
                <small>
                  {client
                    ? "Consulta tus cargos pendientes"
                    : "Asigna un casillero compatible"}
                </small>
              </button>
              <button
                onClick={() =>
                  navigate(
                    client ? "paquetes" : "traslados",
                    client ? "Traslados" : "Historial",
                  )
                }
              >
                <strong>
                  {
                    scopedTransfers.filter((t) => t.estado === "en_traslado")
                      .length
                  }{" "}
                  traslados en camino
                </strong>
                <small>Consulta el avance de cada paquete</small>
              </button>
            </div>
          </Card>
          <Card title="Actividad reciente">
            <div className={styles.activity}>
              {packages.slice(0, 3).map((p) => (
                <button key={p.id_paquete} onClick={() => packageDetail(p)}>
                  <strong>
                    {p.codigo} · {statusName(p.estado)}
                  </strong>
                  <small>
                    {p.descripcion} · {date(p.fecha_ingreso)}
                  </small>
                </button>
              ))}
              {!packages.length && (
                <p className={styles.muted}>Aún no se registraron paquetes.</p>
              )}
            </div>
          </Card>
        </div>
        <Card title="Paquetes recientes">
          {packageTable(packages.slice(0, 10))}
        </Card>
      </>
    );
  } else if (section === "recepcion") {
    if (tab === "Documentos registrados") {
      content = (
        <Card title="Documentos registrados">
          <Table
            rows={data.documentos.filter(
              (d) => !branch || d.id_sucursal === branch,
            )}
            rowKey={(d) => d.id_documento}
            columns={[
              {
                title: "Documento",
                value: (d) =>
                  `${d.tipo === "recepcion" ? "RC" : "EN"}-${d.id_documento}`,
              },
              { title: "Tipo", value: (d) => d.tipo },
              { title: "Fecha", value: (d) => date(d.fecha) },
              {
                title: "Cliente",
                value: (d) => d.cliente?.persona.nombre || "Entrega",
              },
              {
                title: "Paquetes",
                value: (d) =>
                  d.detalle_documento.map((x) => x.paquete.codigo).join(", "),
              },
            ]}
            actions={(d) => (
              <button
                className={styles.textButton}
                onClick={() => setDetail(d)}
              >
                Ver documento →
              </button>
            )}
          />
        </Card>
      );
    } else if (tab === "Corregir recepción") {
      content = (
        <>
          <div className={styles.sectionNotice}>
            Solo se pueden corregir la descripción y el peso de los paquetes
            recibidos o almacenados. La recepción y su documento se conservan;
            no se permite eliminar registros.
          </div>
          <Card title="Recepciones que pueden corregirse">
            {packageTable(
              packages.filter((p) =>
                ["recibido", "almacenado"].includes(p.estado),
              ),
              (p) => (
                <button
                  className={styles.textButton}
                  onClick={() =>
                    open(
                      "Corregir recepción",
                      "paquetes",
                      [
                        text("descripcion", "Descripción", true, "textarea"),
                        {
                          ...text("peso_kg", "Peso en kg", false, "number"),
                          min: "0.001",
                          step: "0.001",
                        },
                      ],
                      {
                        id: p.id_paquete,
                        descripcion: p.descripcion,
                        peso_kg: p.peso_kg || "",
                      },
                      "PATCH",
                      {
                        help: "La corrección está limitada a la descripción y al peso. No cambia el código, la fecha, la sucursal, el destinatario ni el documento original.",
                      },
                    )
                  }
                >
                  Corregir
                </button>
              ),
            )}
          </Card>
        </>
      );
    } else {
      content = (
        <>
          <div className={styles.sectionNotice}>
            Un documento puede contener varios paquetes con diferentes
            destinatarios y lockers.
          </div>
          <Card
            title="Paquetes recibidos"
            action={
              <button className={styles.primary} onClick={reception}>
                Nueva recepción
              </button>
            }
          >
            {packageTable(
              packages.filter((p) =>
                ["recibido", "almacenado"].includes(p.estado),
              ),
            )}
          </Card>
        </>
      );
    }
  } else if (section === "entregas") {
    content = (
      <>
        <div className={styles.sectionNotice}>
          Verifica el código, la sucursal y el saldo completo antes de entregar.
        </div>
        <Card
          title="Paquetes por entregar"
          action={
            <button className={styles.primary} onClick={() => delivery()}>
              Registrar entrega
            </button>
          }
        >
          {packageTable(
            packages.filter((p) =>
              ["recibido", "almacenado"].includes(p.estado),
            ),
            (p) => (
              <button
                className={styles.textButton}
                disabled={debt(p) > 0}
                onClick={() => delivery(p)}
              >
                {debt(p) > 0 ? "Saldo pendiente" : "Entregar"}
              </button>
            ),
          )}
        </Card>
      </>
    );
  } else if (section === "almacenes") {
    if (tab === "Sucursales")
      content = (
        <Card
          title="Sucursales"
          action={
            <button className={styles.primary} onClick={() => branchForm()}>
              Nueva sucursal
            </button>
          }
        >
          <Table
            rows={data.sucursales}
            rowKey={(b) => b.id_sucursal}
            columns={[
              { title: "Sucursal", value: (b) => b.nombre },
              { title: "Dirección", value: (b) => b.direccion || "—" },
              {
                title: "Estado",
                value: (b) => (b.activa ? "Activa" : "Inactiva"),
              },
            ]}
            actions={(b) => (
              <>
                <button
                  className={styles.textButton}
                  onClick={() => branchForm(b)}
                >
                  Editar
                </button>
                <button
                  className={styles.textButton}
                  onClick={() =>
                    remove("Eliminar sucursal", "sucursales", {
                      id: b.id_sucursal,
                    })
                  }
                >
                  Eliminar
                </button>
              </>
            )}
          />
        </Card>
      );
    else if (
      ["Por ubicar", "Reubicaciones", "Ubicación de paquetes"].includes(tab)
    )
      content = (
        <Card title={tab}>
          {packageTable(
            packages.filter((p) =>
              tab === "Por ubicar"
                ? p.estado === "recibido" && !p.id_locker
                : ["recibido", "almacenado"].includes(p.estado),
            ),
            storage
              ? (p) => (
                  <button
                    className={styles.textButton}
                    onClick={() => locate(p)}
                  >
                    {p.id_locker ? "Reubicar" : "Asignar locker"}
                  </button>
                )
              : undefined,
          )}
        </Card>
      );
    else
      content = (
        <>
          <div className={styles.legend}>
            <span>
              <i className={styles.freeDot} />
              Disponible:{" "}
              {lockers.filter((l) => l.habilitado && !l.paquete).length}
            </span>
            <span>
              <i className={styles.occupiedDot} />
              Ocupado: {lockers.filter((l) => l.paquete).length}
            </span>
            <span>
              <i className={styles.disabledDot} />
              Deshabilitado: {lockers.filter((l) => !l.habilitado).length}
            </span>
          </div>
          <Card
            title={
              tab === "Administración de lockers"
                ? "Administración de lockers"
                : "Ocupación por locker"
            }
            action={
              storage && (
                <button className={styles.primary} onClick={() => lockerForm()}>
                  Nuevo locker
                </button>
              )
            }
          >
            {tab === "Administración de lockers" ? (
              <Table
                rows={lockers}
                rowKey={(l) => l.id_locker}
                columns={[
                  { title: "Locker", value: (l) => l.codigo },
                  { title: "Sucursal", value: (l) => l.sucursal.nombre },
                  { title: "Tamaño", value: (l) => sizeName(l.tamanio) },
                  {
                    title: "Estado",
                    value: (l) =>
                      !l.habilitado
                        ? "Deshabilitado"
                        : l.paquete
                          ? "Ocupado"
                          : "Disponible",
                  },
                ]}
                actions={(l) => (
                  <>
                    <button
                      className={styles.textButton}
                      disabled={!!l.paquete}
                      onClick={() => lockerForm(l)}
                    >
                      Editar
                    </button>
                    <button
                      className={styles.textButton}
                      disabled={!!l.paquete}
                      onClick={() =>
                        remove("Eliminar locker", "lockers", {
                          id: l.id_locker,
                          id_sucursal: l.id_sucursal,
                          tamanio: l.tamanio,
                        })
                      }
                    >
                      Eliminar
                    </button>
                  </>
                )}
              />
            ) : (
              <div className={styles.lockerGrid}>
                {lockers.map((l) => (
                  <button
                    key={l.id_locker}
                    className={`${styles.locker} ${!l.habilitado ? styles.disabledLocker : l.paquete ? styles.occupiedLocker : styles.freeLocker}`}
                    onClick={() => {
                      const p = data.paquetes.find(
                        (p) => p.id_paquete === l.paquete?.id_paquete,
                      );
                      if (p) packageDetail(p);
                      else if (storage) lockerForm(l);
                    }}
                  >
                    <span>{l.sucursal.nombre}</span>
                    <strong>{l.codigo}</strong>
                    <small>{sizeName(l.tamanio)}</small>
                    <b>
                      {!l.habilitado
                        ? "Deshabilitado"
                        : l.paquete?.codigo || "Disponible"}
                    </b>
                  </button>
                ))}
                {!lockers.length && (
                  <p className={styles.muted}>
                    No hay lockers registrados en esta sucursal.
                  </p>
                )}
              </div>
            )}
          </Card>
        </>
      );
  } else if (
    section === "traslados" ||
    (section === "paquetes" && tab === "Traslados")
  ) {
    content = (
      <Card
        title={client ? "Traslados de mis paquetes" : tab}
        action={
          storage && (
            <button className={styles.primary} onClick={() => transfer()}>
              Preparar traslado
            </button>
          )
        }
      >
        {transferTable(
          scopedTransfers.filter((t) =>
            tab === "Preparación" || tab === "Despachos"
              ? t.estado === "preparado"
              : tab === "Recepciones"
                ? t.estado === "en_traslado" &&
                  (admin || t.id_sucursal_destino === data.usuario.id_sucursal)
                : tab === "En curso"
                  ? t.estado !== "recibido"
                  : true,
          ),
        )}
      </Card>
    );
  } else if (section === "pagos") {
    if (tab === "Tarifas")
      content = (
        <Card
          title="Tarifas de almacenamiento"
          action={
            <button
              className={styles.primary}
              onClick={() =>
                open(
                  "Editar tarifas",
                  "tarifas",
                  [
                    {
                      ...text(
                        "importe_inicial",
                        "Importe inicial (Bs)",
                        true,
                        "number",
                      ),
                      min: "0.01",
                      step: "0.01",
                    },
                    {
                      ...text(
                        "recargo_semanal",
                        "Recargo por semana iniciada (Bs)",
                        true,
                        "number",
                      ),
                      min: "0.01",
                      step: "0.01",
                    },
                    {
                      ...text(
                        "dias_iniciales",
                        "Días iniciales",
                        true,
                        "number",
                      ),
                      min: "1",
                      max: "365",
                      step: "1",
                    },
                  ],
                  data.configuracion,
                  "PATCH",
                  {
                    help: "Los nuevos valores se aplican únicamente a futuras recepciones. Cada paquete conserva sus tarifas originales.",
                  },
                )
              }
            >
              Editar tarifas
            </button>
          }
        >
          <dl className={styles.detailGrid}>
            <div>
              <dt>Importe inicial</dt>
              <dd>{money(data.configuracion.importe_inicial)}</dd>
            </div>
            <div>
              <dt>Plazo inicial</dt>
              <dd>{data.configuracion.dias_iniciales} días</dd>
            </div>
            <div>
              <dt>Recargo semanal</dt>
              <dd>{money(data.configuracion.recargo_semanal)}</dd>
            </div>
          </dl>
          <p className={styles.muted}>
            El recargo se genera automáticamente al pasar la fecha límite, sin
            tolerancia. No se permiten pagos parciales.
          </p>
        </Card>
      );
    else if (["Cobros", "Realizados"].includes(tab))
      content = (
        <Card title="Historial de movimientos">
          <Table
            rows={data.movimientos.filter(
              (m) =>
                (!branch || m.id_sucursal === branch) &&
                (tab !== "Cobros" || m.tipo === "entrada"),
            )}
            rowKey={(m) => m.id_movimiento}
            exportName={admin ? "movimientos" : undefined}
            columns={[
              { title: "Movimiento", value: (m) => `MV-${m.id_movimiento}` },
              { title: "Paquete", value: (m) => code(m.id_paquete) },
              { title: "Fecha", value: (m) => date(m.fecha) },
              { title: "Tipo", value: (m) => m.tipo },
              { title: "Importe", value: (m) => money(m.monto) },
              { title: "Pagador / receptor", value: (m) => m.pagador },
              { title: "Medio", value: (m) => m.medio },
            ]}
          />
        </Card>
      );
    else
      content = (
        <Card
          title={
            tab === "Devoluciones"
              ? "Devoluciones monetarias"
              : "Pagos pendientes"
          }
        >
          {packageTable(
            packages.filter((p) =>
              tab === "Devoluciones"
                ? !!p.pago_anticipado ||
                  p.pago_pendiente.some((x) => x.movimiento)
                : debt(p) > 0,
            ),
            admin
              ? (p) =>
                  tab === "Devoluciones" ? (
                    p.devolucion ? (
                      <span>Devuelto: {money(p.devolucion.monto)}</span>
                    ) : (
                      <button
                        className={styles.textButton}
                        onClick={() => payment(p, true)}
                      >
                        Devolver total
                      </button>
                    )
                  ) : (
                    <button
                      className={styles.textButton}
                      onClick={() => payment(p)}
                    >
                      Cobrar {money(debt(p))}
                    </button>
                  )
              : undefined,
          )}
        </Card>
      );
  } else if (section === "usuarios") {
    if (tab === "Cargos y accesos")
      content = (
        <Card title="Permisos por cargo">
          <Table
            rows={[
              {
                cargo: "Administrador",
                alcance: "Todas las sucursales",
                tareas:
                  "Recepción, entrega, ubicaciones, traslados, cuentas, caja, avisos y reportes",
              },
              {
                cargo: "Recepcionista",
                alcance: "Su sucursal",
                tareas:
                  "Registrar recepción y entrega; crear y editar fichas de clientes; consultar lockers y traslados",
              },
              {
                cargo: "Almacenero",
                alcance: "Su sucursal",
                tareas:
                  "Administrar lockers, ubicar paquetes, preparar y despachar traslados, recibir paquetes; consultar clientes vinculados",
              },
              {
                cargo: "Cliente",
                alcance: "Sus propios envíos",
                tareas:
                  "Seguimiento, consulta de pagos, leer y ocultar sus avisos, actualizar su cuenta",
              },
            ]}
            rowKey={(r) => r.cargo}
            columns={[
              { title: "Cargo", value: (r) => r.cargo },
              { title: "Alcance", value: (r) => r.alcance },
              { title: "Acceso", value: (r) => r.tareas },
            ]}
          />
          <p className={styles.muted}>
            Los cargos representan reglas del prototipo. Se aplican también en
            el servidor.
          </p>
        </Card>
      );
    else if (tab === "Nuevo usuario")
      content = (
        <>
          <div className={styles.twoColumns}>
            <Card
              title="Crear cuenta de empleado"
              action={
                <Link href="/registerEmpleado" className={styles.primary}>
                  Registrar empleado
                </Link>
              }
            >
              <p className={styles.muted}>
                Registre al personal que utilizará el sistema. Podrá asignar un
                cargo y una sucursal desde el formulario.
              </p>
            </Card>
            <Card
              title="Crear cuenta de cliente"
              action={
                <Link href="/registerCliente" className={styles.primary}>
                  Registrar cliente
                </Link>
              }
            >
              <p className={styles.muted}>
                Cree una cuenta para un cliente nuevo. Su perfil quedará
                disponible para relacionarlo con sus paquetes.
              </p>
            </Card>
          </div>
          <Card title="Crear acceso a un cliente registrado">
            <p className={styles.muted}>
              Habilite el acceso al sistema para un cliente que ya tiene una
              ficha, sin duplicar su información ni su historial.
            </p>
            <Table
              rows={data.clientes.filter(
                (c) => !c.persona.usuario && c.persona.activo && Boolean(c.persona.ci),
              )}
              rowKey={(c) => c.id_cliente}
              columns={[
                { title: "Cliente", value: (c) => c.persona.nombre },
                { title: "CI", value: (c) => c.persona.ci || "—" },
                { title: "Teléfono", value: (c) => c.persona.telefono || "—" },
                { title: "Correo", value: (c) => c.persona.correo || "—" },
              ]}
              actions={(c) => (
                <button
                  className={styles.textButton}
                  onClick={() => createCustomerAccess(c)}
                >
                  Crear acceso
                </button>
              )}
              empty="No hay clientes activos sin cuenta y con CI registrado."
            />
          </Card>
        </>
      );
    else if (tab === "Usuarios registrados")
      content = (
        <>
          <Card title="Personal registrado">
            <Table
              rows={data.personal.filter(
                (s) => !branch || s.persona.empleado.id_sucursal === branch,
              )}
              rowKey={(s) => String(s.id)}
              columns={[
                { title: "Nombre", value: (s) => `${s.nombre} ${s.apellido}` },
                { title: "CI", value: (s) => s.ci },
                { title: "Correo", value: (s) => s.correo },
                { title: "Cargo", value: (s) => s.rol.nombre_rol },
                {
                  title: "Sucursal",
                  value: (s) => branchName(s.persona.empleado.id_sucursal),
                },
                {
                  title: "Estado",
                  value: (s) => (s.activo ? "Activo" : "Inactivo"),
                },
              ]}
            />
          </Card>
          <Card title="Clientes registrados">
            <Table
              rows={data.clientes}
              rowKey={(c) => c.id_cliente}
              columns={[
                { title: "Cliente", value: (c) => c.persona.nombre },
                { title: "CI", value: (c) => c.persona.ci || "—" },
                { title: "Teléfono", value: (c) => c.persona.telefono || "—" },
                { title: "Correo", value: (c) => c.persona.correo || "—" },
                {
                  title: "Acceso al sistema",
                  value: (c) => (c.persona.usuario ? "Con cuenta" : "Sin cuenta"),
                },
                {
                  title: "Estado",
                  value: (c) => (c.persona.activo ? "Activo" : "Inactivo"),
                },
              ]}
            />
          </Card>
        </>
      );
    else if (tab === "Actualizar usuario")
      content = (
        <>
          <Card title="Actualizar datos del personal">
            <Table
              rows={data.personal.filter(
                (s) => !branch || s.persona.empleado.id_sucursal === branch,
              )}
              rowKey={(s) => String(s.id)}
              columns={[
                { title: "Nombre", value: (s) => `${s.nombre} ${s.apellido}` },
                { title: "Correo", value: (s) => s.correo },
                { title: "Cargo", value: (s) => s.rol.nombre_rol },
                {
                  title: "Sucursal",
                  value: (s) => branchName(s.persona.empleado.id_sucursal),
                },
                {
                  title: "Estado",
                  value: (s) => (s.activo ? "Activo" : "Inactivo"),
                },
              ]}
              actions={(s) => (
                <button
                  className={styles.textButton}
                  onClick={() => staffForm(s)}
                >
                  Editar
                </button>
              )}
            />
          </Card>
          <Card title="Actualizar datos de clientes">
            <Table
              rows={data.clientes}
              rowKey={(c) => c.id_cliente}
              columns={[
                { title: "Cliente", value: (c) => c.persona.nombre },
                { title: "CI", value: (c) => c.persona.ci || "—" },
                { title: "Teléfono", value: (c) => c.persona.telefono || "—" },
                { title: "Correo", value: (c) => c.persona.correo || "—" },
                {
                  title: "Acceso",
                  value: (c) => (c.persona.usuario ? "Con cuenta" : "Sin cuenta"),
                },
                {
                  title: "Estado",
                  value: (c) => (c.persona.activo ? "Activo" : "Inactivo"),
                },
              ]}
              actions={(c) => (
                <button
                  className={styles.textButton}
                  onClick={() => customer(c)}
                >
                  Editar
                </button>
              )}
            />
          </Card>
          <p className={styles.muted}>
            Las cuentas y fichas no se eliminan. Para retirar el acceso de un
            usuario, utilice la opción de desactivación del formulario de edición.
          </p>
        </>
      );
    else
      content = (
        <Card title="Usuarios">
          <p className={styles.muted}>
            Seleccione una opción del menú Usuarios para crear, consultar o
            actualizar cuentas y fichas del sistema.
          </p>
        </Card>
      );
  } else if (section === "clientes") {
    if (tab === "Historial")
      content = (
        <Card title="Historial de paquetes por cliente">
          {packageTable(packages)}
        </Card>
      );
    else
      content = (
        <Card
          title="Directorio de clientes"
          action={
            staffReception && (
              <Link href="/registerCliente" className={styles.primary}>
                Nuevo cliente
              </Link>
            )
          }
        >
          <Table
            rows={data.clientes}
            rowKey={(c) => c.id_cliente}
            columns={[
              { title: "Cliente", value: (c) => c.persona.nombre },
              { title: "CI", value: (c) => c.persona.ci || "—" },
              { title: "Teléfono", value: (c) => c.persona.telefono || "—" },
              { title: "Correo", value: (c) => c.persona.correo || "—" },
              {
                title: "Estado",
                value: (c) => (c.persona.activo ? "Activo" : "Inactivo"),
              },
            ]}
            actions={
              staffReception
                ? (c) => (
                    <button
                      className={styles.textButton}
                      onClick={() => customer(c)}
                    >
                      Editar
                    </button>
                  )
                : undefined
            }
          />
        </Card>
      );
  } else if (section === "notificaciones") {
    content =
      tab === "Por realizar" ? (
        <>
          <div className={styles.sectionNotice}>
            Se muestran avisos de pagos sin cobrar que vencen en uno o dos días
            y tienen teléfono de destinatario. No se guardan programaciones.
          </div>
          <Card title="Avisos por realizar">
            <Table
              rows={data.avisos.filter(
                (a) =>
                  !branch ||
                  data.paquetes.some(
                    (p) =>
                      p.id_paquete === a.id_paquete &&
                      p.id_sucursal_actual === branch,
                  ),
              )}
              rowKey={(a) => `${a.id_pago_pendiente}-${a.tipo}`}
              columns={[
                { title: "Paquete", value: (a) => a.codigo },
                {
                  title: "Destinatario",
                  value: (a) => a.nombre_destinatario || "—",
                },
                { title: "Teléfono", value: (a) => a.telefono },
                { title: "Vence", value: (a) => date(a.vence_en) },
                { title: "Tipo", value: (a) => a.tipo.replaceAll("_", " ") },
              ]}
              actions={(a) => (
                <button className={styles.textButton} onClick={() => notify(a)}>
                  Registrar aviso realizado
                </button>
              )}
            />
          </Card>
        </>
      ) : (
        <Card title={client ? "Mis avisos recibidos" : "Avisos realizados"}>
          <Table
            rows={data.notificaciones}
            rowKey={(n) => n.id_notificacion}
            columns={[
              {
                title: "Paquete",
                value: (n) => code(n.pago_pendiente.id_paquete),
              },
              { title: "Tipo", value: (n) => n.tipo.replaceAll("_", " ") },
              { title: "Mensaje", value: (n) => n.contenido },
              { title: "Realizado", value: (n) => date(n.realizado_en) },
              ...(client
                ? [
                    {
                      title: "Lectura",
                      value: (n: DashboardData["notificaciones"][number]) =>
                        n.notificacion_lectura.length ? "Leído" : "Sin leer",
                    },
                  ]
                : [
                    {
                      title: "Teléfono",
                      value: (n: DashboardData["notificaciones"][number]) =>
                        n.telefono,
                    },
                  ]),
            ]}
            actions={
              client
                ? (n) => (
                    <>
                      <button
                        className={styles.textButton}
                        onClick={() =>
                          open(
                            "Marcar aviso como leído",
                            "notificaciones",
                            [],
                            { id: n.id_notificacion },
                            "PATCH",
                            { help: n.contenido },
                          )
                        }
                      >
                        Marcar leído
                      </button>
                      <button
                        className={styles.textButton}
                        onClick={() =>
                          open(
                            "Ocultar aviso de mi bandeja",
                            "notificaciones",
                            [],
                            { id: n.id_notificacion },
                            "DELETE",
                            {
                              help: "El registro del aviso se conserva en el historial de la empresa.",
                            },
                          )
                        }
                      >
                        Ocultar
                      </button>
                    </>
                  )
                : undefined
            }
          />
        </Card>
      );
  } else if (section === "reportes") {
    if (tab === "Caja")
      content = (
        <>
          <Card title="Resumen diario">
            <Table
              rows={data.diarios.filter(
                (r) => !branch || r.id_sucursal === branch,
              )}
              rowKey={(r) => `${r.id_sucursal}-${r.fecha}`}
              exportName="caja-diaria"
              columns={[
                { title: "Sucursal", value: (r) => branchName(r.id_sucursal) },
                { title: "Día", value: (r) => r.fecha?.slice(0, 10) || "" },
                { title: "Entradas", value: (r) => money(r.total_entradas) },
                { title: "Salidas", value: (r) => money(r.total_salidas) },
                { title: "Saldo", value: (r) => money(r.saldo) },
                { title: "Cobros", value: (r) => r.cantidad_cobros },
                {
                  title: "Devoluciones",
                  value: (r) => r.cantidad_devoluciones,
                },
              ]}
            />
          </Card>
          <Card title="Resumen mensual">
            <Table
              rows={data.mensuales.filter(
                (r) => !branch || r.id_sucursal === branch,
              )}
              rowKey={(r) => `${r.id_sucursal}-${r.periodo}`}
              exportName="caja-mensual"
              columns={[
                { title: "Sucursal", value: (r) => branchName(r.id_sucursal) },
                { title: "Mes", value: (r) => r.periodo?.slice(0, 7) || "" },
                { title: "Entradas", value: (r) => money(r.total_entradas) },
                { title: "Salidas", value: (r) => money(r.total_salidas) },
                { title: "Saldo", value: (r) => money(r.saldo) },
              ]}
            />
            <p className={styles.muted}>
              El saldo representa entradas menos salidas registradas; no
              equivale a utilidad contable.
            </p>
          </Card>
        </>
      );
    else if (tab === "Traslados")
      content = (
        <Card title="Reporte de traslados">
          {transferTable(scopedTransfers)}
        </Card>
      );
    else if (tab === "Ocupación")
      content = (
        <Card title="Ocupación por sucursal">
          <Table
            rows={data.sucursales.filter(
              (b) => !branch || b.id_sucursal === branch,
            )}
            rowKey={(b) => b.id_sucursal}
            exportName="ocupacion"
            columns={[
              { title: "Sucursal", value: (b) => b.nombre },
              {
                title: "Lockers",
                value: (b) =>
                  data.lockers.filter((l) => l.id_sucursal === b.id_sucursal)
                    .length,
              },
              {
                title: "Ocupados",
                value: (b) =>
                  data.lockers.filter(
                    (l) => l.id_sucursal === b.id_sucursal && l.paquete,
                  ).length,
              },
              {
                title: "Disponibles",
                value: (b) =>
                  data.lockers.filter(
                    (l) =>
                      l.id_sucursal === b.id_sucursal &&
                      !l.paquete &&
                      l.habilitado,
                  ).length,
              },
              {
                title: "Deshabilitados",
                value: (b) =>
                  data.lockers.filter(
                    (l) => l.id_sucursal === b.id_sucursal && !l.habilitado,
                  ).length,
              },
            ]}
          />
        </Card>
      );
    else
      content = (
        <Card title="Reporte de operación">{packageTable(packages)}</Card>
      );
  } else if (section === "cuenta") {
    content = (
      <Card
        title="Mi cuenta"
        action={
          <div className={styles.rowActions}>
            <button
              className={styles.primary}
              onClick={() =>
                open(
                  "Actualizar mi cuenta",
                  "cuenta",
                  [
                    text("nombre", "Nombre", true),
                    text("apellido", "Apellidos", true),
                    text("telefono", "Teléfono"),
                  ],
                  {
                    nombre: data.usuario.nombre,
                    apellido: data.usuario.apellido,
                    telefono: data.usuario.telefono || "",
                  },
                  "PATCH",
                )
              }
            >
              Editar mi cuenta
            </button>
            <Link href="/password" className={styles.primary}>
              Cambiar contraseña
            </Link>
          </div>
        }
      >
        <dl className={styles.detailGrid}>
          {[
            ["Nombre", `${data.usuario.nombre} ${data.usuario.apellido}`],
            ["Correo", data.usuario.correo],
            ["CI", data.usuario.ci],
            ["Teléfono", data.usuario.telefono || "Sin registrar"],
            ["Perfil", data.usuario.rol],
            [
              "Sucursal",
              data.usuario.id_sucursal
                ? branchName(data.usuario.id_sucursal)
                : "Mis envíos",
            ],
          ].map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </Card>
    );
  } else
    content = (
      <Card title={tab}>
        {packageTable(
          packages.filter((p) =>
            tab === "Activos"
              ? p.estado !== "entregado"
              : tab === "Historial"
                ? p.estado === "entregado"
                : true,
          ),
        )}
      </Card>
    );
  return (
    <>
      {content}
      {form && (
        <FormDialog
          key={`${form.resource}-${form.title}`}
          form={form}
          data={data}
          close={() => setForm(null)}
          mutate={mutate}
        />
      )}
      {detail && (
        <DetailDialog
          detail={detail}
          qr={qr}
          data={data}
          close={() => {
            setDetail(null);
            setQr("");
          }}
        />
      )}
    </>
  );
}

function DetailDialog({
  detail,
  qr,
  data,
  close,
}: {
  detail: Package | Document;
  qr: string;
  data: DashboardData;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  const isPackage = "codigo" in detail;
  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      onCancel={close}
      aria-labelledby="detail-title"
    >
      <div className={styles.dialogHeader}>
        <div>
          <p className={styles.eyebrow}>
            {isPackage ? "Seguimiento de paquete" : "Documento"}
          </p>
          <h2 id="detail-title">
            {isPackage
              ? detail.codigo
              : `${detail.tipo === "recepcion" ? "RC" : "EN"}-${detail.id_documento}`}
          </h2>
        </div>
        <button
          className={styles.iconButton}
          onClick={close}
          aria-label="Cerrar"
        >
          ×
        </button>
      </div>
      {isPackage ? (
        <>
          <div className={styles.detailHero}>
            <div>
              <Badge value={detail.estado} />
              <p>{detail.descripcion}</p>
            </div>
            {qr && (
              <Image
                unoptimized
                src={qr}
                width={140}
                height={140}
                alt={`QR del paquete ${detail.codigo}`}
              />
            )}
          </div>
          <dl className={styles.detailGrid}>
            {[
              ["Sucursal", detail.sucursal?.nombre || "En tránsito"],
              ["Locker", detail.locker?.codigo || "Sin asignar"],
              ["Tamaño", sizeName(detail.tamanio)],
              [
                "Peso",
                detail.peso_kg ? `${detail.peso_kg} kg` : "Sin registrar",
              ],
              ["Ingreso", date(detail.fecha_ingreso)],
              ["Fecha límite", date(detail.fecha_limite)],
              ["Entrega", date(detail.fecha_entrega)],
              ["Modalidad", detail.modalidad_pago],
              ["Saldo pendiente", money(debt(detail))],
              ["Importe inicial", money(detail.importe_inicial)],
              ["Recargo semanal", money(detail.recargo_semanal)],
            ].map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <h3>Cargos por paquete</h3>
          <ul className={styles.timeline}>
            {detail.pago_anticipado && (
              <li>
                <strong>
                  Pago anticipado · {money(detail.pago_anticipado.monto)}
                </strong>
                <small>{date(detail.pago_anticipado.fecha)} · Pagado</small>
              </li>
            )}
            {detail.pago_pendiente.map((p) => (
              <li key={p.id_pago_pendiente}>
                <strong>
                  {p.concepto} {p.numero_periodo || ""} · {money(p.monto)}
                </strong>
                <small>
                  {p.movimiento
                    ? `Pagado · ${date(p.movimiento.fecha)}`
                    : `Pendiente · vence ${date(p.vence_en)}`}
                </small>
              </li>
            ))}
            {detail.devolucion && (
              <li>
                <strong>
                  Devolución monetaria · {money(detail.devolucion.monto)}
                </strong>
                <small>
                  {detail.devolucion.motivo} · {date(detail.devolucion.fecha)}
                </small>
              </li>
            )}
          </ul>
          <h3>Seguimiento</h3>
          <ul className={styles.timeline}>
            <li>
              <strong>Recepción</strong>
              <small>{date(detail.fecha_ingreso)}</small>
            </li>
            {data.traslados
              .filter((t) =>
                t.detalle_traslado.some(
                  (d) => d.paquete.id_paquete === detail.id_paquete,
                ),
              )
              .map((t) => (
                <li key={t.id_traslado}>
                  <strong>
                    TR-{t.id_traslado} ·{" "}
                    {t.estado === "recibido"
                      ? "Recibido"
                      : statusName(t.estado)}
                  </strong>
                  <small>
                    {
                      data.sucursales.find(
                        (b) => b.id_sucursal === t.id_sucursal_origen,
                      )?.nombre
                    }{" "}
                    →{" "}
                    {
                      data.sucursales.find(
                        (b) => b.id_sucursal === t.id_sucursal_destino,
                      )?.nombre
                    }{" "}
                    · {date(t.fecha_recepcion || t.fecha_salida || t.creado_en)}
                  </small>
                </li>
              ))}
            {detail.fecha_entrega && (
              <li>
                <strong>Entrega realizada</strong>
                <small>{date(detail.fecha_entrega)}</small>
              </li>
            )}
          </ul>
        </>
      ) : (
        <>
          <dl className={styles.detailGrid}>
            <div>
              <dt>Fecha</dt>
              <dd>{date(detail.fecha)}</dd>
            </div>
            <div>
              <dt>Sucursal</dt>
              <dd>
                {
                  data.sucursales.find(
                    (b) => b.id_sucursal === detail.id_sucursal,
                  )?.nombre
                }
              </dd>
            </div>
            <div>
              <dt>Cliente</dt>
              <dd>{detail.cliente?.persona.nombre || "Entrega"}</dd>
            </div>
            <div>
              <dt>Observaciones</dt>
              <dd>{detail.observaciones || "—"}</dd>
            </div>
          </dl>
          <ul className={styles.timeline}>
            {detail.detalle_documento.map((d) => (
              <li key={d.paquete.codigo}>
                <strong>{d.paquete.codigo}</strong>
                <small>
                  CI destinatario: {d.ci_destinatario || "Sin registrar"} ·
                  Teléfono: {d.telefono_destinatario || "Sin registrar"}
                </small>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className={styles.dialogFooter}>
        <button className={styles.secondary} onClick={() => window.print()}>
          Imprimir
        </button>
        <button className={styles.primary} onClick={close}>
          Cerrar
        </button>
      </div>
    </dialog>
  );
}
