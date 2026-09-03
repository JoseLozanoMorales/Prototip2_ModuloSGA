-- Adaptación del esquema heredado a los estados del módulo Django.
-- Revisar y respaldar la base antes de ejecutar. No se aplica automáticamente.
-- Convierte únicamente INACTIVO a NO_VIGENTE; no publica documentos ni cambia
-- la referencia de versión vigente de registros existentes.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.doc_versions DROP CONSTRAINT IF EXISTS ck_doc_versions_estado;
UPDATE public.doc_versions SET estado = 'NO_VIGENTE' WHERE estado = 'INACTIVO';
ALTER TABLE public.doc_versions
    ALTER COLUMN estado SET DEFAULT 'BORRADOR',
    ADD CONSTRAINT ck_doc_versions_estado
        CHECK (estado IN ('BORRADOR', 'VIGENTE', 'NO_VIGENTE', 'ELIMINADO'));

COMMIT;
