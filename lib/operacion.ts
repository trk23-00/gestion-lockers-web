import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { obtenerUsuarioSesion } from "@/lib/sesion";

type Sesion = NonNullable<Awaited<ReturnType<typeof obtenerUsuarioSesion>>>;
type Body = Record<string, unknown>;
type Tx = Prisma.TransactionClient;
export class ErrorOperacion extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
function exigir(value: unknown, message: string, status = 400): asserts value {
  if (!value) throw new ErrorOperacion(message, status);
}
function texto(value: unknown, max = 150, obligatorio = false) {
  const s = typeof value === "string" ? value.trim() : "";
  exigir(
    s.length <= max && (!obligatorio || s.length),
    "Revise los campos obligatorios y su longitud.",
  );
  return s;
}
function id(value: unknown): bigint {
  exigir(
    typeof value === "string" && /^\d{1,18}$/.test(value) && BigInt(value) > 0n,
    "Identificador inválido.",
  );
  return BigInt(value);
}
function opcional(value: unknown) {
  return value ? id(value) : null;
}
function numero(value: unknown, min: number, max: number) {
  const n = Number(value);
  exigir(
    Number.isFinite(n) && n >= min && n <= max,
    `Ingrese un valor entre ${min} y ${max}.`,
  );
  return n;
}
function elegir(value: unknown, opciones: string[]) {
  exigir(
    typeof value === "string" && opciones.includes(value),
    "Seleccione una opción válida.",
  );
  return value;
}
function permitir(s: Sesion, ...niveles: number[]) {
  exigir(
    niveles.includes(s.rol.nivel),
    "Su perfil no permite esta operación.",
    403,
  );
}
function sucursal(s: Sesion, value: unknown) {
  const branch = id(value);
  exigir(
    s.rol.nivel === 1 || branch === s.persona.empleado?.id_sucursal,
    "La operación pertenece a otra sucursal.",
    403,
  );
  return branch;
}
function filtroPaquete(s: Sesion): Prisma.paqueteWhereInput {
  if (s.rol.nivel === 1) return {};
  if (s.rol.nivel === 4)
    return {
      OR: [
        { id_destinatario: s.id_persona },
        {
          detalle_documento: {
            some: {
              tipo_documento: "recepcion",
              documento: { id_cliente: s.id_persona },
            },
          },
        },
      ],
    };
  return { id_sucursal_actual: s.persona.empleado!.id_sucursal };
}
async function paqueteVisible(tx: Tx, s: Sesion, value: unknown) {
  const p = await tx.paquete.findFirst({
    where: { AND: [{ id_paquete: id(value) }, filtroPaquete(s)] },
  });
  exigir(p, "Paquete no encontrado en su ámbito.", 404);
  return p;
}
async function branchActiva(tx: Tx, branch: bigint) {
  exigir(
    await tx.sucursal.findFirst({
      where: { id_sucursal: branch, activa: true },
    }),
    "La sucursal no está activa.",
  );
}
const personaSelect = {
  id_persona: true,
  nombre: true,
  ci: true,
  telefono: true,
  correo: true,
  activo: true,
  usuario: { select: { id: true } },
} as const;

