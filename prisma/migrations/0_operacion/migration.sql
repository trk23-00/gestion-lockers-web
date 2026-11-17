-- PROTOTIPO DE LA BASE DE DATOS DE LOCKERS
-- Ejecutar completo en una base de datos PostgreSQL vacia.
-- No crea bases de datos, esquemas, usuarios ni permisos; no elimina datos.
-- Los cargos son datos de la aplicacion, NO roles de PostgreSQL.
-- Importe inicial: Bs 2 por 7 dias. Recargo: Bs 2 por cada semana extra iniciada.
-- Los importes se conservan por paquete para no alterar cobros historicos.
-- Un pendiente base y los recargos pertenecen al paquete, no al documento.
-- Los datos del destinatario pertenecen al detalle de recepcion.
--
-- IMPORTANTE: el paso del tiempo no dispara triggers en PostgreSQL.
-- La aplicacion debe ejecutar SELECT generar_recargos(); periodicamente
-- (por ejemplo, cada minuto) y consultar avisos_por_realizar.
-- cobrar_paquete() y la entrega tambien revisan los recargos vencidos.
-- Registrar en notificacion SOLO despues de haber realizado el aviso.
-- Consultas de disponibilidad y balances no requieren procesos externos.
-- Los documentos y movimientos son historicos: no editar ni eliminar sus datos
-- una vez registrados. Corregir la operacion mediante los flujos de la aplicacion.

BEGIN;
SET TIME ZONE 'America/La_Paz';

-- 1. Personas, personal y ubicacion fisica.
CREATE TABLE persona (
    id_persona BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL CHECK (btrim(nombre) <> ''),
    ci VARCHAR(30) UNIQUE,
    telefono VARCHAR(30),
    correo VARCHAR(150)
);

CREATE TABLE cliente (
    id_cliente BIGINT PRIMARY KEY REFERENCES persona(id_persona),
    observaciones TEXT
);

CREATE TABLE cargo (
    id_cargo SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre VARCHAR(30) NOT NULL UNIQUE
        CHECK (nombre IN ('recepcionista', 'encargado_almacenes', 'administrador'))
);

INSERT INTO cargo (nombre) VALUES
    ('recepcionista'), ('encargado_almacenes'), ('administrador');
-- recepcionista: recepcion y entrega; no despacha ni confirma traslados.
-- encargado_almacenes: casilleros, ubicaciones, despacho y recepcion de traslados.
-- administrador: acceso completo. La aplicacion controla estas autorizaciones.

