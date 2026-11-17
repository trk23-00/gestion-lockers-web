import "./env.mjs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
let running = false;
async function tick() {
  if (running) return;
  running = true;
  try {
    const result = await db.$queryRaw`SELECT generar_recargos() AS generados`;
    console.log(
      new Date().toISOString(),
      "Recargos generados:",
      result[0].generados,
    );
  } catch (error) {
    console.error("No se pudieron revisar los recargos:", error.message);
  } finally {
    running = false;
  }
}
await tick();
const timer = setInterval(tick, 60_000);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    clearInterval(timer);
    await db.$disconnect();
    process.exit(0);
  });