export async function consultarDatos(s: Sesion) {
  // El trabajo periódico realiza lo mismo sin depender de que alguien abra el panel.
  await prisma.$queryRaw`SELECT generar_recargos()`;
  const admin = s.rol.nivel === 1,
    client = s.rol.nivel === 4,
    branch = s.persona.empleado?.id_sucursal;
  const pkgWhere = filtroPaquete(s);
  const transferWhere: Prisma.trasladoWhereInput = admin
    ? {}
    : client
      ? { detalle_traslado: { some: { paquete: pkgWhere } } }
      : {
          OR: [{ id_sucursal_origen: branch }, { id_sucursal_destino: branch }],
        };
  const [
    paquetes,
    lockers,
    sucursales,
    clientes,
    personal,
    traslados,
    documentos,
    movimientos,
    notificaciones,
    configuracion,
    diarios,
    mensuales,
    avisos,
  ] = await Promise.all([
    prisma.paquete.findMany({
      where: pkgWhere,
      orderBy: { fecha_ingreso: "desc" },
      include: {
        sucursal: true,
        locker: true,
        detalle_documento: {
          include: {
            documento: {
              select: {
                id_documento: true,
                tipo: true,
                fecha: true,
                id_cliente: true,
              },
            },
          },
        },
        pago_pendiente: {
          include: {
            movimiento: { select: { id_movimiento: true, fecha: true } },
          },
        },
        pago_anticipado: true,
        devolucion: true,
      },
    }),
    client
      ? []
      : prisma.locker.findMany({
          where: admin ? {} : { id_sucursal: branch },
          orderBy: { codigo: "asc" },
          include: {
            paquete: { select: { id_paquete: true, codigo: true } },
            sucursal: true,
          },
        }),
    prisma.sucursal.findMany({ orderBy: { nombre: "asc" } }),
    client
      ? []
      : prisma.cliente.findMany({
          where:
            s.rol.nivel === 3
              ? {
                  OR: [
                    { documento: { some: { id_sucursal: branch } } },
                    { paquete: { some: { id_sucursal_actual: branch } } },
                  ],
                }
              : {},
          include: { persona: { select: personaSelect } },
          orderBy: { id_cliente: "desc" },
        }),
    admin
      ? prisma.usuario.findMany({
          where: { rol: { nivel: { not: 4 } } },
          select: {
            id: true,
            id_persona: true,
            nombre: true,
            apellido: true,
            correo: true,
            ci: true,
            telefono: true,
            activo: true,
            rol: true,
            persona: {
              select: { empleado: { select: { id_sucursal: true } } },
            },
          },
        })
      : [],
    prisma.traslado.findMany({
      where: transferWhere,
      orderBy: { creado_en: "desc" },
      include: {
        detalle_traslado: {
          where: client ? { paquete: pkgWhere } : {},
          include: {
            paquete: {
              select: { codigo: true, id_paquete: true, tamanio: true },
            },
          },
        },
      },
    }),
    client
      ? []
      : prisma.documento.findMany({
          where: admin ? {} : { id_sucursal: branch },
          orderBy: { fecha: "desc" },
          include: {
            detalle_documento: {
              include: { paquete: { select: { codigo: true } } },
            },
            cliente: { include: { persona: { select: personaSelect } } },
          },
        }),
    admin || client
      ? prisma.movimiento.findMany({
          where: client ? { paquete: pkgWhere } : {},
          orderBy: { fecha: "desc" },
        })
      : [],
    admin || client
      ? prisma.notificacion.findMany({
          where: {
            pago_pendiente: { paquete: pkgWhere },
            ...(client
              ? {
                  NOT: {
                    notificacion_lectura: {
                      some: { id_usuario: s.id, oculta: true },
                    },
                  },
                }
              : {}),
          },
          orderBy: { realizado_en: "desc" },
          include: {
            pago_pendiente: { select: { id_paquete: true } },
            notificacion_lectura: { where: { id_usuario: s.id } },
          },
        })
      : [],
    prisma.configuracion.findUniqueOrThrow({ where: { id: 1 } }),
    admin ? prisma.resumen_diario.findMany({ orderBy: { fecha: "desc" } }) : [],
    admin
      ? prisma.resumen_mensual.findMany({ orderBy: { periodo: "desc" } })
      : [],
    admin
      ? prisma.$queryRaw`SELECT * FROM avisos_por_realizar ORDER BY vence_en`
      : [],
  ]);
  return {
    usuario: {
      id: s.id,
      nombre: s.nombre,
      apellido: s.apellido,
      correo: s.correo,
      ci: s.ci,
      telefono: s.telefono,
      nivel: s.rol.nivel,
      rol: s.rol.nombre_rol,
      id_persona: s.id_persona,
      id_sucursal: branch,
    },
    paquetes,
    lockers,
    sucursales,
    clientes,
    personal,
    traslados,
    documentos,
    movimientos,
    notificaciones,
    configuracion,
    diarios,
    mensuales,
    avisos,
  };
}

