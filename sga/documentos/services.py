"""Operaciones de negocio del módulo documental.

Esta capa no conoce ``request``, mensajes ni plantillas. Las vistas le entregan
datos ya validados y los servicios coordinan cambios atómicos con el ORM.
"""

from datetime import datetime, time, timedelta
from uuid import uuid4

from django.db import transaction
from django.contrib.admin.models import ADDITION, CHANGE
from django.db.models import Max, Q
from django.utils import timezone

from .models import AccesoDocumento, Documento, LecturaDocumento, VersionDocumento
from .audit import _registrar_auditoria_django_pruebas, _registrar_historial_eliminacion


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
    version = VersionDocumento.objects.select_for_update().activas().get(
        documento_id=id_documento, pk=id_version
    )
    documento.titulo = titulo
    documento.descripcion = descripcion
    documento.palabras_clave = palabras_clave
    documento.actualizado_por = id_usuario_externo
    documento.fecha_actualizacion = timezone.now()
    documento.save(
        update_fields=[
            "titulo", "descripcion", "palabras_clave",
            "actualizado_por", "fecha_actualizacion",
        ]
    )
    version.fecha_aprobacion = _fecha_aprobacion_datetime(fecha_aprobacion)
    version.save(update_fields=["fecha_aprobacion"])
    AccesoDocumento.objects.filter(documento_id=id_documento).delete()


@transaction.atomic
def cambiar_estado_version(id_documento, id_version, estado):
    if estado not in {"VIGENTE", "INACTIVO"}:
        raise ValueError(f"Estado de versión no válido: {estado}")
    Documento.objects.select_for_update().get(pk=id_documento)
    version = VersionDocumento.objects.activas().filter(
        documento_id=id_documento, pk=id_version
    ).first()
    if version is None:
        raise ValueError("La versión seleccionada no pertenece al documento.")
    if estado == "VIGENTE" and VersionDocumento.objects.activas().filter(
        documento_id=id_documento, estado="VIGENTE"
    ).exclude(pk=id_version).exists():
        raise ValueError("No se puede tener mas de una version vigente para el documento.")
    VersionDocumento.objects.filter(pk=id_version).update(estado=estado)
    if estado == "VIGENTE":
        Documento.objects.filter(pk=id_documento).update(version_vigente_id=id_version)
    else:
        Documento.objects.filter(pk=id_documento, version_vigente_id=id_version).update(
            version_vigente=None
        )


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


@transaction.atomic
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
    Documento.objects.select_for_update().get(pk=id_documento)
    ids_publicados = set(ids_publicados)
    versiones = VersionDocumento.objects.select_for_update().activas().filter(
        documento_id=id_documento
    )
    actuales = list(versiones.values("id_version", "numero_version", "publicado", "estado_ia"))
    if ids_publicados - {v["id_version"] for v in actuales}:
        raise ValueError("Una o mas versiones seleccionadas no pertenecen al documento.")
    validar_publicacion_versiones_por_ia(actuales, ids_publicados)
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
    validar_eliminacion_no_publicada(id_documento)
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
    Documento.objects.select_for_update().get(pk=id_documento)
    validar_eliminacion_no_publicada(id_documento, id_version)
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
    documento = Documento.objects.select_for_update().get(pk=id_documento)
    versiones = list(
        VersionDocumento.objects.select_for_update().filter(
            documento_id=id_documento, pk__in=ids_versiones
        )
    )
    if len(versiones) != len(ids_versiones):
        raise ValueError("Una o más versiones no pertenecen al documento.")
    if any(version.estado != "ELIMINADO" for version in versiones):
        raise ValueError("Solo se pueden restaurar versiones que estén en la papelera.")
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



