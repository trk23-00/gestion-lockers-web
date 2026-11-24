import "./env.mjs";
import { randomBytes } from "node:crypto";
import { spawn, spawnSync, fork } from "node:child_process";
import pg from "pg";
const source = new URL(process.env.DATABASE_URL);
const name = `lockers_test_${Date.now()}`;
if (!/^lockers_test_\d+$/.test(name))
  throw new Error("Nombre de DB de prueba inválido");
const admin = new pg.Client({ connectionString: source.toString() });
const url = new URL(source);
url.pathname = `/${name}`;
const env = {
  ...process.env,
  DATABASE_URL: url.toString(),
  AUTH_SECRET: randomBytes(32).toString("hex"),
  DEV_SEED_PASSWORD: "LockersDemo2026!",
  CAPTCHA_MODE: "local",
  NEXT_PUBLIC_CAPTCHA_MODE: "local",
  SGAP_TEST_RUN: "1",
  TEST_BASE_URL: "http://127.0.0.1:3117",
};
let server,
  created = false;
function run(file, args) {
  const result = spawnSync(process.execPath, [file, ...args], {
    env,
    stdio: "inherit",
  });
  if (result.status !== 0) throw new Error(`Falló ${file}`);
}
async function runAsync(file, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [file, ...args], {
      env,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`Falló ${file}`)),
    );
  });
}
try {
  await admin.connect();
  await admin.query(`CREATE DATABASE "${name}"`);
  created = true;
  run("node_modules/prisma/build/index.js", ["migrate", "deploy"]);
  run("scripts/seed.mjs", []);
  server = fork("scripts/test-server.mjs", [], {
    env,
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  let logs = "";
  server.stdout.on("data", (x) => {
    logs = (logs + x).slice(-10000);
  });
  server.stderr.on("data", (x) => {
    logs = (logs + x).slice(-10000);
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`No arrancó el servidor: ${logs}`)),
      60000,
    );
    server.on("message", (m) => {
      if (m === "ready") {
        clearTimeout(timer);
        resolve();
      }
    });
    server.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`El servidor terminó (${code}): ${logs}`));
    });
  });
  let ready = false;
  for (let n = 0; n < 90; n++) {
    try {
      const res = await fetch(`${env.TEST_BASE_URL}/api/sgap/datos`);
      if (res.status === 401) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
    if (server.exitCode !== null) break;
  }
  if (!ready) throw new Error(`No arrancó el servidor de pruebas. ${logs}`);
  try {
    await runAsync("node_modules/@playwright/test/cli.js", [
      "test",
      ...process.argv.slice(2),
    ]);
  } catch (e) {
    console.error(logs);
    throw e;
  }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  if (server?.pid) {
    if (server.connected) server.send("shutdown");
    await new Promise((resolve) => {
      if (server.exitCode !== null) return resolve();
      const timer = setTimeout(() => {
        server.kill();
        resolve();
      }, 10000);
      server.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
  if (created) {
    await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
  }
  await admin.end();
}
