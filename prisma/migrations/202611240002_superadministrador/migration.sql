BEGIN;
ALTER TABLE rol DROP CONSTRAINT rol_nivel_check;
ALTER TABLE rol ADD CONSTRAINT rol_nivel_check CHECK (nivel BETWEEN 1 AND 5);
INSERT INTO rol(nivel,nombre_rol) VALUES (5,'SuperAdministrador');
UPDATE usuario SET rol=(SELECT id_rol FROM rol WHERE nivel=5)
WHERE correo='admin@lockers.local';

-- Reservar el rol especial a la cuenta raíz y conservar su acceso.
CREATE FUNCTION proteger_superadministrador() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM rol WHERE id_rol=NEW.rol AND nivel=5)
     AND (NEW.correo<>'admin@lockers.local' OR NOT NEW.activo) THEN
    RAISE EXCEPTION 'El rol SuperAdministrador está reservado a admin@lockers.local y debe permanecer activo';
  END IF;
  IF TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM rol WHERE id_rol=OLD.rol AND nivel=5)
     AND (NEW.rol<>OLD.rol OR NEW.correo<>OLD.correo) THEN
    RAISE EXCEPTION 'No se puede quitar el rol ni cambiar el correo del SuperAdministrador';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER tg_proteger_superadministrador BEFORE INSERT OR UPDATE ON usuario
FOR EACH ROW EXECUTE FUNCTION proteger_superadministrador();
COMMIT;