CREATE TABLE sucursal (
    id_sucursal BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    direccion TEXT,
    activa BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE empleado (
    id_empleado BIGINT PRIMARY KEY REFERENCES persona(id_persona),
    id_cargo SMALLINT NOT NULL REFERENCES cargo(id_cargo),
    id_sucursal BIGINT NOT NULL REFERENCES sucursal(id_sucursal),
    usuario VARCHAR(80) NOT NULL UNIQUE,
    password_hash TEXT, -- Hash generado por la aplicacion; nunca contrasenas en claro.
    activo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE locker (
    id_locker BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_sucursal BIGINT NOT NULL REFERENCES sucursal(id_sucursal),
    codigo VARCHAR(30) NOT NULL CHECK (btrim(codigo) <> ''),
    tamanio SMALLINT NOT NULL CHECK (tamanio IN (1, 2, 3)), -- pequeno, mediano, grande.
    habilitado BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (id_sucursal, codigo)
);

-- 2. Recepcion y entrega: un documento agrupa varios paquetes.
CREATE TABLE documento (
    id_documento BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tipo VARCHAR(15) NOT NULL CHECK (tipo IN ('recepcion', 'entrega')),
    fecha TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    id_sucursal BIGINT NOT NULL REFERENCES sucursal(id_sucursal),
    id_empleado BIGINT NOT NULL REFERENCES empleado(id_empleado),
    id_cliente BIGINT REFERENCES cliente(id_cliente),
    observaciones TEXT,
    CHECK (tipo <> 'recepcion' OR id_cliente IS NOT NULL),
    UNIQUE (id_documento, tipo)
);

CREATE TABLE paquete (
    id_paquete BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo VARCHAR(60) NOT NULL UNIQUE, -- El QR representa este codigo; no es una imagen.
    descripcion TEXT NOT NULL,
    tamanio SMALLINT NOT NULL CHECK (tamanio IN (1, 2, 3)),
    peso_kg NUMERIC(10,3) CHECK (peso_kg > 0),
    fecha_ingreso TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_limite TIMESTAMPTZ NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '7 days'),
    fecha_entrega TIMESTAMPTZ,
    estado VARCHAR(20) NOT NULL DEFAULT 'recibido'
        CHECK (estado IN ('recibido', 'almacenado', 'en_traslado', 'entregado')),
    id_sucursal_actual BIGINT REFERENCES sucursal(id_sucursal),
    id_locker BIGINT UNIQUE REFERENCES locker(id_locker),
    modalidad_pago VARCHAR(15) NOT NULL CHECK (modalidad_pago IN ('anticipado', 'pendiente')),
    importe_inicial NUMERIC(12,2) NOT NULL DEFAULT 2.00 CHECK (importe_inicial > 0),
    recargo_semanal NUMERIC(12,2) NOT NULL DEFAULT 2.00 CHECK (recargo_semanal > 0),
    CHECK (fecha_limite > fecha_ingreso),
    CHECK ((estado = 'en_traslado') = (id_sucursal_actual IS NULL)),
    CHECK ((estado = 'almacenado') = (id_locker IS NOT NULL)),
    CHECK ((estado = 'entregado') = (fecha_entrega IS NOT NULL)),
    CHECK (fecha_entrega IS NULL OR fecha_entrega >= fecha_ingreso)
);

CREATE TABLE detalle_documento (
    id_detalle BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_documento BIGINT NOT NULL,
    tipo_documento VARCHAR(15) NOT NULL,
    id_paquete BIGINT NOT NULL REFERENCES paquete(id_paquete),
    nombre_destinatario VARCHAR(150),
    ci_destinatario VARCHAR(30),
    telefono_destinatario VARCHAR(30)
        CHECK (telefono_destinatario IS NULL OR btrim(telefono_destinatario) <> ''),
    observaciones TEXT,
    FOREIGN KEY (id_documento, tipo_documento) REFERENCES documento(id_documento, tipo),
    UNIQUE (id_documento, id_paquete),
    UNIQUE (id_paquete, tipo_documento)
    -- tipo_documento permite exigir una sola recepcion y una sola entrega por paquete.
    -- El trigger lo copia del documento; no es necesario enviarlo al insertar.
);

-- 3. Pagos: un paquete puede tener su pendiente inicial y varios recargos.
CREATE TABLE pago_pendiente (
    id_pago_pendiente BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_paquete BIGINT NOT NULL REFERENCES paquete(id_paquete),
    concepto VARCHAR(15) NOT NULL CHECK (concepto IN ('almacenamiento', 'recargo')),
    numero_periodo INTEGER NOT NULL DEFAULT 0,
    monto NUMERIC(12,2) NOT NULL CHECK (monto > 0),
    generado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    vence_en TIMESTAMPTZ NOT NULL,
    UNIQUE (id_paquete, concepto, numero_periodo),
    CHECK ((concepto = 'almacenamiento' AND numero_periodo = 0)
        OR (concepto = 'recargo' AND numero_periodo >= 1))
    -- Un pendiente esta pagado cuando existe su movimiento de entrada.
    -- El estado se consulta en saldo_paquete; no se duplica en otra columna.
);

CREATE TABLE pago_anticipado (
    id_pago_anticipado BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_paquete BIGINT NOT NULL UNIQUE REFERENCES paquete(id_paquete),
    monto NUMERIC(12,2) NOT NULL CHECK (monto > 0),
    fecha TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE devolucion (
    id_devolucion BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_paquete BIGINT NOT NULL UNIQUE REFERENCES paquete(id_paquete),
    monto NUMERIC(12,2) NOT NULL CHECK (monto > 0),
    motivo TEXT NOT NULL CHECK (btrim(motivo) <> ''),
    fecha TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    -- Devolucion monetaria total, no devolucion fisica del paquete.
);

CREATE TABLE movimiento (
    id_movimiento BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_paquete BIGINT NOT NULL REFERENCES paquete(id_paquete),
    tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('entrada', 'salida')),
    monto NUMERIC(12,2) NOT NULL CHECK (monto > 0),
    fecha TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    id_sucursal BIGINT NOT NULL REFERENCES sucursal(id_sucursal),
    id_empleado BIGINT NOT NULL REFERENCES empleado(id_empleado),
    pagador VARCHAR(15) NOT NULL DEFAULT 'destinatario'
        CHECK (pagador IN ('cliente', 'destinatario')),
    medio VARCHAR(20) NOT NULL DEFAULT 'efectivo'
        CHECK (medio IN ('efectivo', 'qr', 'transferencia')),
    id_pago_pendiente BIGINT UNIQUE REFERENCES pago_pendiente(id_pago_pendiente),
    id_pago_anticipado BIGINT UNIQUE REFERENCES pago_anticipado(id_pago_anticipado),
    id_devolucion BIGINT UNIQUE REFERENCES devolucion(id_devolucion),
    CHECK (num_nonnulls(id_pago_pendiente, id_pago_anticipado, id_devolucion) = 1),
    CHECK ((tipo = 'salida') = (id_devolucion IS NOT NULL))
);

-- 4. Traslados: cada paquete puede confirmarse por separado.
CREATE TABLE traslado (
    id_traslado BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_sucursal_origen BIGINT NOT NULL REFERENCES sucursal(id_sucursal),
    id_sucursal_destino BIGINT NOT NULL REFERENCES sucursal(id_sucursal),
    id_empleado BIGINT NOT NULL REFERENCES empleado(id_empleado),
    estado VARCHAR(15) NOT NULL DEFAULT 'preparado'
        CHECK (estado IN ('preparado', 'en_traslado', 'recibido', 'cancelado')),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_salida TIMESTAMPTZ,
    fecha_recepcion TIMESTAMPTZ,
    observaciones TEXT,
    CHECK (id_sucursal_origen <> id_sucursal_destino),
    CHECK (fecha_recepcion IS NULL OR fecha_recepcion >= fecha_salida)
);

CREATE TABLE detalle_traslado (
    id_detalle_traslado BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_traslado BIGINT NOT NULL REFERENCES traslado(id_traslado),
    id_paquete BIGINT NOT NULL REFERENCES paquete(id_paquete),
    recibido_en TIMESTAMPTZ,
    id_empleado_receptor BIGINT REFERENCES empleado(id_empleado),
    id_locker_destino BIGINT REFERENCES locker(id_locker),
    observaciones TEXT,
    UNIQUE (id_traslado, id_paquete),
    CHECK ((recibido_en IS NULL) = (id_empleado_receptor IS NULL))
);

-- 5. Solo avisos realmente realizados; no contiene fechas de programacion.
CREATE TABLE notificacion (
    id_notificacion BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_pago_pendiente BIGINT NOT NULL REFERENCES pago_pendiente(id_pago_pendiente),
    tipo VARCHAR(25) NOT NULL CHECK (tipo IN ('recordatorio_2_dias', 'recordatorio_1_dia')),
    telefono VARCHAR(30) NOT NULL CHECK (btrim(telefono) <> ''),
    contenido TEXT NOT NULL CHECK (btrim(contenido) <> ''),
    realizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    id_empleado BIGINT REFERENCES empleado(id_empleado),
    UNIQUE (id_pago_pendiente, tipo)
);

-- 6. Resumen de caja: saldo de entradas y salidas, no utilidad del negocio.
CREATE TABLE resumen_diario (
    id_resumen_diario BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_sucursal BIGINT NOT NULL REFERENCES sucursal(id_sucursal),
    fecha DATE NOT NULL,
    total_entradas NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_salidas NUMERIC(14,2) NOT NULL DEFAULT 0,
    saldo NUMERIC(14,2) GENERATED ALWAYS AS (total_entradas - total_salidas) STORED,
    cantidad_cobros INTEGER NOT NULL DEFAULT 0,
    cantidad_devoluciones INTEGER NOT NULL DEFAULT 0,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (id_sucursal, fecha)
);

CREATE TABLE resumen_mensual (
    id_resumen_mensual BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_sucursal BIGINT NOT NULL REFERENCES sucursal(id_sucursal),
    periodo DATE NOT NULL CHECK (EXTRACT(DAY FROM periodo) = 1),
    total_entradas NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_salidas NUMERIC(14,2) NOT NULL DEFAULT 0,
    saldo NUMERIC(14,2) GENERATED ALWAYS AS (total_entradas - total_salidas) STORED,
    cantidad_cobros INTEGER NOT NULL DEFAULT 0,
    cantidad_devoluciones INTEGER NOT NULL DEFAULT 0,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (id_sucursal, periodo)
);

CREATE INDEX idx_documento_fecha ON documento (id_sucursal, fecha);
CREATE INDEX idx_detalle_documento_documento ON detalle_documento (id_documento);
CREATE INDEX idx_paquete_vencimiento ON paquete (fecha_limite) WHERE estado <> 'entregado';
CREATE INDEX idx_paquete_sucursal ON paquete (id_sucursal_actual);
CREATE INDEX idx_movimiento_caja ON movimiento (id_sucursal, fecha);
CREATE INDEX idx_movimiento_paquete ON movimiento (id_paquete);
CREATE INDEX idx_traslado_paquete ON detalle_traslado (id_paquete);

-- CASILLEROS DISPONIBLES: se devuelve cada casillero concreto.
CREATE VIEW lockers_disponibles AS
SELECT l.id_locker, l.id_sucursal, s.nombre AS sucursal, l.codigo, l.tamanio
FROM locker l JOIN sucursal s USING (id_sucursal)
WHERE l.habilitado AND s.activa
  AND NOT EXISTS (SELECT 1 FROM paquete p WHERE p.id_locker = l.id_locker);

CREATE FUNCTION validar_ubicacion_paquete() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_locker locker%ROWTYPE;
BEGIN
    IF NEW.id_locker IS NOT NULL THEN
        SELECT * INTO STRICT v_locker FROM locker WHERE id_locker = NEW.id_locker FOR UPDATE;
        IF NOT v_locker.habilitado OR v_locker.id_sucursal <> NEW.id_sucursal_actual
           OR v_locker.tamanio < NEW.tamanio THEN
            RAISE EXCEPTION 'Locker no habilitado, incompatible o de otra sucursal';
        END IF;
        IF NEW.estado NOT IN ('recibido', 'almacenado') THEN
            RAISE EXCEPTION 'Este estado del paquete no permite ocupar un locker';
        END IF;
        NEW.estado := 'almacenado';
    ELSIF NEW.estado = 'almacenado' THEN
        NEW.estado := 'recibido';
    END IF;
    RETURN NEW;
END; $$;
CREATE TRIGGER tg_ubicacion_paquete BEFORE INSERT OR UPDATE ON paquete
FOR EACH ROW EXECUTE FUNCTION validar_ubicacion_paquete();

-- Generacion repetible sin duplicados. No crea movimientos de dinero.
CREATE FUNCTION generar_recargos(
    p_fecha TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    p_id_paquete BIGINT DEFAULT NULL
) RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE v_p paquete%ROWTYPE; v_n INTEGER; v_i INTEGER; v_filas INTEGER; v_total INTEGER := 0;
BEGIN
    FOR v_p IN SELECT p.* FROM paquete p
        WHERE p.estado <> 'entregado' AND p.fecha_limite < p_fecha
          AND (p_id_paquete IS NULL OR p.id_paquete = p_id_paquete)
          AND EXISTS (SELECT 1 FROM detalle_documento d
                      WHERE d.id_paquete = p.id_paquete AND d.tipo_documento = 'recepcion')
        ORDER BY p.id_paquete FOR UPDATE OF p
    LOOP
        v_n := CEIL(EXTRACT(EPOCH FROM (p_fecha - v_p.fecha_limite)) / 604800)::INTEGER;
        FOR v_i IN 1..v_n LOOP
            INSERT INTO pago_pendiente
                (id_paquete, concepto, numero_periodo, monto, generado_en, vence_en)
            VALUES (v_p.id_paquete, 'recargo', v_i, v_p.recargo_semanal,
                v_p.fecha_limite + (v_i - 1) * INTERVAL '7 days',
                v_p.fecha_limite + v_i * INTERVAL '7 days')
            ON CONFLICT (id_paquete, concepto, numero_periodo) DO NOTHING;
            GET DIAGNOSTICS v_filas = ROW_COUNT;
            v_total := v_total + v_filas;
        END LOOP;
    END LOOP;
    RETURN v_total;
END; $$;

-- Valida correspondencia, importe completo y devolucion total del paquete.
CREATE FUNCTION validar_movimiento() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_paquete BIGINT; v_monto NUMERIC; v_fecha TIMESTAMPTZ;
BEGIN
    PERFORM 1 FROM paquete WHERE id_paquete = NEW.id_paquete FOR UPDATE;
    IF NEW.id_pago_pendiente IS NOT NULL THEN
        SELECT id_paquete, monto, generado_en INTO STRICT v_paquete, v_monto, v_fecha
        FROM pago_pendiente WHERE id_pago_pendiente = NEW.id_pago_pendiente;
    ELSIF NEW.id_pago_anticipado IS NOT NULL THEN
        SELECT id_paquete, monto, fecha INTO STRICT v_paquete, v_monto, v_fecha
        FROM pago_anticipado WHERE id_pago_anticipado = NEW.id_pago_anticipado;
    ELSE
        SELECT id_paquete, monto, fecha INTO STRICT v_paquete, v_monto, v_fecha
        FROM devolucion WHERE id_devolucion = NEW.id_devolucion;
    END IF;
    IF NEW.id_paquete <> v_paquete OR NEW.monto <> v_monto OR NEW.fecha < v_fecha THEN
        RAISE EXCEPTION 'Movimiento incompatible con su pago, fecha o importe completo';
    END IF;
    RETURN NEW;
END; $$;
CREATE TRIGGER tg_movimiento BEFORE INSERT ON movimiento
FOR EACH ROW EXECUTE FUNCTION validar_movimiento();

CREATE FUNCTION validar_devolucion() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_total NUMERIC;
BEGIN
    PERFORM 1 FROM paquete WHERE id_paquete = NEW.id_paquete FOR UPDATE;
    SELECT COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN monto ELSE -monto END), 0)
    INTO v_total FROM movimiento WHERE id_paquete = NEW.id_paquete AND fecha <= NEW.fecha;
    IF v_total <= 0 OR NEW.monto <> v_total THEN
        RAISE EXCEPTION 'La devolucion debe cubrir todo lo cobrado por el paquete: %', v_total;
    END IF;
    RETURN NEW;
