-- Conserva la fecha de aprobación exclusivamente por versión.
-- Ejecute este script una sola vez sobre una base existente, después de los
-- scripts de esquema y antes de desplegar la aplicación actualizada.

BEGIN;

-- Las instalaciones antiguas tienen la fecha en ambas tablas. La de la
-- versión es la fuente de verdad; este respaldo solo cubre datos heredados.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'docs'
          AND column_name = 'fecha_aprobacion'
    ) THEN
        EXECUTE $sql$
            UPDATE public.doc_versions v
            SET fecha_aprobacion = d.fecha_aprobacion
            FROM public.docs d
            WHERE d.id_documento = v.id_documento
              AND v.fecha_aprobacion IS NULL
        $sql$;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.fn_crear_documento_base(
    p_titulo text, p_descripcion text, p_palabras_clave text,
    p_fecha_aprobacion date, p_archivo_nombre text, p_archivo_path text,
    p_archivo_tipo text, p_archivo_tamano bigint, p_id_usuario_externo bigint
)
RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE v_id_documento bigint; v_id_version bigint;
BEGIN
    INSERT INTO public.docs (titulo, descripcion, palabras_clave, creado_por, fecha_creacion)
    VALUES (p_titulo, p_descripcion, p_palabras_clave, p_id_usuario_externo, NOW())
    RETURNING id_documento INTO v_id_documento;

    INSERT INTO public.doc_versions (
        id_documento, numero_version, archivo_nombre, archivo_path,
        archivo_tipo, archivo_tamano, descripcion_cambio, mensaje_auditoria,
        fecha_subida, subido_por, fecha_aprobacion, estado
    ) VALUES (
        v_id_documento, 1, p_archivo_nombre, p_archivo_path, p_archivo_tipo,
        p_archivo_tamano, 'Version inicial', 'Version inicial del documento',
        NOW(), p_id_usuario_externo, p_fecha_aprobacion, 'VIGENTE'
    ) RETURNING id_version INTO v_id_version;

    UPDATE public.docs
    SET id_version_vigente = v_id_version, actualizado_por = p_id_usuario_externo,
        fecha_actualizacion = NOW()
    WHERE id_documento = v_id_documento;
    RETURN v_id_documento;
END;
$$;

CREATE OR REPLACE PROCEDURE public.sp_editar_documento_base(
    IN p_id_documento bigint, IN p_titulo text, IN p_descripcion text,
    IN p_palabras_clave text, IN p_fecha_aprobacion date, IN p_id_version bigint,
    IN p_id_usuario_externo bigint
)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE public.docs
    SET titulo = p_titulo, descripcion = p_descripcion,
        palabras_clave = p_palabras_clave, id_version_vigente = p_id_version,
        actualizado_por = p_id_usuario_externo, fecha_actualizacion = NOW()
    WHERE id_documento = p_id_documento;

    UPDATE public.doc_versions
    SET fecha_aprobacion = p_fecha_aprobacion
    WHERE id_documento = p_id_documento AND id_version = p_id_version;

    DELETE FROM public.documento_acceso WHERE id_documento = p_id_documento;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_usuario_es_editor(
    p_id_usuario_externo bigint
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.modulo_editores e
        WHERE e.id_usuario_externo = p_id_usuario_externo
          AND COALESCE(e.activo, TRUE)
    );
$$;

