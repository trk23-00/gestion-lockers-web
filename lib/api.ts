type Respuesta<T> = {
  ok: boolean;
  message: string;
  data: T | null;
};

async function enviar<T>(url: string, init?: RequestInit): Promise<Respuesta<T>> {
  try {
    const response = await fetch(url, init);
    const data = await response.json();

    return { ok: response.ok, message: data.message ?? "", data };
  } catch {
    return { ok: false, message: "Error al conectar con el servidor", data: null };
  }
}

export function postJson<T = unknown>(url: string, body: object) {
  return enviar<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function getJson<T = unknown>(url: string) {
  return enviar<T>(url);
}

export function respuestaOk(message: string, extra: Record<string, unknown> = {}, status = 200) {
  return Response.json({ success: true, message, ...extra }, { status });
}

export function respuestaError(message: string, status: number) {
  return Response.json({ success: false, message }, { status });
}
