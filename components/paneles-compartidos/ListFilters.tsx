"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { sizeName } from "./sgap-types";
import styles from "./UserDashboard.module.css";

export const BranchFilterContext = createContext<Record<string, string>>({});
export type FilterColumn<T> = {
  title: string;
  value: (row: T) => ReactNode;
  search?: (row: T) => string;
};
type Row = Record<string, unknown>;
const object = (v: unknown): Row =>
  v && typeof v === "object" ? (v as Row) : {};
const text = (v: unknown) =>
  typeof v === "string" || typeof v === "number" ? String(v) : "";
const dateFields = [
  ["fecha", "Fecha"],
  ["fecha_ingreso", "Fecha de ingreso"],
  ["fecha_limite", "Fecha límite"],
  ["fecha_entrega", "Fecha de entrega"],
  ["creado_en", "Fecha de creación"],
  ["fecha_salida", "Fecha de salida"],
  ["fecha_recepcion", "Fecha de recepción"],
  ["realizado_en", "Fecha de realización"],
  ["vence_en", "Vencimiento"],
  ["periodo", "Período"],
] as const;
const localDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/La_Paz",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
function day(row: unknown, field: string) {
  const r = object(row);
  const raw = text(
    field === "documento.fecha" ? object(r.documento).fecha : r[field],
  );
  if (!raw) return "";
  if (
    /^\d{4}-\d{2}-\d{2}$/.test(raw) ||
    field === "periodo" ||
    r.id_resumen_diario
  )
    return raw.slice(0, 10);
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? "" : localDay.format(date);
}

export function useListFilters<T>(
  rows: T[],
  columns: FilterColumn<T>[],
  branchNames?: Record<string, string>,
) {
  const contextBranches = useContext(BranchFilterContext);
  const branches = branchNames || contextBranches;
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [dateField, setDateField] = useState("");
  const definitions: {
    key: string;
    label: string;
    values: (row: T) => string[];
  }[] = [];
  for (const column of columns) {
    if (
      [
        "Estado",
        "Tipo",
        "Medio",
        "Cargo",
        "Acceso",
        "Acceso al sistema",
        "Lectura",
        "Pagador",
        "Pagador / receptor",
        "Tamaño",
      ].includes(column.title)
    ) {
      definitions.push({
        key: column.title,
        label: column.title,
        values: (row) =>
          [column.search ? column.search(row) : text(column.value(row))].filter(
            Boolean,
          ),
      });
    }
  }
  const data = rows.map(object);
  if (
    !definitions.some((d) => d.key === "Estado") &&
    data.some(
      (r) =>
        typeof object(r.persona).activo === "boolean" ||
        typeof r.activo === "boolean",
    )
  ) {
    definitions.push({
      key: "Estado",
      label: "Estado",
      values: (row) => [
        object(row).activo === false ||
        object(object(row).persona).activo === false
          ? "Inactivo"
          : "Activo",
      ],
    });
  }
  if (
    !definitions.some((d) => d.key === "Tamaño") &&
    data.some(
      (r) => typeof r.tamanio === "number" || Array.isArray(r.detalle_traslado),
    )
  ) {
    definitions.push({
      key: "Tamaño",
      label: "Tamaño",
      values: (row) => {
        const r = object(row);
        return typeof r.tamanio === "number"
          ? [sizeName(r.tamanio)]
          : (Array.isArray(r.detalle_traslado) ? r.detalle_traslado : [])
              .map((d) => sizeName(Number(object(object(d).paquete).tamanio)))
              .filter(Boolean);
      },
    });
  }
  if (data.some((r) => r.modalidad_pago))
    definitions.push({
      key: "modalidad",
      label: "Modalidad de pago",
      values: (row) => [
        object(row).modalidad_pago === "anticipado"
          ? "Anticipado"
          : "Pendiente",
      ],
    });
  const branchId = (row: unknown) => {
    const r = object(row);
    return text(
      r.id_sucursal_actual ||
        r.id_sucursal ||
        object(r.documento).id_sucursal ||
        object(object(r.persona).empleado).id_sucursal,
    );
  };
  if (data.some((r) => branchId(r)))
    definitions.push({
      key: "Sucursal",
      label: "Sucursal",
      values: (row) => {
        const id = branchId(row);
        return id ? [branches[id] || `Sucursal ${id}`] : ["En tránsito"];
      },
    });
  for (const [key, label] of [
    ["id_sucursal_origen", "Origen"],
    ["id_sucursal_destino", "Destino"],
  ]) {
    if (data.some((r) => r[key]))
      definitions.push({
        key,
        label,
        values: (row) => {
          const id = text(object(row)[key]);
          return id ? [branches[id] || `Sucursal ${id}`] : [];
        },
      });
  }
  const facets = definitions.map((definition) => ({
    ...definition,
    options: [...new Set(rows.flatMap(definition.values))]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "es")),
  }));
  const dates: { key: string; label: string }[] = dateFields
    .filter(([key]) => data.some((r) => r[key]))
    .map(([key, label]) => ({ key, label }));
  if (data.some((r) => object(r.documento).fecha))
    dates.unshift({ key: "documento.fecha", label: "Fecha de entrega" });
  const effectiveDate = dates.some((d) => d.key === dateField)
    ? dateField
    : dates[0]?.key || "";
  const effectiveSelected = Object.fromEntries(
    facets.map((f) => [
      f.key,
      f.options.includes(selected[f.key]) ? selected[f.key] : "",
    ]),
  );
  const filtered = rows.filter((row) => {
    const words = columns
      .map((c) => (c.search ? c.search(row) : text(c.value(row))))
      .join(" ");
    if (!words.toLocaleLowerCase().includes(search.toLocaleLowerCase().trim()))
      return false;
    if (
      facets.some(
        (f) =>
          effectiveSelected[f.key] &&
          !f.values(row).includes(effectiveSelected[f.key]),
      )
    )
      return false;
    const value = day(row, effectiveDate);
    return (
      !effectiveDate ||
      ((!from || (!!value && value >= from)) &&
        (!to || (!!value && value <= to)))
    );
  });
  const count =
    Object.values(effectiveSelected).filter(Boolean).length +
    Number(!!effectiveDate && !!from) +
    Number(!!effectiveDate && !!to);
  return {
    search,
    setSearch,
    selected: effectiveSelected,
    setSelected,
    from,
    setFrom,
    to,
    setTo,
    dateField: effectiveDate,
    setDateField,
    facets,
    dates,
    filtered,
    count,
    invalidRange: !!from && !!to && from > to,
    clear: () => {
      setSelected({});
      setFrom("");
      setTo("");
    },
  };
}

