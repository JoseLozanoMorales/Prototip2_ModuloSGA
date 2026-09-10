from importlib import import_module

from django.db import migrations, models


CREAR_ACCESOS_LECTORES = """
CREATE TABLE IF NOT EXISTS public.modulo_lectores_acceso (
    id_acceso_lector bigserial PRIMARY KEY,
    id_usuario_externo bigint NOT NULL,
    id_perfil_externo bigint NULL,
    id_grupo_externo bigint NULL,
    id_tipo_periodo_externo bigint NULL,
    activo boolean NOT NULL DEFAULT TRUE,
    asignado_por bigint NULL,
    fecha_asignacion timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_modulo_lectores_acceso_usuario
    ON public.modulo_lectores_acceso (id_usuario_externo)
    WHERE activo;

CREATE OR REPLACE FUNCTION public.fn_acceso_lector_coincide(
    p_id_usuario_externo bigint,
    p_id_perfil_externo bigint,
    p_id_grupo_externo bigint,
    p_id_tipo_periodo_externo bigint,
    p_acceso_perfil bigint,
    p_acceso_grupo bigint,
    p_acceso_periodo bigint
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT CASE
        WHEN EXISTS (
            SELECT 1
            FROM public.modulo_lectores_acceso l
            WHERE l.id_usuario_externo = p_id_usuario_externo
              AND COALESCE(l.activo, TRUE)
        ) THEN EXISTS (
            SELECT 1
            FROM public.modulo_lectores_acceso l
            WHERE l.id_usuario_externo = p_id_usuario_externo
              AND COALESCE(l.activo, TRUE)
              AND (l.id_perfil_externo IS NULL OR p_acceso_perfil IS NULL
                   OR l.id_perfil_externo = p_acceso_perfil)
              AND (l.id_grupo_externo IS NULL OR p_acceso_grupo IS NULL
                   OR l.id_grupo_externo = p_acceso_grupo)
              AND (l.id_tipo_periodo_externo IS NULL OR p_acceso_periodo IS NULL
                   OR l.id_tipo_periodo_externo = p_acceso_periodo)
        )
        ELSE
            (p_acceso_perfil IS NULL OR p_acceso_perfil = p_id_perfil_externo)
            AND (p_acceso_grupo IS NULL OR p_acceso_grupo = p_id_grupo_externo)
            AND (p_acceso_periodo IS NULL OR p_acceso_periodo = p_id_tipo_periodo_externo)
    END;
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
    id_documento bigint, titulo text, descripcion text, palabras_clave text,
    estado text, fecha_aprobacion text, fecha_creacion timestamp with time zone,
    id_version_vigente bigint, id_perfil_externo bigint,
    id_grupo_externo bigint, id_tipo_periodo_externo bigint,
    numero_version_vigente integer, anio integer, publicado boolean
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
            SELECT TRUE AS publicado FROM public.doc_versions vp
            WHERE vp.id_documento = d.id_documento
              AND COALESCE(vp.estado, 'BORRADOR') <> 'ELIMINADO'
              AND COALESCE(vp.publicado, FALSE) LIMIT 1
        ) pub ON TRUE
        LEFT JOIN LATERAL (
            SELECT a.id_perfil_externo, a.id_grupo_externo, a.id_tipo_periodo_externo
            FROM public.documento_acceso a
            WHERE a.id_documento = d.id_documento AND COALESCE(a.activo, TRUE)
            LIMIT 1
        ) acc ON TRUE
        WHERE COALESCE(v.estado, 'BORRADOR') <> 'ELIMINADO'
          AND (COALESCE(p_busqueda, '') = '' OR d.titulo ILIKE '%%' || p_busqueda || '%%'
               OR COALESCE(d.descripcion, '') ILIKE '%%' || p_busqueda || '%%'
               OR COALESCE(d.palabras_clave, '') ILIKE '%%' || p_busqueda || '%%')
          AND (p_anio IS NULL OR EXTRACT(YEAR FROM COALESCE(v.fecha_aprobacion, d.fecha_creacion))::integer = p_anio)
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
            SELECT pv.* FROM public.doc_versions pv
            WHERE pv.id_documento = d.id_documento
              AND COALESCE(pv.estado, 'BORRADOR') <> 'ELIMINADO'
              AND COALESCE(pv.publicado, FALSE)
            ORDER BY CASE WHEN COALESCE(pv.estado, 'BORRADOR') = 'VIGENTE' THEN 0 ELSE 1 END,
                     pv.numero_version DESC, pv.id_version DESC
            LIMIT 1
        ) v ON TRUE
        JOIN public.documento_acceso da
          ON da.id_documento = d.id_documento AND COALESCE(da.activo, TRUE)
        LEFT JOIN LATERAL (
            SELECT a.id_perfil_externo, a.id_grupo_externo, a.id_tipo_periodo_externo
            FROM public.documento_acceso a
            WHERE a.id_documento = d.id_documento AND COALESCE(a.activo, TRUE)
              AND public.fn_acceso_lector_coincide(
                  p_id_usuario_externo, p_id_perfil_externo, p_id_grupo_externo,
                  p_id_tipo_periodo_externo, a.id_perfil_externo,
                  a.id_grupo_externo, a.id_tipo_periodo_externo)
            LIMIT 1
        ) acc ON TRUE
        WHERE public.fn_acceso_lector_coincide(
                  p_id_usuario_externo, p_id_perfil_externo, p_id_grupo_externo,
                  p_id_tipo_periodo_externo, da.id_perfil_externo,
                  da.id_grupo_externo, da.id_tipo_periodo_externo)
          AND (COALESCE(p_busqueda, '') = '' OR d.titulo ILIKE '%%' || p_busqueda || '%%'
               OR COALESCE(d.descripcion, '') ILIKE '%%' || p_busqueda || '%%'
               OR COALESCE(d.palabras_clave, '') ILIKE '%%' || p_busqueda || '%%')
          AND (p_anio IS NULL OR EXTRACT(YEAR FROM v.fecha_aprobacion)::integer = p_anio)
        ORDER BY d.fecha_creacion DESC, d.id_documento DESC;
    END IF;
END;
$$;
"""


