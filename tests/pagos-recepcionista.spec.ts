import { test, expect, type APIRequestContext } from "@playwright/test";
import pg from "pg";

test("el recepcionista cobra, entrega y corrige pagos únicamente en su sucursal", async ({
  playwright,
  browser,
}) => {
  const database = new URL(process.env.DATABASE_URL!).pathname.slice(1);
  if (!/^lockers_test_\d+$/.test(database))
    throw new Error("Esta prueba requiere una DB temporal.");
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  const apis: APIRequestContext[] = [];
  const contexts = [];
  async function login(correo: string) {
    const api = await playwright.request.newContext({
      baseURL: process.env.TEST_BASE_URL,
    });
    apis.push(api);
    const response = await api.post("/api/auth/login", {
      data: { correo, password: "LockersDemo2026!", captcha: "local-dev" },
    });
    expect(response.status(), await response.text()).toBe(200);
    return api;
  }
  async function post(
    api: APIRequestContext,
    resource: string,
    data: object,
    status = 200,
  ) {
    const response = await api.post(`/api/sgap/${resource}`, { data });
    const result = await response.json();
    expect(response.status(), JSON.stringify(result)).toBe(status);
    return result;
  }
  try {
    await db.connect();
    const admin = await login("admin@lockers.local"),
      recep = await login("recepcion@lockers.local"),
      client = await login("cliente@lockers.local"),
      storage = await login("almacen@lockers.local");
    const initial = await (await admin.get("/api/sgap/datos")).json();
    const central = initial.sucursales.find(
      (s: { nombre: string }) => s.nombre === "Central",
    ).id_sucursal;
    const norte = initial.sucursales.find(
      (s: { nombre: string }) => s.nombre === "Norte",
    ).id_sucursal;
    const recipient = initial.clientes.find(
      (c: { persona: { correo: string } }) =>
        c.persona.correo === "cliente@lockers.local",
    ).id_cliente;
    const prefix = `CAJA-${Date.now()}`;
    await post(admin, "personal", {
      nombre: "Recepción",
      apellido: "Norte",
      ci: "85550001",
      correo: "caja.norte.prueba@lockers.local",
      password: "LockersDemo2026!",
      nivel: "2",
      id_sucursal: norte,
    });
    const recepNorte = await login("caja.norte.prueba@lockers.local");
    async function receipt(branch: string, code: string, anticipado = false) {
      return post(admin, "recepciones", {
        id_sucursal: branch,
        id_cliente: recipient,
        paquetes: [
          {
            codigo: code,
            descripcion: `Prueba de caja ${code}`,
            tamanio: "1",
            modalidad_pago: anticipado ? "anticipado" : "pendiente",
            id_destinatario: recipient,
          },
        ],
      });
    }
    const receiptDue = await receipt(central, `${prefix}-COBRAR`);
    await receipt(central, `${prefix}-DEVOLVER`, true);
    await receipt(central, `${prefix}-TRASLADAR`);
    await receipt(norte, `${prefix}-OTRA`);
    await receipt(norte, `${prefix}-DEVOTRA`, true);
    const registered = await (await admin.get("/api/sgap/datos")).json();
    const pkg = (suffix: string) =>
      registered.paquetes.find(
        (p: { codigo: string }) => p.codigo === `${prefix}-${suffix}`,
      );
    const due = pkg("COBRAR"),
      refund = pkg("DEVOLVER"),
      moved = pkg("TRASLADAR"),
      other = pkg("OTRA"),
      otherRefund = pkg("DEVOTRA");
    // Fecha histórica coherente para probar también el cobro completo del recargo.
    await db.query(
      "WITH d AS (UPDATE documento SET fecha=CURRENT_TIMESTAMP-($2::int+1)*INTERVAL '1 day' WHERE id_documento=$1 RETURNING fecha) UPDATE paquete p SET fecha_ingreso=d.fecha,fecha_limite=d.fecha+$2::int*INTERVAL '1 day' FROM d WHERE p.id_paquete=$3",
      [
        receiptDue.result.id,
        initial.configuracion.dias_iniciales,
        due.id_paquete,
      ],
    );
    const cash = (id: string, branch = central) => ({
      id_paquete: id,
      id_sucursal: branch,
      pagador: "destinatario",
      medio: "efectivo",
    });
    for (const denied of [client, storage]) {
      await post(denied, "cobros", cash(due.id_paquete), 403);
      await post(
        denied,
        "devoluciones",
        { ...cash(refund.id_paquete), motivo: "No permitido" },
        403,
      );
    }
    await post(recep, "cobros", cash(other.id_paquete, norte), 404);
    await post(recepNorte, "cobros", cash(due.id_paquete), 404);
    await post(recep, "cobros", cash(due.id_paquete, norte), 403);
    await post(
      recep,
      "devoluciones",
      { ...cash(otherRefund.id_paquete, norte), motivo: "Otra sucursal" },
      404,
    );
    const rates = await recep.patch("/api/sgap/tarifas", {
      data: { importe_inicial: "1", recargo_semanal: "1", dias_iniciales: "7" },
    });
    expect(rates.status()).toBe(403);
    await post(recepNorte, "cobros", cash(other.id_paquete, norte));
    await post(recepNorte, "devoluciones", {
      ...cash(otherRefund.id_paquete, norte),
      motivo: "Devolución total en Norte",
    });

    const context = await browser.newContext({
      storageState: await recep.storageState(),
    });
    contexts.push(context);
    const page = await context.newPage();
    await page.goto("/paneles/empleado?seccion=entregas");
    await expect(
      page.locator("aside").getByRole("button", { name: "Pagos", exact: true }),
    ).toBeVisible();
    const sidebarButtons = await page
      .locator("aside nav > div > button")
      .allTextContents();
    const entregaIndex = sidebarButtons.findIndex(
      (label) => label.trim() === "Entrega",
    );
    expect(entregaIndex).toBeGreaterThanOrEqual(0);
    expect(sidebarButtons[entregaIndex + 1].trim()).toBe("Pagos");
    await page
      .getByRole("textbox", { name: "Buscar", exact: true })
      .fill(due.codigo);
    await page
      .getByRole("row")
      .filter({ hasText: due.codigo })
      .getByRole("button", { name: "Cobrar para entregar", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", {
        name: "Registrar cobro completo",
        exact: true,
      }),
    ).toBeVisible();
    await expect(dialog.getByLabel("Caja / sucursal")).toHaveValue(central);
    await expect(
      dialog.getByLabel("Caja / sucursal").locator("option"),
    ).toHaveCount(2);
    await dialog.getByLabel("Quién paga").selectOption("cliente");
    await dialog.getByLabel("Medio de pago").selectOption("qr");
    await dialog.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await page
      .getByRole("row")
      .filter({ hasText: due.codigo })
      .getByRole("button", { name: "Entregar", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByLabel("CI de quien recoge")
      .fill("90000004");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Guardar", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByRole("row").filter({ hasText: due.codigo }),
    ).toHaveCount(0);
    let data = await (await recep.get("/api/sgap/datos")).json();
    const delivered = data.paquetes.find(
      (p: { id_paquete: string }) => p.id_paquete === due.id_paquete,
    );
    expect(delivered.estado).toBe("entregado");
    expect(delivered.pago_pendiente.length).toBe(2);
    expect(
      delivered.pago_pendiente.every((p: { movimiento: unknown }) =>
        Boolean(p.movimiento),
      ),
    ).toBeTruthy();
    await post(recep, "cobros", cash(due.id_paquete), 409);
    expect(
      data.movimientos.filter(
        (m: { id_paquete: string }) => m.id_paquete === due.id_paquete,
      ),
    ).toHaveLength(2);
    expect(
      data.movimientos.every(
        (m: { id_sucursal: string }) => m.id_sucursal === central,
      ),
    ).toBeTruthy();
    expect(
      data.movimientos.some(
        (m: { id_paquete: string }) => m.id_paquete === other.id_paquete,
      ),
    ).toBeFalsy();

    await page
      .locator("aside")
      .getByRole("button", { name: "Pagos", exact: true })
      .click();
    await page
      .locator("#submenu-pagos")
      .getByRole("button", { name: "Tarifas", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Tarifas de almacenamiento",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Editar tarifas", exact: true }),
    ).toHaveCount(0);
    await page
      .locator("#submenu-pagos")
      .getByRole("button", { name: "Corregir pagos", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Buscar", exact: true })
      .fill(refund.codigo);
    await page
      .getByRole("row")
      .filter({ hasText: refund.codigo })
      .getByRole("button", { name: "Corregir", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByLabel("Operación")
      .selectOption("anular");
    await page
      .getByRole("dialog")
      .getByLabel("Motivo de la corrección o anulación")
      .fill("Cobro registrado por error en recepción");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirmar anulación", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByRole("row").filter({ hasText: refund.codigo }),
    ).toContainText("Anulado");
    await post(
      recep,
      "devoluciones",
      { ...cash(refund.id_paquete), motivo: "No duplicar" },
      409,
    );

    // El historial conserva el código aunque el paquete cambie de sucursal.
    await post(recep, "cobros", cash(moved.id_paquete));
    const transfer = await post(admin, "traslados", {
      id_sucursal_origen: central,
      id_sucursal_destino: norte,
      paquetes: [moved.id_paquete],
    });
    const dispatch = await admin.patch("/api/sgap/traslados", {
      data: { id: transfer.result.id, accion: "despachar" },
    });
    expect(dispatch.status()).toBe(200);
    const transferData = await (await admin.get("/api/sgap/datos")).json();
    const detail = transferData.traslados.find(
      (t: { id_traslado: string }) => t.id_traslado === transfer.result.id,
    ).detalle_traslado[0];
    const receive = await admin.patch("/api/sgap/traslados", {
      data: {
        id: transfer.result.id,
        accion: "recibir",
        id_detalle: detail.id_detalle_traslado,
      },
    });
    expect(receive.status(), await receive.text()).toBe(200);
    data = await (await recep.get("/api/sgap/datos")).json();
    expect(
      data.paquetes.some(
        (p: { id_paquete: string }) => p.id_paquete === moved.id_paquete,
      ),
    ).toBeFalsy();
    expect(
      data.movimientos.find(
        (m: { id_paquete: string }) => m.id_paquete === moved.id_paquete,
      ).paquete.codigo,
    ).toBe(moved.codigo);
    await page.reload();
    await page
      .locator("#submenu-pagos")
      .getByRole("button", { name: "Cobros realizados", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Buscar", exact: true })
      .fill(moved.codigo);
    await expect(
      page.getByRole("row").filter({ hasText: moved.codigo }),
    ).toBeVisible({ timeout: 12000 });
    const ledger = (
      await db.query(
        "SELECT tipo,id_empleado,id_sucursal FROM movimiento WHERE id_paquete=$1 ORDER BY id_movimiento",
        [due.id_paquete],
      )
    ).rows;
    expect(
      ledger.every(
        (m) =>
          String(m.id_empleado) === data.usuario.id_persona &&
          String(m.id_sucursal) === central,
      ),
    ).toBeTruthy();
    const daily = page.locator("section").filter({
      has: page.getByRole("heading", { name: "Cobros de hoy", exact: true }),
    });
    const dailyTotal = (
      await db.query(
        `SELECT COALESCE(SUM(monto), 0) AS total FROM movimiento
       WHERE tipo='entrada' AND anulado_en IS NULL AND id_sucursal=$1
         AND (fecha AT TIME ZONE 'America/La_Paz')::date =
             (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')::date`,
        [central],
      )
    ).rows[0].total;
    await expect(daily.locator("dl")).toContainText(
      `Bs ${Number(dailyTotal).toLocaleString("es-BO", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
    );
    await daily.getByText("Ver cobros de hoy", { exact: true }).click();
    const todayTable = daily.getByRole("table", {
      name: "Cobros realizados hoy",
    });
    await expect(todayTable).toContainText(due.codigo);
    await expect(todayTable).not.toContainText(other.codigo);
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
    await Promise.all(apis.map((a) => a.dispose()));
    await db.end();
  }
});