END; $$;
CREATE TRIGGER tg_devolucion BEFORE INSERT ON devolucion
FOR EACH ROW EXECUTE FUNCTION validar_devolucion();

-- Cobrar todos los pendientes del paquete juntos; admite al cliente como excepcion.
CREATE FUNCTION cobrar_paquete(
    p_id_paquete BIGINT, p_id_empleado BIGINT, p_id_sucursal BIGINT,
    p_pagador VARCHAR DEFAULT 'destinatario', p_medio VARCHAR DEFAULT 'efectivo',
    p_fecha TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
) RETURNS NUMERIC LANGUAGE plpgsql AS $$
DECLARE v_deuda RECORD; v_total NUMERIC := 0;
BEGIN
    PERFORM 1 FROM paquete WHERE id_paquete = p_id_paquete FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Paquete inexistente'; END IF;
    PERFORM generar_recargos(p_fecha, p_id_paquete);
    FOR v_deuda IN SELECT pp.* FROM pago_pendiente pp
        WHERE pp.id_paquete = p_id_paquete
          AND NOT EXISTS (SELECT 1 FROM movimiento m
                          WHERE m.id_pago_pendiente = pp.id_pago_pendiente)
        ORDER BY pp.id_pago_pendiente
    LOOP
        INSERT INTO movimiento (id_paquete, tipo, monto, fecha, id_empleado,
            id_sucursal, pagador, medio, id_pago_pendiente)
        VALUES (p_id_paquete, 'entrada', v_deuda.monto, p_fecha, p_id_empleado,
            p_id_sucursal, p_pagador, p_medio, v_deuda.id_pago_pendiente);
        v_total := v_total + v_deuda.monto;
    END LOOP;
    IF v_total = 0 THEN RAISE EXCEPTION 'El paquete no tiene pagos pendientes'; END IF;
    RETURN v_total;
