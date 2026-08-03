ALTER TABLE public.doc_versions
    ADD COLUMN IF NOT EXISTS estado_ia text DEFAULT 'PENDIENTE'::text NOT NULL,
    ADD COLUMN IF NOT EXISTS porcentaje_texto_ia numeric(5,2),
    ADD COLUMN IF NOT EXISTS mensaje_ia text,
    ADD COLUMN IF NOT EXISTS fecha_analisis_ia timestamp with time zone;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ck_doc_versions_estado_ia'
    ) THEN
        ALTER TABLE public.doc_versions
            ADD CONSTRAINT ck_doc_versions_estado_ia
            CHECK (estado_ia = ANY (ARRAY['PENDIENTE'::text, 'LEIDO'::text, 'OBSERVADO'::text, 'ERROR'::text]));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_doc_versions_estado_ia
    ON public.doc_versions USING btree (estado_ia);
