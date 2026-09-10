-- Rutinas usadas por sga/documentos/views.py.
-- Ejecute este archivo después de schema_documentosv2_tables.sql y de las
-- migraciones que agregan estado_ia y tiene_versionamiento.

-- La publicación es opcional en instalaciones antiguas; las rutinas de
-- lectura la necesitan cuando la funcionalidad se habilita.
ALTER TABLE public.doc_versions
    ADD COLUMN IF NOT EXISTS publicado boolean DEFAULT FALSE NOT NULL;

CREATE OR REPLACE FUNCTION public.fn_obtener_estados_ia_documentos(
    p_ids_documentos bigint[],
    p_estado_sin_version text,
    p_estado_predeterminado text,
    p_mensaje_sin_vigente text
)
RETURNS TABLE(
    id_documento bigint,
    estado_ia text,
    porcentaje_texto_ia numeric,
    mensaje_ia text
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        d.id_documento,
        CASE
            WHEN v.id_version IS NULL THEN p_estado_sin_version
            ELSE COALESCE(v.estado_ia, p_estado_predeterminado)
        END,
        v.porcentaje_texto_ia,
        CASE
            WHEN v.id_version IS NULL THEN p_mensaje_sin_vigente
            ELSE COALESCE(v.mensaje_ia, '')
        END
    FROM public.docs d
    LEFT JOIN LATERAL (
        SELECT dv.*
        FROM public.doc_versions dv
        WHERE dv.id_documento = d.id_documento
          AND COALESCE(dv.estado, 'INACTIVO') = 'VIGENTE'
        ORDER BY dv.numero_version DESC, dv.id_version DESC
        LIMIT 1
    ) v ON TRUE
    WHERE d.id_documento = ANY(p_ids_documentos);
$$;

CREATE OR REPLACE FUNCTION public.fn_obtener_publicacion_documentos(
    p_ids_documentos bigint[]
)
RETURNS TABLE(id_documento bigint, publicado boolean)
LANGUAGE sql
STABLE
AS $$
    SELECT
        d.id_documento,
        EXISTS (
            SELECT 1
            FROM public.doc_versions v
            WHERE v.id_documento = d.id_documento
              AND COALESCE(v.estado, 'INACTIVO') <> 'ELIMINADO'
              AND COALESCE(v.publicado, FALSE)
        )
    FROM public.docs d
    WHERE d.id_documento = ANY(p_ids_documentos);
$$;

CREATE OR REPLACE FUNCTION public.fn_obtener_versionamiento_documentos(
    p_ids_documentos bigint[]
)
RETURNS TABLE(id_documento bigint, tiene_versionamiento boolean)
LANGUAGE sql
STABLE
AS $$
    SELECT
        d.id_documento,
        COUNT(v.id_version) >= 2
    FROM public.docs d
    LEFT JOIN public.doc_versions v
        ON v.id_documento = d.id_documento
       AND COALESCE(v.estado, 'INACTIVO') <> 'ELIMINADO'
    WHERE d.id_documento = ANY(p_ids_documentos)
    GROUP BY d.id_documento;
$$;

CREATE OR REPLACE PROCEDURE public.sp_sincronizar_versionamiento_documento(
    p_id_documento bigint
)
LANGUAGE sql
AS $$
    UPDATE public.docs d
    SET tiene_versionamiento = (
        SELECT COUNT(*) >= 2
        FROM public.doc_versions v
        WHERE v.id_documento = d.id_documento
          AND COALESCE(v.estado, 'INACTIVO') <> 'ELIMINADO'
    )
    WHERE d.id_documento = p_id_documento;
$$;

CREATE OR REPLACE FUNCTION public.fn_listar_papelera_documentos(
    p_busqueda text,
    p_anio integer
)
RETURNS TABLE(
    tipo_item text,
    id_documento bigint,
    id_version bigint,
    titulo text,
    numero_version integer,
    archivo_nombre text,
    anio integer,
    fecha_eliminacion timestamp with time zone,
    motivo_eliminacion text
)
LANGUAGE sql
STABLE
AS $$
    WITH papelera (
        tipo_item, id_documento, id_version, titulo, numero_version,
        archivo_nombre, anio, fecha_eliminacion, motivo_eliminacion
    ) AS (
        SELECT
            'DOCUMENTO'::text, d.id_documento, NULL::bigint, d.titulo,
            NULL::integer, NULL::text,
            EXTRACT(YEAR FROM (
                SELECT MAX(v.fecha_aprobacion)
                FROM public.doc_versions v
                WHERE v.id_documento = d.id_documento
            ))::integer,
            d.fecha_eliminacion, d.motivo_eliminacion
        FROM public.docs d
        WHERE d.fecha_eliminacion IS NOT NULL

        UNION ALL

        SELECT
            'VERSION'::text, d.id_documento, v.id_version, d.titulo,
            v.numero_version, v.archivo_nombre,
            EXTRACT(YEAR FROM v.fecha_aprobacion)::integer,
            v.fecha_eliminacion, v.motivo_eliminacion
        FROM public.docs d
        JOIN public.doc_versions v ON v.id_documento = d.id_documento
        WHERE COALESCE(v.estado, 'INACTIVO') = 'ELIMINADO'
    )
    SELECT *
    FROM papelera
    WHERE (
        COALESCE(p_busqueda, '') = ''
        OR titulo ILIKE '%' || p_busqueda || '%'
        OR COALESCE(archivo_nombre, '') ILIKE '%' || p_busqueda || '%'
    )
      AND (p_anio IS NULL OR anio = p_anio)
    ORDER BY titulo, CASE tipo_item WHEN 'DOCUMENTO' THEN 0 ELSE 1 END,
             numero_version NULLS FIRST;
$$;

CREATE OR REPLACE FUNCTION public.fn_obtener_fecha_aprobacion_version(
    p_id_documento bigint,
    p_id_version bigint
)
RETURNS timestamp with time zone
LANGUAGE sql
STABLE
AS $$
    SELECT v.fecha_aprobacion
    FROM public.doc_versions v
    WHERE v.id_documento = p_id_documento
      AND v.id_version = p_id_version;
$$;

CREATE OR REPLACE PROCEDURE public.sp_actualizar_estado_ia_version(
    p_id_documento bigint,
    p_id_version bigint,
    p_estado text,
    p_porcentaje_texto numeric,
    p_mensaje text
)
LANGUAGE sql
AS $$
    UPDATE public.doc_versions
    SET estado_ia = p_estado,
        porcentaje_texto_ia = p_porcentaje_texto,
        mensaje_ia = p_mensaje,
        fecha_analisis_ia = CURRENT_TIMESTAMP
    WHERE id_documento = p_id_documento
      AND id_version = p_id_version;
$$;

CREATE OR REPLACE FUNCTION public.fn_reservar_reintento_ia(
    p_id_documento bigint,
    p_id_version bigint,
    p_estado_pendiente text,
    p_mensaje text,
    p_estado_leido text,
    p_espera_segundos integer
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE public.doc_versions
    SET estado_ia = p_estado_pendiente,
        porcentaje_texto_ia = NULL,
        mensaje_ia = p_mensaje,
        fecha_analisis_ia = CURRENT_TIMESTAMP
    WHERE id_documento = p_id_documento
      AND id_version = p_id_version
      AND estado_ia <> p_estado_leido
      AND (
            estado_ia <> p_estado_pendiente
            OR fecha_analisis_ia IS NULL
            OR fecha_analisis_ia < CURRENT_TIMESTAMP
                - (p_espera_segundos * INTERVAL '1 second')
      );
    RETURN FOUND;
END;
$$;
