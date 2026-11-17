import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { config } from "dotenv";
import pg from "pg";

if (!existsSync(".env") && !existsSync(".env.local")) {
  writeFileSync(
    ".env",
    readFileSync(".env.example", "utf8").replace(
      "GENERAR_CON_NPM_RUN_SETUP",
      randomBytes(32).toString("hex"),
    ),
  );
  console.log("Se creó .env con una clave de sesión local.");
}
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
if (process.env.AUTH_SECRET === "GENERAR_CON_NPM_RUN_SETUP") {
  const path =
    existsSync(".env.local") &&
    readFileSync(".env.local", "utf8").includes("GENERAR_CON_NPM_RUN_SETUP")
      ? ".env.local"
      : ".env";
  const secret = randomBytes(32).toString("hex");
  writeFileSync(
    path,
    readFileSync(path, "utf8").replace("GENERAR_CON_NPM_RUN_SETUP", secret),
  );
  process.env.AUTH_SECRET = secret;
}
function prisma(...args) {
  const run = spawnSync(
    process.execPath,
    ["node_modules/prisma/build/index.js", ...args],
    { stdio: "inherit", env: process.env },
  );
  if (run.status !== 0)
    throw new Error(`Prisma ${args[0]} no pudo completarse.`);
}
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
  const { rows } = await client.query(
    "SELECT tablename FROM pg_tables WHERE schemaname='public'",
  );
  const names = new Set(rows.map((r) => r.tablename));
  if (names.size && !names.has("_prisma_migrations")) {
    const expected = [
      ...readFileSync(
        "prisma/migrations/0_operacion/migration.sql",
        "utf8",
      ).matchAll(/CREATE TABLE\s+(\w+)/g),
    ].map((m) => m[1]);
    if (!expected.every((name) => names.has(name)))
      throw new Error(
        "La DB no coincide con el modelo de lockers. Revise DATABASE_URL; no se eliminó ningún dato.",
      );
    prisma("migrate", "resolve", "--applied", "0_operacion");
  }
  prisma("migrate", "deploy");
  prisma("generate");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
