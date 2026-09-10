from django.db import migrations


CREAR_FUNCIONES = """
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
    p_id_usuario_externo bigint,
    p_id_perfil_externo bigint,
    p_id_grupo_externo bigint,
    p_id_tipo_periodo_externo bigint,
    p_busqueda text DEFAULT '',
    p_anio integer DEFAULT NULL
)
RETURNS TABLE(
    id_documento bigint,
    titulo text,
    descripcion text,
    palabras_clave text,
    estado text,
    fecha_aprobacion text,
    fecha_creacion timestamp with time zone,
    id_version_vigente bigint,
    id_perfil_externo bigint,
    id_grupo_externo bigint,
    id_tipo_periodo_externo bigint,
    numero_version_vigente integer,
    anio integer,
    publicado boolean
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    IF public.fn_usuario_es_editor(p_id_usuario_externo) THEN
        RETURN QUERY
        SELECT
            d.id_documento, d.titulo, d.descripcion, d.palabras_clave,
            COALESCE(v.estado, 'BORRADOR')::text,
            TO_CHAR(v.fecha_aprobacion::date, 'YYYY-MM-DD'), d.fecha_creacion,
            d.id_version_vigente, acc.id_perfil_externo, acc.id_grupo_externo,
            acc.id_tipo_periodo_externo, v.numero_version,
            EXTRACT(YEAR FROM COALESCE(v.fecha_aprobacion, d.fecha_creacion))::integer,
            COALESCE(pub.publicado, FALSE)
        FROM public.docs d
        LEFT JOIN public.doc_versions v ON v.id_version = d.id_version_vigente
        LEFT JOIN LATERAL (
            SELECT TRUE AS publicado
            FROM public.doc_versions vp
            WHERE vp.id_documento = d.id_documento
              AND COALESCE(vp.estado, 'BORRADOR') <> 'ELIMINADO'
              AND COALESCE(vp.publicado, FALSE)
            LIMIT 1
        ) pub ON TRUE
        LEFT JOIN LATERAL (
            SELECT a.id_perfil_externo, a.id_grupo_externo, a.id_tipo_periodo_externo
            FROM public.documento_acceso a
            WHERE a.id_documento = d.id_documento
              AND COALESCE(a.activo, TRUE)
            LIMIT 1
        ) acc ON TRUE
        WHERE COALESCE(v.estado, 'BORRADOR') <> 'ELIMINADO'
          AND (
              COALESCE(p_busqueda, '') = ''
              OR d.titulo ILIKE '%%' || p_busqueda || '%%'
              OR COALESCE(d.descripcion, '') ILIKE '%%' || p_busqueda || '%%'
              OR COALESCE(d.palabras_clave, '') ILIKE '%%' || p_busqueda || '%%'
          )
          AND (
              p_anio IS NULL
              OR EXTRACT(YEAR FROM COALESCE(v.fecha_aprobacion, d.fecha_creacion))::integer = p_anio
          )
        ORDER BY d.fecha_creacion DESC, d.id_documento DESC;
    ELSE
        RETURN QUERY
        SELECT DISTINCT
            d.id_documento, d.titulo, d.descripcion, d.palabras_clave,
            COALESCE(v.estado, 'BORRADOR')::text,
            TO_CHAR(v.fecha_aprobacion::date, 'YYYY-MM-DD'), d.fecha_creacion,
            v.id_version, acc.id_perfil_externo, acc.id_grupo_externo,
            acc.id_tipo_periodo_externo, v.numero_version,
            EXTRACT(YEAR FROM v.fecha_aprobacion)::integer, TRUE
        FROM public.docs d
        JOIN LATERAL (
            SELECT pv.*
            FROM public.doc_versions pv
            WHERE pv.id_documento = d.id_documento
              AND COALESCE(pv.estado, 'BORRADOR') <> 'ELIMINADO'
              AND COALESCE(pv.publicado, FALSE)
            ORDER BY
                CASE WHEN COALESCE(pv.estado, 'BORRADOR') = 'VIGENTE' THEN 0 ELSE 1 END,
                pv.numero_version DESC,
                pv.id_version DESC
            LIMIT 1
        ) v ON TRUE
        JOIN public.documento_acceso da
          ON da.id_documento = d.id_documento AND COALESCE(da.activo, TRUE)
        LEFT JOIN LATERAL (
            SELECT a.id_perfil_externo, a.id_grupo_externo, a.id_tipo_periodo_externo
            FROM public.documento_acceso a
            WHERE a.id_documento = d.id_documento
              AND COALESCE(a.activo, TRUE)
              AND (a.id_perfil_externo IS NULL OR a.id_perfil_externo = p_id_perfil_externo)
              AND (a.id_grupo_externo IS NULL OR a.id_grupo_externo = p_id_grupo_externo)
              AND (a.id_tipo_periodo_externo IS NULL OR a.id_tipo_periodo_externo = p_id_tipo_periodo_externo)
            LIMIT 1
        ) acc ON TRUE
        WHERE (da.id_perfil_externo IS NULL OR da.id_perfil_externo = p_id_perfil_externo)
          AND (da.id_grupo_externo IS NULL OR da.id_grupo_externo = p_id_grupo_externo)
          AND (da.id_tipo_periodo_externo IS NULL OR da.id_tipo_periodo_externo = p_id_tipo_periodo_externo)
          AND (
              COALESCE(p_busqueda, '') = ''
              OR d.titulo ILIKE '%%' || p_busqueda || '%%'
              OR COALESCE(d.descripcion, '') ILIKE '%%' || p_busqueda || '%%'
              OR COALESCE(d.palabras_clave, '') ILIKE '%%' || p_busqueda || '%%'
          )
          AND (p_anio IS NULL OR EXTRACT(YEAR FROM v.fecha_aprobacion)::integer = p_anio)
        ORDER BY d.fecha_creacion DESC, d.id_documento DESC;
    END IF;
END;
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
        WHERE COALESCE(v.estado, 'BORRADOR') = 'ELIMINADO'
    )
    SELECT *
    FROM papelera
    WHERE (
        COALESCE(p_busqueda, '') = ''
        OR titulo ILIKE '%%' || p_busqueda || '%%'
        OR COALESCE(archivo_nombre, '') ILIKE '%%' || p_busqueda || '%%'
    )
      AND (p_anio IS NULL OR anio = p_anio)
    ORDER BY titulo,
             CASE tipo_item WHEN 'DOCUMENTO' THEN 0 ELSE 1 END,
             numero_version NULLS FIRST;
$$;
"""


ELIMINAR_FUNCIONES = """
DROP FUNCTION IF EXISTS public.fn_listar_papelera_documentos(text, integer);
DROP FUNCTION IF EXISTS public.fn_listar_documentos_modulo(
    bigint, bigint, bigint, bigint, text, integer
);
DROP FUNCTION IF EXISTS public.fn_usuario_es_editor(bigint);
"""


def crear_funciones(apps, schema_editor):
    if schema_editor.connection.vendor == "postgresql":
        schema_editor.execute(CREAR_FUNCIONES)


def eliminar_funciones(apps, schema_editor):
    if schema_editor.connection.vendor == "postgresql":
        schema_editor.execute(ELIMINAR_FUNCIONES)


class Migration(migrations.Migration):
    dependencies = [("documentos", "0001_initial")]
    operations = [migrations.RunPython(crear_funciones, eliminar_funciones)]