def eliminar_documento_fisico(id_documento, motivo, usuario, usuario_django):
    """Elimina de la base un documento que ya se encuentra en la papelera."""
    validar_motivo_eliminacion_definitiva(motivo)
    with transaction.atomic():
        documento = Documento.objects.select_for_update().filter(
            pk=id_documento
        ).values(
            "id_documento", "titulo", "descripcion", "uuid_documento",
            "fecha_eliminacion", "motivo_eliminacion",
        ).first()
        if not documento:
            raise ValueError("El documento no existe.")
        if not documento.get("fecha_eliminacion"):
            raise ValueError(
                "Solo se puede eliminar definitivamente un documento que esté en la papelera."
            )

        versiones = list(
            VersionDocumento.objects.filter(documento_id=id_documento)
            .order_by("numero_version")
            .values(
                "id_version", "numero_version", "archivo_nombre",
                "archivo_path", "uuid_version",
            )
        )
        resumen = {
            "id_documento_eliminado": id_documento,
            "titulo": documento.get("titulo"),
            "uuid_documento": str(documento.get("uuid_documento") or ""),
            "motivo_baja_logica": documento.get("motivo_eliminacion"),
            "motivo_eliminacion_definitiva": motivo,
            "versiones": [
                {
                    "id_version": version.get("id_version"),
                    "numero_version": version.get("numero_version"),
                    "archivo_nombre": version.get("archivo_nombre"),
                    "uuid_version": str(version.get("uuid_version") or ""),
                }
                for version in versiones
            ],
        }

        _registrar_auditoria_django_pruebas(
            usuario,
            usuario_django,
            id_documento,
            "ELIMINACION_DEFINITIVA",
            motivo,
            resumen,
            mensaje=(
                f"{usuario.get('nombre_usuario') or 'Usuario'} "
                f"ha eliminado el documento {documento.get('titulo') or id_documento} "
                f"y todas sus versiones. Motivo de eliminación: {motivo}. "
                f"Versiones eliminadas: {len(versiones)}"
            ),
        )
        _registrar_historial_eliminacion(
            id_documento,
            documento.get("titulo") or "",
            motivo,
            usuario,
            len(versiones),
            versiones_eliminadas=[
                {
                    "id_version": version.get("id_version"),
                    "numero_version": version.get("numero_version"),
                    "archivo_nombre": version.get("archivo_nombre"),
                }
                for version in versiones
            ],
        )
        Documento.objects.filter(pk=id_documento).update(version_vigente=None)
        AccesoDocumento.objects.filter(documento_id=id_documento).delete()
        VersionDocumento.objects.filter(documento_id=id_documento).delete()
        Documento.objects.filter(pk=id_documento).delete()

    return versiones


def eliminar_version_fisica(id_documento, id_version, motivo, usuario, usuario_django):
    """Elimina permanentemente una versión que ya se encuentra en la papelera."""
    validar_motivo_eliminacion_definitiva(motivo)
    with transaction.atomic():
        if not Documento.objects.select_for_update().filter(pk=id_documento).first():
            raise ValueError("El documento no existe.")
        version = VersionDocumento.objects.select_for_update().filter(
            documento_id=id_documento, pk=id_version
        ).values(
            "id_version", "documento_id", "numero_version", "archivo_nombre",
            "archivo_path", "uuid_version", "fecha_eliminacion",
            "motivo_eliminacion", "documento__titulo",
        ).first()
        if not version:
            raise ValueError("La versión no existe o no pertenece al documento.")
        version["id_documento"] = version.pop("documento_id")
        version["titulo"] = version.pop("documento__titulo")
        if not version.get("fecha_eliminacion"):
            raise ValueError(
                "Solo se puede eliminar definitivamente una versión que esté en la papelera."
            )

        resumen = {
            "id_documento": id_documento,
            "id_version_eliminada": id_version,
            "titulo": version.get("titulo"),
            "numero_version": version.get("numero_version"),
            "archivo_nombre": version.get("archivo_nombre"),
            "uuid_version": str(version.get("uuid_version") or ""),
            "motivo_baja_logica": version.get("motivo_eliminacion"),
            "motivo_eliminacion_definitiva": motivo,
        }
        _registrar_auditoria_django_pruebas(
            usuario,
            usuario_django,
            id_documento,
            "ELIMINACION_DEFINITIVA_VERSION",
            motivo,
            resumen,
            mensaje=(
                f"{usuario.get('nombre_usuario') or 'Usuario'} ha eliminado la versión "
                f"{version.get('numero_version')} del documento "
                f"{version.get('titulo') or id_documento}. Motivo de eliminación: {motivo}. "
                "Versiones eliminadas: 1"
            ),
        )
        _registrar_historial_eliminacion(
            id_documento,
            version.get("titulo") or "",
            motivo,
            usuario,
            1,
            id_version=id_version,
            numero_version=version.get("numero_version"),
            versiones_eliminadas=[
                {
                    "id_version": id_version,
                    "numero_version": version.get("numero_version"),
                    "archivo_nombre": version.get("archivo_nombre"),
                }
            ],
        )
        Documento.objects.filter(version_vigente_id=id_version).update(
            version_vigente=None
        )
        VersionDocumento.objects.filter(pk=id_version).delete()
        sincronizar_versionamiento(id_documento)

    return version


