"""Consultas de lectura reutilizables del mÃ³dulo documental."""

from .models import (
    AccesoDocumento,
    Documento,
    ESTADO_BORRADOR,
    ESTADO_VIGENTE,
    VersionDocumento,
)


def accesos_de_documentos(ids_documentos):
    return list(
        AccesoDocumento.objects.filter(
            documento_id__in=ids_documentos, activo=True
        ).values(
            "documento_id",
            "id_perfil_externo",
            "id_grupo_externo",
            "id_tipo_periodo_externo",
            "activo",
            "asignado_por",
            "fecha_asignacion",
        )
    )


def accesos_de_documento(id_documento):
    return AccesoDocumento.objects.filter(
        documento_id=id_documento, activo=True
    ).values(
        "id_perfil_externo", "id_grupo_externo", "id_tipo_periodo_externo"
    )


def versiones_activas(id_documento):
    return list(
        VersionDocumento.objects.activas()
        .filter(documento_id=id_documento)
        .values(
            "id_version", "numero_version", "archivo_nombre", "archivo_path",
            "archivo_tipo", "archivo_tamano", "descripcion_cambio",
            "mensaje_auditoria", "fecha_subida", "subido_por",
            "fecha_aprobacion", "uuid_version", "estado", "estado_ia",
            "porcentaje_texto_ia", "mensaje_ia", "fecha_analisis_ia",
            "publicado", "eliminado_por", "fecha_eliminacion",
            "motivo_eliminacion",
        )
    )


def estado_version(id_documento, id_version):
    return (
        VersionDocumento.objects.filter(
            documento_id=id_documento, pk=id_version
        ).values_list("estado", flat=True).first()
        or ""
    )


def contexto_version_chroma(id_documento, id_version=None, vigente=None):
    versiones = VersionDocumento.objects.filter(documento_id=id_documento)
    if id_version is not None:
        versiones = versiones.filter(pk=id_version)
    if vigente is True:
        versiones = versiones.filter(estado=ESTADO_VIGENTE)
    elif vigente is False:
        versiones = versiones.exclude(estado=ESTADO_VIGENTE)
    version = versiones.select_related("documento").order_by(
        "-fecha_subida", "-id_version"
    ).first()
    if not version:
        return {}
    return {
        "id_documento": version.documento_id,
        "id_version": version.id_version,
        "numero_version": version.numero_version,
        "archivo_nombre": version.archivo_nombre,
        "archivo_path": version.archivo_path,
        "estado": version.estado or ESTADO_BORRADOR,
        "uuid_documento": version.documento.uuid_documento,
        "uuid_version": version.uuid_version,
        "fecha_aprobacion": version.fecha_aprobacion,
        "publicado": bool(version.publicado),
    }


def documento_para_accion(id_documento):
    documento = Documento.objects.select_related("version_vigente").filter(
        pk=id_documento
    ).first()
    if not documento:
        return None
    version = documento.version_vigente or (
        VersionDocumento.objects.activas()
        .filter(documento_id=id_documento)
        .order_by("-numero_version", "-id_version")
        .first()
    )
    return {
        "id_documento": documento.id_documento,
        "titulo": documento.titulo,
        "descripcion": documento.descripcion,
        "palabras_clave": documento.palabras_clave,
        "tipo": documento.tipo,
        "estado": (version.estado if version else ESTADO_BORRADOR),
        "fecha_aprobacion": (version.fecha_aprobacion if version else None),
        "id_version_vigente": documento.version_vigente_id,
        "numero_version_vigente": (version.numero_version if version else None),
        "archivo_vigente": (version.archivo_nombre if version else None),
        "publicado": bool(version and version.publicado),
    }


def estados_ia_documentos(ids_documentos):
    """Devuelve la versiÃ³n vigente mÃ¡s reciente de cada documento solicitado."""
    versiones = (
        VersionDocumento.objects.filter(
            documento_id__in=ids_documentos, estado=ESTADO_VIGENTE
        )
        .order_by("documento_id", "-numero_version", "-id_version")
        .values(
            "documento_id", "estado_ia", "porcentaje_texto_ia", "mensaje_ia"
        )
    )
    resultado = {}
    for version in versiones:
        resultado.setdefault(version["documento_id"], version)
    return resultado
