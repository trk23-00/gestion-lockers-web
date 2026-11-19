import "../scripts/env.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import pg from "pg";
import bcrypt from "bcrypt";

const folder = fileURLToPath(new URL("./", import.meta.url));
const demoPassword = "PruebaLockers2026!";
const prefix = "DEMO-COMPARTIR-";
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
const newAccounts = [
  {
    nombre: "María",
    apellido: "Fernández",
    ci: "91000001",
    correo: "comerciante.maria@lockers.local",
    telefono: "71000001",
    nivel: 4,
  },
  {
    nombre: "Jorge",
    apellido: "Rojas",
    ci: "91000002",
    correo: "comerciante.jorge@lockers.local",
    telefono: "71000002",
    nivel: 4,
  },
  {
    nombre: "Ana",
    apellido: "Gómez",
    ci: "91000003",
    correo: "compradora.ana@lockers.local",
    telefono: "71000003",
    nivel: 4,
  },
  {
    nombre: "Luis",
    apellido: "Quispe",
    ci: "91000004",
    correo: "comprador.luis@lockers.local",
    telefono: "71000004",
    nivel: 4,
  },
  {
    nombre: "Sofía",
    apellido: "Méndez",
    ci: "91000005",
    correo: "recepcion.norte@lockers.local",
    telefono: "71000005",
    nivel: 2,
  },
  {
    nombre: "Diego",
    apellido: "Paredes",
    ci: "91000006",
    correo: "almacen.norte@lockers.local",
    telefono: "71000006",
    nivel: 3,
  },
];

async function query(sql, params = []) {
  return (await db.query(sql, params)).rows;
}
async function one(sql, params = []) {
  const rows = await query(sql, params);
  if (!rows[0])
    throw new Error("Falta un dato inicial requerido por la demostración.");
  return rows[0];
}
async function validate() {
  const tables = await query(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
  );
  const counts = {};
  for (const { tablename } of tables) {
    if (!/^[a-z_]+$/.test(tablename))
      throw new Error("Nombre de tabla inesperado.");
    const { n } = await one(`SELECT count(*) AS n FROM public.${tablename}`);
    counts[tablename] = Number(n);
    if (!Number(n))
      throw new Error(`La tabla ${tablename} quedó sin datos de prueba.`);
  }
  const { pendientes_entregados } = await one(
    "SELECT count(*) AS pendientes_entregados FROM paquete p JOIN saldo_paquete s USING(id_paquete) WHERE p.estado='entregado' AND s.saldo_pendiente<>0",
  );
  if (Number(pendientes_entregados))
    throw new Error("Hay paquetes entregados con deuda.");
  const { errores } = await one(`
    WITH caja AS (
      SELECT id_sucursal,(fecha AT TIME ZONE 'America/La_Paz')::date AS fecha,
        SUM(CASE WHEN tipo='entrada' THEN monto ELSE 0 END) AS entradas,
        SUM(CASE WHEN tipo='salida' THEN monto ELSE 0 END) AS salidas,
        COUNT(*) FILTER(WHERE tipo='entrada') AS cobros,
        COUNT(*) FILTER(WHERE tipo='salida') AS devoluciones
      FROM movimiento GROUP BY 1,2
    )
    SELECT count(*) AS errores FROM caja c FULL JOIN resumen_diario r USING(id_sucursal,fecha)
    WHERE c.entradas IS DISTINCT FROM r.total_entradas
       OR c.salidas IS DISTINCT FROM r.total_salidas
       OR c.cobros IS DISTINCT FROM r.cantidad_cobros
       OR c.devoluciones IS DISTINCT FROM r.cantidad_devoluciones
       OR r.saldo IS DISTINCT FROM r.total_entradas-r.total_salidas
  `);
  if (Number(errores))
    throw new Error("La caja diaria no coincide con los movimientos.");
  const { errores: monthly } = await one(`
    WITH caja AS (
      SELECT id_sucursal,date_trunc('month',fecha AT TIME ZONE 'America/La_Paz')::date AS periodo,
        SUM(CASE WHEN tipo='entrada' THEN monto ELSE 0 END) AS entradas,
        SUM(CASE WHEN tipo='salida' THEN monto ELSE 0 END) AS salidas
      FROM movimiento GROUP BY 1,2
    )
    SELECT count(*) AS errores FROM caja c FULL JOIN resumen_mensual r USING(id_sucursal,periodo)
    WHERE c.entradas IS DISTINCT FROM r.total_entradas OR c.salidas IS DISTINCT FROM r.total_salidas
       OR r.saldo IS DISTINCT FROM r.total_entradas-r.total_salidas
  `);
  if (Number(monthly))
    throw new Error("La caja mensual no coincide con los movimientos.");
  return counts;
}

