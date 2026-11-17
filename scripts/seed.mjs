import "./env.mjs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcrypt";
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
try {
  const hash = await bcrypt.hash(
    process.env.DEV_SEED_PASSWORD || "LockersDemo2026!",
    10,
  );
  for (const nombre of ["Central", "Norte"]) {
    const branch = await db.sucursal.upsert({
      where: { nombre },
      update: {},
      create: { nombre, direccion: "Configurar dirección" },
    });
    for (let n = 1; n <= 12; n++)
      await db.locker.upsert({
        where: {
          id_sucursal_codigo: {
            id_sucursal: branch.id_sucursal,
            codigo: `L-${String(n).padStart(3, "0")}`,
          },
        },
        update: {},
        create: {
          id_sucursal: branch.id_sucursal,
          codigo: `L-${String(n).padStart(3, "0")}`,
          tamanio: n <= 4 ? 1 : n <= 8 ? 2 : 3,
        },
      });
  }
  const branch = await db.sucursal.findUniqueOrThrow({
    where: { nombre: "Central" },
  });
  for (const [nivel, nombre, correo, ci, cargo] of [
    [1, "Administrador", "admin@lockers.local", "90000001", "administrador"],
    [2, "Recepción", "recepcion@lockers.local", "90000002", "recepcionista"],
    [3, "Almacén", "almacen@lockers.local", "90000003", "encargado_almacenes"],
    [4, "Cliente", "cliente@lockers.local", "90000004", null],
  ]) {
    if (await db.usuario.findUnique({ where: { correo } })) continue;
    await db.$transaction(async (tx) => {
      const person = await tx.persona.create({
        data: { nombre: `${nombre} Demo`, ci, correo, telefono: "70000000" },
      });
      if (cargo) {
        const job = await tx.cargo.findUniqueOrThrow({
          where: { nombre: cargo },
        });
        await tx.empleado.create({
          data: {
            id_empleado: person.id_persona,
            id_cargo: job.id_cargo,
            id_sucursal: branch.id_sucursal,
            usuario: correo,
            password_hash: hash,
          },
        });
      } else
        await tx.cliente.create({ data: { id_cliente: person.id_persona } });
      const rol = await tx.rol.findUniqueOrThrow({ where: { nivel } });
      await tx.usuario.create({
        data: {
          nombre,
          apellido: "Demo",
          ci,
          correo,
          telefono: "70000000",
          password: hash,
          rolId: rol.id_rol,
          id_persona: person.id_persona,
        },
      });
    });
  }
  console.log(
    "Datos iniciales listos. Las cuentas existentes no se modificaron. Consulte DESARROLLO.md.",
  );
} finally {
  await db.$disconnect();
}