def eliminar_versiones_fisicas(id_documento, ids_versiones, motivo, usuario, usuario_django):
    """Elimina definitivamente varias versiones que permanecen en la papelera."""
    validar_motivo_eliminacion_definitiva(motivo)
    ids_versiones = list(dict.fromkeys(ids_versiones))
    if not ids_versiones:
        raise ValueError("Seleccione al menos una versión para eliminar.")

    with transaction.atomic():
        if not Documento.objects.select_for_update().filter(pk=id_documento).first():
            raise ValueError("El documento no existe.")
        versiones = list(
            VersionDocumento.objects.select_for_update().filter(
                documento_id=id_documento, pk__in=ids_versiones
            ).values(
                "id_version", "documento_id", "numero_version", "archivo_nombre",
                "archivo_path", "uuid_version", "fecha_eliminacion",
                "motivo_eliminacion", "estado", "documento__titulo",
            )
        )
        for version in versiones:
            version["id_documento"] = version.pop("documento_id")
            version["titulo"] = version.pop("documento__titulo")
        if len(versiones) != len(ids_versiones):
            raise ValueError("Una o más versiones no pertenecen al documento.")
        if any(str(version.get("estado") or "").upper() != "ELIMINADO" for version in versiones):
            raise ValueError("Solo se pueden eliminar definitivamente versiones que estén en la papelera.")

        titulo = versiones[0].get("titulo") or str(id_documento)
        resumen = {
            "id_documento": id_documento,
            "titulo": titulo,
            "motivo_eliminacion_definitiva": motivo,
            "versiones": [
                {
                    "id_version": version["id_version"],
                    "numero_version": version.get("numero_version"),
                    "archivo_nombre": version.get("archivo_nombre"),
                    "uuid_version": str(version.get("uuid_version") or ""),
                }
                for version in versiones
            ],
        }
        _registrar_auditoria_django_pruebas(
            usuario,
            usuario_django,
            id_documento,
            "ELIMINACION_DEFINITIVA_VERSIONES",
            motivo,
            resumen,
            mensaje=(
                f"{usuario.get('nombre_usuario') or 'Usuario'} ha eliminado definitivamente "
                f"{len(versiones)} versiones del documento {titulo}. "
                f"Motivo de eliminación: {motivo}."
            ),
        )
        _registrar_historial_eliminacion(
            id_documento,
            titulo,
            motivo,
            usuario,
            len(versiones),
            versiones_eliminadas=[
                {
                    "id_version": version["id_version"],
                    "numero_version": version.get("numero_version"),
                    "archivo_nombre": version.get("archivo_nombre"),
                }
                for version in versiones
            ],
        )
        Documento.objects.filter(
            pk=id_documento, version_vigente_id__in=ids_versiones
        ).update(version_vigente=None)
        VersionDocumento.objects.filter(
            documento_id=id_documento, pk__in=ids_versiones
        ).delete()
        sincronizar_versionamiento(id_documento)

    return versiones


@transaction.atomic
def crear_documento_con_accesos(titulo, descripcion, palabras_clave, fecha_aprobacion, datos_archivo, usuario, tipo, accesos, usuario_django):
    validar_titulo_unico(titulo)
    id_documento = crear_documento(
        titulo, descripcion, palabras_clave, fecha_aprobacion, datos_archivo,
        usuario["id_usuario_externo"],
    )
    actualizar_tipo_documento(id_documento, tipo)
    reemplazar_accesos_documento(id_documento, accesos, usuario["id_usuario_externo"])
    sincronizar_versionamiento(id_documento)
    _registrar_auditoria_django_pruebas(
        usuario,
        usuario_django,
        id_documento,
        "CREACION_DOCUMENTO",
        "",
        {"titulo": titulo, "tipo": tipo, "fecha_aprobacion": str(fecha_aprobacion)},
        mensaje=(
            f"{usuario.get('nombre_usuario') or 'Usuario'} ha creado el documento {titulo}."
        ),
        action_flag=ADDITION,
    )
    return id_documento


@transaction.atomic
def editar_documento_con_accesos(id_documento, titulo, descripcion, palabras_clave, fecha_aprobacion, id_version, usuario, tipo, accesos, estado_version, puede_cambiar_estado_version, datos_archivo, cambios, usuario_django):
    Documento.objects.select_for_update().get(pk=id_documento)
    validar_titulo_unico(titulo, id_documento)
    if puede_cambiar_estado_version:
        cambiar_estado_version(id_documento, id_version, estado_version)
    editar_documento(
        id_documento, titulo, descripcion, palabras_clave, fecha_aprobacion,
        id_version, usuario["id_usuario_externo"],
    )
    if estado_version == "INACTIVO":
        Documento.objects.filter(pk=id_documento, version_vigente_id=id_version).update(
            version_vigente=None
        )
    actualizar_tipo_documento(id_documento, tipo)
    reemplazar_accesos_documento(id_documento, accesos, usuario["id_usuario_externo"])
    if datos_archivo:
        reemplazar_archivo_version(
            id_documento, id_version, datos_archivo, usuario["id_usuario_externo"],
        )
    _registrar_auditoria_django_pruebas(
        usuario,
        usuario_django,
        id_documento,
        "EDICION_DOCUMENTO",
        "",
        {
            "titulo": titulo,
            "tipo": tipo,
            "id_version": id_version,
            "estado_version": estado_version,
            "archivo_reemplazado": bool(datos_archivo),
            "cambios": cambios,
        },
        mensaje=(
            mensaje_edicion_documento(usuario, titulo, cambios)
        ),
        action_flag=CHANGE,
    )