END; $$;

-- Se comprueba al finalizar la transaccion para permitir varios movimientos
-- del mismo paquete, pero impedir que se pague solo una parte de sus cargos.
CREATE FUNCTION exigir_cobro_completo() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.id_pago_pendiente IS NOT NULL THEN
        PERFORM generar_recargos(NEW.fecha, NEW.id_paquete);
        IF EXISTS (SELECT 1 FROM pago_pendiente pp
            WHERE pp.id_paquete = NEW.id_paquete AND pp.generado_en <= NEW.fecha
              AND NOT EXISTS (SELECT 1 FROM movimiento m
                              WHERE m.id_pago_pendiente = pp.id_pago_pendiente)) THEN
            RAISE EXCEPTION 'No se permiten pagos parciales: liquide todos los pendientes del paquete';
        END IF;
    END IF;
    RETURN NULL;
END; $$;
CREATE CONSTRAINT TRIGGER tg_cobro_completo AFTER INSERT ON movimiento
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION exigir_cobro_completo();

-- Documento de recepcion: crea automaticamente el pendiente o el cobro anticipado.
-- Documento de entrega: exige que no exista deuda y libera el casillero.
CREATE FUNCTION procesar_detalle_documento() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_doc documento%ROWTYPE; v_p paquete%ROWTYPE; v_antic BIGINT;
BEGIN
    SELECT * INTO STRICT v_doc FROM documento WHERE id_documento = NEW.id_documento;
    NEW.tipo_documento := v_doc.tipo;
    SELECT * INTO STRICT v_p FROM paquete WHERE id_paquete = NEW.id_paquete FOR UPDATE;
    IF v_doc.tipo = 'recepcion' THEN
        IF v_p.estado NOT IN ('recibido', 'almacenado')
           OR v_p.id_sucursal_actual <> v_doc.id_sucursal
           OR v_p.fecha_ingreso <> v_doc.fecha THEN
            RAISE EXCEPTION 'La recepcion debe coincidir con la fecha y sucursal de ingreso';
        END IF;
        IF v_p.modalidad_pago = 'pendiente' THEN
            INSERT INTO pago_pendiente
                (id_paquete, concepto, numero_periodo, monto, generado_en, vence_en)
            VALUES (v_p.id_paquete, 'almacenamiento', 0, v_p.importe_inicial,
                v_doc.fecha, v_p.fecha_limite);
        ELSE
            INSERT INTO pago_anticipado (id_paquete, monto, fecha)
            VALUES (v_p.id_paquete, v_p.importe_inicial, v_doc.fecha)
            RETURNING id_pago_anticipado INTO v_antic;
            INSERT INTO movimiento (id_paquete, tipo, monto, fecha, id_sucursal,
                id_empleado, pagador, id_pago_anticipado)
            VALUES (v_p.id_paquete, 'entrada', v_p.importe_inicial, v_doc.fecha,
                v_doc.id_sucursal, v_doc.id_empleado, 'cliente', v_antic);
        END IF;
    ELSE
        IF v_p.estado NOT IN ('recibido', 'almacenado')
           OR v_p.id_sucursal_actual <> v_doc.id_sucursal THEN
            RAISE EXCEPTION 'Paquete no disponible para entregar en esta sucursal';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM detalle_documento d
            WHERE d.id_paquete = NEW.id_paquete AND d.tipo_documento = 'recepcion') THEN
            RAISE EXCEPTION 'El paquete no tiene documento de recepcion';
        END IF;
        PERFORM generar_recargos(v_doc.fecha, v_p.id_paquete);
        IF EXISTS (SELECT 1 FROM pago_pendiente pp WHERE pp.id_paquete = v_p.id_paquete
            AND NOT EXISTS (SELECT 1 FROM movimiento m
                            WHERE m.id_pago_pendiente = pp.id_pago_pendiente)) THEN
            RAISE EXCEPTION 'Debe cobrar el saldo completo antes de entregar';
        END IF;
        UPDATE paquete SET estado = 'entregado', fecha_entrega = v_doc.fecha,
            id_locker = NULL WHERE id_paquete = v_p.id_paquete;
    END IF;
    RETURN NEW;
