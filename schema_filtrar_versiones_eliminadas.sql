CREATE OR REPLACE FUNCTION public.fn_obtener_versiones_documento(p_id_documento bigint)
RETURNS TABLE(
    id_version bigint,
    id_documento bigint,
    numero_version integer,
    archivo_nombre text,
    archivo_path text,
    fecha_subida timestamp with time zone,
    fecha_aprobacion timestamp with time zone,
    estado text,
    vigente boolean
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        v.id_version,
        v.id_documento,
        v.numero_version,
        v.archivo_nombre,
        v.archivo_path,
        v.fecha_subida,
        v.fecha_aprobacion,
        COALESCE(v.estado, 'INACTIVO')::text AS estado,
        (COALESCE(v.estado, 'INACTIVO') = 'VIGENTE') AS vigente
    FROM doc_versions v
    JOIN docs d
        ON d.id_documento = v.id_documento
    WHERE v.id_documento = p_id_documento
      AND COALESCE(v.estado, 'INACTIVO') <> 'ELIMINADO'
    ORDER BY v.numero_version DESC;
END;
$$;
