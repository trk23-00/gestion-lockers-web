BEGIN;
ALTER TABLE detalle_documento ADD COLUMN anulado_en TIMESTAMPTZ;
ALTER TABLE detalle_documento DROP CONSTRAINT detalle_documento_id_paquete_tipo_documento_key;
CREATE UNIQUE INDEX detalle_documento_activo_key ON detalle_documento(id_paquete,tipo_documento) WHERE anulado_en IS NULL;
CREATE INDEX detalle_documento_id_paquete_tipo_documento_idx ON detalle_documento(id_paquete,tipo_documento);
ALTER TABLE movimiento ADD COLUMN id_operacion UUID;
-- Agrupar los cargos de cobros existentes que se registraron en la misma operación.
WITH grupos AS (SELECT id_paquete,fecha,id_empleado,id_sucursal,gen_random_uuid() AS operacion
 FROM movimiento GROUP BY id_paquete,fecha,id_empleado,id_sucursal)
UPDATE movimiento m SET id_operacion=g.operacion FROM grupos g
 WHERE m.id_paquete=g.id_paquete AND m.fecha=g.fecha AND m.id_empleado=g.id_empleado AND m.id_sucursal=g.id_sucursal;
ALTER TABLE movimiento ALTER COLUMN id_operacion SET DEFAULT gen_random_uuid();
ALTER TABLE movimiento ALTER COLUMN id_operacion SET NOT NULL;
ALTER TABLE movimiento ADD COLUMN anulado_en TIMESTAMPTZ;
ALTER TABLE movimiento ADD COLUMN observaciones TEXT;
ALTER TABLE movimiento DROP CONSTRAINT movimiento_check;
ALTER TABLE movimiento DROP CONSTRAINT movimiento_check1;
ALTER TABLE movimiento ADD CONSTRAINT movimiento_referencia_check CHECK (
 (anulado_en IS NULL AND num_nonnulls(id_pago_pendiente,id_pago_anticipado,id_devolucion)=1
  AND ((tipo='salida')=(id_devolucion IS NOT NULL))) OR
 (anulado_en IS NOT NULL AND tipo='entrada' AND num_nonnulls(id_pago_pendiente,id_pago_anticipado,id_devolucion)=0));
CREATE TABLE auditoria_operacion (
 id_auditoria BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 entidad VARCHAR(15) NOT NULL CHECK(entidad IN ('entrega','pago')),
 id_registro BIGINT NOT NULL,
 accion VARCHAR(15) NOT NULL CHECK(accion IN ('corregir','anular')),
 motivo TEXT NOT NULL CHECK(btrim(motivo)<>''),
 antes JSONB NOT NULL,despues JSONB NOT NULL,
 id_empleado BIGINT NOT NULL REFERENCES empleado(id_empleado),
 id_sucursal BIGINT NOT NULL REFERENCES sucursal(id_sucursal),
 fecha TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX auditoria_operacion_entidad_id_registro_idx ON auditoria_operacion(entidad,id_registro);
CREATE INDEX auditoria_operacion_id_sucursal_fecha_idx ON auditoria_operacion(id_sucursal,fecha);
CREATE OR REPLACE FUNCTION cobrar_paquete(
    p_id_paquete BIGINT, p_id_empleado BIGINT, p_id_sucursal BIGINT,
    p_pagador VARCHAR DEFAULT 'destinatario', p_medio VARCHAR DEFAULT 'efectivo',
    p_fecha TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
) RETURNS NUMERIC LANGUAGE plpgsql AS $$
DECLARE v_deuda RECORD; v_total NUMERIC := 0; v_operacion UUID := gen_random_uuid();
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
            id_sucursal, pagador, medio, id_pago_pendiente, id_operacion)
        VALUES (p_id_paquete, 'entrada', v_deuda.monto, p_fecha, p_id_empleado,
            p_id_sucursal, p_pagador, p_medio, v_deuda.id_pago_pendiente, v_operacion);
        v_total := v_total + v_deuda.monto;
    END LOOP;
    IF v_total = 0 THEN RAISE EXCEPTION 'El paquete no tiene pagos pendientes'; END IF;
    RETURN v_total;
END; $$;
CREATE OR REPLACE FUNCTION validar_devolucion() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_total NUMERIC;
BEGIN
    PERFORM 1 FROM paquete WHERE id_paquete = NEW.id_paquete FOR UPDATE;
    SELECT COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN monto ELSE -monto END), 0)
    INTO v_total FROM movimiento WHERE id_paquete = NEW.id_paquete AND fecha <= NEW.fecha AND anulado_en IS NULL;
    IF v_total <= 0 OR NEW.monto <> v_total THEN
        RAISE EXCEPTION 'La devolucion debe cubrir todo lo cobrado por el paquete: %', v_total;
    END IF;
    RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION devolver_pago_paquete(
    p_id_paquete BIGINT, p_id_empleado BIGINT, p_id_sucursal BIGINT, p_motivo TEXT,
    p_medio VARCHAR DEFAULT 'efectivo', p_receptor VARCHAR DEFAULT 'cliente'
) RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE v_monto NUMERIC; v_id BIGINT;
BEGIN
    PERFORM 1 FROM paquete WHERE id_paquete = p_id_paquete FOR UPDATE;
    SELECT COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN monto ELSE -monto END), 0)
    INTO v_monto FROM movimiento WHERE id_paquete = p_id_paquete AND anulado_en IS NULL;
    IF v_monto <= 0 THEN RAISE EXCEPTION 'No hay un importe cobrado para devolver'; END IF;
    INSERT INTO devolucion (id_paquete, monto, motivo)
    VALUES (p_id_paquete, v_monto, p_motivo) RETURNING id_devolucion INTO v_id;
    INSERT INTO movimiento (id_paquete, tipo, monto, id_sucursal, id_empleado,
        pagador, medio, id_devolucion)
    VALUES (p_id_paquete, 'salida', v_monto, p_id_sucursal, p_id_empleado,
        p_receptor, p_medio, v_id);
    RETURN v_id;