END; $$;
CREATE TRIGGER tg_detalle_documento BEFORE INSERT ON detalle_documento
FOR EACH ROW EXECUTE FUNCTION procesar_detalle_documento();

-- Registrar primero el documento; esta funcion agrega cada paquete a su recepcion.
CREATE FUNCTION recibir_paquete(
    p_id_documento BIGINT, p_codigo VARCHAR, p_descripcion TEXT, p_tamanio SMALLINT,
    p_modalidad_pago VARCHAR, p_destinatario VARCHAR DEFAULT NULL,
    p_ci VARCHAR DEFAULT NULL, p_telefono VARCHAR DEFAULT NULL, p_id_locker BIGINT DEFAULT NULL
) RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE v_doc documento%ROWTYPE; v_id BIGINT;
BEGIN
    SELECT * INTO STRICT v_doc FROM documento WHERE id_documento = p_id_documento;
    IF v_doc.tipo <> 'recepcion' THEN RAISE EXCEPTION 'Se requiere documento de recepcion'; END IF;
    INSERT INTO paquete (codigo, descripcion, tamanio, fecha_ingreso, fecha_limite,
        id_sucursal_actual, id_locker, modalidad_pago)
    VALUES (p_codigo, p_descripcion, p_tamanio, v_doc.fecha, v_doc.fecha + INTERVAL '7 days',
        v_doc.id_sucursal, p_id_locker, p_modalidad_pago) RETURNING id_paquete INTO v_id;
    INSERT INTO detalle_documento (id_documento, id_paquete,
        nombre_destinatario, ci_destinatario, telefono_destinatario)
    VALUES (p_id_documento, v_id, p_destinatario, p_ci, NULLIF(btrim(p_telefono), ''));
    RETURN v_id;
