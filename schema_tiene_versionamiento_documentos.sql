-- Indica si el documento tiene dos o más versiones no eliminadas.
ALTER TABLE public.docs
    ADD COLUMN IF NOT EXISTS tiene_versionamiento boolean DEFAULT false NOT NULL;

ALTER TABLE public.docs
    ALTER COLUMN tiene_versionamiento SET DEFAULT false;

UPDATE public.docs d
SET tiene_versionamiento = (
    SELECT COUNT(*) >= 2
    FROM public.doc_versions v
    WHERE v.id_documento = d.id_documento
      AND COALESCE(v.estado, 'INACTIVO') <> 'ELIMINADO'
);