export function ListFilters<T>({
  filters,
  onChange,
}: {
  filters: ReturnType<typeof useListFilters<T>>;
  onChange?: () => void;
}) {
  const update = (action: () => void) => {
    action();
    onChange?.();
  };
  if (!filters.facets.length && !filters.dates.length) return null;
  return (
    <details className={styles.listFilters}>
      <summary>Filtros{filters.count ? ` (${filters.count})` : ""}</summary>
      <div className={styles.filterFields}>
        {filters.facets.map((f) => (
          <label key={f.key}>
            {f.label}
            <select
              aria-label={f.label}
              value={filters.selected[f.key] || ""}
              onChange={(e) =>
                update(() =>
                  filters.setSelected({
                    ...filters.selected,
                    [f.key]: e.target.value,
                  }),
                )
              }
            >
              <option value="">Todos</option>
              {f.options.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        ))}
        {filters.dates.length > 1 && (
          <label>
            Fecha a filtrar
            <select
              aria-label="Fecha a filtrar"
              value={filters.dateField}
              onChange={(e) =>
                update(() => filters.setDateField(e.target.value))
              }
            >
              {filters.dates.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {!!filters.dates.length && (
          <>
            <label>
              Desde
              <input
                type="date"
                value={filters.from}
                max={filters.to || undefined}
                onChange={(e) => update(() => filters.setFrom(e.target.value))}
              />
            </label>
            <label>
              Hasta
              <input
                type="date"
                value={filters.to}
                min={filters.from || undefined}
                onChange={(e) => update(() => filters.setTo(e.target.value))}
              />
            </label>
          </>
        )}
        <button
          className={styles.secondary}
          disabled={!filters.count}
          onClick={() => update(filters.clear)}
        >
          Limpiar filtros
        </button>
      </div>
      {filters.invalidRange && (
        <p className={styles.error} role="alert">
          La fecha inicial no puede ser posterior a la fecha final.
        </p>
      )}
    </details>
  );
}
