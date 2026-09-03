"""Escrituras de auditoría; participan en la transacción del servicio llamador."""

import json
from django.contrib.admin.models import DELETION, LogEntry
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.utils import timezone
from .models import HistorialEliminacion

# El usuario técnico es temporal hasta conectar la autenticación real.

def _registrar_auditoria_django_pruebas(
    usuario,
    usuario_django,
    id_documento,
    accion,
    motivo,
    resumen,
    mensaje=None,
    action_flag=DELETION,
):
    """Versión temporal de auditoría compatible con el usuario simulado."""
    usuario_id = (
        getattr(usuario_django, "pk", None)
        if getattr(usuario_django, "is_authenticated", False)
        else None
    )
    if not usuario_id:
        modelo_usuario = get_user_model()
        campo_usuario = modelo_usuario.USERNAME_FIELD
        nombre_usuario_pruebas = "auditoria_documentos_pruebas"
        usuario_pruebas, _ = modelo_usuario.objects.get_or_create(
            **{campo_usuario: nombre_usuario_pruebas}
        )
        usuario_id = usuario_pruebas.pk

    tipo_contenido, _ = ContentType.objects.get_or_create(
        app_label="documentos",
        model="documento",
    )
    titulo = str(resumen.get("titulo") or f"Documento {id_documento}")
    LogEntry.objects.create(
        user_id=usuario_id,
        content_type=tipo_contenido,
        object_id=str(id_documento),
        object_repr=titulo[:200],
        action_flag=action_flag,
        change_message=mensaje or json.dumps(
            {
                "accion": accion,
                "motivo": motivo,
                "datos_anteriores": resumen,
            },
            ensure_ascii=False,
        ),
    )

def _registrar_historial_eliminacion(
    id_documento,
    titulo,
    motivo,
    usuario,
    total_versiones,
    id_version=None,
    numero_version=None,
    versiones_eliminadas=None,
):
    HistorialEliminacion.objects.create(
        id_documento=id_documento,
        id_version=id_version,
        titulo_documento=titulo,
        numero_version=numero_version,
        nombre_usuario=usuario.get("nombre_usuario") or "Usuario",
        motivo_eliminacion=motivo,
        total_versiones=total_versiones,
        versiones_eliminadas=versiones_eliminadas or [],
        fecha_eliminacion=timezone.now(),
    )
