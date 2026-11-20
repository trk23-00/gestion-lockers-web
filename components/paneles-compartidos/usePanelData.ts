"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { panelPorNivel, rutaPanel, type PanelRole } from "@/lib/paneles";
import { type DashboardData } from "./sgap-types";

const INTERVALO_MS = 5_000;
const TIEMPO_LIMITE_MS = 20_000;

export function usePanelData(role: PanelRole) {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const activo = useRef(false);
  const secuencia = useRef(0);
  const ultimoContenido = useRef("");
  const pendiente = useRef<{
    controller: AbortController;
    promise: Promise<void>;
  } | null>(null);

  const refresh = useCallback(
    ({ force = false }: { force?: boolean } = {}): Promise<void> => {
      if (!activo.current) return Promise.resolve();
      if (pendiente.current && !force) return pendiente.current.promise;
      // Una lectura anterior al guardado no puede reemplazar su resultado.
      pendiente.current?.controller.abort();
      const controller = new AbortController();
      const numero = ++secuencia.current;
      let agotado = false;
      const timer = window.setTimeout(() => {
        agotado = true;
        controller.abort();
      }, TIEMPO_LIMITE_MS);
      const vigente = () => activo.current && numero === secuencia.current;
      const promise = (async () => {
        try {
          const response = await fetch("/api/sgap/datos", {
            cache: "no-store",
            signal: controller.signal,
          });
          const result = await response.json();
          if (!vigente()) return;
          if (response.status === 401) {
            ultimoContenido.current = "";
            setData(null);
            router.replace("/login");
            return;
          }
          if (!response.ok)
            throw new Error(
              result.message || "No se pudo actualizar la información.",
            );
          const snapshot = result as DashboardData;
          if (panelPorNivel[snapshot.usuario.nivel] !== role) {
            ultimoContenido.current = "";
            setData(null);
            router.replace(rutaPanel(snapshot.usuario.nivel));
            return;
          }
          const contenido = JSON.stringify(snapshot);
          if (contenido !== ultimoContenido.current) {
            ultimoContenido.current = contenido;
            setData(snapshot);
          }
          setError("");
        } catch (cause) {
          if (!vigente() || (controller.signal.aborted && !agotado)) return;
          const message =
            cause instanceof Error && !(cause instanceof TypeError) && !agotado
              ? cause.message
              : "No se pudo actualizar la información. Se reintentará automáticamente al recuperar la conexión.";
          // Conserva los últimos datos y los formularios durante una interrupción.
          setError(message);
          throw new Error(message);
        } finally {
          window.clearTimeout(timer);
          if (numero === secuencia.current) pendiente.current = null;
        }
      })();
      pendiente.current = { controller, promise };
      return promise;
    },
    [role, router, setData, setError],
  );

  const cancelarConsultas = useCallback(() => {
    activo.current = false;
    ++secuencia.current;
    pendiente.current?.controller.abort();
    pendiente.current = null;
  }, []);

  useEffect(() => {
    activo.current = true;
    let cancelled = false;
    void Promise.resolve()
      .then(() => refresh())
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    const sincronizar = () => {
      if (document.visibilityState === "visible" && navigator.onLine)
        void refresh().catch(() => {});
    };
    const timer = window.setInterval(sincronizar, INTERVALO_MS);
    window.addEventListener("focus", sincronizar);
    window.addEventListener("online", sincronizar);
    document.addEventListener("visibilitychange", sincronizar);
    return () => {
      cancelled = true;
      cancelarConsultas();
      window.clearInterval(timer);
      window.removeEventListener("focus", sincronizar);
      window.removeEventListener("online", sincronizar);
      document.removeEventListener("visibilitychange", sincronizar);
    };
  }, [refresh, cancelarConsultas]);

  return { data, error, loading, refresh, setError };
}