END; $$;

CREATE VIEW saldo_paquete AS
SELECT p.id_paquete, p.codigo, p.modalidad_pago,
    COALESCE((SELECT SUM(pp.monto) FROM pago_pendiente pp
        WHERE pp.id_paquete = p.id_paquete AND NOT EXISTS
            (SELECT 1 FROM movimiento m WHERE m.id_pago_pendiente = pp.id_pago_pendiente)), 0)
        AS saldo_pendiente,
    COALESCE((SELECT SUM(m.monto) FROM movimiento m
        WHERE m.id_paquete = p.id_paquete AND m.tipo = 'entrada'), 0) AS total_cobrado,
    COALESCE((SELECT SUM(m.monto) FROM movimiento m
        WHERE m.id_paquete = p.id_paquete AND m.tipo = 'salida'), 0) AS total_devuelto
FROM paquete p;

-- Consulta de trabajo, NO es una tabla ni registra avisos automaticamente.
CREATE VIEW avisos_por_realizar AS
SELECT pp.id_pago_pendiente, p.id_paquete, p.codigo,
    d.nombre_destinatario, d.telefono_destinatario AS telefono, pp.monto, pp.vence_en,
    CASE WHEN (pp.vence_en AT TIME ZONE 'America/La_Paz')::DATE
                   - (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')::DATE = 2
         THEN 'recordatorio_2_dias' ELSE 'recordatorio_1_dia' END AS tipo
FROM pago_pendiente pp JOIN paquete p USING (id_paquete)
JOIN detalle_documento d ON d.id_paquete = p.id_paquete AND d.tipo_documento = 'recepcion'
WHERE p.estado <> 'entregado' AND d.telefono_destinatario IS NOT NULL
  AND (pp.vence_en AT TIME ZONE 'America/La_Paz')::DATE
      - (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')::DATE IN (1, 2)
  AND NOT EXISTS (SELECT 1 FROM movimiento m WHERE m.id_pago_pendiente = pp.id_pago_pendiente)
  AND NOT EXISTS (SELECT 1 FROM notificacion n
      WHERE n.id_pago_pendiente = pp.id_pago_pendiente AND n.tipo =
          CASE WHEN (pp.vence_en AT TIME ZONE 'America/La_Paz')::DATE
                    - (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')::DATE = 2
               THEN 'recordatorio_2_dias' ELSE 'recordatorio_1_dia' END);

CREATE FUNCTION validar_notificacion() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_telefono TEXT; v_vence TIMESTAMPTZ; v_dias INTEGER;
BEGIN
    SELECT d.telefono_destinatario, pp.vence_en INTO STRICT v_telefono, v_vence
    FROM pago_pendiente pp JOIN detalle_documento d USING (id_paquete)
    WHERE pp.id_pago_pendiente = NEW.id_pago_pendiente AND d.tipo_documento = 'recepcion';
    v_dias := (v_vence AT TIME ZONE 'America/La_Paz')::DATE
        - (NEW.realizado_en AT TIME ZONE 'America/La_Paz')::DATE;
    IF v_telefono IS NULL OR NEW.telefono <> v_telefono
       OR NEW.realizado_en > CURRENT_TIMESTAMP
       OR v_dias <> (CASE NEW.tipo WHEN 'recordatorio_2_dias' THEN 2 ELSE 1 END)
       OR EXISTS (SELECT 1 FROM movimiento m
           WHERE m.id_pago_pendiente = NEW.id_pago_pendiente AND m.fecha <= NEW.realizado_en) THEN
        RAISE EXCEPTION 'El aviso requiere telefono, deuda sin pagar y fecha de recordatorio valida';
    END IF;
    RETURN NEW;
END; $$;
CREATE TRIGGER tg_notificacion BEFORE INSERT ON notificacion
FOR EACH ROW EXECUTE FUNCTION validar_notificacion();

-- Traslados: el despacho libera el locker; cada recepcion asigna la sucursal destino.
CREATE FUNCTION validar_detalle_traslado() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_t traslado%ROWTYPE; v_p paquete%ROWTYPE;
BEGIN
    SELECT * INTO STRICT v_t FROM traslado WHERE id_traslado = NEW.id_traslado FOR UPDATE;
    SELECT * INTO STRICT v_p FROM paquete WHERE id_paquete = NEW.id_paquete FOR UPDATE;
    IF v_t.estado <> 'preparado' OR v_p.estado NOT IN ('recibido', 'almacenado')
       OR v_p.id_sucursal_actual <> v_t.id_sucursal_origen
       OR NEW.recibido_en IS NOT NULL
       OR EXISTS (SELECT 1 FROM detalle_traslado dt JOIN traslado t USING (id_traslado)
           WHERE dt.id_paquete = NEW.id_paquete AND dt.recibido_en IS NULL
             AND t.estado IN ('preparado', 'en_traslado')) THEN
        RAISE EXCEPTION 'Paquete no disponible en origen o incluido en otro traslado activo';
    END IF;
    RETURN NEW;
END; $$;
CREATE TRIGGER tg_detalle_traslado BEFORE INSERT ON detalle_traslado
FOR EACH ROW EXECUTE FUNCTION validar_detalle_traslado();

CREATE FUNCTION despachar_traslado(p_id_traslado BIGINT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_t traslado%ROWTYPE; v_p RECORD;
BEGIN
    SELECT * INTO STRICT v_t FROM traslado WHERE id_traslado = p_id_traslado FOR UPDATE;
    IF v_t.estado <> 'preparado' OR NOT EXISTS
        (SELECT 1 FROM detalle_traslado WHERE id_traslado = p_id_traslado) THEN
        RAISE EXCEPTION 'Traslado vacio o no preparado';
    END IF;
    FOR v_p IN SELECT p.* FROM paquete p JOIN detalle_traslado dt USING (id_paquete)
        WHERE dt.id_traslado = p_id_traslado ORDER BY p.id_paquete FOR UPDATE OF p
    LOOP
        IF v_p.id_sucursal_actual <> v_t.id_sucursal_origen
           OR v_p.estado NOT IN ('recibido', 'almacenado') THEN
            RAISE EXCEPTION 'Un paquete ya no esta disponible en origen';
        END IF;
        UPDATE paquete SET estado = 'en_traslado', id_sucursal_actual = NULL,
            id_locker = NULL WHERE id_paquete = v_p.id_paquete;
    END LOOP;
    UPDATE traslado SET estado = 'en_traslado', fecha_salida = CURRENT_TIMESTAMP
    WHERE id_traslado = p_id_traslado;
END; $$;

CREATE FUNCTION confirmar_paquete_traslado(
    p_id_detalle_traslado BIGINT, p_id_empleado BIGINT, p_id_locker BIGINT DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_d detalle_traslado%ROWTYPE; v_t traslado%ROWTYPE;
BEGIN
    SELECT * INTO STRICT v_d FROM detalle_traslado WHERE id_detalle_traslado = p_id_detalle_traslado;
    SELECT * INTO STRICT v_t FROM traslado WHERE id_traslado = v_d.id_traslado FOR UPDATE;
    SELECT * INTO STRICT v_d FROM detalle_traslado
        WHERE id_detalle_traslado = p_id_detalle_traslado FOR UPDATE;
    IF v_t.estado <> 'en_traslado' OR v_d.recibido_en IS NOT NULL THEN
        RAISE EXCEPTION 'El detalle no esta pendiente de recepcion';
    END IF;
    UPDATE paquete SET estado = 'recibido', id_sucursal_actual = v_t.id_sucursal_destino,
        id_locker = p_id_locker WHERE id_paquete = v_d.id_paquete;
    UPDATE detalle_traslado SET recibido_en = CURRENT_TIMESTAMP,
        id_empleado_receptor = p_id_empleado, id_locker_destino = p_id_locker
    WHERE id_detalle_traslado = p_id_detalle_traslado;
    IF NOT EXISTS (SELECT 1 FROM detalle_traslado
        WHERE id_traslado = v_t.id_traslado AND recibido_en IS NULL) THEN
        UPDATE traslado SET estado = 'recibido', fecha_recepcion = CURRENT_TIMESTAMP
        WHERE id_traslado = v_t.id_traslado;
    END IF;
END; $$;

-- Devolucion total: registra el documento monetario y su salida juntos.
-- No cambia la ubicacion ni equivale a entregar fisicamente el paquete.
CREATE FUNCTION devolver_pago_paquete(
    p_id_paquete BIGINT, p_id_empleado BIGINT, p_id_sucursal BIGINT, p_motivo TEXT,
    p_medio VARCHAR DEFAULT 'efectivo', p_receptor VARCHAR DEFAULT 'cliente'
) RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE v_monto NUMERIC; v_id BIGINT;
BEGIN
    PERFORM 1 FROM paquete WHERE id_paquete = p_id_paquete FOR UPDATE;
    SELECT COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN monto ELSE -monto END), 0)
    INTO v_monto FROM movimiento WHERE id_paquete = p_id_paquete;
    IF v_monto <= 0 THEN RAISE EXCEPTION 'No hay un importe cobrado para devolver'; END IF;
    INSERT INTO devolucion (id_paquete, monto, motivo)
    VALUES (p_id_paquete, v_monto, p_motivo) RETURNING id_devolucion INTO v_id;
    INSERT INTO movimiento (id_paquete, tipo, monto, id_sucursal, id_empleado,
        pagador, medio, id_devolucion)
    VALUES (p_id_paquete, 'salida', v_monto, p_id_sucursal, p_id_empleado,
        p_receptor, p_medio, v_id);
    RETURN v_id;
END; $$;

-- Actualiza los resumenes de caja al registrar cada movimiento nuevo.
-- cantidad_cobros cuenta entradas de caja, no paquetes ni documentos.
-- Los meses se agregan directamente desde movimientos, no desde filas duplicadas.
CREATE FUNCTION actualizar_resumenes() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_dia DATE := (NEW.fecha AT TIME ZONE 'America/La_Paz')::DATE;
        v_mes DATE := date_trunc('month', NEW.fecha AT TIME ZONE 'America/La_Paz')::DATE;
BEGIN
    INSERT INTO resumen_diario (id_sucursal, fecha, total_entradas, total_salidas,
        cantidad_cobros, cantidad_devoluciones)
    VALUES (NEW.id_sucursal, v_dia,
        CASE WHEN NEW.tipo = 'entrada' THEN NEW.monto ELSE 0 END,
        CASE WHEN NEW.tipo = 'salida' THEN NEW.monto ELSE 0 END,
        CASE WHEN NEW.tipo = 'entrada' THEN 1 ELSE 0 END,
        CASE WHEN NEW.tipo = 'salida' THEN 1 ELSE 0 END)
    ON CONFLICT (id_sucursal, fecha) DO UPDATE SET
        total_entradas = resumen_diario.total_entradas + EXCLUDED.total_entradas,
        total_salidas = resumen_diario.total_salidas + EXCLUDED.total_salidas,
        cantidad_cobros = resumen_diario.cantidad_cobros + EXCLUDED.cantidad_cobros,
        cantidad_devoluciones = resumen_diario.cantidad_devoluciones + EXCLUDED.cantidad_devoluciones,
        actualizado_en = CURRENT_TIMESTAMP;
    INSERT INTO resumen_mensual (id_sucursal, periodo, total_entradas, total_salidas,
        cantidad_cobros, cantidad_devoluciones)
    VALUES (NEW.id_sucursal, v_mes,
        CASE WHEN NEW.tipo = 'entrada' THEN NEW.monto ELSE 0 END,
        CASE WHEN NEW.tipo = 'salida' THEN NEW.monto ELSE 0 END,
        CASE WHEN NEW.tipo = 'entrada' THEN 1 ELSE 0 END,
        CASE WHEN NEW.tipo = 'salida' THEN 1 ELSE 0 END)
    ON CONFLICT (id_sucursal, periodo) DO UPDATE SET
        total_entradas = resumen_mensual.total_entradas + EXCLUDED.total_entradas,
        total_salidas = resumen_mensual.total_salidas + EXCLUDED.total_salidas,
        cantidad_cobros = resumen_mensual.cantidad_cobros + EXCLUDED.cantidad_cobros,
        cantidad_devoluciones = resumen_mensual.cantidad_devoluciones + EXCLUDED.cantidad_devoluciones,
        actualizado_en = CURRENT_TIMESTAMP;
    RETURN NEW;
END; $$;
CREATE TRIGGER tg_resumenes AFTER INSERT ON movimiento
FOR EACH ROW EXECUTE FUNCTION actualizar_resumenes();

COMMIT;

-- EJEMPLOS DE USO (comentados; reemplazar los identificadores por los reales).
-- Crear varios lockers de una sucursal de una vez:
-- INSERT INTO locker (id_sucursal, codigo, tamanio)
-- SELECT 1, 'A-' || lpad(n::TEXT, 2, '0'), 1 FROM generate_series(1, 20) AS n;
-- SELECT * FROM lockers_disponibles WHERE id_sucursal = 1 ORDER BY codigo;
--
-- Crear primero personas, cliente, empleado y sucursales; luego una recepcion:
-- INSERT INTO documento (tipo, id_sucursal, id_empleado, id_cliente)
-- VALUES ('recepcion', 1, 1, 2) RETURNING id_documento;
-- SELECT recibir_paquete(1, 'PAQ-001', 'Caja de ropa', 1::SMALLINT,
--     'pendiente', 'Ana', NULL, '70000000', 1);
-- Repetir recibir_paquete con el mismo documento para otros paquetes/destinatarios.
--
-- SELECT generar_recargos(); -- Tarea periodica de la aplicacion.
-- SELECT * FROM saldo_paquete;
-- SELECT * FROM avisos_por_realizar;
-- Despues de realizar el aviso, guardar tipo y telefono devueltos por la consulta:
-- INSERT INTO notificacion (id_pago_pendiente, tipo, telefono, contenido, id_empleado)
-- VALUES (1, 'recordatorio_2_dias', '70000000', 'Su paquete vence en dos dias.', 1);
--
-- SELECT cobrar_paquete(1, 1, 1); -- Liquida todo, no acepta un importe parcial.
-- SELECT cobrar_paquete(1, 1, 1, 'cliente'); -- Excepcion: paga quien lo dejo.
-- Crear documento tipo entrega y agregar detalles con los datos de quien recoge.
-- INSERT INTO detalle_documento (id_documento, id_paquete, ci_destinatario)
-- VALUES (2, 1, '1234567'); -- Actualiza estado y libera el locker automaticamente.
--
-- Crear traslado preparado, agregar sus detalles, luego:
-- SELECT despachar_traslado(1);
-- SELECT confirmar_paquete_traslado(1, 1, 21); -- detalle, empleado, locker destino.
-- SELECT devolver_pago_paquete(1, 1, 1, 'Devolucion total autorizada');
-- SELECT * FROM resumen_diario ORDER BY fecha DESC;
-- SELECT * FROM resumen_mensual ORDER BY periodo DESC;
