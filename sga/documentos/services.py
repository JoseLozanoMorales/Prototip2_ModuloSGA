"""Operaciones de negocio del módulo documental.

Esta capa no conoce ``request``, mensajes ni plantillas. Las vistas le entregan
datos ya validados y los servicios coordinan cambios atómicos con el ORM.
"""

from datetime import datetime, time, timedelta
from uuid import uuid4

from django.db import transaction
from django.db.models import Max, Q
from django.utils import timezone

from .models import AccesoDocumento, Documento, LecturaDocumento, VersionDocumento


def registrar_lectura_documento(id_documento, id_version, usuario):
    """Registra cada apertura del visor realizada por un usuario lector."""
    return LecturaDocumento.objects.create(
        documento_id=id_documento,
        version_id=id_version,
        id_usuario_externo=usuario.get("id_usuario_externo"),
        nombre_usuario=usuario.get("nombre_usuario"),
        accion="LECTURA",
    )


def _fecha_aprobacion_datetime(valor):
    if isinstance(valor, datetime):
        return valor
    fecha = datetime.combine(valor, time.min)
    return timezone.make_aware(fecha, timezone.get_current_timezone())


def validar_titulo_unico(titulo, id_documento=None):
    documentos = Documento.objects.visibles().filter(titulo__iexact=titulo.strip())
    if id_documento is not None:
        documentos = documentos.exclude(pk=id_documento)
    if documentos.exists():
        raise ValueError("Ya existe un documento con ese título.")


def actualizar_tipo_documento(id_documento, tipo):
    Documento.objects.filter(pk=id_documento).update(tipo=tipo)


@transaction.atomic
def crear_documento(
    titulo, descripcion, palabras_clave, fecha_aprobacion, datos_archivo,
    id_usuario_externo,
):
    ahora = timezone.now()
    documento = Documento.objects.create(
        titulo=titulo,
        descripcion=descripcion,
        palabras_clave=palabras_clave,
        creado_por=id_usuario_externo,
        fecha_creacion=ahora,
        uuid_documento=uuid4(),
    )
    version = VersionDocumento.objects.create(
        documento=documento,
        numero_version=1,
        archivo_nombre=datos_archivo["archivo_nombre"],
        archivo_path=datos_archivo["archivo_path"],
        archivo_tipo=datos_archivo["archivo_tipo"],
        archivo_tamano=datos_archivo["archivo_tamano"],
        descripcion_cambio="Version inicial",
        mensaje_auditoria="Version inicial del documento",
        fecha_subida=ahora,
        subido_por=id_usuario_externo,
        fecha_aprobacion=_fecha_aprobacion_datetime(fecha_aprobacion),
        uuid_version=uuid4(),
        estado="VIGENTE",
    )
    documento.version_vigente = version
    documento.actualizado_por = id_usuario_externo
    documento.fecha_actualizacion = ahora
    documento.save(
        update_fields=["version_vigente", "actualizado_por", "fecha_actualizacion"]
    )
    return documento.id_documento


@transaction.atomic
def editar_documento(
    id_documento, titulo, descripcion, palabras_clave, fecha_aprobacion,
    id_version, id_usuario_externo,
):
    documento = Documento.objects.select_for_update().get(pk=id_documento)
    version = VersionDocumento.objects.select_for_update().get(
        documento_id=id_documento, pk=id_version
    )
    documento.titulo = titulo
    documento.descripcion = descripcion
    documento.palabras_clave = palabras_clave
    documento.version_vigente = version
    documento.actualizado_por = id_usuario_externo
    documento.fecha_actualizacion = timezone.now()
    documento.save(
        update_fields=[
            "titulo", "descripcion", "palabras_clave", "version_vigente",
            "actualizado_por", "fecha_actualizacion",
        ]
    )
    version.fecha_aprobacion = _fecha_aprobacion_datetime(fecha_aprobacion)
    version.save(update_fields=["fecha_aprobacion"])
    AccesoDocumento.objects.filter(documento_id=id_documento).delete()


def cambiar_estado_version(id_documento, id_version, estado):
    if estado not in {"VIGENTE", "INACTIVO", "ELIMINADO"}:
        raise ValueError(f"Estado de versión no válido: {estado}")
    VersionDocumento.objects.filter(
        documento_id=id_documento, pk=id_version
    ).update(estado=estado)