@transaction.atomic
def agregar_version_auditada(id_documento, datos_archivo, descripcion_cambio, fecha_aprobacion, usuario, documento, usuario_django):
    id_version_nueva = agregar_version(
        id_documento, datos_archivo, descripcion_cambio, fecha_aprobacion,
        usuario["id_usuario_externo"],
    )
    _registrar_auditoria_django_pruebas(
        usuario,
        usuario_django,
        id_documento,
        "NUEVA_VERSION",
        "",
        {"titulo": documento.get("titulo"), "descripcion_cambio": descripcion_cambio},
        mensaje=(
            f"{usuario.get('nombre_usuario') or 'Usuario'} ha agregado una nueva versión "
            f"al documento {documento.get('titulo') or id_documento}."
        ),
        action_flag=CHANGE,
    )
    return id_version_nueva


@transaction.atomic
def publicar_versiones_auditadas(id_documento, ids_publicados, usuario, documento, usuario_django):
    guardar_publicacion_versiones(id_documento, ids_publicados, usuario["id_usuario_externo"])
    _registrar_auditoria_django_pruebas(
        usuario,
        usuario_django,
        id_documento,
        "CAMBIO_PUBLICACION",
        "",
        {"titulo": documento.get("titulo"), "versiones_publicadas": sorted(ids_publicados)},
        mensaje=(
            f"{usuario.get('nombre_usuario') or 'Usuario'} ha actualizado la publicación "
            f"del documento {documento.get('titulo') or id_documento}."
        ),
        action_flag=CHANGE,
    )


def mensaje_edicion_documento(usuario, titulo, cambios):
    mensaje = f"{usuario.get('nombre_usuario') or 'Usuario'} ha editado el documento {titulo}."
    if len(cambios) == 1:
        return f"{mensaje} Cambio realizado: {cambios[0]}."
    if cambios:
        return f"{mensaje} Cambios realizados: {', '.join(cambios)}."
    return mensaje


@transaction.atomic
def eliminar_version_auditada(id_documento, id_version, motivo, usuario, documento, usuario_django):
    eliminar_version_logicamente(id_documento, id_version, motivo, usuario["id_usuario_externo"])
    _registrar_auditoria_django_pruebas(
        usuario,
        usuario_django,
        id_documento,
        "ELIMINACION_VERSION_LOGICA",
        motivo,
        {
            "titulo": documento.get("titulo"),
            "id_version": id_version,
        },
        mensaje=(
            f"{usuario.get('nombre_usuario') or 'Usuario'} ha eliminado "
            f"lógicamente una versión de {documento.get('titulo') or id_documento}."
        ),
    )


@transaction.atomic
def eliminar_documento_auditado(id_documento, motivo, usuario, documento, usuario_django):
    eliminar_documento_logicamente(id_documento, motivo, usuario["id_usuario_externo"])
    _registrar_auditoria_django_pruebas(
        usuario,
        usuario_django,
        id_documento,
        "ELIMINACION_DOCUMENTO_LOGICA",
        motivo,
        {"titulo": documento.get("titulo")},
        mensaje=(
            f"{usuario.get('nombre_usuario') or 'Usuario'} ha eliminado "
            f"lógicamente el documento {documento.get('titulo') or id_documento}."
        ),
    )


def validar_publicacion_versiones_por_ia(versiones, ids_publicados):
    versiones_por_id = {int(version["id_version"]): version for version in versiones}
    bloqueadas = []
    for id_version in ids_publicados:
        version = versiones_por_id.get(int(id_version))
        if not version:
            continue
        if version.get("publicado"):
            continue
        if str(version.get("estado_ia") or "").strip().upper() != "LEIDO":
            bloqueadas.append(version)

    if bloqueadas:
        detalle = ", ".join(
            f"versión {version.get('numero_version') or version['id_version']}"
            for version in bloqueadas
        )
        raise ValueError(
            "No se puede publicar una versión si la lectura de IA aún no es positiva "
            f"para: {detalle}."
        )


def validar_eliminacion_no_publicada(id_documento, id_version=None):
    versiones = VersionDocumento.objects.filter(documento_id=id_documento, publicado=True)
    if id_version is not None:
        versiones = versiones.filter(pk=id_version)
    if versiones.exists():
        raise ValueError("Para eliminar, primero debe quitar la publicación de las versiones seleccionadas.")


def validar_motivo_eliminacion_definitiva(motivo):
    if len((motivo or "").strip()) < 5:
        raise ValueError("El motivo de eliminación definitiva debe tener al menos 5 caracteres.")
