import {
  test,
  expect as baseExpect,
  type APIRequestContext,
} from "@playwright/test";
import pg from "pg";

test.use({ actionTimeout: 15000 });
const expect = baseExpect.configure({ timeout: 15000 });
test("superadministrador, lockers sin borrado y filtros por módulo", async ({
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
  async function login(correo: string, password = "LockersDemo2026!") {
    const api = await playwright.request.newContext({
      baseURL: process.env.TEST_BASE_URL,
    });
    apis.push(api);
    const res = await api.post("/api/auth/login", {
      data: { correo, password, captcha: "local-dev" },
    });
    expect(res.status(), await res.text()).toBe(200);
    return api;
  }
  async function call(
    api: APIRequestContext,
    resource: string,
    data: object,
    method = "POST",
    expected = 200,
  ) {
    const res = await api.fetch(`/api/sgap/${resource}`, { method, data });
    const result = await res.json();
    expect(res.status(), JSON.stringify(result)).toBe(expected);
    return result;
  }
  try {
    const root = await login("admin@lockers.local");
    const snapshot = async (api = root) =>
      (await api.get("/api/sgap/datos")).json();
    let data = await snapshot();
    expect(data.usuario.nivel).toBe(5);
    expect(data.usuario.rol).toBe("SuperAdministrador");
    const central = data.sucursales.find(
      (s: { nombre: string }) => s.nombre === "Central",
    ).id_sucursal;
    const norte = data.sucursales.find(
      (s: { nombre: string }) => s.nombre === "Norte",
    ).id_sucursal;
    const customer = data.clientes[0].id_cliente;
    const tag = `MOD-${Date.now()}`;
    const person = {
      nombre: "Administrador",
      apellido: "Sucursal",
      correo: "admin.normal@lockers.local",
      ci: "86661001",
      telefono: "70001001",
      password: "LockersDemo2026!",
      nivel: 1,
      id_sucursal: central,
    };
    const creation = await root.post("/api/auth/register-empleado", {
      data: person,
    });
    expect(creation.status(), await creation.text()).toBe(201);
    const admin = await login(person.correo);
    expect((await snapshot(admin)).usuario.nivel).toBe(1);
    const denied = await admin.post("/api/auth/register-empleado", {
      data: {
        ...person,
        correo: "admin.no-permitido@lockers.local",
        ci: "86661002",
      },
    });
    expect(denied.status()).toBe(403);
    await call(
      admin,
      "personal",
      { ...person, correo: "admin.tampoco@lockers.local", ci: "86661003" },
      "POST",
      403,
    );
    const employee = {
      ...person,
      nombre: "Empleado",
      correo: "empleado.normal@lockers.local",
      ci: "86661004",
      nivel: 2,
    };
    expect(
      (
        await admin.post("/api/auth/register-empleado", { data: employee })
      ).status(),
    ).toBe(201);
    data = await snapshot(admin);
    const employeeRecord = data.personal.find(
      (s: { correo: string }) => s.correo === employee.correo,
    );
    await call(
      admin,
      "personal",
      { ...employee, id: employeeRecord.id, nivel: 1 },
      "PATCH",
      403,
    );
    await call(
      admin,
      "personal",
      { ...employee, id: data.usuario.id, nivel: 5 },
      "PATCH",
      403,
    );
    const rootRecord = data.personal.find(
      (s: { correo: string }) => s.correo === "admin@lockers.local",
    );
    await call(
      admin,
      "personal",
      { ...person, id: rootRecord.id, nivel: 5 },
      "PATCH",
      403,
    );
    expect(data.sucursales.length).toBeGreaterThan(1);
    const ctx = await browser.newContext({
      storageState: await admin.storageState(),
      viewport: { width: 1440, height: 1000 },
    });
    contexts.push(ctx);
    const page = await ctx.newPage();
    await page.goto("/registerEmpleado");
    await expect(
      page.getByLabel("Cargo").locator('option[value="1"]'),
    ).toHaveCount(0);
    const rootContext = await browser.newContext({
      storageState: await root.storageState(),
    });
    contexts.push(rootContext);
    const rootPage = await rootContext.newPage();
    await rootPage.goto("/registerEmpleado");
    await expect(
      rootPage.getByLabel("Cargo").locator('option[value="1"]'),
    ).toHaveCount(1);
    const beforeCount = Number(
      (await db.query("SELECT count(*) AS n FROM locker")).rows[0].n,
    );
    const locker = (
      await call(admin, "lockers", {
        codigo: `${tag}-L1`,
        id_sucursal: central,
        tamanio: "1",
      })
    ).result;
    const large = (
      await call(admin, "lockers", {
        codigo: `${tag}-L3`,
        id_sucursal: norte,
        tamanio: "3",
      })
    ).result;
    await call(admin, "recepciones", {
      id_sucursal: central,
      id_cliente: customer,
      paquetes: [
        {
          codigo: `${tag}-P1`,
          descripcion: "Paquete pequeño ubicado",
          tamanio: "1",
          modalidad_pago: "pendiente",
        },
      ],
    });
    await call(admin, "recepciones", {
      id_sucursal: norte,
      id_cliente: customer,
      paquetes: [
        {
          codigo: `${tag}-P3`,
          descripcion: "Paquete grande por ubicar",
          tamanio: "3",
          modalidad_pago: "pendiente",
        },
      ],
    });
    data = await snapshot(admin);
    const smallPackage = data.paquetes.find(
      (p: { codigo: string }) => p.codigo === `${tag}-P1`,
    );
    await call(
      admin,
      "ubicaciones",
      { id: smallPackage.id_paquete, id_locker: locker.id_locker },
      "PATCH",
    );
    await call(
      admin,
      "lockers",
      { id: locker.id_locker, accion: "deshabilitar" },
      "PATCH",
      409,
    );
    await call(admin, "lockers", { id: large.id_locker }, "DELETE", 405);
    await page.goto(
      "/paneles/administrador?seccion=almacenes&vista=Por%20ubicar",
    );
    await expect(page.locator("#submenu-almacenes")).toBeVisible();
    await expect(
      page
        .locator("#submenu-almacenes")
        .getByRole("button", { name: "Nuevo locker", exact: true }),
    ).toBeVisible();
    await expect(
      page
        .locator("#submenu-almacenes")
        .getByRole("button", { name: "Sucursales", exact: true }),
    ).toHaveCount(0);
    await expect(
      page
        .locator("#submenu-almacenes")
        .getByRole("button", { name: "Reubicaciones", exact: true }),
    ).toHaveCount(0);
    await page.getByRole("textbox", { name: "Buscar", exact: true }).fill(tag);
    await expect(page.locator("tbody tr")).toHaveCount(2);
    await expect(
      page.getByRole("button", { name: "Reubicar", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Asignar locker", exact: true }),
    ).toBeVisible();
    await page.getByText("Filtros", { exact: true }).click();
    await page.getByLabel("Estado", { exact: true }).selectOption("Almacenado");
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await page.getByLabel("Tamaño", { exact: true }).selectOption("Grande");
    await expect(page.locator("tbody tr")).toHaveCount(0);
    await page
      .getByRole("button", { name: "Limpiar filtros", exact: true })
      .click();
    await expect(page.locator("tbody tr")).toHaveCount(2);
    await page.getByLabel("Sucursal", { exact: true }).selectOption("Norte");
    await expect(page.locator("tbody")).toContainText(`${tag}-P3`);
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await page
      .getByRole("button", { name: "Limpiar filtros", exact: true })
      .click();
    const tomorrow = (
      await db.query(
        "SELECT ((CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')::date+1)::text AS dia",
      )
    ).rows[0].dia;
    await page.getByLabel("Desde", { exact: true }).fill(tomorrow);
    await expect(page.locator("tbody tr")).toHaveCount(0);
    await page
      .getByRole("button", { name: "Limpiar filtros", exact: true })
      .click();
    await page
      .locator("#submenu-almacenes")
      .getByRole("button", { name: "Actualizar lockers", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Buscar", exact: true })
      .fill(large.codigo);
    await expect(
      page.getByRole("button", { name: "Eliminar", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Deshabilitar", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Guardar", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator("tbody")).toContainText("Deshabilitado");
    expect(
      Number((await db.query("SELECT count(*) AS n FROM locker")).rows[0].n),
    ).toBe(beforeCount + 2);
    expect(
      (
        await db.query("SELECT habilitado FROM locker WHERE id_locker=$1", [
          large.id_locker,
        ])
      ).rows[0].habilitado,
    ).toBe(false);
    await page.getByText("Filtros", { exact: true }).click();
    await page.getByLabel("Estado", { exact: true }).selectOption("Disponible");
    await expect(page.locator("tbody tr")).toHaveCount(0);
    await page
      .getByLabel("Estado", { exact: true })
      .selectOption("Deshabilitado");
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await page.goto(
      "/paneles/administrador?seccion=usuarios&vista=Usuarios%20registrados",
    );
    await expect(
      page
        .locator("aside")
        .getByRole("button", { name: "Cargos y accesos", exact: true }),
    ).toHaveCount(0);
    await page.getByText("Cargos y accesos", { exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Permisos por cargo", exact: true }),
    ).toBeVisible();
    const created = await call(admin, "clientes", {
      nombre: `Comerciante${Date.now()}`,
    });
    const clientId = created.result.id_cliente;
    await call(admin, "recepciones", {
      id_sucursal: central,
      id_cliente: clientId,
      paquetes: [
        {
          codigo: `${tag}-HISTORIAL`,
          descripcion: "Historial que debe conservarse",
          tamanio: "1",
          modalidad_pago: "pendiente",
        },
      ],
    });
    data = await snapshot(admin);
    const personBefore = data.clientes.find(
      (c: { id_cliente: string }) => c.id_cliente === clientId,
    );
    const personsBefore = Number(
      (await db.query("SELECT count(*) AS n FROM persona")).rows[0].n,
    );
    await page.goto(
      "/paneles/administrador?seccion=usuarios&vista=Nuevo%20usuario",
    );
    const access = page.locator("section").filter({
      has: page.getByRole("heading", {
        name: "Crear acceso a un cliente registrado",
        exact: true,
      }),
    });
    await access
      .getByRole("textbox", { name: "Buscar", exact: true })
      .fill(personBefore.persona.nombre);
    await access
      .getByRole("button", { name: "Crear acceso", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("textbox", { name: /^CI\b/ })
      .fill("86661005");
    await page
      .getByLabel("Correo de acceso")
      .fill("cliente.habilitado@lockers.local");
    await page.getByLabel("Contraseña inicial").fill("LockersDemo2026!");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Guardar", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const linked = await login("cliente.habilitado@lockers.local");
    expect(
      (await snapshot(linked)).paquetes.some(
        (p: { codigo: string }) => p.codigo === `${tag}-HISTORIAL`,
      ),
    ).toBeTruthy();
    expect(
      Number((await db.query("SELECT count(*) AS n FROM persona")).rows[0].n),
    ).toBe(personsBefore);
    expect(
      (
        await db.query(
          "SELECT id_persona FROM usuario WHERE correo='cliente.habilitado@lockers.local'",
        )
      ).rows[0].id_persona,
    ).toBe(clientId);
  } finally {
    for (const ctx of contexts) await ctx.close();
    for (const api of apis) await api.dispose();
    await db.end();
  }
});