@transaction.atomic
def agregar_version(
    id_documento, datos_archivo, descripcion_cambio, fecha_aprobacion,
    id_usuario_externo,
):
    documento = Documento.objects.select_for_update().get(pk=id_documento)
    numero = (
        VersionDocumento.objects.filter(documento_id=id_documento)
        .aggregate(maximo=Max("numero_version"))["maximo"]
        or 0
    ) + 1
    VersionDocumento.objects.filter(
        documento_id=id_documento, estado="VIGENTE"
    ).update(estado="INACTIVO")
    ahora = timezone.now()
    version = VersionDocumento.objects.create(
        documento=documento,
        numero_version=numero,
        archivo_nombre=datos_archivo["archivo_nombre"],
        archivo_path=datos_archivo["archivo_path"],
        archivo_tipo=datos_archivo["archivo_tipo"],
        archivo_tamano=datos_archivo["archivo_tamano"],
        descripcion_cambio=descripcion_cambio,
        mensaje_auditoria=descripcion_cambio,
        fecha_subida=ahora,
        subido_por=id_usuario_externo,
        fecha_aprobacion=_fecha_aprobacion_datetime(fecha_aprobacion),
        uuid_version=uuid4(),
        estado="VIGENTE",
    )
    documento.version_vigente = version
    documento.actualizado_por = id_usuario_externo
    documento.fecha_actualizacion = ahora
    documento.save(
        update_fields=["version_vigente", "actualizado_por", "fecha_actualizacion"]
    )
    sincronizar_versionamiento(id_documento)
    return version.id_version


def reemplazar_archivo_version(
    id_documento, id_version, datos_archivo, id_usuario_externo,
):
    VersionDocumento.objects.filter(
        documento_id=id_documento, pk=id_version
    ).update(
        archivo_nombre=datos_archivo["archivo_nombre"],
        archivo_path=datos_archivo["archivo_path"],
        archivo_tipo=datos_archivo["archivo_tipo"],
        archivo_tamano=datos_archivo["archivo_tamano"],
        descripcion_cambio="Archivo reemplazado desde Django",
        fecha_subida=timezone.now(),
        subido_por=id_usuario_externo,
    )


def sincronizar_versionamiento(id_documento):
    total = VersionDocumento.objects.activas().filter(
        documento_id=id_documento
    ).count()
    Documento.objects.filter(pk=id_documento).update(tiene_versionamiento=total >= 2)


def actualizar_estado_ia(
    id_documento, id_version, estado, porcentaje_texto=None, mensaje="",
):
    VersionDocumento.objects.filter(
        documento_id=id_documento, pk=id_version
    ).update(
        estado_ia=estado,
        porcentaje_texto_ia=porcentaje_texto,
        mensaje_ia=mensaje,
        fecha_analisis_ia=timezone.now(),
    )


def reservar_reintento_ia(
    id_documento, id_version, estado_pendiente, mensaje, estado_leido,
    espera_segundos,
):
    limite = timezone.now() - timedelta(seconds=espera_segundos)
    return bool(
        VersionDocumento.objects.filter(
            documento_id=id_documento, pk=id_version
        )
        .exclude(estado_ia=estado_leido)
        .filter(
            ~Q(estado_ia=estado_pendiente)
            | Q(fecha_analisis_ia__isnull=True)
            | Q(fecha_analisis_ia__lt=limite)
        )
        .update(
            estado_ia=estado_pendiente,
            porcentaje_texto_ia=None,
            mensaje_ia=mensaje,
            fecha_analisis_ia=timezone.now(),
        )
    )


def reemplazar_accesos_documento(id_documento, accesos, id_usuario_externo):
    """Reemplaza todas las combinaciones de acceso en una sola transacción."""
    AccesoDocumento.objects.filter(documento_id=id_documento).delete()
    AccesoDocumento.objects.bulk_create(
        [
            AccesoDocumento(
                documento_id=id_documento,
                id_perfil_externo=perfil,
                id_grupo_externo=grupo,
                id_tipo_periodo_externo=periodo,
                asignado_por=id_usuario_externo,
                fecha_asignacion=timezone.now(),
            )
            for perfil, grupo, periodo in accesos
        ]
    )


@transaction.atomic
def guardar_publicacion_versiones(id_documento, ids_publicados, id_usuario_externo):
    versiones = VersionDocumento.objects.select_for_update().activas().filter(
        documento_id=id_documento
    )
    versiones.update(publicado=False)

    if ids_publicados:
        seleccionadas = versiones.filter(pk__in=ids_publicados)
        seleccionadas.update(publicado=True)
        id_version_vigente = seleccionadas.order_by(
            "-numero_version", "-id_version"
        ).values_list("id_version", flat=True).first()
        versiones.update(estado="INACTIVO")
        versiones.filter(pk=id_version_vigente).update(estado="VIGENTE")
        Documento.objects.filter(pk=id_documento).update(
            version_vigente_id=id_version_vigente
        )

    Documento.objects.filter(pk=id_documento).update(
        actualizado_por=id_usuario_externo,
        fecha_actualizacion=timezone.now(),
    )


def retirar_vigencia_documento(id_documento):
    Documento.objects.filter(pk=id_documento).update(version_vigente=None)
    VersionDocumento.objects.filter(
        documento_id=id_documento, estado="VIGENTE"
    ).update(estado="INACTIVO")


