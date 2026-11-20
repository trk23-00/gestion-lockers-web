import { test, expect } from "@playwright/test";

test("dos usuarios ven el CRUD sin recargar y conservan sus formularios", async ({
  playwright,
  browser,
}) => {
  const baseURL = process.env.TEST_BASE_URL;
  const admin = await playwright.request.newContext({ baseURL });
  const recepcion = await playwright.request.newContext({ baseURL });
  const cliente = await playwright.request.newContext({ baseURL });
  for (const [api, correo] of [
    [admin, "admin@lockers.local"],
    [recepcion, "recepcion@lockers.local"],
    [cliente, "cliente@lockers.local"],
  ] as const) {
    const login = await api.post("/api/auth/login", {
      data: { correo, password: "LockersDemo2026!", captcha: "local-dev" },
    });
    expect(login.status(), await login.text()).toBe(200);
  }
  const writerContext = await browser.newContext({
    storageState: await admin.storageState(),
  });
  const readerContext = await browser.newContext({
    storageState: await recepcion.storageState(),
  });
  const clientContext = await browser.newContext({
    storageState: await cliente.storageState(),
  });
  const writer = await writerContext.newPage(),
    reader = await readerContext.newPage();
  let navigations = 0;
  reader.on("framenavigated", (frame) => {
    if (frame === reader.mainFrame()) navigations++;
  });
  const marker = `SYNC-${Date.now()}`;
  let packageId: string | undefined;
  const createdClients: string[] = [];
  try {
    await writer.goto("/paneles/administrador?seccion=usuarios&vista=Clientes");
    await reader.goto("/paneles/empleado?seccion=clientes&vista=Directorio");
    await expect(
      reader.getByRole("heading", {
        name: "Directorio de clientes",
        exact: true,
      }),
    ).toBeVisible();
    const initialNavigations = navigations;
    const search = reader.getByRole("textbox", { name: "Buscar", exact: true });
    await search.fill(marker);
    await reader
      .getByRole("button", { name: "Nuevo cliente", exact: true })
      .click();
    await reader
      .getByLabel("Nombre completo")
      .fill("Borrador que debe conservarse");
    await reader.getByLabel("CI", { exact: true }).fill("86666666");

    await writer
      .getByRole("button", { name: "Nuevo cliente", exact: true })
      .click();
    await writer.getByLabel("Nombre completo").fill(`${marker} creado`);
    await writer.getByLabel("CI", { exact: true }).fill("87770001");
    await writer.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(writer.getByRole("dialog")).toHaveCount(0);
    const snapshot = await (await admin.get("/api/sgap/datos")).json();
    const record = snapshot.clientes.find(
      (c: { persona: { ci: string } }) => c.persona.ci === "87770001",
    );
    createdClients.push(record.id_cliente);
    // El fondo recibe los datos sin desmontar el formulario que sigue abierto.
    await expect(reader.locator("tbody")).toContainText(`${marker} creado`, {
      timeout: 12000,
    });
    await expect(reader.getByRole("dialog")).toBeVisible();
    await expect(reader.getByLabel("Nombre completo")).toHaveValue(
      "Borrador que debe conservarse",
    );
    await expect(reader.getByLabel("CI", { exact: true })).toHaveValue(
      "86666666",
    );
    await reader.getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(search).toHaveValue(marker);

    await writer
      .getByRole("row")
      .filter({ hasText: "87770001" })
      .getByRole("button", { name: "Editar", exact: true })
      .click();
    await writer.getByLabel("Nombre completo").fill(`${marker} editado`);
    await writer.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(writer.getByRole("dialog")).toHaveCount(0);
    await expect(
      reader.getByRole("row").filter({ hasText: "87770001" }),
    ).toContainText(`${marker} editado`, { timeout: 12000 });
    await expect(search).toHaveValue(marker);

    await writer
      .getByRole("row")
      .filter({ hasText: "87770001" })
      .getByRole("button", { name: "Eliminar", exact: true })
      .click();
    await writer
      .getByRole("button", { name: "Eliminar registro", exact: true })
      .click();
    await expect(writer.getByRole("dialog")).toHaveCount(0);
    await expect(
      reader.getByRole("row").filter({ hasText: "87770001" }),
    ).toHaveCount(0, { timeout: 12000 });
    expect(navigations).toBe(initialNavigations);

    // Al volver a estar en línea se consultan los cambios automáticamente.
    await readerContext.setOffline(true);
    const creation = await admin.post("/api/sgap/clientes", {
      data: { nombre: `${marker} reconectado`, ci: "87770002" },
    });
    expect(creation.status()).toBe(200);
    const second = await (await admin.get("/api/sgap/datos")).json();
    const reconnected = second.clientes.find(
      (c: { persona: { ci: string } }) => c.persona.ci === "87770002",
    );
    createdClients.push(reconnected.id_cliente);
    await readerContext.setOffline(false);
    await expect(
      reader.getByRole("row").filter({ hasText: "87770002" }),
    ).toContainText(`${marker} reconectado`, { timeout: 12000 });
    expect(navigations).toBe(initialNavigations);

    const initial = await (await admin.get("/api/sgap/datos")).json();
    const branch = initial.sucursales.find(
      (s: { nombre: string }) => s.nombre === "Central",
    ).id_sucursal;
    const recipient = initial.clientes.find(
      (c: { persona: { correo: string } }) =>
        c.persona.correo === "cliente@lockers.local",
    ).id_cliente;
    const code = `${marker}-PAQ`;
    const receipt = await recepcion.post("/api/sgap/recepciones", {
      data: {
        id_sucursal: branch,
        id_cliente: recipient,
        paquetes: [
          {
            codigo: code,
            descripcion: "Paquete para sincronización",
            tamanio: "1",
            modalidad_pago: "pendiente",
            id_destinatario: recipient,
          },
        ],
      },
    });
    expect(receipt.status()).toBe(200);
    const registered = await (await admin.get("/api/sgap/datos")).json();
    packageId = registered.paquetes.find(
      (p: { codigo: string }) => p.codigo === code,
    ).id_paquete;
    const clientPage = await clientContext.newPage();
    await clientPage.goto("/paneles/cliente?seccion=paquetes&vista=Activos");
    await clientPage
      .getByRole("textbox", { name: "Buscar", exact: true })
      .fill(code);
    await clientPage
      .getByRole("row")
      .filter({ hasText: code })
      .getByRole("button", { name: "Ver detalle →", exact: true })
      .click();
    const changed = await admin.patch("/api/sgap/paquetes", {
      data: {
        id: packageId,
        descripcion: "Descripción cambiada por otro usuario",
      },
    });
    expect(changed.status()).toBe(200);
    await expect(
      clientPage
        .getByRole("dialog")
        .getByText("Descripción cambiada por otro usuario", { exact: true }),
    ).toBeVisible({ timeout: 12000 });
    const removed = await admin.delete("/api/sgap/paquetes", {
      data: { id: packageId },
    });
    expect(removed.status()).toBe(200);
    packageId = undefined;
    await expect(
      clientPage
        .getByRole("dialog")
        .getByRole("heading", { name: "Registro no disponible", exact: true }),
    ).toBeVisible({ timeout: 12000 });
    await clientPage
      .getByRole("button", { name: "Cerrar", exact: true })
      .click();
    await expect(
      clientPage.getByRole("row").filter({ hasText: code }),
    ).toHaveCount(0);
  } finally {
    await Promise.all([
      writerContext.close(),
      readerContext.close(),
      clientContext.close(),
    ]);
    if (packageId)
      await admin.delete("/api/sgap/paquetes", { data: { id: packageId } });
    for (const id of createdClients)
      await admin.delete("/api/sgap/clientes", { data: { id } });
    await Promise.all([
      admin.dispose(),
      recepcion.dispose(),
      cliente.dispose(),
    ]);
  }
});