try {
  await db.connect();
  await db.query("BEGIN");
  await db.query("SET LOCAL TIME ZONE 'America/La_Paz'");
  const { fecha: now } = await one("SELECT CURRENT_TIMESTAMP AS fecha");
  const { n } = await one(
    "SELECT count(*) AS n FROM paquete WHERE codigo LIKE $1",
    [`${prefix}%`],
  );
  if (Number(n) !== 0 && Number(n) !== 24)
    throw new Error(
      "Existen datos parciales de esta demostración. No se modificaron.",
    );
  const central = await one("SELECT * FROM sucursal WHERE nombre='Central'");
  const norte = await one("SELECT * FROM sucursal WHERE nombre='Norte'");
  if (!Number(n)) {
    const hash = await bcrypt.hash(demoPassword, 10);
    for (const a of newAccounts) {
      const found = await query(
        "SELECT id FROM usuario WHERE correo=$1 OR ci=$2",
        [a.correo, a.ci],
      );
      if (found.length)
        throw new Error(
          `La cuenta ${a.correo} ya existe fuera de esta demostración. No se cambió su contraseña.`,
        );
      const person = await one(
        "INSERT INTO persona(nombre,ci,correo,telefono) VALUES($1,$2,$3,$4) RETURNING id_persona",
        [`${a.nombre} ${a.apellido}`, a.ci, a.correo, a.telefono],
      );
      if (a.nivel === 4)
        await db.query(
          "INSERT INTO cliente(id_cliente,observaciones) VALUES($1,$2)",
          [
            person.id_persona,
            "Cliente ficticio de prueba para compartir el prototipo.",
          ],
        );
      else {
        const cargo = await one("SELECT id_cargo FROM cargo WHERE nombre=$1", [
          a.nivel === 2 ? "recepcionista" : "encargado_almacenes",
        ]);
        await db.query(
          "INSERT INTO empleado(id_empleado,id_cargo,id_sucursal,usuario,password_hash) VALUES($1,$2,$3,$4,$5)",
          [
            person.id_persona,
            cargo.id_cargo,
            norte.id_sucursal,
            a.correo,
            hash,
          ],
        );
      }
      const rol = await one("SELECT id_rol FROM rol WHERE nivel=$1", [a.nivel]);
      await db.query(
        "INSERT INTO usuario(nombre,apellido,ci,correo,telefono,password,rol,id_persona) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
        [
          a.nombre,
          a.apellido,
          a.ci,
          a.correo,
          a.telefono,
          hash,
          rol.id_rol,
          person.id_persona,
        ],
      );
    }
    const users = await query(
      "SELECT u.*,r.nivel FROM usuario u JOIN rol r ON r.id_rol=u.rol",
    );
    const account = (email) => {
      const u = users.find((u) => u.correo === email);
      if (!u)
        throw new Error(
          `Falta la cuenta ${email}. Ejecute primero npm run setup.`,
        );
      return u;
    };
    const maria = account("comerciante.maria@lockers.local"),
      jorge = account("comerciante.jorge@lockers.local");
    const ana = account("compradora.ana@lockers.local"),
      luis = account("comprador.luis@lockers.local"),
      cliente = account("cliente@lockers.local");
    const recepcion = account("recepcion@lockers.local"),
      recepcionNorte = account("recepcion.norte@lockers.local");
    const almacen = account("almacen@lockers.local"),
      almacenNorte = account("almacen.norte@lockers.local"),
      admin = account("admin@lockers.local");
    const config = await one("SELECT * FROM configuracion WHERE id=1");
    const d = Number(config.dias_iniciales);
    const ago = (days) => new Date(now.getTime() - days * 86400000);
    const packages = new Map();
    const lockers = await query("SELECT * FROM locker");
    function locker(branch, code) {
      if (!code) return null;
      const l = lockers.find(
        (l) =>
          l.id_sucursal === branch.id_sucursal &&
          l.codigo === code &&
          l.habilitado,
      );
      if (!l)
        throw new Error(`Falta el locker habilitado ${branch.nombre}/${code}`);
      return l.id_locker;
    }
    async function receive(branch, merchant, employee, fecha, definitions) {
      const doc = await one(
        "INSERT INTO documento(tipo,fecha,id_sucursal,id_empleado,id_cliente,observaciones) VALUES('recepcion',$1,$2,$3,$4,$5) RETURNING id_documento",
        [
          fecha,
          branch.id_sucursal,
          employee.id_persona,
          merchant.id_persona,
          "Recepción ficticia de demostración; un documento agrupa paquetes y destinatarios diferentes.",
        ],
      );
      for (const def of definitions) {
        const code = `${prefix}${String(def.n).padStart(3, "0")}`;
        const limit = new Date(fecha.getTime() + d * 86400000);
        const p = await one(
          "INSERT INTO paquete(codigo,descripcion,tamanio,peso_kg,fecha_ingreso,fecha_limite,id_sucursal_actual,id_locker,modalidad_pago,importe_inicial,recargo_semanal,id_destinatario) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *",
          [
            code,
            def.descripcion,
            def.size || 1,
            def.peso || "1.250",
            fecha,
            limit,
            branch.id_sucursal,
            locker(branch, def.locker),
            def.anticipado ? "anticipado" : "pendiente",
            config.importe_inicial,
            config.recargo_semanal,
            def.recipient?.id_persona || null,
          ],
        );
        await db.query(
          "INSERT INTO detalle_documento(id_documento,tipo_documento,id_paquete,nombre_destinatario,ci_destinatario,telefono_destinatario,observaciones) VALUES($1,'recepcion',$2,$3,$4,$5,$6)",
          [
            doc.id_documento,
            p.id_paquete,
            def.recipient
              ? `${def.recipient.nombre} ${def.recipient.apellido}`
              : "Destinatario sin cuenta",
            def.recipient?.ci || "92000001",
            def.sinTelefono ? null : def.recipient?.telefono || "71000999",
            "Datos ficticios para demostración.",
          ],
        );
        packages.set(def.n, p);
      }
    }
    await receive(central, maria, recepcion, ago(2), [
      {
        n: 1,
        descripcion: "Caja de libros: pendiente de asignación de locker",
        recipient: ana,
      },
      {
        n: 2,
        descripcion: "Ropa: pago anticipado y locker mediano",
        recipient: luis,
        anticipado: true,
        size: 2,
        locker: "L-005",
      },
      {
        n: 3,
        descripcion: "Accesorios: disponible para entregar, saldo pagado",
        recipient: cliente,
        locker: "L-001",
      },
      {
        n: 4,
        descripcion: "Documentos: destinatario sin cuenta ni teléfono",
        sinTelefono: true,
        size: 2,
      },
    ]);
    await receive(central, maria, recepcion, ago(d - 1), [
      {
        n: 5,
        descripcion: "Regalo: vence mañana, aviso pendiente de realizar",
        recipient: ana,
      },
      {
        n: 6,
        descripcion: "Zapatos: vence mañana, aviso realizado y leído",
        recipient: luis,
        locker: "L-008",
      },
      {
        n: 7,
        descripcion: "Cuadernos: vence mañana, aviso realizado sin leer",
        recipient: cliente,
      },
    ]);
    await receive(norte, jorge, recepcionNorte, ago(d - 2), [
      {
        n: 8,
        descripcion: "Material de oficina: vence en dos días, aviso pendiente",
        recipient: ana,
        locker: "L-004",
      },
      {
        n: 9,
        descripcion: "Textiles: aviso de dos días ocultado por el cliente",
        recipient: luis,
        size: 2,
        locker: "L-008",
      },
    ]);
    await receive(central, maria, recepcion, ago(d + 3), [
      {
        n: 10,
        descripcion: "Herramientas: plazo vencido, recargo pendiente",
        recipient: ana,
        size: 2,
        locker: "L-007",
      },
      {
        n: 11,
        descripcion: "Equipo pequeño: entregado después de pagar el recargo",
        recipient: ana,
        locker: "L-004",
      },
    ]);
    await receive(norte, jorge, recepcionNorte, ago(d + 13), [
      {
        n: 12,
        descripcion: "Caja grande: dos semanas extra iniciadas sin pagar",
        recipient: luis,
        size: 3,
        locker: "L-009",
      },
      {
        n: 13,
        descripcion:
          "Producto con devolución monetaria total posterior a la entrega",
        recipient: luis,
        anticipado: true,
        size: 3,
        locker: "L-010",
      },
    ]);
    const previousMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 12, 14),
    );
    await receive(central, maria, recepcion, previousMonth, [
      {
        n: 14,
        descripcion: "Entrega del mes anterior con pago anticipado",
        recipient: cliente,
        anticipado: true,
      },
      {
        n: 15,
        descripcion: "Entrega del mes anterior pagada por el comerciante",
        recipient: ana,
      },
    ]);
    await receive(central, maria, recepcion, ago(1), [
      {
        n: 16,
        descripcion: "Traslado preparado a Norte, todavía sin despachar",
        recipient: ana,
        locker: "L-002",
      },
      {
        n: 17,
        descripcion: "Traslado parcial: este paquete ya fue recibido en Norte",
        recipient: cliente,
      },
      {
        n: 18,
        descripcion: "Traslado parcial: este paquete sigue en tránsito",
        recipient: luis,
      },
    ]);
    await receive(norte, jorge, recepcionNorte, ago(2), [
      {
        n: 19,
        descripcion: "Traslado completado desde Norte a Central",
        recipient: ana,
        locker: "L-002",
      },
      {
        n: 20,
        descripcion: "Segundo paquete del traslado completado",
        recipient: cliente,
        size: 2,
        locker: "L-005",
      },
      {
        n: 21,
        descripcion: "Traslado en camino desde Norte a Central",
        recipient: luis,
        locker: "L-003",
      },
    ]);
    await receive(norte, jorge, recepcionNorte, ago(1), [
      {
        n: 22,
        descripcion: "Traslado preparado desde Norte, paquete sin locker",
        recipient: ana,
      },
    ]);
    await receive(central, maria, recepcion, now, [
      {
        n: 23,
        descripcion: "Recepción de hoy: paquete grande con pago anticipado",
        recipient: cliente,
        anticipado: true,
        size: 3,
        peso: "8.500",
        locker: "L-009",
      },
      {
        n: 24,
        descripcion: "Recepción de hoy: paquete pequeño con pago al recoger",
        recipient: ana,
        peso: "0.750",
      },
    ]);
    const packageId = (n) => packages.get(n).id_paquete;
    async function pay(
      n,
      branch,
      employee,
      fecha,
      payer = "destinatario",
      medio = "efectivo",
    ) {
      await db.query(
        "SELECT cobrar_paquete($1::bigint,$2::bigint,$3::bigint,$4::varchar,$5::varchar,$6::timestamptz)",
        [
          packageId(n),
          employee.id_persona,
          branch.id_sucursal,
          payer,
          medio,
          fecha,
        ],
      );
    }
    async function deliver(numbers, branch, employee, fecha, collector) {
      const doc = await one(
        "INSERT INTO documento(tipo,fecha,id_sucursal,id_empleado,observaciones) VALUES('entrega',$1,$2,$3,$4) RETURNING id_documento",
        [
          fecha,
          branch.id_sucursal,
          employee.id_persona,
          "Entrega ficticia de uno o varios paquetes con saldo cero.",
        ],
      );
      for (const n of numbers)
        await db.query(
          "INSERT INTO detalle_documento(id_documento,tipo_documento,id_paquete,nombre_destinatario,ci_destinatario,telefono_destinatario) VALUES($1,'entrega',$2,$3,$4,$5)",
          [
            doc.id_documento,
            packageId(n),
            `${collector.nombre} ${collector.apellido}`,
            collector.ci,
            collector.telefono,
          ],
        );
    }
    await pay(3, central, admin, now, "destinatario", "qr");
    await pay(11, central, admin, ago(2));
    await deliver([11], central, recepcion, ago(2), ana);
    await deliver([13], norte, recepcionNorte, ago(d + 10), luis);
    const priorDelivery = new Date(
      previousMonth.getTime() + Math.min(d - 1, 2) * 86400000,
    );
    await pay(15, central, admin, priorDelivery, "cliente", "transferencia");
    await deliver([14, 15], central, recepcion, priorDelivery, cliente);
    await db.query(
      "SELECT devolver_pago_paquete($1::bigint,$2::bigint,$3::bigint,$4::text,$5::varchar,$6::varchar)",
      [
        packageId(13),
        admin.id_persona,
        norte.id_sucursal,
        "Devolución monetaria total de demostración; el historial del paquete se conserva.",
        "efectivo",
        "cliente",
      ],
    );
    async function transfer(numbers, origin, destination, employee, received) {
      const t = await one(
        "INSERT INTO traslado(id_sucursal_origen,id_sucursal_destino,id_empleado,observaciones) VALUES($1,$2,$3,$4) RETURNING id_traslado",
        [
          origin.id_sucursal,
          destination.id_sucursal,
          employee.id_persona,
          "Traslado ficticio para probar preparación, despacho y recepción individual.",
        ],
      );
      for (const n of numbers)
        await db.query(
          "INSERT INTO detalle_traslado(id_traslado,id_paquete) VALUES($1,$2)",
          [t.id_traslado, packageId(n)],
        );
      if (received === null) return;
      await db.query("SELECT despachar_traslado($1::bigint)", [t.id_traslado]);
      const receiver =
        destination.id_sucursal === central.id_sucursal
          ? almacen
          : almacenNorte;
      for (const [n, code] of received) {
        const detail = await one(
          "SELECT id_detalle_traslado FROM detalle_traslado WHERE id_traslado=$1 AND id_paquete=$2",
          [t.id_traslado, packageId(n)],
        );
        await db.query(
          "SELECT confirmar_paquete_traslado($1::bigint,$2::bigint,$3::bigint)",
          [
            detail.id_detalle_traslado,
            receiver.id_persona,
            locker(destination, code),
          ],
        );
      }
    }
    await transfer([16], central, norte, almacen, null);
    await transfer([17, 18], central, norte, almacen, [[17, "L-001"]]);
    await transfer([19, 20], norte, central, almacenNorte, [
      [19, "L-003"],
      [20, "L-006"],
    ]);
    await transfer([21], norte, central, almacenNorte, []);
    await transfer([22], norte, central, almacenNorte, null);
    for (const [n, recipient, tipo, read, hidden] of [
      [6, luis, "recordatorio_1_dia", true, false],
      [7, cliente, "recordatorio_1_dia", false, false],
      [9, luis, "recordatorio_2_dias", true, true],
    ]) {
      const pending = await one(
        "SELECT id_pago_pendiente FROM pago_pendiente WHERE id_paquete=$1 AND concepto='almacenamiento'",
        [packageId(n)],
      );
      const notification = await one(
        "INSERT INTO notificacion(id_pago_pendiente,tipo,telefono,contenido,realizado_en,id_empleado) VALUES($1,$2,$3,$4,$5,$6) RETURNING id_notificacion",
        [
          pending.id_pago_pendiente,
          tipo,
          recipient.telefono,
          `AVISO FICTICIO: el paquete ${packages.get(n).codigo} tiene un pago pendiente. Ejemplo para probar el módulo; no se envió un mensaje real.`,
          now,
          admin.id_persona,
        ],
      );
      if (read)
        await db.query(
          "INSERT INTO notificacion_lectura(id_usuario,id_notificacion,leido_en,oculta) VALUES($1,$2,$3,$4)",
          [recipient.id, notification.id_notificacion, now, hidden],
        );
    }
    await db.query("SELECT generar_recargos()");
    for (const branch of [central, norte]) {
      await db.query(
        "UPDATE locker l SET habilitado=false WHERE id_sucursal=$1 AND codigo='L-012' AND NOT EXISTS(SELECT 1 FROM paquete p WHERE p.id_locker=l.id_locker)",
        [branch.id_sucursal],
      );
      await db.query(
        "UPDATE sucursal SET direccion=$1 WHERE id_sucursal=$2 AND (direccion IS NULL OR direccion='Configurar dirección')",
        [
          branch.nombre === "Central"
            ? "Dirección ficticia: avenida Central 100, La Paz"
            : "Dirección ficticia: avenida Norte 200, La Paz",
          branch.id_sucursal,
        ],
      );
    }
  }
  await db.query("SET CONSTRAINTS ALL IMMEDIATE");
  const counts = await validate();
  const users = await query(
    "SELECT u.*,r.nivel,r.nombre_rol,s.nombre AS sucursal FROM usuario u JOIN rol r ON r.id_rol=u.rol LEFT JOIN empleado e ON e.id_empleado=u.id_persona LEFT JOIN sucursal s ON s.id_sucursal=e.id_sucursal ORDER BY r.nivel,u.id",
  );
  const candidates = [
    ...new Set(
      [demoPassword, process.env.DEV_SEED_PASSWORD, "LockersDemo2026!"].filter(
        Boolean,
      ),
    ),
  ];
  const credentials = [];
  for (const user of users) {
    let password;
    for (const candidate of candidates)
      if (await bcrypt.compare(candidate, user.password)) {
        password = candidate;
        break;
      }
    if (!password)
      throw new Error(
        `No se conoce la contraseña de ${user.correo}; se conservó intacta y no se generó un listado incorrecto.`,
      );
    credentials.push({ ...user, password });
  }
  const fecha = now.toLocaleString("es-BO", { timeZone: "America/La_Paz" });
  const line = (u) =>
    `- **${u.nombre} ${u.apellido}**${u.nivel === 4 ? "" : ` — ${u.nombre_rol}, sucursal ${u.sucursal}`}\n  - Correo: \`${u.correo}\`\n  - Contraseña: \`${u.password}\`\n  - CI: \`${u.ci}\`\n`;
  const markdown = `# Cuentas de prueba de SGAP\n\nGenerado: ${fecha} (America/La_Paz).\n\nTodas las personas, paquetes y operaciones agregados por esta demostración son ficticios. Las contraseñas de este documento son para compartir el prototipo local; en PostgreSQL se guardan como hashes bcrypt. Las cuentas iniciales conservaron sus claves.\n\n## Clientes\n\n${credentials
    .filter((u) => u.nivel === 4)
    .map(line)
    .join(
      "\n",
    )}\nMaría y Jorge actúan como comerciantes/remitentes; Ana y Luis como compradores/destinatarios. La cuenta Cliente Demo permite probar seguimiento, pagos y un aviso sin leer. Una cuenta de cliente puede consultar sus paquetes tanto como remitente como destinatario.\n\n## Empleados\n\n${credentials
    .filter((u) => u.nivel !== 4)
    .map(line)
    .join(
      "\n",
    )}\nEl administrador consulta todas las sucursales. Los recepcionistas registran recepciones y entregas de su sucursal; los almaceneros administran ubicaciones y traslados en su sucursal.\n\n## Uso\n\nAbra /login y utilice el correo y la contraseña indicados. Para configurar otro ordenador y restaurar el respaldo completo consulte RESTAURAR.md de esta misma carpeta. Los recordatorios y recargos cambian con la fecha real del equipo: este respaldo conserva las fechas de su generación.\n`;
  await db.query("COMMIT");
  mkdirSync(folder, { recursive: true });
  writeFileSync(new URL("CUENTAS.md", import.meta.url), markdown);
  writeFileSync(
    new URL("contenido.json", import.meta.url),
    JSON.stringify(
      {
        generado: now.toISOString(),
        zona: "America/La_Paz",
        base: new URL(process.env.DATABASE_URL).pathname.slice(1),
        filas: counts,
        cuentas: credentials.length,
        paquetesDeDemostracion: 24,
        avisosPendientes: await query(
          "SELECT codigo,tipo FROM avisos_por_realizar ORDER BY codigo",
        ),
        estadosPaquetes: await query(
          "SELECT estado,count(*) AS cantidad FROM paquete GROUP BY estado ORDER BY estado",
        ),
        estadosTraslados: await query(
          "SELECT estado,count(*) AS cantidad FROM traslado GROUP BY estado ORDER BY estado",
        ),
      },
      null,
      2,
    ) + "\n",
  );
  console.log({
    tablasConDatos: Object.keys(counts).length,
    filas: counts,
    cuentas: credentials.length,
    archivoCuentas: "DB_datos_prueba/CUENTAS.md",
  });
} catch (error) {
  await db.query("ROLLBACK").catch(() => {});
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await db.end();
}
