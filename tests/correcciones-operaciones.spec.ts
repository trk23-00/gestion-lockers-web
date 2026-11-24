import { test, expect, type APIRequestContext } from "@playwright/test";
import pg from "pg";

test.use({ actionTimeout: 15000 });

test("submenús, correcciones y anulaciones conservan recepción, caja e historial", async ({
  playwright,
  browser,
}) => {
  test.setTimeout(180000);
  if (
    !/^lockers_test_\d+$/.test(
      new URL(process.env.DATABASE_URL!).pathname.slice(1),
    )
  )
    throw Error("Se requiere una DB temporal.");
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  const apis: APIRequestContext[] = [];
  const contexts = [];
  async function login(correo: string) {
    const api = await playwright.request.newContext({
      baseURL: process.env.TEST_BASE_URL,
    });
    apis.push(api);
    const res = await api.post("/api/auth/login", {
      data: { correo, password: "LockersDemo2026!", captcha: "local-dev" },
    });
    expect(res.status(), await res.text()).toBe(200);
    return api;
  }
  async function call(
    api: APIRequestContext,
    resource: string,
    data: object,
    method = "POST",
    status = 200,
  ) {
    const res = await api.fetch(`/api/sgap/${resource}`, { method, data });
    const result = await res.json();
    expect(res.status(), JSON.stringify(result)).toBe(status);
    return result;
  }
  try {
    const admin = await login("admin@lockers.local"),
      recep = await login("recepcion@lockers.local"),
      client = await login("cliente@lockers.local"),
      warehouse = await login("almacen@lockers.local");
    const snapshot = async () => (await admin.get("/api/sgap/datos")).json();
    let data = await snapshot();
    const central = data.sucursales.find(
      (s: { nombre: string }) => s.nombre === "Central",
    ).id_sucursal;
    const norte = data.sucursales.find(
      (s: { nombre: string }) => s.nombre === "Norte",
    ).id_sucursal;
    const customer = data.clientes.find(
      (c: { persona: { correo: string } }) =>
        c.persona.correo === "cliente@lockers.local",
    ).id_cliente;
    const tag = `COR-${Date.now()}`;
    async function receive(
      codes: string[],
      branch = central,
      anticipated = false,
    ) {
      await call(admin, "recepciones", {
        id_sucursal: branch,
        id_cliente: customer,
        paquetes: codes.map((codigo) => ({
          codigo,
          descripcion: "Contenido de recepción que debe conservarse",
          tamanio: "1",
          modalidad_pago: anticipated ? "anticipado" : "pendiente",
          id_destinatario: customer,
        })),
      });
      const next = await snapshot();
      return next.paquetes.filter((p: { codigo: string }) =>
        codes.includes(p.codigo),
      );
    }
    const [main] = await receive([`${tag}-PRINCIPAL`]);
    // Fechas coherentes para generar un recargo y cobrarlo junto con el cargo inicial.
    await db.query(
      `WITH fechas AS (SELECT CURRENT_TIMESTAMP-interval '1 day' AS limite),
      ingreso AS (SELECT limite,limite-$2::int*interval '1 day' AS fecha FROM fechas),
      doc AS (UPDATE documento SET fecha=ingreso.fecha FROM ingreso WHERE id_documento=(SELECT id_documento FROM detalle_documento WHERE id_paquete=$1 AND tipo_documento='recepcion')),
      paquete_actualizado AS (UPDATE paquete SET fecha_ingreso=ingreso.fecha,fecha_limite=ingreso.limite FROM ingreso WHERE id_paquete=$1)
      UPDATE pago_pendiente SET generado_en=ingreso.fecha,vence_en=ingreso.limite FROM ingreso WHERE id_paquete=$1`,
      [main.id_paquete, data.configuracion.dias_iniciales],
    );
    const others = await receive(
      Array.from({ length: 12 }, (_, i) => `${tag}-${i}`),
    );
    const cash = (id: string, branch = central) => ({
      id_paquete: id,
      id_sucursal: branch,
      pagador: "destinatario",
      medio: "efectivo",
    });
    for (const p of [main, ...others])
      await call(recep, "cobros", cash(p.id_paquete));
    await call(recep, "entregas", {
      id_sucursal: central,
      paquetes: [main, ...others].map((p) => p.id_paquete),
      ci_destinatario: "8000011",
      nombre_destinatario: "Persona que recoge",
    });
    const [foreign] = await receive([`${tag}-NORTE`], norte);
    await call(admin, "cobros", cash(foreign.id_paquete, norte));
    await call(admin, "entregas", {
      id_sucursal: norte,
      paquetes: [foreign.id_paquete],
    });
    data = await snapshot();
    const deliveryFor = (pkg: string) =>
      data.documentos
        .filter((d: { tipo: string }) => d.tipo === "entrega")
        .flatMap(
          (d: {
            detalle_documento: { id_paquete: string; id_detalle: string }[];
          }) => d.detalle_documento,
        )
        .find((d: { id_paquete: string }) => d.id_paquete === pkg);
    const delivered = deliveryFor(main.id_paquete),
      foreignDelivery = deliveryFor(foreign.id_paquete);
    const receiptBefore = (
      await db.query(
        "SELECT to_jsonb(d) AS valor FROM detalle_documento d WHERE id_paquete=$1 AND tipo_documento='recepcion'",
        [main.id_paquete],
      )
    ).rows[0].valor;
    const collection = data.movimientos.filter(
      (m: { id_paquete: string; tipo: string }) =>
        m.id_paquete === main.id_paquete && m.tipo === "entrada",
    );
    expect(collection).toHaveLength(2);
    expect(
      new Set(collection.map((m: { id_operacion: string }) => m.id_operacion))
        .size,
    ).toBe(1);
    const movementId = String(
      Math.min(
        ...collection.map((m: { id_movimiento: string }) =>
          Number(m.id_movimiento),
        ),
      ),
    );
    for (const actor of [client, warehouse]) {
      await call(
        actor,
        "correcciones_entrega",
        { id: delivered.id_detalle, accion: "anular", motivo: "Sin permiso" },
        "PATCH",
        403,
      );
      await call(
        actor,
        "correcciones_pago",
        { id: movementId, accion: "anular", motivo: "Sin permiso" },
        "PATCH",
        403,
      );
    }
    await call(
      recep,
      "correcciones_entrega",
      {
        id: foreignDelivery.id_detalle,
        accion: "anular",
        motivo: "Otra sucursal",
      },
      "PATCH",
      404,
    );
    await call(
      recep,
      "correcciones_entrega",
      {
        id: delivered.id_detalle,
        accion: "corregir",
        motivo: "No permitido",
        codigo: "CAMBIADO",
      },
      "PATCH",
      400,
    );
    await call(
      recep,
      "correcciones_pago",
      { id: movementId, accion: "anular", motivo: "Aún entregado" },
      "PATCH",
      409,
    );
    const ctx = await browser.newContext({
      storageState: await recep.storageState(),
    });
    contexts.push(ctx);
    const page = await ctx.newPage();
    await page.goto(
      "/paneles/empleado?seccion=recepcion&vista=Nueva%20recepci%C3%B3n",
    );
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Recepción / Nueva recepción",
        exact: true,
      }),
    ).toBeVisible();
    await page.goto(
      "/paneles/empleado?seccion=entregas&vista=Documentos%20registrados",
    );
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Entrega / Documentos registrados",
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.locator("tbody tr")).toHaveCount(10);
    await page.getByRole("button", { name: "Siguiente", exact: true }).click();
    await expect(
      page.getByText("Página 2 de 2", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("textbox", { name: "Buscar", exact: true })
      .fill(main.codigo);
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await page
      .getByRole("button", { name: "Ver detalles", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText("8000011");
    await page.getByRole("button", { name: "Cerrar", exact: true }).click();
    await page
      .locator("#submenu-entregas")
      .getByRole("button", { name: "Corregir entrega", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Buscar", exact: true })
      .fill(main.codigo);
    await page.getByRole("button", { name: "Corregir", exact: true }).click();
    await page.getByLabel("CI de quien recoge").fill("900001234");
    await page
      .getByLabel("Observaciones del paquete al entregar")
      .fill("Embalaje revisado al retirar");
    await page
      .getByLabel("Motivo de la corrección o anulación")
      .fill("Corrección de identificación del retiro");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page
      .getByRole("button", { name: "Ver detalles", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText("900001234");
    await expect(page.getByRole("dialog")).toContainText(
      "Corrección de identificación del retiro",
    );
    await page.getByRole("button", { name: "Cerrar", exact: true }).click();
    await page.getByRole("button", { name: "Corregir", exact: true }).click();
    await page.getByLabel("Operación").selectOption("anular");
    await expect(page.getByLabel("CI de quien recoge")).toHaveCount(0);
    await page
      .getByLabel("Motivo de la corrección o anulación")
      .fill("El paquete continúa bajo custodia");
    await page
      .getByRole("button", { name: "Confirmar anulación", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator("tbody")).toContainText("Anulada");
    data = await snapshot();
    const restored = data.paquetes.find(
      (p: { id_paquete: string }) => p.id_paquete === main.id_paquete,
    );
    expect(restored.estado).toBe("recibido");
    expect(restored.id_locker).toBeNull();
    expect(restored.fecha_entrega).toBeNull();
    expect(
      (
        await db.query(
          "SELECT to_jsonb(d) AS valor FROM detalle_documento d WHERE id_paquete=$1 AND tipo_documento='recepcion'",
          [main.id_paquete],
        )
      ).rows[0].valor,
    ).toEqual(receiptBefore);
    // La entrega anulada conserva el documento y permite un nuevo registro.
    await call(recep, "entregas", {
      id_sucursal: central,
      paquetes: [main.id_paquete],
    });
    const activeDetail = (
      await db.query(
        "SELECT id_detalle FROM detalle_documento WHERE id_paquete=$1 AND tipo_documento='entrega' AND anulado_en IS NULL",
        [main.id_paquete],
      )
    ).rows[0].id_detalle;
    await call(
      recep,
      "correcciones_entrega",
      { id: activeDetail, accion: "anular", motivo: "Rectificar retiro" },
      "PATCH",
    );
    await page
      .locator("aside")
      .getByRole("button", { name: "Pagos", exact: true })
      .click();
    await page
      .locator("#submenu-pagos")
      .getByRole("button", { name: "Registrar cobro", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Pagos / Registrar cobro",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Cobros de hoy", exact: true }),
    ).toHaveCount(0);
    await page
      .locator("#submenu-pagos")
      .getByRole("button", { name: "Cobros realizados", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Cobros de hoy", exact: true }),
    ).toBeVisible();
    await page
      .locator("#submenu-pagos")
      .getByRole("button", { name: "Corregir pagos", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Cobros de hoy", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Devolver total", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("textbox", { name: "Buscar", exact: true })
      .fill(main.codigo);
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await page.getByRole("button", { name: "Corregir", exact: true }).click();
    await page.getByLabel("Medio de pago").selectOption("qr");
    await page.getByLabel("Quién paga").selectOption("cliente");
    await page
      .getByLabel("Motivo de la corrección o anulación")
      .fill("Medio registrado incorrectamente");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator("tbody")).toContainText("qr");
    await call(
      recep,
      "correcciones_pago",
      {
        id: movementId,
        accion: "corregir",
        monto: "0.01",
        motivo: "Alterar tarifa",
      },
      "PATCH",
      400,
    );
    const balanceBefore = (
      await db.query(
        "SELECT total_entradas FROM resumen_diario WHERE id_sucursal=$1 AND fecha=(CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')::date",
        [central],
      )
    ).rows[0].total_entradas;
    await page.getByRole("button", { name: "Corregir", exact: true }).click();
    await page.getByLabel("Operación").selectOption("anular");
    await page
      .getByLabel("Motivo de la corrección o anulación")
      .fill("Cobro registrado sin recibir dinero");
    await page
      .getByRole("button", { name: "Confirmar anulación", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator("tbody")).toContainText("Anulado");
    const after = (
      await db.query("SELECT * FROM movimiento WHERE id_operacion=$1", [
        collection[0].id_operacion,
      ])
    ).rows;
    expect(after).toHaveLength(2);
    expect(
      after.every((m) => m.anulado_en && !m.id_pago_pendiente),
    ).toBeTruthy();
    const total = collection.reduce(
      (sum: number, m: { monto: string }) => sum + Number(m.monto),
      0,
    );
    const balanceAfter = (
      await db.query(
        "SELECT total_entradas FROM resumen_diario WHERE id_sucursal=$1 AND fecha=(CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')::date",
        [central],
      )
    ).rows[0].total_entradas;
    expect(Number(balanceAfter)).toBe(Number(balanceBefore) - total);
    expect(
      Number(
        (
          await db.query(
            "SELECT saldo_pendiente FROM saldo_paquete WHERE id_paquete=$1",
            [main.id_paquete],
          )
        ).rows[0].saldo_pendiente,
      ),
    ).toBe(total);
    await call(
      recep,
      "correcciones_pago",
      { id: movementId, accion: "anular", motivo: "Duplicada" },
      "PATCH",
      409,
    );
    await call(recep, "cobros", cash(main.id_paquete));
    await call(recep, "entregas", {
      id_sucursal: central,
      paquetes: [main.id_paquete],
    });
    const [advance] = await receive([`${tag}-ANTICIPO`], central, true);
    data = await snapshot();
    const advanceCash = data.movimientos.find(
      (m: { id_paquete: string }) => m.id_paquete === advance.id_paquete,
    );
    await call(
      recep,
      "correcciones_pago",
      {
        id: advanceCash.id_movimiento,
        accion: "anular",
        motivo: "Anticipo no recibido",
      },
      "PATCH",
    );
    const advanceAfter = (
      await db.query(
        "SELECT p.modalidad_pago,s.saldo_pendiente FROM paquete p JOIN saldo_paquete s USING(id_paquete) WHERE id_paquete=$1",
        [advance.id_paquete],
      )
    ).rows[0];
    expect(advanceAfter.modalidad_pago).toBe("anticipado");
    expect(Number(advanceAfter.saldo_pendiente)).toBe(
      Number(data.configuracion.importe_inicial),
    );
    expect(
      (
        await db.query(
          "SELECT count(*)::int AS n FROM auditoria_operacion WHERE entidad='pago' AND id_registro=$1",
          [movementId],
        )
      ).rows[0].n,
    ).toBe(2);
    expect(
      (await (await client.get("/api/sgap/datos")).json()).auditorias,
    ).toEqual([]);
    const consistent = (
      await db.query(`SELECT count(*)::int AS n FROM resumen_mensual r WHERE r.total_entradas IS DISTINCT FROM
      (SELECT COALESCE(sum(m.monto),0) FROM movimiento m WHERE m.id_sucursal=r.id_sucursal AND m.tipo='entrada' AND m.anulado_en IS NULL AND date_trunc('month',m.fecha AT TIME ZONE 'America/La_Paz')::date=r.periodo)`)
    ).rows[0].n;
    expect(consistent).toBe(0);
  } finally {
    for (const ctx of contexts) await ctx.close();
    for (const api of apis) await api.dispose();
    await db.end();
  }
});
