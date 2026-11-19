import "../scripts/env.mjs";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import pg from "pg";
import bcrypt from "bcrypt";

const name = process.argv[2];
if (!/^lockers_bkp_verificacion_\d+$/.test(name || ""))
  throw new Error(
    "Indique el nombre de la base temporal lockers_bkp_verificacion_... que restauró previamente.",
  );
const connection = new URL(process.env.DATABASE_URL);
connection.pathname = `/${name}`;
const source = new pg.Client({ connectionString: process.env.DATABASE_URL });
const restored = new pg.Client({ connectionString: connection.toString() });
const expected = JSON.parse(
  readFileSync(new URL("contenido.json", import.meta.url), "utf8"),
);
function normalizarRestriccion(definicion) {
  // PostgreSQL reescribe al restaurar los casts de arrays VARCHAR a TEXT.
  // Normaliza solo esa equivalencia; conserva agrupaciones y operadores.
  return definicion
    .replace(/\(('(?:[^']|'')*')::character varying\)::text/g, "$1::text")
    .replace(/('(?:[^']|'')*')::character varying/g, "$1::text")
    .replace(/\(\(ARRAY\[([^\]]+)\]\)::text\[\]\)/g, "(ARRAY[$1])");
}
async function snapshot(db) {
  const rows = (
    await db.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
    )
  ).rows;
  const counts = {};
  const hashes = {};
  for (const { tablename } of rows) {
    if (!/^[a-z_]+$/.test(tablename))
      throw new Error("Nombre de tabla inesperado.");
    counts[tablename] = Number(
      (await db.query(`SELECT count(*) AS n FROM public.${tablename}`)).rows[0]
        .n,
    );
    // Orden independiente de la disposición física de las filas.
    hashes[tablename] = (
      await db.query(
        `SELECT md5(COALESCE(string_agg(md5(row_to_json(t)::text),'' ORDER BY md5(row_to_json(t)::text)),'')) AS hash FROM public.${tablename} t`,
      )
    ).rows[0].hash;
  }
  return {
    counts,
    hashes,
    routines: (
      await db.query(
        "SELECT p.proname,pg_get_function_identity_arguments(p.oid) AS argumentos,p.prokind,md5(pg_get_functiondef(p.oid)) AS hash FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' ORDER BY p.proname,argumentos",
      )
    ).rows,
    views: (
      await db.query(
        "SELECT viewname,definition FROM pg_views WHERE schemaname='public' ORDER BY viewname",
      )
    ).rows,
    triggers: (
      await db.query(
        "SELECT c.relname,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid) AS definicion FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY c.relname,t.tgname",
      )
    ).rows,
    constraints: (
      await db.query(
        "SELECT c.relname,k.conname,pg_get_constraintdef(k.oid) AS definicion FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY c.relname,k.conname",
      )
    ).rows.map((row) => ({
      ...row,
      definicion: normalizarRestriccion(row.definicion),
    })),
    sequences: (
      await db.query(
        "SELECT sequencename,last_value FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename",
      )
    ).rows,
  };
}
try {
  await source.connect();
  await restored.connect();
  await source.query("SET TIME ZONE 'America/La_Paz'");
  await restored.query("SET TIME ZONE 'America/La_Paz'");
  const original = await snapshot(source),
    copy = await snapshot(restored);
  for (const key of Object.keys(original)) {
    if (JSON.stringify(original[key]) !== JSON.stringify(copy[key]))
      throw new Error(`La restauración difiere del original: ${key}`);
  }
  if (JSON.stringify(copy.counts) !== JSON.stringify(expected.filas))
    throw new Error("Los conteos no coinciden con contenido.json.");
  const accounts = (
    await restored.query("SELECT correo,password FROM usuario ORDER BY id")
  ).rows;
  const candidates = [
    ...new Set(
      [
        "PruebaLockers2026!",
        process.env.DEV_SEED_PASSWORD,
        "LockersDemo2026!",
      ].filter(Boolean),
    ),
  ];
  for (const user of accounts) {
    let valid = false;
    for (const password of candidates)
      if (await bcrypt.compare(password, user.password)) valid = true;
    if (!valid)
      throw new Error(`No se pudo verificar la contraseña de ${user.correo}`);
  }
  await restored.query("BEGIN");
  const recargos = (
    await restored.query("SELECT generar_recargos() AS generados")
  ).rows[0].generados;
  await restored.query("ROLLBACK");
  const hash = createHash("sha256")
    .update(
      readFileSync(new URL("sgap_completo_2026-11-19.bkp", import.meta.url)),
    )
    .digest("hex");
  const report = {
    verificado: new Date().toISOString(),
    restauracionCompleta: true,
    tablas: Object.keys(copy.counts).length,
    datosIdenticosPorHash: true,
    funciones: copy.routines.filter((r) => r.prokind === "f").length,
    procedimientos: copy.routines.filter((r) => r.prokind === "p").length,
    vistas: copy.views.length,
    triggers: copy.triggers.length,
    restricciones: copy.constraints.length,
    secuencias: copy.sequences.length,
    cuentasConClaveVerificada: accounts.length,
    ejecutarGenerarRecargos: true,
    nuevosRecargos: recargos,
    sha256: hash,
    filas: copy.counts,
  };
  writeFileSync(
    new URL("VERIFICACION.json", import.meta.url),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(report);
} finally {
  await restored.end();
  await source.end();
}
