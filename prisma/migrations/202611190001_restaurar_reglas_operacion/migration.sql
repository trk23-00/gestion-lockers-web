-- Restablece las reglas SQL del prototipo si se perdieron al restaurar la DB.
-- No recrea tablas, elimina registros ni ejecuta cobros o recargos.
-- Reaplicable: reemplaza solo funciones/vistas y triggers propios de SGAP.
BEGIN;
SET LOCAL search_path TO public, pg_catalog;

-- CASILLEROS DISPONIBLES: se devuelve cada casillero concreto.
CREATE OR REPLACE VIEW lockers_disponibles AS
SELECT l.id_locker, l.id_sucursal, s.nombre AS sucursal, l.codigo, l.tamanio
FROM locker l JOIN sucursal s USING (id_sucursal)
WHERE l.habilitado AND s.activa
  AND NOT EXISTS (SELECT 1 FROM paquete p WHERE p.id_locker = l.id_locker);

CREATE OR REPLACE FUNCTION validar_ubicacion_paquete() RETURNS TRIGGER LANGUAGE plpgsql AS $$
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
DROP TRIGGER IF EXISTS tg_ubicacion_paquete ON paquete;
CREATE TRIGGER tg_ubicacion_paquete BEFORE INSERT OR UPDATE ON paquete
FOR EACH ROW EXECUTE FUNCTION validar_ubicacion_paquete();

-- Generacion repetible sin duplicados. No crea movimientos de dinero.
CREATE OR REPLACE FUNCTION generar_recargos(
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
CREATE OR REPLACE FUNCTION validar_movimiento() RETURNS TRIGGER LANGUAGE plpgsql AS $$
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
DROP TRIGGER IF EXISTS tg_movimiento ON movimiento;
CREATE TRIGGER tg_movimiento BEFORE INSERT ON movimiento
FOR EACH ROW EXECUTE FUNCTION validar_movimiento();

CREATE OR REPLACE FUNCTION validar_devolucion() RETURNS TRIGGER LANGUAGE plpgsql AS $$
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
DROP TRIGGER IF EXISTS tg_devolucion ON devolucion;
CREATE TRIGGER tg_devolucion BEFORE INSERT ON devolucion
FOR EACH ROW EXECUTE FUNCTION validar_devolucion();

-- Cobrar todos los pendientes del paquete juntos; admite al cliente como excepcion.
CREATE OR REPLACE FUNCTION cobrar_paquete(
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
CREATE OR REPLACE FUNCTION exigir_cobro_completo() RETURNS TRIGGER LANGUAGE plpgsql AS $$
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
DROP TRIGGER IF EXISTS tg_cobro_completo ON movimiento;
CREATE CONSTRAINT TRIGGER tg_cobro_completo AFTER INSERT ON movimiento
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION exigir_cobro_completo();

-- Documento de recepcion: crea automaticamente el pendiente o el cobro anticipado.
-- Documento de entrega: exige que no exista deuda y libera el casillero.
CREATE OR REPLACE FUNCTION procesar_detalle_documento() RETURNS TRIGGER LANGUAGE plpgsql AS $$
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
DROP TRIGGER IF EXISTS tg_detalle_documento ON detalle_documento;
CREATE TRIGGER tg_detalle_documento BEFORE INSERT ON detalle_documento
FOR EACH ROW EXECUTE FUNCTION procesar_detalle_documento();

-- Registrar primero el documento; esta funcion agrega cada paquete a su recepcion.
CREATE OR REPLACE FUNCTION recibir_paquete(
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

CREATE OR REPLACE VIEW saldo_paquete AS
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
CREATE OR REPLACE VIEW avisos_por_realizar AS
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

CREATE OR REPLACE FUNCTION validar_notificacion() RETURNS TRIGGER LANGUAGE plpgsql AS $$
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
DROP TRIGGER IF EXISTS tg_notificacion ON notificacion;
CREATE TRIGGER tg_notificacion BEFORE INSERT ON notificacion
FOR EACH ROW EXECUTE FUNCTION validar_notificacion();

-- Traslados: el despacho libera el locker; cada recepcion asigna la sucursal destino.
CREATE OR REPLACE FUNCTION validar_detalle_traslado() RETURNS TRIGGER LANGUAGE plpgsql AS $$
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
DROP TRIGGER IF EXISTS tg_detalle_traslado ON detalle_traslado;
CREATE TRIGGER tg_detalle_traslado BEFORE INSERT ON detalle_traslado
FOR EACH ROW EXECUTE FUNCTION validar_detalle_traslado();

CREATE OR REPLACE FUNCTION despachar_traslado(p_id_traslado BIGINT) RETURNS VOID LANGUAGE plpgsql AS $$
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

CREATE OR REPLACE FUNCTION confirmar_paquete_traslado(
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
CREATE OR REPLACE FUNCTION devolver_pago_paquete(
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
CREATE OR REPLACE FUNCTION actualizar_resumenes() RETURNS TRIGGER LANGUAGE plpgsql AS $$
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
DROP TRIGGER IF EXISTS tg_resumenes ON movimiento;
CREATE TRIGGER tg_resumenes AFTER INSERT ON movimiento
FOR EACH ROW EXECUTE FUNCTION actualizar_resumenes();

COMMIT;