CREATE OR REPLACE FUNCTION public.fn_listar_documentos_modulo(
    p_id_usuario_externo bigint, p_id_perfil_externo bigint,
    p_id_grupo_externo bigint, p_id_tipo_periodo_externo bigint,
    p_busqueda text DEFAULT '', p_anio integer DEFAULT NULL
)
RETURNS TABLE(
    id_documento bigint, titulo text, descripcion text, palabras_clave text,
    estado text, fecha_aprobacion text, fecha_creacion timestamp with time zone,
    id_version_vigente bigint, id_perfil_externo bigint, id_grupo_externo bigint,
    id_tipo_periodo_externo bigint, numero_version_vigente integer, anio integer,
    publicado boolean
)
LANGUAGE plpgsql AS $$
BEGIN
    IF fn_usuario_es_editor(p_id_usuario_externo) THEN
        RETURN QUERY
        SELECT d.id_documento, d.titulo, d.descripcion, d.palabras_clave,
               COALESCE(v.estado, 'INACTIVO')::text,
               TO_CHAR(v.fecha_aprobacion::date, 'YYYY-MM-DD'), d.fecha_creacion,
               d.id_version_vigente, acc.id_perfil_externo, acc.id_grupo_externo,
               acc.id_tipo_periodo_externo, v.numero_version,
               EXTRACT(YEAR FROM COALESCE(v.fecha_aprobacion, d.fecha_creacion))::int,
               COALESCE(pub.publicado, FALSE)
        FROM public.docs d
        LEFT JOIN public.doc_versions v ON v.id_version = d.id_version_vigente
        LEFT JOIN LATERAL (
            SELECT TRUE AS publicado FROM public.doc_versions vp
            WHERE vp.id_documento = d.id_documento
              AND COALESCE(vp.estado, 'INACTIVO') <> 'ELIMINADO'
              AND COALESCE(vp.publicado, FALSE) LIMIT 1
        ) pub ON TRUE
        LEFT JOIN LATERAL (
            SELECT a.id_perfil_externo, a.id_grupo_externo, a.id_tipo_periodo_externo
            FROM public.documento_acceso a WHERE a.id_documento = d.id_documento
              AND COALESCE(a.activo, TRUE) LIMIT 1
        ) acc ON TRUE
        WHERE COALESCE(v.estado, 'INACTIVO') <> 'ELIMINADO'
          AND (COALESCE(p_busqueda, '') = '' OR d.titulo ILIKE '%' || p_busqueda || '%'
               OR COALESCE(d.descripcion, '') ILIKE '%' || p_busqueda || '%'
               OR COALESCE(d.palabras_clave, '') ILIKE '%' || p_busqueda || '%')
          AND (p_anio IS NULL OR EXTRACT(YEAR FROM COALESCE(v.fecha_aprobacion, d.fecha_creacion))::int = p_anio)
        ORDER BY d.fecha_creacion DESC, d.id_documento DESC;
    ELSE
        RETURN QUERY
        SELECT DISTINCT d.id_documento, d.titulo, d.descripcion, d.palabras_clave,
               COALESCE(v.estado, 'INACTIVO')::text,
               TO_CHAR(v.fecha_aprobacion::date, 'YYYY-MM-DD'), d.fecha_creacion,
               v.id_version, acc.id_perfil_externo, acc.id_grupo_externo,
               acc.id_tipo_periodo_externo, v.numero_version,
               EXTRACT(YEAR FROM v.fecha_aprobacion)::int, TRUE
        FROM public.docs d
        JOIN LATERAL (
            SELECT pv.* FROM public.doc_versions pv
            WHERE pv.id_documento = d.id_documento
              AND COALESCE(pv.estado, 'INACTIVO') <> 'ELIMINADO'
              AND COALESCE(pv.publicado, FALSE)
            ORDER BY CASE WHEN COALESCE(pv.estado, 'INACTIVO') = 'VIGENTE' THEN 0 ELSE 1 END,
                     pv.numero_version DESC, pv.id_version DESC LIMIT 1
        ) v ON TRUE
        JOIN public.documento_acceso da ON da.id_documento = d.id_documento
            AND COALESCE(da.activo, TRUE)
        LEFT JOIN LATERAL (
            SELECT a.id_perfil_externo, a.id_grupo_externo, a.id_tipo_periodo_externo
            FROM public.documento_acceso a WHERE a.id_documento = d.id_documento
              AND COALESCE(a.activo, TRUE)
              AND (a.id_perfil_externo IS NULL OR a.id_perfil_externo = p_id_perfil_externo)
              AND (a.id_grupo_externo IS NULL OR a.id_grupo_externo = p_id_grupo_externo)
              AND (a.id_tipo_periodo_externo IS NULL OR a.id_tipo_periodo_externo = p_id_tipo_periodo_externo)
            LIMIT 1
        ) acc ON TRUE
        WHERE (da.id_perfil_externo IS NULL OR da.id_perfil_externo = p_id_perfil_externo)
          AND (da.id_grupo_externo IS NULL OR da.id_grupo_externo = p_id_grupo_externo)
          AND (da.id_tipo_periodo_externo IS NULL OR da.id_tipo_periodo_externo = p_id_tipo_periodo_externo)
          AND (COALESCE(p_busqueda, '') = '' OR d.titulo ILIKE '%' || p_busqueda || '%'
               OR COALESCE(d.descripcion, '') ILIKE '%' || p_busqueda || '%'
               OR COALESCE(d.palabras_clave, '') ILIKE '%' || p_busqueda || '%')
          AND (p_anio IS NULL OR EXTRACT(YEAR FROM v.fecha_aprobacion)::int = p_anio)
        ORDER BY d.fecha_creacion DESC, d.id_documento DESC;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_obtener_documento_para_accion(p_id_documento bigint)
RETURNS TABLE(
    id_documento bigint, titulo text, descripcion text, palabras_clave text,
    estado text, fecha_aprobacion timestamp with time zone, id_version_vigente bigint,
    numero_version_vigente integer, archivo_vigente text, publicado boolean
)
LANGUAGE sql STABLE ROWS 1 AS $$
    SELECT d.id_documento, d.titulo, d.descripcion, d.palabras_clave,
           COALESCE(v.estado, 'INACTIVO')::text, v.fecha_aprobacion,
           d.id_version_vigente, v.numero_version, v.archivo_nombre,
           COALESCE(v.publicado, FALSE)
    FROM public.docs d
    LEFT JOIN public.doc_versions v ON v.id_version = d.id_version_vigente
    WHERE d.id_documento = p_id_documento;
$$;

CREATE OR REPLACE FUNCTION public.fn_listar_papelera_documentos(
    p_busqueda text,
    p_anio integer
)
RETURNS TABLE(
    tipo_item text, id_documento bigint, id_version bigint, titulo text,
    numero_version integer, archivo_nombre text, anio integer,
    fecha_eliminacion timestamp with time zone, motivo_eliminacion text
)
LANGUAGE sql STABLE AS $$
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

ALTER TABLE public.docs DROP COLUMN IF EXISTS fecha_aprobacion;

COMMIT;