def preparar_eliminacion_version(id_documento, id_version):
    """Bloquea y valida las versiones antes de ejecutar la baja heredada."""
    ids_versiones = set(
        VersionDocumento.objects.select_for_update()
        .activas()
        .filter(documento_id=id_documento)
        .values_list("id_version", flat=True)
    )
    if id_version not in ids_versiones:
        raise ValueError("La versión seleccionada no pertenece al documento.")
    if len(ids_versiones) <= 1:
        raise ValueError(
            "No se puede eliminar la única versión del documento. "
            "Para enviarlo a la papelera, elimine el documento completo."
        )
    Documento.objects.filter(
        pk=id_documento, version_vigente_id=id_version
    ).update(version_vigente=None)
    VersionDocumento.objects.filter(
        documento_id=id_documento, pk=id_version, estado="VIGENTE"
    ).update(estado="INACTIVO")


@transaction.atomic
def eliminar_documento_logicamente(
    id_documento, motivo, id_usuario_externo,
):
    ahora = timezone.now()
    Documento.objects.select_for_update().get(pk=id_documento)
    retirar_vigencia_documento(id_documento)
    VersionDocumento.objects.activas().filter(documento_id=id_documento).update(
        estado="ELIMINADO",
        eliminado_por=id_usuario_externo,
        fecha_eliminacion=ahora,
        motivo_eliminacion=motivo,
    )
    Documento.objects.filter(pk=id_documento).update(
        eliminado_por=id_usuario_externo,
        fecha_eliminacion=ahora,
        motivo_eliminacion=motivo,
        actualizado_por=id_usuario_externo,
        fecha_actualizacion=ahora,
    )
    sincronizar_versionamiento(id_documento)


@transaction.atomic
def eliminar_version_logicamente(
    id_documento, id_version, motivo, id_usuario_externo,
):
    preparar_eliminacion_version(id_documento, id_version)
    ahora = timezone.now()
    VersionDocumento.objects.filter(
        documento_id=id_documento, pk=id_version
    ).update(
        estado="ELIMINADO",
        eliminado_por=id_usuario_externo,
        fecha_eliminacion=ahora,
        motivo_eliminacion=motivo,
    )
    Documento.objects.filter(pk=id_documento).update(
        actualizado_por=id_usuario_externo,
        fecha_actualizacion=ahora,
    )
    sincronizar_versionamiento(id_documento)


@transaction.atomic
def restaurar_documento_logicamente(id_documento, id_usuario_externo):
    documento = Documento.objects.select_for_update().get(pk=id_documento)
    versiones = VersionDocumento.objects.filter(
        documento_id=id_documento, estado="ELIMINADO"
    )
    versiones.update(
        estado="INACTIVO",
        eliminado_por=None,
        fecha_eliminacion=None,
        motivo_eliminacion=None,
    )
    if documento.version_vigente_id:
        VersionDocumento.objects.filter(
            documento_id=id_documento, pk=documento.version_vigente_id
        ).update(estado="VIGENTE")
    documento.eliminado_por = None
    documento.fecha_eliminacion = None
    documento.motivo_eliminacion = None
    documento.actualizado_por = id_usuario_externo
    documento.fecha_actualizacion = timezone.now()
    documento.save(
        update_fields=[
            "eliminado_por", "fecha_eliminacion", "motivo_eliminacion",
            "actualizado_por", "fecha_actualizacion",
        ]
    )
    sincronizar_versionamiento(id_documento)


@transaction.atomic
def restaurar_version_logicamente(id_documento, id_version):
    documento = Documento.objects.select_for_update().get(pk=id_documento)
    estado = "VIGENTE" if documento.version_vigente_id == id_version else "INACTIVO"
    VersionDocumento.objects.filter(
        documento_id=id_documento, pk=id_version, estado="ELIMINADO"
    ).update(
        estado=estado,
        eliminado_por=None,
        fecha_eliminacion=None,
        motivo_eliminacion=None,
    )
    Documento.objects.filter(pk=id_documento).update(
        fecha_eliminacion=None, motivo_eliminacion=None
    )
    sincronizar_versionamiento(id_documento)


@transaction.atomic
def restaurar_versiones_logicamente(id_documento, ids_versiones):
    ids_versiones = list(dict.fromkeys(ids_versiones))
    if not ids_versiones:
        raise ValueError("Seleccione al menos una versión para restaurar.")
    versiones = list(
        VersionDocumento.objects.select_for_update().filter(
            documento_id=id_documento, pk__in=ids_versiones
        )
    )
    if len(versiones) != len(ids_versiones):
        raise ValueError("Una o más versiones no pertenecen al documento.")
    if any(version.estado != "ELIMINADO" for version in versiones):
        raise ValueError("Solo se pueden restaurar versiones que estén en la papelera.")
    documento = Documento.objects.select_for_update().get(pk=id_documento)
    for version in versiones:
        version.estado = (
            "VIGENTE" if documento.version_vigente_id == version.id_version
            else "INACTIVO"
        )
        version.eliminado_por = None
        version.fecha_eliminacion = None
        version.motivo_eliminacion = None
    VersionDocumento.objects.bulk_update(
        versiones,
        ["estado", "eliminado_por", "fecha_eliminacion", "motivo_eliminacion"],
    )
    documento.fecha_eliminacion = None
    documento.motivo_eliminacion = None
    documento.save(update_fields=["fecha_eliminacion", "motivo_eliminacion"])
    sincronizar_versionamiento(id_documento)
