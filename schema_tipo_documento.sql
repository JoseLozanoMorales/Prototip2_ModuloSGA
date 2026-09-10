-- Actualización repetible. No reclasifica registros existentes.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE public.docs
    ADD COLUMN IF NOT EXISTS tipo character varying(20) NOT NULL DEFAULT 'Documento legal';

ALTER TABLE public.docs
    ALTER COLUMN tipo SET DEFAULT 'Documento legal';

ALTER TABLE public.docs
    DROP CONSTRAINT IF EXISTS chk_docs_tipo;

ALTER TABLE public.docs
    ADD CONSTRAINT chk_docs_tipo
    CHECK (tipo IN ('Documento legal', 'Manual', 'Reglamento', 'Guías', 'Ordenes', 'Modelos', 'Procedimiento', 'Videos'));
COMMIT;