ELIMINAR_ACCESOS_LECTORES = """
DROP FUNCTION IF EXISTS public.fn_acceso_lector_coincide(
    bigint, bigint, bigint, bigint, bigint, bigint, bigint
);
DROP INDEX IF EXISTS public.idx_modulo_lectores_acceso_usuario;
DROP TABLE IF EXISTS public.modulo_lectores_acceso;
"""


def crear_accesos_lectores(apps, schema_editor):
    if schema_editor.connection.vendor == "postgresql":
        schema_editor.execute(CREAR_ACCESOS_LECTORES)


def eliminar_accesos_lectores(apps, schema_editor):
    if schema_editor.connection.vendor == "postgresql":
        funciones_anteriores = import_module(
            "sga.documentos.migrations.0002_funciones_consulta"
        )
        schema_editor.execute(funciones_anteriores.CREAR_FUNCIONES)
        schema_editor.execute(ELIMINAR_ACCESOS_LECTORES)


class Migration(migrations.Migration):
    dependencies = [("documentos", "0002_funciones_consulta")]
    operations = [
        migrations.CreateModel(
            name="AccesoLectorModulo",
            fields=[
                ("id_acceso_lector", models.BigAutoField(primary_key=True, serialize=False)),
                ("id_usuario_externo", models.BigIntegerField()),
                ("id_perfil_externo", models.BigIntegerField(blank=True, null=True)),
                ("id_grupo_externo", models.BigIntegerField(blank=True, null=True)),
                ("id_tipo_periodo_externo", models.BigIntegerField(blank=True, null=True)),
                ("activo", models.BooleanField(default=True)),
                ("asignado_por", models.BigIntegerField(blank=True, null=True)),
                ("fecha_asignacion", models.DateTimeField()),
            ],
            options={"db_table": "modulo_lectores_acceso", "managed": False},
        ),
        migrations.RunPython(crear_accesos_lectores, eliminar_accesos_lectores),
    ]
