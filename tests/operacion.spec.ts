import { test, expect, type APIRequestContext } from "@playwright/test";
import pg from "pg";
import { readFileSync } from "node:fs";
import { navigation } from "../components/paneles-compartidos/sgap-navigation";
test("CRUD por perfiles y ciclo completo de los paquetes", async ({
  playwright,
  browser,
}) => {
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  const contexts: APIRequestContext[] = [];
  async function login(correo: string) {
    const api = await playwright.request.newContext({
      baseURL: process.env.TEST_BASE_URL,
    });
    contexts.push(api);
    const res = await api.post("/api/auth/login", {
      data: { correo, password: "LockersDemo2026!", captcha: "local-dev" },
    });
    expect(res.status(), await res.text()).toBe(200);
    return api;
  }
  async function call(
    api: APIRequestContext,
    resource: string,
    body: object,
    method = "POST",
    expected = 200,
  ) {
    const res = await api.fetch(`/api/sgap/${resource}`, {
      method,
      data: body,
    });
    const json = await res.json();
    expect(res.status(), JSON.stringify(json)).toBe(expected);
    return json;
  }
  try {
    const anon = await playwright.request.newContext({
      baseURL: process.env.TEST_BASE_URL,
    });
    contexts.push(anon);
    expect((await anon.get("/api/sgap/datos")).status()).toBe(401);
    const admin = await login("admin@lockers.local"),
      recep = await login("recepcion@lockers.local"),
      warehouse = await login("almacen@lockers.local"),
      customer = await login("cliente@lockers.local");
    let data = await (await admin.get("/api/sgap/datos")).json();
    const central = data.sucursales.find(
        (b: { nombre: string }) => b.nombre === "Central",
      ).id_sucursal,
      norte = data.sucursales.find(
        (b: { nombre: string }) => b.nombre === "Norte",
      ).id_sucursal;
    const recipient = data.clientes[0].id_cliente;
    await call(
      recep,
      "lockers",
      { id_sucursal: central, codigo: "NO-PERMITIDO", tamanio: "1" },
      "POST",
      403,
    );
    await call(customer, "clientes", { nombre: "No permitido" }, "POST", 403);
    await call(warehouse, "recepciones", {}, "POST", 403);
    await call(recep, "traslados", {}, "POST", 403);
    await call(warehouse, "clientes", { nombre: "No permitido" }, "POST", 403);
    await call(admin, "clientes", {
      nombre: "Comerciante prueba",
      ci: "81111111",
      telefono: "71111111",
    });
    data = await (await admin.get("/api/sgap/datos")).json();
    const merchant = data.clientes.find(
      (c: { persona: { ci: string } }) => c.persona.ci === "81111111",
    ).id_cliente;
    await call(
      recep,
      "clientes",
      {
        id: merchant,
        nombre: "Comerciante editado",
        ci: "81111111",
        telefono: "72222222",
      },
      "PATCH",
    );
    await call(admin, "lockers", {
      id_sucursal: central,
      codigo: "TEST-1",
      tamanio: "2",
    });
    data = await (await admin.get("/api/sgap/datos")).json();
    const locker = data.lockers.find(
      (l: { codigo: string }) => l.codigo === "TEST-1",
    ).id_locker;
    await call(
      warehouse,
      "lockers",
      {
        id: locker,
        id_sucursal: central,
        codigo: "TEST-EDIT",
        tamanio: "3",
        habilitado: true,
      },
      "PATCH",
    );
    await call(
      warehouse,
      "lockers",
      { id_sucursal: norte, codigo: "NO", tamanio: "1" },
      "POST",
      403,
    );
    await call(admin, "sucursales", {
      nombre: "Temporal",
      direccion: "Prueba",
    });
    data = await (await admin.get("/api/sgap/datos")).json();
    const temp = data.sucursales.find(
      (b: { nombre: string }) => b.nombre === "Temporal",
    );
    await call(
      admin,
      "sucursales",
      { id: temp.id_sucursal, nombre: "Temporal editada", activa: false },
      "PATCH",
    );
    await call(admin, "sucursales", { id: temp.id_sucursal }, "DELETE");
    await call(recep, "recepciones", {
      id_sucursal: central,
      id_cliente: merchant,
      paquetes: [
        {
          codigo: "TEST-P1",
          descripcion: "Caja uno",
          tamanio: "1",
          modalidad_pago: "pendiente",
          id_destinatario: recipient,
          telefono_destinatario: "70000000",
        },
        {
          codigo: "TEST-P2",
          descripcion: "Caja dos",
          tamanio: "2",
          modalidad_pago: "anticipado",
          nombre_destinatario: "Otro destinatario",
          id_locker: locker,
        },
        {
          codigo: "TEST-P3",
          descripcion: "Privado",
          tamanio: "1",
          modalidad_pago: "pendiente",
        },
      ],
    });
    data = await (await admin.get("/api/sgap/datos")).json();
    const p1 = data.paquetes.find(
        (p: { codigo: string }) => p.codigo === "TEST-P1",
      ),
      p2 = data.paquetes.find(
        (p: { codigo: string }) => p.codigo === "TEST-P2",
      ),
      p3 = data.paquetes.find(
        (p: { codigo: string }) => p.codigo === "TEST-P3",
      );
    expect(
      data.documentos.find((d: { tipo: string }) => d.tipo === "recepcion")
        .detalle_documento,
    ).toHaveLength(3);
    let own = await (await customer.get("/api/sgap/datos")).json();
    expect(own.paquetes.map((p: { codigo: string }) => p.codigo)).toEqual([
      "TEST-P1",
    ]);
    expect(own.personal).toHaveLength(0);
    expect(own.clientes).toHaveLength(0);
    await call(
      customer,
      "paquetes",
      { id: p3.id_paquete, descripcion: "robo" },
      "PATCH",
      403,
    );
    await call(
      recep,
      "entregas",
      { id_sucursal: central, paquetes: [p1.id_paquete] },
      "POST",
      409,
    );
    await call(
      recep,
      "paquetes",
      { id: p1.id_paquete, descripcion: "Caja uno editada", peso_kg: "1.25" },
      "PATCH",
    );
    await call(
      warehouse,
      "ubicaciones",
      { id: p1.id_paquete, id_locker: locker },
      "PATCH",
      409,
    );
    const free = data.lockers.find(
      (l: { paquete: unknown; tamanio: number; id_sucursal: string }) =>
        !l.paquete && l.tamanio === 1 && l.id_sucursal === central,
    );
    await call(
      warehouse,
      "ubicaciones",
      { id: p1.id_paquete, id_locker: free.id_locker },
      "PATCH",
    );
    await call(admin, "cobros", {
      id_paquete: p1.id_paquete,
      id_sucursal: central,
      pagador: "destinatario",
      medio: "efectivo",
    });
    await call(
      admin,
      "cobros",
      {
        id_paquete: p1.id_paquete,
        id_sucursal: central,
        pagador: "destinatario",
        medio: "efectivo",
      },
      "POST",
      409,
    );
    await call(warehouse, "traslados", {
      id_sucursal_origen: central,
      id_sucursal_destino: norte,
      paquetes: [p1.id_paquete, p2.id_paquete],
    });
    data = await (await admin.get("/api/sgap/datos")).json();
    const transfer = data.traslados[0];
    await call(
      warehouse,
      "traslados",
      {
        id: transfer.id_traslado,
        id_sucursal_destino: norte,
        observaciones: "Verificado",
      },
      "PATCH",
    );
    await call(
      warehouse,
      "traslados",
      { id: transfer.id_traslado, accion: "despachar" },
      "PATCH",
    );
    await call(
      recep,
      "entregas",
      { id_sucursal: central, paquetes: [p1.id_paquete] },
      "POST",
      404,
    );
    await call(
      warehouse,
      "traslados",
      {
        id: transfer.id_traslado,
        accion: "recibir",
        id_detalle: transfer.detalle_traslado[0].id_detalle_traslado,
      },
      "PATCH",
      403,
    );
    for (const d of transfer.detalle_traslado)
      await call(
        admin,
        "traslados",
        {
          id: transfer.id_traslado,
          accion: "recibir",
          id_detalle: d.id_detalle_traslado,
        },
        "PATCH",
      );
    await call(admin, "entregas", {
      id_sucursal: norte,
      paquetes: [p1.id_paquete, p2.id_paquete],
      ci_destinatario: "81112222",
    });
    await call(
      admin,
      "entregas",
      { id_sucursal: norte, paquetes: [p1.id_paquete] },
      "POST",
      409,
    );
    await call(admin, "devoluciones", {
      id_paquete: p2.id_paquete,
      id_sucursal: norte,
      pagador: "cliente",
      medio: "efectivo",
      motivo: "Ajuste total de prueba",
    });
    await call(
      admin,
      "devoluciones",
      {
        id_paquete: p2.id_paquete,
        id_sucursal: norte,
        pagador: "cliente",
        medio: "efectivo",
        motivo: "Duplicada",
      },
      "POST",
      409,
    );
    await call(admin, "paquetes", { id: p2.id_paquete }, "DELETE", 400);
    await call(admin, "paquetes", { id: p3.id_paquete }, "DELETE");
    // Recargos por tiempo y avisos: la DB de esta prueba es desechable.
    await call(recep, "recepciones", {
      id_sucursal: central,
      id_cliente: merchant,
      paquetes: [
        {
          codigo: "TEST-DUE",
          descripcion: "Aviso",
          tamanio: "1",
          modalidad_pago: "pendiente",
          id_destinatario: recipient,
        },
      ],
    });
    data = await (await admin.get("/api/sgap/datos")).json();
    const due = data.paquetes.find(
      (p: { codigo: string }) => p.codigo === "TEST-DUE",
    );
    await db.query(
      "UPDATE pago_pendiente SET vence_en=((CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')::date + 1)::timestamp AT TIME ZONE 'America/La_Paz' WHERE id_paquete=$1",
      [due.id_paquete],
    );
    data = await (await admin.get("/api/sgap/datos")).json();
    const alert = data.avisos.find(
      (a: { codigo: string }) => a.codigo === "TEST-DUE",
    );
    expect(alert).toBeTruthy();
    await call(admin, "notificaciones", {
      id_pago_pendiente: alert.id_pago_pendiente,
      tipo: alert.tipo,
      telefono: alert.telefono,
      contenido: "Aviso efectuado de prueba",
    });
    own = await (await customer.get("/api/sgap/datos")).json();
    const notification = own.notificaciones[0];
    expect(notification.contenido).toContain("Aviso efectuado");
    await call(
      customer,
      "notificaciones",
      { id: notification.id_notificacion },
      "PATCH",
    );
    await call(
      customer,
      "notificaciones",
      { id: notification.id_notificacion },
      "DELETE",
    );
    own = await (await customer.get("/api/sgap/datos")).json();
    expect(own.notificaciones).toHaveLength(0);
    await db.query(
      "UPDATE paquete SET fecha_ingreso=CURRENT_TIMESTAMP-INTERVAL '8 days',fecha_limite=CURRENT_TIMESTAMP-INTERVAL '1 second' WHERE id_paquete=$1",
      [due.id_paquete],
    );
    data = await (await admin.get("/api/sgap/datos")).json();
    expect(
      data.paquetes.find((p: { codigo: string }) => p.codigo === "TEST-DUE")
        .pago_pendiente,
    ).toHaveLength(2);
    const afterAgain = await (await admin.get("/api/sgap/datos")).json();
    expect(
      afterAgain.paquetes.find(
        (p: { codigo: string }) => p.codigo === "TEST-DUE",
      ).pago_pendiente,
    ).toHaveLength(2);
    await call(
      admin,
      "tarifas",
      { importe_inicial: "3", recargo_semanal: "4", dias_iniciales: "5" },
      "PATCH",
    );
    const original = afterAgain.paquetes.find(
      (p: { codigo: string }) => p.codigo === "TEST-DUE",
    );
    expect(Number(original.importe_inicial)).toBe(2);
    await call(admin, "personal", {
      nombre: "Temporal",
      apellido: "Prueba",
      ci: "83333333",
      correo: "temporal@lockers.local",
      password: "LockersDemo2026!",
      nivel: "3",
      id_sucursal: norte,
    });
    data = await (await admin.get("/api/sgap/datos")).json();
    const employee = data.personal.find(
      (p: { correo: string }) => p.correo === "temporal@lockers.local",
    );
    await call(
      admin,
      "personal",
      {
        id: String(employee.id),
        nombre: "Editado",
        apellido: "Prueba",
        ci: "83333333",
        correo: "temporal@lockers.local",
        nivel: "2",
        id_sucursal: norte,
        activo: false,
      },
      "PATCH",
    );
    await call(
      admin,
      "personal",
      {
        id: String(employee.id),
        nivel: "2",
        id_sucursal: norte,
        nombre: "Editado",
        apellido: "Prueba",
        ci: "83333333",
        correo: "temporal@lockers.local",
      },
      "DELETE",
    );
    await call(
      customer,
      "cuenta",
      { nombre: "Cliente", apellido: "Actualizado", telefono: "73333333" },
      "PATCH",
    );
    // Verifica UI real en escritorio y móvil con las cuatro sesiones.
    for (const [api, role] of [
      [admin, "administrador"],
      [recep, "empleado"],
      [warehouse, "almacenes"],
      [customer, "cliente"],
    ] as const) {
      const ctx = await browser.newContext({
        storageState: await api.storageState(),
        viewport: { width: 1440, height: 1080 },
        reducedMotion: "reduce",
      });
      const page = await ctx.newPage();
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`/paneles/${role}`);
      await expect(
        page.getByRole("heading", { name: "Panel general", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("Cargando tu espacio de trabajo…"),
      ).toHaveCount(0);
      await page.screenshot({
        path: `test-results/${role}-desktop.png`,
        fullPage: true,
      });
      // Recorre todas las subsecciones; no basta con que cargue la portada.
      for (const item of navigation(role)) {
        await page
          .locator("aside")
          .getByRole("button", { name: item.label, exact: true })
          .click();
        await expect(
          page.getByRole("heading", {
            level: 1,
            name: item.label,
            exact: true,
          }),
        ).toBeVisible();
        if (item.id === "pagos")
          await expect(
            page.getByRole("heading", { name: "Cobros de hoy", exact: true }),
          ).toBeVisible();
        for (const view of item.tabs)
          await page.getByRole("tab", { name: view, exact: true }).click();
      }
      if (role === "administrador") {
        await page
          .locator("aside")
          .getByRole("button", { name: "Usuarios", exact: true })
          .click();
        await page
          .getByRole("link", { name: "Nuevo cliente", exact: true })
          .click();
        await page.getByLabel("Nombre", { exact: true }).fill("Cliente");
        await page.getByLabel("Apellidos", { exact: true }).fill("Interfaz");
        await page.getByLabel("Carnet de Identidad").fill("84444444");
        await page.getByLabel("Número de Celular").fill("74444444");
        await page
          .getByLabel("Correo Electrónico")
          .fill("interfaz@lockers.local");
        await page
          .getByLabel("Contraseña", { exact: true })
          .fill("LockersDemo2026!");
        const registrationResponse = page.waitForResponse(
          (response) =>
            response.url().endsWith("/api/auth/register") &&
            response.request().method() === "POST",
        );
        await page
          .getByRole("button", { name: "Crear Cuenta", exact: true })
          .click();
        const registered = await registrationResponse;
        expect(registered.status(), await registered.text()).toBe(201);
        await expect(page).toHaveURL(
          /\/paneles\/administrador\?seccion=usuarios/,
        );
        const row = page.getByRole("row").filter({ hasText: "84444444" });
        await expect(row).toContainText("Cliente Interfaz");
        await login("interfaz@lockers.local");
      }
      if (role === "empleado") {
        await page
          .locator("aside")
          .getByRole("button", { name: "Recepción y entregas", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Nueva recepción", exact: true })
          .click();
        await page
          .getByLabel("Cliente que deja los paquetes")
          .selectOption(merchant);
        await page.getByLabel("Código (vacío para generar)").fill("UI-PACKAGE");
        await page
          .getByLabel("Descripción", { exact: false })
          .fill("Paquete creado desde la interfaz");
        await page
          .getByLabel("Cuenta del destinatario (opcional)")
          .selectOption(recipient);
        await page
          .getByRole("button", { name: "Guardar", exact: true })
          .click();
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await expect(
          page.getByRole("row").filter({ hasText: "UI-PACKAGE" }),
        ).toBeVisible();
      }
      if (role === "almacenes") {
        await page
          .locator("aside")
          .getByRole("button", { name: "Almacenes y lockers", exact: true })
          .click();
        await page
          .getByRole("tab", { name: "Por ubicar", exact: true })
          .click();
        await page
          .getByRole("row")
          .filter({ hasText: "UI-PACKAGE" })
          .getByRole("button", { name: "Asignar locker" })
          .click();
        const control = page.getByLabel("Locker compatible");
        const available = await control
          .locator("option")
          .nth(1)
          .getAttribute("value");
        await control.selectOption(available!);
        await page
          .getByRole("button", { name: "Guardar", exact: true })
          .click();
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await expect(
          page.getByRole("row").filter({ hasText: "UI-PACKAGE" }),
        ).toHaveCount(0);
      }
      await page
        .locator("aside")
        .getByRole("button", { name: "Panel general", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Ver detalle →", exact: true })
        .first()
        .click();
      await expect(
        page.getByRole("img", { name: /QR del paquete/ }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Cerrar", exact: true })
        .last()
        .click();
      await page
        .getByRole("button", { name: "Mi cuenta", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Mi cuenta", exact: true }).first(),
      ).toBeVisible();
      await page.getByRole("button", { name: "Editar mi cuenta" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.getByLabel("Teléfono", { exact: true }).fill("74444444");
      await page.getByRole("button", { name: "Guardar", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.getByText("74444444", { exact: true })).toBeVisible();
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole("button", { name: "Abrir menú" }).click();
      await page
        .getByRole("button", { name: "Panel general", exact: true })
        .click();
      await page.screenshot({
        path: `test-results/${role}-mobile.png`,
        fullPage: true,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
      expect(errors).toEqual([]);
      await ctx.close();
    }
    await call(
      warehouse,
      "lockers",
      { id: locker, id_sucursal: central, tamanio: "3" },
      "DELETE",
    );
    expect(data.diarios.length).toBeGreaterThan(0);
    // Reproduce el incidente real únicamente en la DB desechable de las pruebas.
    const database = new URL(process.env.DATABASE_URL!).pathname.slice(1);
    if (!/^lockers_test_\d+$/.test(database))
      throw new Error("La prueba de restauración requiere la DB temporal.");
    const repair = readFileSync(
      "prisma/migrations/202611190001_restaurar_reglas_operacion/migration.sql",
      "utf8",
    );
    const antes = (await db.query("SELECT count(*) AS n FROM movimiento"))
      .rows[0].n;
    try {
      await db.query("DROP FUNCTION generar_recargos(timestamptz, bigint)");
      const error = await admin.get("/api/sgap/datos");
      expect(error.status()).toBe(503);
      expect((await error.json()).code).toBe("DB_SCHEMA_INCOMPLETE");
    } finally {
      await db.query(repair);
    }
    expect((await admin.get("/api/sgap/datos")).status()).toBe(200);
    // La misma reparación también es válida si las reglas ya existen.
    await db.query(repair);
    expect((await admin.get("/api/sgap/datos")).status()).toBe(200);
    expect(
      (await db.query("SELECT count(*) AS n FROM movimiento")).rows[0].n,
    ).toBe(antes);
  } finally {
    for (const ctx of contexts) await ctx.dispose();
    await db.end();
  }
});