export async function modificar(
  s: Sesion,
  recurso: string,
  method: string,
  b: Body,
) {
  const metodos: Record<string, string[]> = {
    clientes: ["POST", "PATCH"],
    personal: ["POST", "PATCH"],
    sucursales: ["POST", "PATCH", "DELETE"],
    lockers: ["POST", "PATCH", "DELETE"],
    recepciones: ["POST"],
    paquetes: ["PATCH"],
    ubicaciones: ["PATCH"],
    entregas: ["POST"],
    traslados: ["POST", "PATCH", "DELETE"],
    cobros: ["POST"],
    devoluciones: ["POST"],
    tarifas: ["PATCH"],
    notificaciones: ["POST", "PATCH", "DELETE"],
    cuenta: ["PATCH"],
  };
  exigir(metodos[recurso], "Recurso inexistente.", 404);
  exigir(
    metodos[recurso].includes(method),
    "Método no permitido para este recurso.",
    405,
  );
  return prisma.$transaction(
    async (tx) => {
      const nivel = s.rol.nivel;
      if (recurso === "clientes") {
        permitir(s, 1, 2);
        if (method === "POST") {
          const p = await tx.persona.create({
            data: {
              nombre: texto(b.nombre, 150, true),
              ci: texto(b.ci, 30) || null,
              telefono: texto(b.telefono, 30) || null,
              correo: texto(b.correo, 150) || null,
            },
          });
          return tx.cliente.create({
            data: {
              id_cliente: p.id_persona,
              observaciones: texto(b.observaciones, 1000) || null,
            },
          });
        }
        const c = await tx.cliente.findUnique({
          where: { id_cliente: id(b.id) },
          include: { persona: { include: { usuario: true } } },
        });
        exigir(c, "Cliente inexistente.", 404);
        if (b.accion === "crear_cuenta" && method === "PATCH") {
          permitir(s, 1);
          exigir(
            !c.persona.usuario && c.persona.activo,
            "El cliente ya tiene una cuenta o está inactivo.",
          );
          const nombre = texto(b.nombre, 100, true),
            apellido = texto(b.apellido, 100, true);
          exigir(
            `${nombre} ${apellido}`.length <= 150,
            "El nombre completo no debe superar 150 caracteres.",
          );
          const correo = texto(b.correo, 150, true).toLowerCase();
          exigir(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo), "Correo inválido.");
          exigir(
            c.persona.ci && c.persona.ci.length <= 20,
            "Registre un CI de hasta 20 caracteres en la ficha del cliente.",
          );
          const password = texto(b.password, 200, true);
          exigir(
            password.length >= 8,
            "La contraseña requiere al menos 8 caracteres.",
          );
          const rol = await tx.rol.findUniqueOrThrow({ where: { nivel: 4 } });
          await tx.usuario.create({
            data: {
              nombre,
              apellido,
              ci: c.persona.ci,
              correo,
              telefono: c.persona.telefono,
              password: await bcrypt.hash(password, 10),
              rolId: rol.id_rol,
              id_persona: c.id_cliente,
            },
          });
          await tx.persona.update({
            where: { id_persona: c.id_cliente },
            data: { nombre: `${nombre} ${apellido}`, correo },
          });
          return { id: c.id_cliente };
        }
        const data = {
          nombre: texto(b.nombre, 150, true),
          ci: texto(b.ci, 30) || null,
          telefono: texto(b.telefono, 30) || null,
          correo: texto(b.correo, 150) || null,
          ...(nivel === 1 && typeof b.activo === "boolean"
            ? { activo: b.activo }
            : {}),
        };
        // Los clientes con cuenta conservan los identificadores usados para autenticarse.
        exigir(
          !c.persona.usuario ||
            (data.ci === c.persona.ci &&
              data.correo === c.persona.correo &&
              data.nombre === c.persona.nombre),
          "El nombre de una cuenta se cambia desde Mi cuenta; su CI y correo se conservan.",
        );
        await tx.persona.update({ where: { id_persona: c.id_cliente }, data });
        if (c.persona.usuario)
          await tx.usuario.update({
            where: { id: c.persona.usuario.id },
            data: {
              telefono: data.telefono,
              ...(typeof b.activo === "boolean" && nivel === 1
                ? { activo: b.activo }
                : {}),
            },
          });
        return tx.cliente.update({
          where: { id_cliente: c.id_cliente },
          data: { observaciones: texto(b.observaciones, 1000) || null },
        });
      }
      if (recurso === "personal") {
        permitir(s, 1);
        const level = numero(b.nivel, 1, 3);
        exigir(Number.isInteger(level), "Cargo inválido.");
        const branch = id(b.id_sucursal);
        await branchActiva(tx, branch);
        const role = await tx.rol.findUniqueOrThrow({
          where: { nivel: level },
        });
        const job = await tx.cargo.findUniqueOrThrow({
          where: {
            nombre:
              level === 1
                ? "administrador"
                : level === 2
                  ? "recepcionista"
                  : "encargado_almacenes",
          },
        });
        const nombre = texto(b.nombre, 100, true),
          apellido = texto(b.apellido, 100, true),
          correo = texto(b.correo, 150, true).toLowerCase(),
          ci = texto(b.ci, 20, true),
          telefono = texto(b.telefono, 20) || null;
        exigir(
          `${nombre} ${apellido}`.length <= 150,
          "El nombre completo no debe superar 150 caracteres.",
        );
        exigir(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo), "Correo inválido.");
        if (method === "POST") {
          const password = texto(b.password, 200, true);
          exigir(
            password.length >= 8,
            "La contraseña requiere al menos 8 caracteres.",
          );
          const hash = await bcrypt.hash(password, 10);
          const p = await tx.persona.create({
            data: { nombre: `${nombre} ${apellido}`, ci, correo, telefono },
          });
          await tx.empleado.create({
            data: {
              id_empleado: p.id_persona,
              id_sucursal: branch,
              id_cargo: job.id_cargo,
              usuario: correo,
              password_hash: hash,
            },
          });
          await tx.usuario.create({
            data: {
              nombre,
              apellido,
              ci,
              correo,
              telefono,
              password: hash,
              rolId: role.id_rol,
              id_persona: p.id_persona,
            },
          });
          return { id: p.id_persona };
        }
        const account = await tx.usuario.findUnique({
          where: { id: Number(b.id) },
          include: { rol: true },
        });
        exigir(
          account && account.rol.nivel !== 4,
          "Empleado inexistente.",
          404,
        );
        exigir(
          account.id !== s.id || (b.activo !== false && level === 1),
          "No puede quitarse su propio acceso de administrador.",
        );
        const activo = b.activo !== false;
        const password = texto(b.password, 200);
        exigir(
          !password || password.length >= 8,
          "La contraseña requiere al menos 8 caracteres.",
        );
        const hash = password ? await bcrypt.hash(password, 10) : undefined;
        await tx.persona.update({
          where: { id_persona: account.id_persona },
          data: {
            nombre: `${nombre} ${apellido}`,
            ci,
            correo,
            telefono,
            activo,
          },
        });
        await tx.empleado.update({
          where: { id_empleado: account.id_persona },
          data: {
            id_sucursal: branch,
            id_cargo: job.id_cargo,
            usuario: correo,
            activo,
            ...(hash ? { password_hash: hash } : {}),
          },
        });
        await tx.usuario.update({
          where: { id: account.id },
          data: {
            nombre,
            apellido,
            ci,
            correo,
            telefono,
            rolId: role.id_rol,
            activo,
            ...(hash ? { password: hash } : {}),
          },
        });
        return { id: account.id };
      }
      if (recurso === "sucursales") {
        permitir(s, 1);
        if (method === "DELETE")
          return tx.sucursal.delete({ where: { id_sucursal: id(b.id) } });
        const data = {
          nombre: texto(b.nombre, 100, true),
          direccion: texto(b.direccion, 500) || null,
          activa: b.activa !== false,
        };
        return method === "POST"
          ? tx.sucursal.create({ data })
          : tx.sucursal.update({ where: { id_sucursal: id(b.id) }, data });
      }
      if (recurso === "lockers") {
        permitir(s, 1, 3);
        const branch = sucursal(s, b.id_sucursal);
        await branchActiva(tx, branch);
        const size = numero(b.tamanio, 1, 3);
        exigir(Number.isInteger(size), "Tamaño inválido.");
        if (method === "POST")
          return tx.locker.create({
            data: {
              id_sucursal: branch,
              codigo: texto(b.codigo, 30, true),
              tamanio: size,
              habilitado: b.habilitado !== false,
            },
          });
        const l = await tx.locker.findUnique({
          where: { id_locker: id(b.id) },
          include: { paquete: true },
        });
        exigir(l, "Locker inexistente.", 404);
        sucursal(s, String(l.id_sucursal));
        exigir(
          !l.paquete,
          "Libere o reubique el paquete antes de modificar este locker.",
        );
        if (method === "DELETE")
          return tx.locker.delete({ where: { id_locker: l.id_locker } });
        return tx.locker.update({
          where: { id_locker: l.id_locker },
          data: {
            id_sucursal: branch,
            codigo: texto(b.codigo, 30, true),
            tamanio: size,
            habilitado: b.habilitado !== false,
          },
        });
      }
      if (recurso === "recepciones") {
        permitir(s, 1, 2);
        exigir(method === "POST", "Método inválido.", 405);
        const branch = sucursal(s, b.id_sucursal);
        await branchActiva(tx, branch);
        const c = await tx.cliente.findUnique({
          where: { id_cliente: id(b.id_cliente) },
          include: { persona: true },
        });
        exigir(c?.persona.activo, "Seleccione un cliente activo.");
        exigir(
          Array.isArray(b.paquetes) &&
            b.paquetes.length > 0 &&
            b.paquetes.length <= 50,
          "Registre entre 1 y 50 paquetes.",
        );
        const config = await tx.configuracion.findUniqueOrThrow({
          where: { id: 1 },
        });
        const fecha = new Date();
        const doc = await tx.documento.create({
          data: {
            tipo: "recepcion",
            fecha,
            id_sucursal: branch,
            id_empleado: s.id_persona,
            id_cliente: c.id_cliente,
            observaciones: texto(b.observaciones, 2000) || null,
          },
        });
        for (const raw of b.paquetes) {
          const row = raw as Body;
          const recipientId = opcional(row.id_destinatario);
          const recipient = recipientId
            ? await tx.cliente.findUnique({
                where: { id_cliente: recipientId },
                include: { persona: true },
              })
            : null;
          exigir(
            !recipientId || recipient?.persona.activo,
            "Destinatario inválido.",
          );
          const size = numero(row.tamanio, 1, 3);
          exigir(Number.isInteger(size), "Tamaño inválido.");
          const lockerId = opcional(row.id_locker);
          if (lockerId)
            exigir(
              await tx.locker.findFirst({
                where: {
                  id_locker: lockerId,
                  id_sucursal: branch,
                  habilitado: true,
                },
              }),
              "Locker no disponible en esta sucursal.",
            );
          const p = await tx.paquete.create({
            data: {
              codigo:
                texto(row.codigo, 60) ||
                `PK-${randomUUID().slice(0, 12).toUpperCase()}`,
              descripcion: texto(row.descripcion, 2000, true),
              tamanio: size,
              peso_kg: row.peso_kg ? numero(row.peso_kg, 0.001, 9999999) : null,
              fecha_ingreso: fecha,
              fecha_limite: new Date(
                fecha.getTime() + config.dias_iniciales * 86400000,
              ),
              id_sucursal_actual: branch,
              id_locker: lockerId,
              modalidad_pago: elegir(row.modalidad_pago, [
                "anticipado",
                "pendiente",
              ]),
              importe_inicial: config.importe_inicial,
              recargo_semanal: config.recargo_semanal,
              id_destinatario: recipientId,
            },
          });
          await tx.detalle_documento.create({
            data: {
              id_documento: doc.id_documento,
              tipo_documento: "recepcion",
              id_paquete: p.id_paquete,
              nombre_destinatario:
                recipient?.persona.nombre ||
                texto(row.nombre_destinatario, 150) ||
                null,
              ci_destinatario:
                recipient?.persona.ci || texto(row.ci_destinatario, 30) || null,
              telefono_destinatario:
                recipient?.persona.telefono ||
                texto(row.telefono_destinatario, 30) ||
                null,
            },
          });
        }
        return { id: doc.id_documento };
      }
      if (recurso === "paquetes" || recurso === "ubicaciones") {
        permitir(s, ...(recurso === "ubicaciones" ? [1, 3] : [1, 2]));
        const visible = await paqueteVisible(tx, s, b.id);
        await tx.$queryRaw`SELECT id_paquete FROM paquete WHERE id_paquete=${visible.id_paquete} FOR UPDATE`;
        const p = await paqueteVisible(tx, s, b.id);
        exigir(
          ["recibido", "almacenado"].includes(p.estado),
          "El paquete ya fue entregado o está en traslado.",
        );
        if (recurso === "ubicaciones") {
          const l = opcional(b.id_locker);
          exigir(p.id_sucursal_actual, "El paquete no está en una sucursal.");
          if (l)
            exigir(
              await tx.locker.findFirst({
                where: {
                  id_locker: l,
                  id_sucursal: p.id_sucursal_actual,
                  habilitado: true,
                },
              }),
              "Locker no disponible en la sucursal actual.",
            );
          return tx.paquete.update({
            where: { id_paquete: p.id_paquete },
            data: { id_locker: l },
          });
        }
        return tx.paquete.update({
          where: { id_paquete: p.id_paquete },
          data: {
            descripcion: texto(b.descripcion, 2000, true),
            peso_kg: b.peso_kg ? numero(b.peso_kg, 0.001, 9999999) : null,
          },
        });
      }
      if (recurso === "entregas") {
        permitir(s, 1, 2);
        exigir(method === "POST", "Método inválido.", 405);
        const branch = sucursal(s, b.id_sucursal);
        const fecha = new Date();
        exigir(
          Array.isArray(b.paquetes) &&
            b.paquetes.length > 0 &&
            b.paquetes.length <= 50,
          "Seleccione los paquetes a entregar.",
        );
        const doc = await tx.documento.create({
          data: {
            tipo: "entrega",
            fecha,
            id_empleado: s.id_persona,
            id_sucursal: branch,
            observaciones: texto(b.observaciones, 2000) || null,
          },
        });
        for (const value of b.paquetes) {
          const p = await paqueteVisible(tx, s, value);
          exigir(
            p.id_sucursal_actual === branch,
            "Los paquetes deben estar en la sucursal de entrega.",
          );
          await tx.detalle_documento.create({
            data: {
              id_documento: doc.id_documento,
              tipo_documento: "entrega",
              id_paquete: p.id_paquete,
              ci_destinatario: texto(b.ci_destinatario, 30) || null,
              nombre_destinatario: texto(b.nombre_destinatario, 150) || null,
              telefono_destinatario: texto(b.telefono_destinatario, 30) || null,
            },
          });
        }
        return { id: doc.id_documento };
      }
      if (recurso === "traslados") {
        permitir(s, 1, 3);
        if (method === "POST") {
          const origin = sucursal(s, b.id_sucursal_origen),
            dest = id(b.id_sucursal_destino);
          await branchActiva(tx, origin);
          await branchActiva(tx, dest);
          exigir(origin !== dest, "Seleccione otra sucursal de destino.");
          exigir(
            Array.isArray(b.paquetes) &&
              b.paquetes.length > 0 &&
              b.paquetes.length <= 50,
            "Seleccione los paquetes del traslado.",
          );
          const t = await tx.traslado.create({
            data: {
              id_sucursal_origen: origin,
              id_sucursal_destino: dest,
              id_empleado: s.id_persona,
              observaciones: texto(b.observaciones, 2000) || null,
            },
          });
          for (const value of b.paquetes) {
            const p = await paqueteVisible(tx, s, value);
            exigir(
              p.id_sucursal_actual === origin,
              "El paquete no está en origen.",
            );
            await tx.detalle_traslado.create({
              data: { id_traslado: t.id_traslado, id_paquete: p.id_paquete },
            });
          }
          return { id: t.id_traslado };
        }
        const t = await tx.traslado.findUnique({
          where: { id_traslado: id(b.id) },
        });
        exigir(t, "Traslado inexistente.", 404);
        await tx.$queryRaw`SELECT id_traslado FROM traslado WHERE id_traslado=${t.id_traslado} FOR UPDATE`;
        if (b.accion === "recibir") {
          sucursal(s, String(t.id_sucursal_destino));
          const detail = await tx.detalle_traslado.findFirst({
            where: {
              id_detalle_traslado: id(b.id_detalle),
              id_traslado: t.id_traslado,
            },
          });
          exigir(detail, "Detalle inexistente.");
          const l = opcional(b.id_locker);
          if (l)
            exigir(
              await tx.locker.findFirst({
                where: {
                  id_locker: l,
                  id_sucursal: t.id_sucursal_destino,
                  habilitado: true,
                },
              }),
              "Locker de destino inválido.",
            );
          await tx.$queryRaw`SELECT confirmar_paquete_traslado(${detail.id_detalle_traslado},${s.id_persona},${l}::bigint)::text`;
          return { id: t.id_traslado };
        }
        sucursal(s, String(t.id_sucursal_origen));
        exigir(
          t.estado === "preparado",
          "Solo puede modificar un traslado preparado.",
        );
        if (method === "DELETE") {
          await tx.detalle_traslado.deleteMany({
            where: { id_traslado: t.id_traslado },
          });
          return tx.traslado.delete({ where: { id_traslado: t.id_traslado } });
        }
        if (b.accion === "despachar") {
          await tx.$queryRaw`SELECT despachar_traslado(${t.id_traslado})::text`;
          return { id: t.id_traslado };
        }
        const dest = id(b.id_sucursal_destino);
        await branchActiva(tx, dest);
        exigir(dest !== t.id_sucursal_origen, "Destino inválido.");
        return tx.traslado.update({
          where: { id_traslado: t.id_traslado },
          data: {
            id_sucursal_destino: dest,
            observaciones: texto(b.observaciones, 2000) || null,
          },
        });
      }
      if (recurso === "cobros" || recurso === "devoluciones") {
        permitir(s, 1);
        exigir(
          method === "POST",
          "Los movimientos conservan su historial.",
          405,
        );
        const p = await paqueteVisible(tx, s, b.id_paquete);
        const branch = sucursal(s, b.id_sucursal);
        await branchActiva(tx, branch);
        const payer = elegir(b.pagador, ["cliente", "destinatario"]),
          medio = elegir(b.medio, ["efectivo", "qr", "transferencia"]);
        if (recurso === "cobros")
          return tx.$queryRaw`SELECT cobrar_paquete(${p.id_paquete},${s.id_persona},${branch},${payer}::varchar,${medio}::varchar) AS total`;
        return tx.$queryRaw`SELECT devolver_pago_paquete(${p.id_paquete},${s.id_persona},${branch},${texto(b.motivo, 2000, true)},${medio}::varchar,${payer}::varchar) AS id`;
      }
      if (recurso === "tarifas") {
        permitir(s, 1);
        exigir(method === "PATCH", "Método inválido.", 405);
        const dias = numero(b.dias_iniciales, 1, 365);
        exigir(Number.isInteger(dias), "Los días deben ser enteros.");
        return tx.configuracion.update({
          where: { id: 1 },
          data: {
            importe_inicial: numero(b.importe_inicial, 0.01, 9999999),
            recargo_semanal: numero(b.recargo_semanal, 0.01, 9999999),
            dias_iniciales: dias,
            actualizado_en: new Date(),
          },
        });
      }
      if (recurso === "notificaciones") {
        if (method === "POST") {
          permitir(s, 1);
          // Prisma calcula algunos defaults de fecha en el cliente; el registro
          // del aviso debe usar el reloj de la transacción de PostgreSQL.
          const [reloj] = await tx.$queryRaw<
            { fecha: Date }[]
          >`SELECT CURRENT_TIMESTAMP AS fecha`;
          return tx.notificacion.create({
            data: {
              realizado_en: reloj.fecha,
              id_pago_pendiente: id(b.id_pago_pendiente),
              tipo: elegir(b.tipo, [
                "recordatorio_1_dia",
                "recordatorio_2_dias",
              ]),
              telefono: texto(b.telefono, 30, true),
              contenido: texto(b.contenido, 4000, true),
              id_empleado: s.id_persona,
            },
          });
        }
        permitir(s, 4);
        const n = await tx.notificacion.findFirst({
          where: {
            id_notificacion: id(b.id),
            pago_pendiente: { paquete: filtroPaquete(s) },
          },
        });
        exigir(n, "Aviso inexistente.", 404);
        return tx.notificacion_lectura.upsert({
          where: {
            id_usuario_id_notificacion: {
              id_usuario: s.id,
              id_notificacion: n.id_notificacion,
            },
          },
          create: {
            id_usuario: s.id,
            id_notificacion: n.id_notificacion,
            oculta: method === "DELETE",
          },
          update: { leido_en: new Date(), oculta: method === "DELETE" },
        });
      }
      if (recurso === "cuenta") {
        exigir(method === "PATCH", "Método inválido.", 405);
        const nombre = texto(b.nombre, 100, true),
          apellido = texto(b.apellido, 100, true),
          telefono = texto(b.telefono, 20) || null;
        const data = { nombre, apellido, telefono };
        const password = texto(b.password, 200);
        if (password) {
          const account = await tx.usuario.findUniqueOrThrow({
            where: { id: s.id },
          });
          exigir(
            await bcrypt.compare(
              texto(b.password_actual, 200, true),
              account.password,
            ),
            "La contraseña actual es incorrecta.",
          );
          exigir(
            password.length >= 8,
            "La nueva contraseña requiere al menos 8 caracteres.",
          );
          const hash = await bcrypt.hash(password, 10);
          await tx.usuario.update({
            where: { id: s.id },
            data: { password: hash },
          });
          if (nivel !== 4)
            await tx.empleado.update({
              where: { id_empleado: s.id_persona },
              data: { password_hash: hash },
            });
        }
        await tx.persona.update({
          where: { id_persona: s.id_persona },
          data: { nombre: `${nombre} ${apellido}`, telefono },
        });
        await tx.usuario.update({ where: { id: s.id }, data });
        return { id: s.id };
      }
      throw new ErrorOperacion("Recurso inexistente.", 404);
    },
    { maxWait: 10000, timeout: 20000 },
  );
}

export function serializar(value: unknown) {
  return JSON.parse(
    JSON.stringify(value, (_, v) => (typeof v === "bigint" ? String(v) : v)),
  );
}
