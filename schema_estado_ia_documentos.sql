ALTER TABLE public.doc_versions
    ADD COLUMN IF NOT EXISTS estado_ia text DEFAULT 'PENDIENTE'::text NOT NULL,
    ADD COLUMN IF NOT EXISTS porcentaje_texto_ia numeric(5,2),
    ADD COLUMN IF NOT EXISTS mensaje_ia text,
    ADD COLUMN IF NOT EXISTS fecha_analisis_ia timestamp with time zone,
    ADD COLUMN IF NOT EXISTS resultado_ia jsonb;

ALTER TABLE public.doc_versions
    DROP CONSTRAINT IF EXISTS ck_doc_versions_estado_ia;

ALTER TABLE public.doc_versions
    ADD CONSTRAINT ck_doc_versions_estado_ia
    CHECK (estado_ia = ANY (ARRAY['PENDIENTE'::text, 'LEIDO'::text, 'OMITIDO'::text, 'OBSERVADO'::text, 'ERROR'::text]));

CREATE INDEX IF NOT EXISTS ix_doc_versions_estado_ia
    ON public.doc_versions USING btree (estado_ia);