END; $$;
CREATE OR REPLACE VIEW saldo_paquete AS
SELECT p.id_paquete, p.codigo, p.modalidad_pago,
    COALESCE((SELECT SUM(pp.monto) FROM pago_pendiente pp
        WHERE pp.id_paquete = p.id_paquete AND NOT EXISTS
            (SELECT 1 FROM movimiento m WHERE m.id_pago_pendiente = pp.id_pago_pendiente)), 0)
        AS saldo_pendiente,
    COALESCE((SELECT SUM(m.monto) FROM movimiento m
        WHERE m.id_paquete = p.id_paquete AND m.tipo = 'entrada' AND m.anulado_en IS NULL), 0) AS total_cobrado,
    COALESCE((SELECT SUM(m.monto) FROM movimiento m
        WHERE m.id_paquete = p.id_paquete AND m.tipo = 'salida' AND m.anulado_en IS NULL), 0) AS total_devuelto
FROM paquete p;
CREATE OR REPLACE FUNCTION actualizar_resumenes() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_dia DATE := (NEW.fecha AT TIME ZONE 'America/La_Paz')::DATE;
        v_mes DATE := date_trunc('month', NEW.fecha AT TIME ZONE 'America/La_Paz')::DATE; v_sign INTEGER := 1;
BEGIN
    IF TG_OP='UPDATE' THEN
        IF OLD.anulado_en IS NOT NULL OR NEW.anulado_en IS NULL THEN RETURN NEW; END IF;
        v_sign := -1;
    ELSIF NEW.anulado_en IS NOT NULL THEN RETURN NEW;
    END IF;
    INSERT INTO resumen_diario (id_sucursal, fecha, total_entradas, total_salidas,
        cantidad_cobros, cantidad_devoluciones)
    VALUES (NEW.id_sucursal, v_dia,
        CASE WHEN NEW.tipo = 'entrada' THEN v_sign * NEW.monto ELSE 0 END,
        CASE WHEN NEW.tipo = 'salida' THEN v_sign * NEW.monto ELSE 0 END,
        CASE WHEN NEW.tipo = 'entrada' THEN v_sign ELSE 0 END,
        CASE WHEN NEW.tipo = 'salida' THEN v_sign ELSE 0 END)
    ON CONFLICT (id_sucursal, fecha) DO UPDATE SET
        total_entradas = resumen_diario.total_entradas + EXCLUDED.total_entradas,
        total_salidas = resumen_diario.total_salidas + EXCLUDED.total_salidas,
        cantidad_cobros = resumen_diario.cantidad_cobros + EXCLUDED.cantidad_cobros,
        cantidad_devoluciones = resumen_diario.cantidad_devoluciones + EXCLUDED.cantidad_devoluciones,
        actualizado_en = CURRENT_TIMESTAMP;
    INSERT INTO resumen_mensual (id_sucursal, periodo, total_entradas, total_salidas,
        cantidad_cobros, cantidad_devoluciones)
    VALUES (NEW.id_sucursal, v_mes,
        CASE WHEN NEW.tipo = 'entrada' THEN v_sign * NEW.monto ELSE 0 END,
        CASE WHEN NEW.tipo = 'salida' THEN v_sign * NEW.monto ELSE 0 END,
        CASE WHEN NEW.tipo = 'entrada' THEN v_sign ELSE 0 END,
        CASE WHEN NEW.tipo = 'salida' THEN v_sign ELSE 0 END)
    ON CONFLICT (id_sucursal, periodo) DO UPDATE SET
        total_entradas = resumen_mensual.total_entradas + EXCLUDED.total_entradas,
        total_salidas = resumen_mensual.total_salidas + EXCLUDED.total_salidas,
        cantidad_cobros = resumen_mensual.cantidad_cobros + EXCLUDED.cantidad_cobros,
        cantidad_devoluciones = resumen_mensual.cantidad_devoluciones + EXCLUDED.cantidad_devoluciones,
        actualizado_en = CURRENT_TIMESTAMP;
    RETURN NEW;
END; $$;
DROP TRIGGER tg_resumenes ON movimiento;
CREATE TRIGGER tg_resumenes AFTER INSERT OR UPDATE OF anulado_en ON movimiento FOR EACH ROW EXECUTE FUNCTION actualizar_resumenes();
COMMIT;
