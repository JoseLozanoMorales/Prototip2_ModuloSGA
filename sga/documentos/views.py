import json
import re
import logging
import ssl
import threading
import urllib.error
import urllib.request
from datetime import date
from io import BytesIO
from itertools import product
from pathlib import Path, PurePosixPath
from uuid import uuid4

from django.conf import settings
from django.contrib.admin.models import ADDITION, CHANGE, DELETION, LogEntry
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.contrib import messages
from django.db import DatabaseError, close_old_connections
from django.http import FileResponse, Http404, HttpResponse, JsonResponse
from django.shortcuts import redirect, render
from django.urls import reverse
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.db import transaction
from django.utils import timezone
from django.views.decorators.clickjacking import xframe_options_sameorigin
from django.views.decorators.http import require_POST

from sga.models import PerfilUsuario, Periodo
from .models import (
    AccesoDocumento, Documento, EditorModulo, HistorialEliminacion,
    VersionDocumento,
)
from . import repositories, selectors, services

logger = logging.getLogger(__name__)

USUARIO_SIMULADO = {
    "id_usuario_externo": 1001,
    "id_perfil_externo": 2,
    "id_grupo_externo": 10,
    "id_tipo_periodo_externo": 2,
    "nombre_usuario": "Usuario simulado",
    "rol_modulo": "CONSULTA",
}

FECHA_APROBACION_MINIMA = date(1984, 1, 1)
PDF_TEXTO_MINIMO_CARACTERES = 200
TIPOS_DOCUMENTO = (
    "Manual",
    "Reglamento",
    "Guías",
    "Ordenes",
    "Modelos",
    "Procedimiento",
    "Videos",
)
# Preparado para habilitar la clasificación cuando el módulo maneje más tipos.
# Todos los registros del módulo son documentos legales. Mientras el selector
# esté deshabilitado se usa una categoría admitida por chk_docs_tipo.
TIPO_DOCUMENTO_PREDETERMINADO = "Manual"
SELECTOR_TIPO_DOCUMENTO_HABILITADO = False

ESTADO_IA_PENDIENTE = "PENDIENTE"
ESTADO_IA_LEIDO = "LEIDO"
ESTADO_IA_OBSERVADO = "OBSERVADO"
ESTADO_IA_ERROR = "ERROR"

ESTADOS_IA_DOCUMENTO = {
    ESTADO_IA_PENDIENTE: {
        "label": "Pendiente",
        "leido": False,
        "clase": "status-pending",
    },
    ESTADO_IA_LEIDO: {
        "label": "Leido",
        "leido": True,
        "clase": "status-success",
    },
    ESTADO_IA_OBSERVADO: {
        "label": "No Leído",
        "leido": False,
        "clase": "status-warning",
    },
    ESTADO_IA_ERROR: {
        "label": "Error",
        "leido": False,
        "clase": "status-error",
    },
}

NOMBRES_PERFILES_ACCESO = {
    None: "Todos",
    1: "Estudiante",
    2: "Docente",
    3: "Coordinador",
}

NOMBRES_GRUPOS_ACCESO = {
    None: "Todos",
    10: "Computacion",
    20: "Empresariales",
    30: "Derecho",
}

NOMBRES_PERIODOS_ACCESO = {
    None: "Todos",
    1: "Nivelacion",
    2: "Grado",
    3: "Postgrado",
}


def lista_documentos(request):
    """Lista documentos leyendo el estado desde la versiÃ³n actual."""
    documentos = []
    error_base_datos = None
    usuario = _obtener_usuario_modulo()
    sessionid = _obtener_sessionid_chat(request)
    catalogos_acceso = _catalogos_acceso()
    busqueda = request.GET.get("q", "").strip()
    filtros_seleccionados = {
        "anio": request.GET.get("anio", "").strip(),
        "periodo": request.GET.get("periodo", "").strip(),
        "grupo": request.GET.get("grupo", "").strip(),
        "perfil": request.GET.get("perfil", "").strip(),
        "tipo": request.GET.get("tipo", "").strip(),
    }
    filtros_disponibles = _filtros_documentos_vacios()
    try:
        # Los filtros se aplican despues de obtener los documentos visibles para
        # que cada selector solo muestre valores que realmente existen.
        documentos = _listar_documentos_modulo(usuario, busqueda, None)
        _adjuntar_publicacion_documentos(documentos)
        if usuario["rol_modulo"] != "EDITOR":
            documentos = _filtrar_documentos_publicados(documentos)
            _adjuntar_ultima_version_documentos(documentos, solo_publicadas=True)
        else:
            _adjuntar_versionamiento_documentos(documentos)
        _adjuntar_estado_ia_documentos(
            documentos,
            solo_publicadas=usuario["rol_modulo"] != "EDITOR",
        )
        accesos_por_documento = _accesos_por_documento(documentos)
        filtros_disponibles = _construir_filtros_documentos(
            documentos,
            accesos_por_documento,
            catalogos_acceso,
        )
        _validar_filtros_documentos(filtros_seleccionados, filtros_disponibles)
        documentos = _filtrar_documentos_por_criterios(
            documentos,
            accesos_por_documento,
            filtros_seleccionados,
        )
        if usuario["rol_modulo"] == "EDITOR":
            _adjuntar_detalles_editor(documentos, catalogos_acceso)
    except (DatabaseError, ValueError) as error:
        # La pÃ¡gina sigue siendo Ãºtil para comprobar el servidor aunque PostgreSQL
        # aÃºn no estÃ© disponible o falten variables en .env.
        error_base_datos = str(error)

    return render(
        request,
        "documentos/documentosV2.html",
        {
            "documentos": documentos,
            "usuario": usuario,
            "busqueda": busqueda,
            "filtros_seleccionados": filtros_seleccionados,
            "filtros_disponibles": filtros_disponibles,
            "filtros_activos": any(filtros_seleccionados.values()),
            "fecha_aprobacion_minima": FECHA_APROBACION_MINIMA.isoformat(),
            "fecha_aprobacion_maxima": date.today().isoformat(),
            "error_base_datos": error_base_datos,
            "sessionid": sessionid,
            "capacidades": _capacidades_base() if usuario["rol_modulo"] == "EDITOR" else {},
            "catalogos_acceso": catalogos_acceso,
            "perfiles_acceso": catalogos_acceso["perfiles"],
            "grupos_acceso": catalogos_acceso["grupos"],
            "tipos_periodo_acceso": catalogos_acceso["tipos_periodo"],
            "tipos_documento": TIPOS_DOCUMENTO,
            "selector_tipo_documento_habilitado": SELECTOR_TIPO_DOCUMENTO_HABILITADO,
        },
    )


def pendiente_de_migrar(request, *args, **kwargs):
    """Placeholder temporal para flujos todavía atendidos por Flask."""
    return HttpResponse("Pendiente de migrar desde Flask a Django.", status=501)


def _obtener_usuario_modulo():
    """Obtiene el rol del usuario simulado desde la tabla de editores."""
    usuario = dict(USUARIO_SIMULADO)
    try:
        es_editor = EditorModulo.objects.filter(
            id_usuario_externo=usuario["id_usuario_externo"], activo=True
        ).exists()
        usuario["rol_modulo"] = "EDITOR" if es_editor else "LECTOR"
    except DatabaseError:
        usuario["rol_modulo"] = "LECTOR"
    return usuario


def _obtener_sessionid_chat(request):
    """Asegura un identificador de sesion para el iframe de BettIA."""
    if not request.session.session_key:
        request.session.create()
    return request.session.session_key


def _columna_existe(tabla, columna):
    try:
        return repositories.columna_existe(tabla, columna)
    except DatabaseError:
        return False


def _normalizar_estado_ia(estado):
    estado = str(estado or ESTADO_IA_PENDIENTE).upper()
    return estado if estado in ESTADOS_IA_DOCUMENTO else ESTADO_IA_PENDIENTE


def _datos_estado_ia(estado, porcentaje_texto=None, mensaje=""):
    estado = _normalizar_estado_ia(estado)
    datos = dict(ESTADOS_IA_DOCUMENTO[estado])
    return {
        "estado_ia": estado,
        "label_ia": datos["label"],
        "leido_ia": datos["leido"],
        "clase_ia": datos["clase"],
        "porcentaje_texto_ia": porcentaje_texto,
        "mensaje_ia": mensaje or "",
        "leido_ia_texto": "Si" if datos["leido"] else "No",
    }


def _adjuntar_estado_ia_documentos(documentos, solo_publicadas=False):
    if not documentos:
        return

    estado_por_defecto = _datos_estado_ia(ESTADO_IA_PENDIENTE)
    estado_sin_vigente = _datos_estado_ia(
        ESTADO_IA_OBSERVADO,
        None,
        "El documento no tiene versiones vigentes para IA.",
    )
    if not _columna_existe("doc_versions", "estado_ia"):
        for documento in documentos:
            documento.update(estado_por_defecto)
        return

    ids_documentos = [documento["id_documento"] for documento in documentos]
    if solo_publicadas and _publicacion_habilitada():
        filas = VersionDocumento.objects.activas().publicadas().filter(
            documento_id__in=ids_documentos
        ).order_by(
            "documento_id", "-numero_version", "-id_version"
        ).distinct("documento_id").values(
            "documento_id", "estado_ia", "porcentaje_texto_ia", "mensaje_ia"
        )
        filas = [
            {
                "id_documento": fila["documento_id"],
                "estado_ia": fila.get("estado_ia") or ESTADO_IA_PENDIENTE,
                "porcentaje_texto_ia": fila.get("porcentaje_texto_ia"),
                "mensaje_ia": fila.get("mensaje_ia") or "",
            }
            for fila in filas
        ]
    else:
        estados_vigentes = selectors.estados_ia_documentos(ids_documentos)
        filas = []
        for id_documento in ids_documentos:
            version = estados_vigentes.get(id_documento)
            filas.append(
                {
                    "id_documento": id_documento,
                    "estado_ia": (
                        version.get("estado_ia") or ESTADO_IA_PENDIENTE
                        if version else ESTADO_IA_OBSERVADO
                    ),
                    "porcentaje_texto_ia": (
                        version.get("porcentaje_texto_ia") if version else None
                    ),
                    "mensaje_ia": (
                        version.get("mensaje_ia") or ""
                        if version else estado_sin_vigente["mensaje_ia"]
                    ),
                }
            )
    estados = {
        fila["id_documento"]: _datos_estado_ia(
            fila.get("estado_ia"),
            fila.get("porcentaje_texto_ia"),
            fila.get("mensaje_ia"),
        )
        for fila in filas
    }
    for documento in documentos:
        estado_fallback = estado_sin_vigente if solo_publicadas else estado_por_defecto
        documento.update(estados.get(documento["id_documento"], estado_fallback))


def estado_analisis_ia_documentos(request):
    """Devuelve el estado IA de documentos visibles para refrescar la UI."""
    try:
        ids_solicitados = _ids_documentos_consulta(request.GET.get("ids", ""))
        if not ids_solicitados:
            return JsonResponse({"documentos": []})

        usuario = _obtener_usuario_modulo()
        documentos_visibles = _listar_documentos_modulo(usuario, "", None)
        _adjuntar_publicacion_documentos(documentos_visibles)
        if usuario["rol_modulo"] != "EDITOR":
            documentos_visibles = _filtrar_documentos_publicados(documentos_visibles)
        documentos = [
            documento
            for documento in documentos_visibles
            if documento.get("id_documento") in ids_solicitados
        ]
        _adjuntar_estado_ia_documentos(
            documentos,
            solo_publicadas=usuario["rol_modulo"] != "EDITOR",
        )
    except ValueError as error:
        return JsonResponse({"error": str(error)}, status=400)
    except DatabaseError as error:
        return JsonResponse({"error": str(error)}, status=500)

    return JsonResponse(
        {
            "documentos": [
                {
                    "id_documento": documento["id_documento"],
                    "titulo": documento.get("titulo") or "",
                    "estado_ia": documento.get("estado_ia") or ESTADO_IA_PENDIENTE,
                    "label_ia": documento.get("label_ia") or "Pendiente",
                    "leido_ia_texto": documento.get("leido_ia_texto") or "No",
                    "clase_ia": documento.get("clase_ia") or "status-pending",
                    "porcentaje_texto_ia": _numero_json(documento.get("porcentaje_texto_ia")),
                    "mensaje_ia": documento.get("mensaje_ia") or "",
                    "finalizado": documento.get("estado_ia") in {
                        ESTADO_IA_LEIDO,
                        ESTADO_IA_OBSERVADO,
                        ESTADO_IA_ERROR,
                    },
                }
                for documento in documentos
            ]
        }
    )


def _ids_documentos_consulta(valor):
    ids = []
    for item in str(valor or "").split(","):
        item = item.strip()
        if not item:
            continue
        try:
            id_documento = int(item)
        except ValueError as error:
            raise ValueError("Los identificadores de documentos no son validos.") from error
        if id_documento not in ids:
            ids.append(id_documento)
    return ids


def _numero_json(valor):
    if valor is None:
        return None
    return float(valor)


def _sincronizar_estado_versiones(id_documento):
    # El estado ya no se deriva desde docs.id_version_vigente.
    # doc_versions.estado es la fuente unica de vigencia.
    return


def _publicacion_habilitada():
    return _columna_existe("doc_versions", "publicado")


def _adjuntar_publicacion_documentos(documentos):
    if not documentos:
        return

    if not _publicacion_habilitada():
        for documento in documentos:
            documento["publicado"] = None
            documento["publicado_texto"] = "No disponible"
        return

    ids_documentos = [documento["id_documento"] for documento in documentos]
    publicados = set(
        VersionDocumento.objects.activas()
        .publicadas()
        .filter(documento_id__in=ids_documentos)
        .values_list("documento_id", flat=True)
        .distinct()
    )
    for documento in documentos:
        publicado = documento["id_documento"] in publicados
        documento["publicado"] = publicado
        documento["publicado_texto"] = "Publicado" if publicado else "No publicado"


def _filtrar_documentos_publicados(documentos):
    if not _publicacion_habilitada():
        return documentos
    return [documento for documento in documentos if documento.get("publicado")]


def _adjuntar_versionamiento_documentos(documentos):
    if not documentos:
        return

    ids_documentos = [documento["id_documento"] for documento in documentos]
    versionamiento_por_documento = dict(
        Documento.objects.filter(pk__in=ids_documentos).values_list(
            "id_documento", "tiene_versionamiento"
        )
    )
    for documento in documentos:
        tiene_versionamiento = versionamiento_por_documento.get(
            documento["id_documento"], False
        )
        documento["tiene_versionamiento"] = tiene_versionamiento
        documento["tiene_versionamiento_texto"] = (
            "Sí" if tiene_versionamiento else "No"
        )


def _adjuntar_ultima_version_documentos(documentos, solo_publicadas=False):
    if not documentos:
        return

    ids_documentos = [documento["id_documento"] for documento in documentos]
    versiones = VersionDocumento.objects.activas().filter(
        documento_id__in=ids_documentos
    )
    if solo_publicadas and _publicacion_habilitada():
        versiones = versiones.publicadas()
    filas = versiones.order_by(
        "documento_id", "-numero_version", "-id_version"
    ).distinct("documento_id").values(
        "documento_id", "id_version", "numero_version"
    )
    ultima_version_por_documento = {
        fila["documento_id"]: fila for fila in filas
    }
    for documento in documentos:
        version = ultima_version_por_documento.get(documento["id_documento"]) or {}
        id_version = version.get("id_version")
        numero_version = version.get("numero_version")
        if numero_version is None:
            numero_version = documento.get("numero_version_vigente")
        documento["id_version_consulta"] = id_version
        documento["ultima_version"] = numero_version
        documento["ultima_version_texto"] = (
            f"Versión {numero_version}" if numero_version else "No disponible"
        )


def _sincronizar_versionamiento_documento(id_documento):
    services.sincronizar_versionamiento(id_documento)


def _listar_documentos_modulo(usuario, busqueda, anio):
    return repositories.listar_documentos_modulo(
        usuario, busqueda, _anio_entero(anio)
    )


def _listar_papelera_fallback(busqueda, anio):
    """Lista cada documento y versión eliminada como un elemento independiente."""
    texto_busqueda = (busqueda or "").strip()
    anio_consulta = _anio_entero(anio)
    return repositories.listar_papelera(texto_busqueda, anio_consulta)


def _agrupar_papelera_por_documento(elementos):
    """Agrupa las versiones eliminadas bajo la fila de su documento."""
    grupos = {}
    for elemento in elementos:
        id_documento = elemento["id_documento"]
        grupo = grupos.setdefault(
            id_documento,
            {
                "id_documento": id_documento,
                "principal": None,
                "versiones_eliminadas": [],
            },
        )
        if elemento.get("tipo_item") == "DOCUMENTO":
            grupo["principal"] = elemento
        else:
            grupo["versiones_eliminadas"].append(elemento)

    resultado = []
    for grupo in grupos.values():
        # Un documento activo puede tener versiones eliminadas. En ese caso se
        # usa la primera versión solo para identificar el grupo, sin habilitar
        # las acciones propias de un documento eliminado.
        if grupo["principal"] is None:
            grupo["principal"] = grupo["versiones_eliminadas"][0]
            grupo["documento_eliminado"] = False
        else:
            grupo["documento_eliminado"] = True
        resultado.append(grupo)
    return resultado


def _extraer_anios_disponibles(documentos):
    return sorted(
        {str(documento["anio"]) for documento in documentos if documento.get("anio") is not None},
        reverse=True,
    )


def _filtros_documentos_vacios():
    return {"anios": [], "periodos": [], "grupos": [], "perfiles": [], "tipos": []}


def _accesos_por_documento(documentos):
    if not documentos:
        return {}
    ids_documentos = [documento["id_documento"] for documento in documentos]
    accesos = selectors.accesos_de_documentos(ids_documentos)
    resultado = {id_documento: [] for id_documento in ids_documentos}
    for acceso in accesos:
        acceso["id_documento"] = acceso.pop("documento_id")
        resultado.setdefault(acceso["id_documento"], []).append(acceso)
    return resultado


def _opciones_filtro_acceso(accesos_por_documento, campo, catalogo):
    nombres = _nombres_catalogo(catalogo)
    valores = {
        acceso.get(campo)
        for accesos in accesos_por_documento.values()
        for acceso in accesos
    }
    opciones = []
    for valor in sorted(valores, key=lambda item: (item is not None, str(item))):
        opciones.append(
            {
                "id": "__todos__" if valor is None else str(valor),
                "nombre": nombres.get(valor, str(valor)),
            }
        )
    return opciones


def _construir_filtros_documentos(documentos, accesos_por_documento, catalogos_acceso):
    return {
        "anios": _extraer_anios_disponibles(documentos),
        "tipos": sorted({documento.get("tipo") for documento in documentos if documento.get("tipo")}),
        "perfiles": _opciones_filtro_acceso(
            accesos_por_documento, "id_perfil_externo", catalogos_acceso["perfiles"]
        ),
        "grupos": _opciones_filtro_acceso(
            accesos_por_documento, "id_grupo_externo", catalogos_acceso["grupos"]
        ),
        "periodos": _opciones_filtro_acceso(
            accesos_por_documento,
            "id_tipo_periodo_externo",
            catalogos_acceso["tipos_periodo"],
        ),
    }


def _validar_filtros_documentos(filtros, disponibles):
    opciones = {
        "anio": set(disponibles["anios"]),
        "tipo": set(disponibles["tipos"]),
        "perfil": {opcion["id"] for opcion in disponibles["perfiles"]},
        "grupo": {opcion["id"] for opcion in disponibles["grupos"]},
        "periodo": {opcion["id"] for opcion in disponibles["periodos"]},
    }
    for campo, valor in filtros.items():
        if valor and valor not in opciones[campo]:
            raise ValueError("El valor seleccionado no existe en los documentos disponibles.")


def _documento_tiene_acceso(accesos, campo, valor):
    valor = None if valor == "__todos__" else int(valor)
    return any(acceso.get(campo) == valor for acceso in accesos)


def _filtrar_documentos_por_criterios(documentos, accesos_por_documento, filtros):
    resultado = []
    for documento in documentos:
        if filtros["anio"] and str(documento.get("anio")) != filtros["anio"]:
            continue
        if filtros["tipo"] and documento.get("tipo") != filtros["tipo"]:
            continue
        accesos = accesos_por_documento.get(documento["id_documento"], [])
        if filtros["perfil"] and not _documento_tiene_acceso(
            accesos, "id_perfil_externo", filtros["perfil"]
        ):
            continue
        if filtros["grupo"] and not _documento_tiene_acceso(
            accesos, "id_grupo_externo", filtros["grupo"]
        ):
            continue
        if filtros["periodo"] and not _documento_tiene_acceso(
            accesos, "id_tipo_periodo_externo", filtros["periodo"]
        ):
            continue
        resultado.append(documento)
    return resultado


def _capacidades_base():
    return {
        "puede_cambiar_estado_version": _columna_existe("doc_versions", "estado"),
        "puede_reemplazar_archivo": _columna_existe("doc_versions", "archivo_path"),
        "puede_eliminar_version": _columna_existe("doc_versions", "estado"),
        "puede_restaurar_version": _columna_existe("doc_versions", "estado"),
        "puede_publicar_version": _publicacion_habilitada(),
    }


def _adjuntar_detalles_editor(documentos, catalogos_acceso):
    """Completa versiones y accesos necesarios por los formularios de editor."""
    if not documentos:
        return

    documentos_sin_versiones = []
    for documento in documentos:
        try:
            versiones = _obtener_versiones(documento["id_documento"])
        except Http404:
            # Un dato heredado inconsistente no debe provocar un 404 en toda
            # la lista. Sus versiones eliminadas siguen recuperables desde la papelera.
            documentos_sin_versiones.append(documento)
            continue
        documento["versiones"] = versiones
        id_version_vigente = documento.get("id_version_vigente")
        if not any(version["id_version"] == id_version_vigente for version in versiones):
            id_version_vigente = None
        version_vigente = _seleccionar_version(versiones, id_version_vigente)
        documento["id_version_preview"] = version_vigente["id_version"]

    if documentos_sin_versiones:
        documentos[:] = [
            documento for documento in documentos if documento not in documentos_sin_versiones
        ]

    if not documentos:
        return

    ids_documentos = [documento["id_documento"] for documento in documentos]
    accesos = selectors.accesos_de_documentos(ids_documentos)
    accesos_por_documento = {}
    for acceso in accesos:
        acceso["id_documento"] = acceso.pop("documento_id")
        accesos_por_documento.setdefault(acceso["id_documento"], []).append(acceso)

    for documento in documentos:
        accesos_documento = accesos_por_documento.get(documento["id_documento"], [])
        documento["perfiles_seleccionados"] = _opciones_acceso(
            _valores_acceso(accesos_documento, "id_perfil_externo"),
            _nombres_catalogo(catalogos_acceso["perfiles"]),
        )
        documento["perfiles_seleccionados_opciones"] = documento["perfiles_seleccionados"]
        documento["grupos_seleccionados"] = _opciones_acceso(
            _valores_acceso(accesos_documento, "id_grupo_externo"),
            _nombres_catalogo(catalogos_acceso["grupos"]),
        )
        documento["grupos_seleccionados_opciones"] = documento["grupos_seleccionados"]
        documento["periodos_seleccionados"] = _opciones_acceso(
            _valores_acceso(accesos_documento, "id_tipo_periodo_externo"),
            _nombres_catalogo(catalogos_acceso["tipos_periodo"]),
        )
        documento["periodos_seleccionados_opciones"] = documento["periodos_seleccionados"]


def _valores_acceso(accesos, campo):
    valores = []
    for acceso in accesos:
        valor = acceso.get(campo)
        valor = "" if valor is None else valor
        if valor not in valores:
            valores.append(valor)
    return valores or [""]


def _requerir_editor(request):
    usuario = _obtener_usuario_modulo()
    if usuario["rol_modulo"] != "EDITOR":
        messages.error(request, "No tienes permisos para realizar esta acciÃ³n.")
        return None
    return usuario


def _fecha_formulario(valor, requerido=False):
    if not valor:
        if requerido:
            raise ValueError("La fecha de aprobacion es obligatoria.")
        return None
    try:
        fecha = date.fromisoformat(valor)
    except ValueError as error:
        raise ValueError("La fecha debe tener el formato AAAA-MM-DD.") from error
    fecha_maxima = date.today()
    if fecha < FECHA_APROBACION_MINIMA or fecha > fecha_maxima:
        raise ValueError(
            "La fecha de aprobacion debe estar entre "
            f"{FECHA_APROBACION_MINIMA.isoformat()} y {fecha_maxima.isoformat()}."
        )
    return fecha


def _anio_entero(valor):
    if valor in (None, ""):
        return None
    try:
        return int(valor)
    except (TypeError, ValueError) as error:
        raise ValueError("El anio de filtro no es valido.") from error


def _valores_enteros_formulario(request, campo):
    valores = [valor.strip() for valor in request.POST.getlist(campo)]
    if not valores or "" in valores:
        return [None]
    try:
        return list(dict.fromkeys(int(valor) for valor in valores))
    except ValueError as error:
        raise ValueError("Los valores de acceso no son válidos.") from error


def _ids_enteros_formulario(request, campo):
    ids = []
    for valor in request.POST.getlist(campo):
        valor = valor.strip()
        if not valor:
            continue
        try:
            id_entero = int(valor)
        except ValueError as error:
            raise ValueError("Los identificadores de versiones no son validos.") from error
        if id_entero not in ids:
            ids.append(id_entero)
    return ids


def _combinaciones_acceso(request):
    return list(
        product(
            _valores_enteros_formulario(request, "id_perfil_externo"),
            _valores_enteros_formulario(request, "id_grupo_externo"),
            _valores_enteros_formulario(request, "id_tipo_periodo_externo"),
        )
    )


def _catalogos_acceso():
    return {
        "perfiles": _opciones_perfiles_acceso(),
        "grupos": _opciones_grupos_acceso(),
        "tipos_periodo": _opciones_periodos_acceso(),
    }


def _opciones_perfiles_acceso():
    opciones = [{"id": "", "nombre": "Todos"}]
    try:
        perfiles = PerfilUsuario.objects.filter(status=True)
        if perfiles.filter(inscripcion__isnull=False).exists():
            opciones.append({"id": 1, "nombre": "Estudiante"})
        if perfiles.filter(profesor__isnull=False).exists():
            opciones.append({"id": 2, "nombre": "Docente"})
        if perfiles.filter(administrativo__isnull=False).exists():
            opciones.append({"id": 3, "nombre": "Administrativo"})
        if perfiles.filter(empleador__isnull=False).exists():
            opciones.append({"id": 4, "nombre": "Empleador"})
    except DatabaseError:
        pass

    if len(opciones) == 1:
        return _opciones_desde_mapa(NOMBRES_PERFILES_ACCESO)
    return opciones


def _opciones_grupos_acceso():
    return _opciones_desde_mapa(NOMBRES_GRUPOS_ACCESO)


def _opciones_periodos_acceso():
    opciones = [{"id": "", "nombre": "Todos"}]
    try:
        periodos = (
            Periodo.objects.filter(status=True, activo=True)
            .order_by("nombre")
            .values("id", "nombre")
        )
        opciones.extend(
            {"id": periodo["id"], "nombre": periodo["nombre"]}
            for periodo in periodos
        )
    except DatabaseError:
        pass

    if len(opciones) == 1:
        return _opciones_desde_mapa(NOMBRES_PERIODOS_ACCESO)
    return opciones


def _opciones_desde_mapa(nombres):
    return [
        {"id": "" if identificador is None else identificador, "nombre": nombre}
        for identificador, nombre in nombres.items()
    ]


def _nombres_catalogo(opciones):
    nombres = {}
    for opcion in opciones:
        identificador = opcion["id"]
        identificador = None if identificador == "" else int(identificador)
        nombres[identificador] = opcion["nombre"]
    return nombres


def _opciones_acceso(valores, nombres):
    opciones = []
    for valor in valores or [None]:
        valor_normalizado = None if valor in ("", None) else int(valor)
        opciones.append(
            {
                "id": "" if valor_normalizado is None else valor_normalizado,
                "nombre": nombres.get(valor_normalizado, str(valor_normalizado)),
            }
        )
    return opciones


def _contexto_accesos(perfiles, grupos, periodos):
    catalogos_acceso = _catalogos_acceso()
    return {
        "perfiles": _opciones_acceso(
            perfiles,
            _nombres_catalogo(catalogos_acceso["perfiles"]),
        ),
        "grupos": _opciones_acceso(
            grupos,
            _nombres_catalogo(catalogos_acceso["grupos"]),
        ),
        "tipos_periodo": _opciones_acceso(
            periodos,
            _nombres_catalogo(catalogos_acceso["tipos_periodo"]),
        ),
    }


def _contexto_accesos_formulario(request):
    return _contexto_accesos(
        _valores_enteros_formulario(request, "id_perfil_externo"),
        _valores_enteros_formulario(request, "id_grupo_externo"),
        _valores_enteros_formulario(request, "id_tipo_periodo_externo"),
    )


def _contexto_accesos_documento(id_documento):
    accesos = selectors.accesos_de_documento(id_documento)
    return _contexto_accesos(
        _valores_unicos_acceso(accesos, "id_perfil_externo"),
        _valores_unicos_acceso(accesos, "id_grupo_externo"),
        _valores_unicos_acceso(accesos, "id_tipo_periodo_externo"),
    )


def _valores_unicos_acceso(accesos, campo):
    valores = []
    for acceso in accesos:
        valor = acceso.get(campo)
        if valor not in valores:
            valores.append(valor)
    return valores or [None]


def _campos_multipart_accesos(contexto_accesos):
    contexto_accesos = contexto_accesos or _contexto_accesos(None, None, None)
    perfiles = contexto_accesos["perfiles"]
    grupos = contexto_accesos["grupos"]
    tipos_periodo = contexto_accesos["tipos_periodo"]
    metadata_accesos = _metadata_accesos(contexto_accesos)
    campos = [
        ("metadata", json.dumps(metadata_accesos, ensure_ascii=False, default=str)),
        ("perfiles_acceso", json.dumps(perfiles, ensure_ascii=False, default=str)),
        ("grupos_acceso", json.dumps(grupos, ensure_ascii=False, default=str)),
        ("tipos_periodo_acceso", json.dumps(tipos_periodo, ensure_ascii=False, default=str)),
        ("perfiles_acceso_ids", json.dumps(_ids_opciones_acceso(perfiles), ensure_ascii=False, default=str)),
        ("grupos_acceso_ids", json.dumps(_ids_opciones_acceso(grupos), ensure_ascii=False, default=str)),
        (
            "tipos_periodo_acceso_ids",
            json.dumps(_ids_opciones_acceso(tipos_periodo), ensure_ascii=False, default=str),
        ),
    ]
    campos.extend(("id_perfil_externo", opcion["id"]) for opcion in perfiles)
    campos.extend(("id_grupo_externo", opcion["id"]) for opcion in grupos)
    campos.extend(("id_tipo_periodo_externo", opcion["id"]) for opcion in tipos_periodo)
    campos.extend(("perfiles", opcion["nombre"]) for opcion in perfiles)
    campos.extend(("grupos", opcion["nombre"]) for opcion in grupos)
    campos.extend(("tipos_periodo", opcion["nombre"]) for opcion in tipos_periodo)
    campos.extend(("tipo_periodo", opcion["nombre"]) for opcion in tipos_periodo)
    return campos


def _metadata_accesos(contexto_accesos):
    contexto_accesos = contexto_accesos or _contexto_accesos(None, None, None)
    perfiles = contexto_accesos["perfiles"]
    grupos = contexto_accesos["grupos"]
    tipos_periodo = contexto_accesos["tipos_periodo"]
    return {
        "perfiles_acceso": perfiles,
        "grupos_acceso": grupos,
        "tipos_periodo_acceso": tipos_periodo,
        "id_perfil_externo": _ids_opciones_acceso(perfiles),
        "id_grupo_externo": _ids_opciones_acceso(grupos),
        "id_tipo_periodo_externo": _ids_opciones_acceso(tipos_periodo),
        "perfiles": _nombres_opciones_acceso(perfiles),
        "grupos": _nombres_opciones_acceso(grupos),
        "tipos_periodo": _nombres_opciones_acceso(tipos_periodo),
        "tipo_periodo": _nombres_opciones_acceso(tipos_periodo),
    }


def _ids_opciones_acceso(opciones):
    return [opcion["id"] for opcion in opciones]


def _nombres_opciones_acceso(opciones):
    return [opcion["nombre"] for opcion in opciones]


def _items_campos_multipart(campos):
    if hasattr(campos, "items"):
        return campos.items()
    return campos


def _formatear_valor_multipart(valor):
    if isinstance(valor, (dict, list, tuple)):
        return json.dumps(valor, ensure_ascii=False, default=str)
    return "" if valor is None else str(valor)


def _nombres_campos_multipart(campos):
    return [nombre for nombre, _valor in _items_campos_multipart(campos)]


def _obtener_pdf_reader():
    try:
        from pypdf import PdfReader

        return PdfReader
    except ImportError:
        try:
            from PyPDF2 import PdfReader

            return PdfReader
        except ImportError as error:
            raise RuntimeError(
                "No se puede validar el texto del PDF porque falta la dependencia pypdf."
            ) from error


def _leer_bytes_archivo_subido(archivo):
    if hasattr(archivo, "seek"):
        archivo.seek(0)

    if hasattr(archivo, "chunks"):
        contenido = b"".join(archivo.chunks())
    else:
        contenido = archivo.read()

    if hasattr(archivo, "seek"):
        archivo.seek(0)
    return contenido


def _extraer_texto_pdf_subido(archivo):
    PdfReader = _obtener_pdf_reader()
    contenido = _leer_bytes_archivo_subido(archivo)
    try:
        lector = PdfReader(BytesIO(contenido))
    except Exception as error:
        raise ValueError("No se pudo leer el PDF para validar su texto.") from error

    textos = []
    for numero_pagina, pagina in enumerate(lector.pages, start=1):
        try:
            textos.append(pagina.extract_text() or "")
        except Exception as error:
            raise ValueError(
                f"No se pudo extraer texto de la pagina {numero_pagina} del PDF."
            ) from error
    return "\n".join(textos)


def _validar_pdf_texto_minimo(archivo):
    texto = _extraer_texto_pdf_subido(archivo)
    caracteres = _contar_caracteres_texto(texto)
    if caracteres < PDF_TEXTO_MINIMO_CARACTERES:
        raise ValueError(
            "El PDF debe contener al menos "
            f"{PDF_TEXTO_MINIMO_CARACTERES} caracteres de texto extraible; "
            f"se detectaron {caracteres}. Verifique que no sea un PDF netamente escaneado."
        )
    return caracteres


def _contar_caracteres_texto(texto):
    """Cuenta contenido real, sin hacer que espacios y saltos inflen el total."""
    return len(re.sub(r"\s+", "", texto or ""))


def _guardar_pdf_django(archivo):
    nombre_original = Path(archivo.name).name
    if not nombre_original.lower().endswith(".pdf"):
        raise ValueError("Solo se permiten archivos PDF.")
    if archivo.size <= 0:
        raise ValueError("El archivo PDF está¡ vacio.")

    contenido = _leer_bytes_archivo_subido(archivo)
    nombre_guardado = f"{uuid4().hex}_{nombre_original}"
    ruta_relativa = default_storage.save(
        f"documentos/{nombre_guardado}",
        ContentFile(contenido),
    )
    return {
        "archivo_nombre": nombre_guardado,
        "archivo_path": ruta_relativa,
        "archivo_tipo": archivo.content_type or "application/pdf",
        "archivo_tamano": len(contenido),
    }


def _ruta_media_segura(ruta_relativa):
    raiz_media = settings.MEDIA_ROOT.resolve()
    ruta_pdf = (raiz_media / PurePosixPath(str(ruta_relativa))).resolve()
    if ruta_pdf != raiz_media and raiz_media not in ruta_pdf.parents:
        raise ValueError("La ruta del PDF no es valida.")
    return ruta_pdf


def _ruta_pdf_version_segura(datos_archivo):
    ruta_relativa = str(datos_archivo.get("archivo_path") or "")
    if ruta_relativa.startswith("documentos/"):
        return _ruta_media_segura(ruta_relativa)

    nombre_archivo = Path(
        ruta_relativa or str(datos_archivo.get("archivo_nombre") or "")
    ).name
    if not nombre_archivo.lower().endswith(".pdf"):
        raise ValueError("El archivo asociado no es un PDF valido.")

    ruta_pdf = (settings.FLASK_PDF_DIR / nombre_archivo).resolve()
    raiz_flask = settings.FLASK_PDF_DIR.resolve()
    if ruta_pdf != raiz_flask and raiz_flask not in ruta_pdf.parents:
        raise ValueError("La ruta del PDF heredado no es valida.")
    if not ruta_pdf.is_file():
        raise ValueError("El PDF original no esta disponible.")
    return ruta_pdf


def _leer_pdf_version(datos_archivo):
    ruta_pdf = _ruta_pdf_version_segura(datos_archivo)
    if not ruta_pdf.is_file():
        raise ValueError("El PDF original no esta disponible.")
    return ruta_pdf.read_bytes()


def _leer_json_http(respuesta):
    cuerpo = respuesta.read().decode("utf-8")
    try:
        return json.loads(cuerpo or "{}")
    except ValueError as error:
        raise RuntimeError(
            f"El servicio respondio con un formato no JSON. HTTP {respuesta.status}."
        ) from error


def _contexto_ssl_ia():
    if getattr(settings, "IA_SSL_VERIFY", True):
        return None
    return ssl._create_unverified_context()


def _publicar_json(url, payload):
    datos = json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8")
    solicitud = urllib.request.Request(
        url,
        data=datos,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(
            solicitud,
            timeout=settings.IA_DOCUMENTOS_TIMEOUT,
            context=_contexto_ssl_ia(),
        ) as respuesta:
            return _leer_json_http(respuesta)
    except urllib.error.HTTPError as error:
        contenido = _leer_json_http(error)
        mensaje = contenido.get("error") or contenido.get("mensaje") or error.reason
        raise RuntimeError(f"HTTP {error.code}: {mensaje}") from error
    except urllib.error.URLError as error:
        raise RuntimeError(str(error.reason)) from error


def _publicar_multipart(url, campos, archivos):
    boundary = f"----django-documentos-{uuid4().hex}"
    partes = []
    for nombre, valor in _items_campos_multipart(campos):
        partes.extend(
            [
                f"--{boundary}\r\n".encode("utf-8"),
                f'Content-Disposition: form-data; name="{nombre}"\r\n\r\n'.encode("utf-8"),
                _formatear_valor_multipart(valor).encode("utf-8"),
                b"\r\n",
            ]
        )
    for nombre, archivo in archivos.items():
        partes.extend(
            [
                f"--{boundary}\r\n".encode("utf-8"),
                (
                    f'Content-Disposition: form-data; name="{nombre}"; '
                    f'filename="{archivo["filename"]}"\r\n'
                ).encode("utf-8"),
                f'Content-Type: {archivo.get("content_type", "application/octet-stream")}\r\n\r\n'.encode("utf-8"),
                archivo["content"],
                b"\r\n",
            ]
        )
    partes.append(f"--{boundary}--\r\n".encode("utf-8"))
    solicitud = urllib.request.Request(
        url,
        data=b"".join(partes),
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(
            solicitud,
            timeout=settings.IA_DOCUMENTOS_TIMEOUT,
            context=_contexto_ssl_ia(),
        ) as respuesta:
            return _leer_json_http(respuesta)
    except urllib.error.HTTPError as error:
        contenido = _leer_json_http(error)
        mensaje = contenido.get("error") or contenido.get("mensaje") or error.reason
        raise RuntimeError(f"HTTP {error.code}: {mensaje}") from error
    except urllib.error.URLError as error:
        raise RuntimeError(str(error.reason)) from error


def _llamar_ia_documentos(datos_archivo, contexto_accesos=None, tipo_documento=None):
    url = f"{settings.IA_DOCUMENTOS_BASE_URL}{settings.IA_DOCUMENTOS_ANALIZAR_PATH}"
    try:
        contenido = _publicar_multipart(
            url,
            {
                "tipo_documento": _texto_comparable(tipo_documento),
            },
            {
                "archivo": {
                    "filename": datos_archivo["archivo_nombre"],
                    "content": _leer_pdf_version(datos_archivo),
                    "content_type": "application/pdf",
                }
            },
        )
    except RuntimeError as error:
        raise RuntimeError(
            f"No se pudo conectar con la IA documental en {url}. "
            f"Campos enviados: archivo, tipo_documento. Error: {error}"
        ) from error

    return contenido


def _obtener_porcentaje_texto_ia(contenido):
    valor = contenido.get("porcentaje_texto")
    if valor is None:
        datos_pdf = contenido.get("datos_pdf") or contenido.get("datosPdf") or contenido.get("datos") or {}
        valor = datos_pdf.get("porcentaje_texto")
        if valor is None:
            valor = datos_pdf.get("porcentaje_contenido_texto")
    if valor is None:
        raise ValueError("La IA no devolvio el campo porcentaje_texto.")
    try:
        return float(valor)
    except (TypeError, ValueError) as error:
        raise ValueError(f"La IA devolvio un porcentaje_texto invalido: {valor}") from error


def _validar_porcentaje_texto_ia(contenido):
    porcentaje_texto = _obtener_porcentaje_texto_ia(contenido)
    if porcentaje_texto < settings.IA_DOCUMENTOS_PORCENTAJE_TEXTO_MINIMO:
        # El porcentaje remoto suele representar la ocupacion visual o la
        # proporcion de paginas con texto. Portadas, tablas, firmas e imagenes
        # pueden reducirlo aunque el PDF sea perfectamente util para busqueda.
        # Si la IA logro extraer suficiente texto, no debemos descartarlo por
        # ese indicador secundario.
        caracteres_extraidos = _contar_caracteres_texto(
            contenido.get("texto_extraido")
        )
        if caracteres_extraidos >= PDF_TEXTO_MINIMO_CARACTERES:
            return porcentaje_texto
        raise ValueError(
            "El documento tiene un bajo porcentaje de texto "
            f"({porcentaje_texto:g}%). Minimo requerido: "
            f"{settings.IA_DOCUMENTOS_PORCENTAJE_TEXTO_MINIMO:g}%."
        )
    return porcentaje_texto


def _obtener_interpretacion_ia(contenido):
    interpretacion_ia = contenido.get("interpretacion_ia") or {}
    return interpretacion_ia.get("interpretacion") or contenido


def _obtener_contexto_version_chroma(id_documento, id_version=None, vigente=None):
    return selectors.contexto_version_chroma(id_documento, id_version, vigente)


def _obtener_fecha_aprobacion_version(id_documento, id_version):
    contexto = selectors.contexto_version_chroma(id_documento, id_version)
    return contexto.get("fecha_aprobacion")


def _texto_uuid(valor):
    return str(valor) if valor else ""


def _anio_fecha(valor):
    if not valor:
        return ""
    return str(valor.year) if hasattr(valor, "year") else str(valor)[:4]


def _obtener_estado_version(id_documento, id_version):
    if not id_documento or not id_version:
        return ""
    return _texto_comparable(
        selectors.estado_version(id_documento, id_version)
    ).upper()


def _resolver_estado_vigencia_payload(id_documento, contexto_version):
    contexto_version = contexto_version or {}
    estado = _texto_comparable(contexto_version.get("estado")).upper()
    if estado:
        return estado
    return _obtener_estado_version(id_documento, contexto_version.get("id_version")) or "VIGENTE"


def _construir_url_pdf_vigente(request, id_documento, contexto_version):
    """Construye el enlace directo solo para la version que actualmente es vigente."""
    # IMPORTANTE: en produccion, el host de la solicitud debe corresponder a la
    # direccion publica real desde la que se serviran los archivos PDF.
    contexto_version = contexto_version or {}
    id_version = contexto_version.get("id_version")
    if not id_version:
        return ""
    if _resolver_estado_vigencia_payload(id_documento, contexto_version) != "VIGENTE":
        return ""
    ruta = reverse(
        "documentos:pdf",
        kwargs={"id_documento": id_documento, "id_version": id_version},
    )
    return request.build_absolute_uri(ruta)


def _construir_contexto_reemplazo_version(version_nueva, version_anterior=None):
    version_anterior = version_anterior or {}
    return {
        "id_version": version_nueva.get("id_version"),
        "numero_version": version_nueva.get("numero_version"),
        "fecha_aprobacion": version_nueva.get("fecha_aprobacion"),
        "anio_aprobacion": _anio_fecha(version_nueva.get("fecha_aprobacion")),
        "estado": version_nueva.get("estado"),
        "uuid_documento": _texto_uuid(version_nueva.get("uuid_documento")),
        "uuid_version": _texto_uuid(version_nueva.get("uuid_version")),
        "id_version_anterior": version_anterior.get("id_version"),
        "numero_version_anterior": version_anterior.get("numero_version"),
        "uuid_version_anterior": _texto_uuid(version_anterior.get("uuid_version")),
    }


def _lista_a_json_texto(valor):
    if valor is None:
        return ""
    if isinstance(valor, str):
        return valor
    return json.dumps(valor, ensure_ascii=False, default=str)


def _bool_a_texto(valor):
    return "true" if bool(valor) else "false"


def _construir_payload_chroma(
    id_documento,
    titulo,
    datos_archivo,
    respuesta_ia,
    contexto_version=None,
    contexto_accesos=None,
    tipo_documento=None,
    documento_url="",
):
    interpretacion = _obtener_interpretacion_ia(respuesta_ia)
    contexto_version = contexto_version or {}
    contexto_accesos = contexto_accesos or _contexto_accesos(None, None, None)
    estado_vigencia = _resolver_estado_vigencia_payload(id_documento, contexto_version)
    tipo_documento = _texto_comparable(tipo_documento) or (
        interpretacion.get("tipo_documento_sugerido") or "GENERAL"
    )
    anio_documento = (
        contexto_version.get("anio_aprobacion")
        or interpretacion.get("anio_documento_sugerido")
        or ""
    )
    metadata_accesos = _metadata_accesos(contexto_accesos)
    metadata_documento_url = (
        {"documento_url": documento_url}
        if estado_vigencia == "VIGENTE" and documento_url
        else {}
    )
    payload = {
        "id_documento": str(id_documento),
        "id_version": contexto_version.get("id_version") or "",
        "uuid_documento": contexto_version.get("uuid_documento") or "",
        "uuid_version": contexto_version.get("uuid_version") or "",
        "id_version_anterior": contexto_version.get("id_version_anterior") or "",
        "uuid_version_anterior": contexto_version.get("uuid_version_anterior") or "",
        "accion_chroma": "reemplazar_version_vigente",
        "titulo": titulo,
        "texto_extraido": respuesta_ia.get("texto_extraido") or "",
        "reemplazar_existente": True,
        "tipo_documento": tipo_documento,
        "ambito": interpretacion.get("ambito_sugerido") or "PUBLICO",
        "estado_vigencia": estado_vigencia,
        "anio_documento": str(anio_documento),
        "rol": interpretacion.get("rol_sugerido") or "GENERAL",
        "carrera": interpretacion.get("carrera_sugerida") or "GENERAL",
        "tipo_estudio": interpretacion.get("tipo_estudio_sugerido") or "GENERAL",
        "perfiles_acceso": contexto_accesos["perfiles"],
        "grupos_acceso": contexto_accesos["grupos"],
        "tipos_periodo_acceso": contexto_accesos["tipos_periodo"],
        "nombre_archivo": respuesta_ia.get("nombre_archivo") or datos_archivo["archivo_nombre"],
        "resumen_documento": interpretacion.get("resumen") or respuesta_ia.get("resumen") or "",
        "temas_detectados": interpretacion.get("temas_detectados") or respuesta_ia.get("temas_detectados") or [],
        "advertencias": interpretacion.get("advertencias") or respuesta_ia.get("advertencias") or [],
        "requiere_revision_humana": _bool_a_texto(
            interpretacion.get(
                "requiere_revision_humana",
                respuesta_ia.get("requiere_revision_humana", False),
            )
        ),
        "metadata": {
            "fuente": "Django_Modulo_GestionDocumentosLegales",
            "archivo_path": datos_archivo["archivo_path"],
            "id_documento": str(id_documento),
            "id_version": str(contexto_version.get("id_version") or ""),
            "numero_version": str(contexto_version.get("numero_version") or ""),
            "anio_documento": str(anio_documento),
            "tipo_documento": tipo_documento,
            "tipo_documento_sugerido_ia": interpretacion.get("tipo_documento_sugerido") or "",
            "uuid_documento": contexto_version.get("uuid_documento") or "",
            "uuid_version": contexto_version.get("uuid_version") or "",
            "id_version_anterior": str(contexto_version.get("id_version_anterior") or ""),
            "numero_version_anterior": str(contexto_version.get("numero_version_anterior") or ""),
            "uuid_version_anterior": contexto_version.get("uuid_version_anterior") or "",
            "porcentaje_texto": respuesta_ia.get("porcentaje_texto"),
            "porcentaje_imagenes": respuesta_ia.get("porcentaje_imagenes"),
            **metadata_documento_url,
            **metadata_accesos,
        },
        "paginas": respuesta_ia.get("paginas") or 0,
        "paginas_con_texto": respuesta_ia.get("paginas_con_texto") or 0,
        "paginas_sin_texto": respuesta_ia.get("paginas_sin_texto") or 0,
        "paginas_con_poco_texto": respuesta_ia.get("paginas_con_poco_texto") or 0,
        "total_imagenes": respuesta_ia.get("total_imagenes") or 0,
        "requiere_revision": bool(respuesta_ia.get("requiere_revision", False)),
    }
    return payload


def _convertir_payload_chroma_multipart(payload):
    data = {}
    for clave, valor in payload.items():
        if clave == "texto_extraido" and not valor:
            continue
        if clave in (
            "temas_detectados",
            "advertencias",
            "metadata",
            "perfiles_acceso",
            "grupos_acceso",
            "tipos_periodo_acceso",
        ):
            data[clave] = _lista_a_json_texto(valor)
        elif isinstance(valor, bool):
            data[clave] = _bool_a_texto(valor)
        else:
            data[clave] = "" if valor is None else str(valor)
    return data


def _guardar_documento_chroma(
    id_documento,
    titulo,
    datos_archivo,
    respuesta_ia,
    contexto_version=None,
    contexto_accesos=None,
    tipo_documento=None,
    documento_url="",
):
    url = f"{settings.IA_CHROMA_BASE_URL}{settings.IA_CHROMA_GUARDAR_PATH}"
    payload = _construir_payload_chroma(
        id_documento,
        titulo,
        datos_archivo,
        respuesta_ia,
        contexto_version,
        contexto_accesos,
        tipo_documento,
        documento_url,
    )
    try:
        if payload["texto_extraido"]:
            return _publicar_json(url, payload)

        return _publicar_multipart(
            url,
            _convertir_payload_chroma_multipart(payload),
            {
                "archivo": {
                    "filename": datos_archivo["archivo_nombre"],
                    "content": _leer_pdf_version(datos_archivo),
                    "content_type": "application/pdf",
                }
            },
        )
    except RuntimeError as error:
        raise RuntimeError(f"No se pudo conectar con ChromaDB en {url}: {error}") from error


def _actualizar_estado_ia_version(id_documento, id_version, estado, porcentaje_texto=None, mensaje=""):
    columnas_requeridas = (
        "estado_ia",
        "porcentaje_texto_ia",
        "mensaje_ia",
        "fecha_analisis_ia",
    )
    if not id_version or not all(
        _columna_existe("doc_versions", columna) for columna in columnas_requeridas
    ):
        return

    services.actualizar_estado_ia(
        id_documento,
        id_version,
        _normalizar_estado_ia(estado),
        porcentaje_texto,
        str(mensaje or "")[:1000],
    )


def _reservar_reintento_ia(id_documento, id_version):
    """Reserva de forma atomica un reintento y evita dos analisis simultaneos."""
    return services.reservar_reintento_ia(
        id_documento,
        id_version,
        ESTADO_IA_PENDIENTE,
        "Reintento de analisis de IA pendiente.",
        ESTADO_IA_LEIDO,
        settings.IA_DOCUMENTOS_REINTENTO_ESPERA,
    )


def _mensaje_ia_con_advertencias(mensaje, advertencias):
    mensaje = str(mensaje or "")
    advertencias = [str(advertencia) for advertencia in advertencias if advertencia]
    if not advertencias:
        return mensaje
    return f"{mensaje} Advertencias: {' '.join(advertencias)}"


def _procesar_ia_documento_segundo_plano(
    id_documento,
    titulo,
    datos_archivo,
    contexto_version,
    contexto_accesos,
    tipo_documento=None,
    contexto_version_anterior=None,
    documento_url="",
):
    close_old_connections()
    id_version = contexto_version.get("id_version")
    respuesta_ia = {}
    advertencias = []
    try:
        _notificar_version_anterior_no_vigente(
            contexto_version_anterior,
            contexto_version,
        )
    except RuntimeError as error_chroma_vigencia:
        advertencias.append(str(error_chroma_vigencia))

    try:
        respuesta_ia = _llamar_ia_documentos(
            datos_archivo,
            contexto_accesos,
            tipo_documento,
        )
        porcentaje_texto = _validar_porcentaje_texto_ia(respuesta_ia)
    except ValueError as error:
        try:
            porcentaje_texto = _obtener_porcentaje_texto_ia(respuesta_ia)
        except Exception:
            porcentaje_texto = None
        _actualizar_estado_ia_version(
            id_documento,
            id_version,
            ESTADO_IA_OBSERVADO,
            porcentaje_texto,
            _mensaje_ia_con_advertencias(error, advertencias),
        )
        close_old_connections()
        return
    except RuntimeError as error:
        _actualizar_estado_ia_version(
            id_documento,
            id_version,
            ESTADO_IA_ERROR,
            None,
            _mensaje_ia_con_advertencias(error, advertencias),
        )
        close_old_connections()
        return
    except Exception as error:
        logger.exception(
            "Error inesperado al analizar con IA el documento %s, version %s.",
            id_documento,
            id_version,
        )
        _actualizar_estado_ia_version(
            id_documento,
            id_version,
            ESTADO_IA_ERROR,
            None,
            _mensaje_ia_con_advertencias(error, advertencias),
        )
        close_old_connections()
        return

    mensaje = _mensaje_ia_con_advertencias("Analisis de IA completado.", advertencias)
    try:
        respuesta_chroma = _guardar_documento_chroma(
            id_documento,
            titulo,
            datos_archivo,
            respuesta_ia,
            contexto_version,
            contexto_accesos,
            tipo_documento,
            documento_url,
        )
        mensaje = (
            f"El documento {titulo} fue analizado por la IA exitosamente."
        )
    except RuntimeError as error_chroma:
        mensaje = f"{mensaje} No se pudo actualizar ChromaDB: {error_chroma}"
    except Exception as error_chroma:
        logger.exception(
            "Error inesperado al actualizar ChromaDB para el documento %s, version %s.",
            id_documento,
            id_version,
        )
        mensaje = f"{mensaje} No se pudo actualizar ChromaDB: {error_chroma}"

    _actualizar_estado_ia_version(
        id_documento,
        id_version,
        ESTADO_IA_LEIDO,
        porcentaje_texto,
        mensaje,
    )
    close_old_connections()


def _iniciar_analisis_ia_segundo_plano(
    id_documento,
    titulo,
    datos_archivo,
    contexto_version,
    contexto_accesos,
    tipo_documento=None,
    contexto_version_anterior=None,
    documento_url="",
):
    id_version = contexto_version.get("id_version")
    _actualizar_estado_ia_version(
        id_documento,
        id_version,
        ESTADO_IA_PENDIENTE,
        None,
        "Analisis de IA pendiente.",
    )
    hilo = threading.Thread(
        target=_procesar_ia_documento_segundo_plano,
        args=(
            id_documento,
            titulo,
            datos_archivo,
            contexto_version,
            contexto_accesos,
            tipo_documento,
            contexto_version_anterior,
            documento_url,
        ),
        daemon=True,
    )
    hilo.start()


@require_POST
def reintentar_analisis_ia_documento(request, id_documento):
    usuario = _requerir_editor(request)
    if not usuario:
        return redirect("documentos:lista")

    id_version = None
    reintento_reservado = False
    try:
        documento = _obtener_documento_para_edicion(id_documento)
        contexto_version = _obtener_contexto_version_chroma(id_documento, vigente=True)
        id_version = contexto_version.get("id_version")
        if not id_version:
            raise ValueError("El documento no tiene una version vigente para analizar.")

        reintento_reservado = _reservar_reintento_ia(id_documento, id_version)
        if not reintento_reservado:
            messages.info(
                request,
                "El documento ya fue leido o su analisis de IA sigue en ejecucion.",
            )
            return redirect("documentos:lista")

        datos_archivo = _datos_archivo_desde_contexto_version(contexto_version)
        contexto_accesos = _contexto_accesos_documento(id_documento)
        _iniciar_analisis_ia_segundo_plano(
            id_documento,
            documento.get("titulo") or "",
            datos_archivo,
            contexto_version,
            contexto_accesos,
            documento.get("tipo") or "",
            documento_url=_construir_url_pdf_vigente(
                request, id_documento, contexto_version
            ),
        )
        messages.success(request, "El analisis de IA se envio nuevamente.")
    except (DatabaseError, ValueError, RuntimeError) as error:
        if reintento_reservado and id_version:
            try:
                _actualizar_estado_ia_version(
                    id_documento,
                    id_version,
                    ESTADO_IA_ERROR,
                    None,
                    error,
                )
            except DatabaseError:
                pass
        messages.error(request, f"No se pudo reintentar el analisis de IA: {error}")
    return redirect("documentos:lista")


def _datos_archivo_desde_contexto_version(contexto_version):
    archivo_path = str((contexto_version or {}).get("archivo_path") or "")
    archivo_nombre = str((contexto_version or {}).get("archivo_nombre") or Path(archivo_path).name)
    if not archivo_nombre:
        raise ValueError("La version vigente no tiene archivo asociado.")
    contenido = _leer_pdf_version(
        {"archivo_nombre": archivo_nombre, "archivo_path": archivo_path}
    )
    return {
        "archivo_nombre": archivo_nombre,
        "archivo_path": archivo_path,
        "archivo_tipo": "application/pdf",
        "archivo_tamano": len(contenido),
    }


def _quitar_vigencia_chroma(uuid_version):
    uuid_version = _texto_uuid(uuid_version)
    if not uuid_version:
        return {}

    url = f"{settings.IA_CHROMA_BASE_URL}{settings.IA_CHROMA_QUITAR_VIGENCIA_PATH}"
    try:
        return _publicar_json(url, {"uuid_version": uuid_version})
    except RuntimeError as error:
        raise RuntimeError(
            f"No se pudo quitar la vigencia en ChromaDB para la version {uuid_version}: {error}"
        ) from error


def _notificar_version_anterior_no_vigente(contexto_anterior, contexto_actual=None):
    uuid_anterior = _texto_uuid((contexto_anterior or {}).get("uuid_version"))
    uuid_actual = _texto_uuid((contexto_actual or {}).get("uuid_version"))
    if uuid_anterior and uuid_anterior != uuid_actual:
        return _quitar_vigencia_chroma(uuid_anterior)
    return {}


def _notificar_version_anterior_no_vigente_segundo_plano(contexto_anterior, contexto_actual=None):
    uuid_anterior = _texto_uuid((contexto_anterior or {}).get("uuid_version"))
    uuid_actual = _texto_uuid((contexto_actual or {}).get("uuid_version"))
    if not uuid_anterior or uuid_anterior == uuid_actual:
        return

    def notificar():
        close_old_connections()
        try:
            _notificar_version_anterior_no_vigente(contexto_anterior, contexto_actual)
        except RuntimeError:
            logger.exception(
                "No se pudo quitar la vigencia en ChromaDB para la version %s.",
                uuid_anterior,
            )
        finally:
            close_old_connections()

    hilo = threading.Thread(target=notificar, daemon=True)
    hilo.start()


def _validar_titulo_unico(titulo, id_documento=None):
    services.validar_titulo_unico(titulo, id_documento)


def _consultar_documento_accion(id_documento):
    return selectors.documento_para_accion(id_documento)


def _obtener_documento_para_edicion(id_documento):
    documento = _consultar_documento_accion(id_documento)
    if not documento:
        raise ValueError("El documento no existe.")
    return documento


def _obtener_documento_visible(id_documento):
    """Evita que un identificador escrito a mano salte las reglas de acceso."""
    usuario = _obtener_usuario_modulo()
    documentos = _listar_documentos_modulo(usuario, "", None)
    if not any(documento["id_documento"] == id_documento for documento in documentos):
        raise Http404("Documento no disponible.")

    detalle = _consultar_documento_accion(id_documento)
    if not detalle:
        raise Http404("Documento no encontrado.")
    return detalle


def _obtener_versiones(id_documento, solo_publicadas=False):
    versiones = selectors.versiones_activas(id_documento)
    for version in versiones:
        version["id_documento"] = id_documento
        version["vigente"] = version.get("estado") == "VIGENTE"
    _adjuntar_publicacion_versiones(id_documento, versiones)
    _adjuntar_estado_ia_versiones(id_documento, versiones)
    if solo_publicadas and _publicacion_habilitada():
        versiones = [version for version in versiones if version.get("publicado")]
    versiones = sorted(
        versiones,
        key=lambda version: (
            version.get("numero_version") or 0,
            version.get("id_version") or 0,
        ),
        reverse=True,
    )
    if not versiones:
        raise Http404("El documento no tiene versiones disponibles.")
    return versiones


def _adjuntar_publicacion_versiones(id_documento, versiones):
    if not versiones or not _publicacion_habilitada():
        return

    ids_versiones = [version["id_version"] for version in versiones]
    filas = VersionDocumento.objects.filter(
        documento_id=id_documento, pk__in=ids_versiones
    ).values("id_version", "publicado")
    publicados = {fila["id_version"]: bool(fila["publicado"]) for fila in filas}
    for version in versiones:
        version["publicado"] = publicados.get(version["id_version"], False)


def _version_esta_vigente(version):
    return bool(version.get("vigente") or version.get("estado") == "VIGENTE")


def _adjuntar_estado_ia_versiones(id_documento, versiones):
    if not versiones:
        return

    if not _columna_existe("doc_versions", "estado_ia"):
        for version in versiones:
            version["estado_ia"] = ESTADO_IA_PENDIENTE
            version["requiere_lectura_ia_publicacion"] = not version.get("publicado")
            version["label_ia"] = (
                ESTADOS_IA_DOCUMENTO[ESTADO_IA_PENDIENTE]["label"]
                if version["requiere_lectura_ia_publicacion"]
                else "No Leído"
            )
            version["bloqueada_publicacion_ia"] = (
                version["requiere_lectura_ia_publicacion"]
            )
        return

    ids_versiones = [version["id_version"] for version in versiones]
    filas = VersionDocumento.objects.filter(
        documento_id=id_documento, pk__in=ids_versiones
    ).values("id_version", "estado_ia")
    estados = {
        fila["id_version"]: _normalizar_estado_ia(fila.get("estado_ia"))
        for fila in filas
    }
    for version in versiones:
        estado = estados.get(version["id_version"], ESTADO_IA_PENDIENTE)
        requiere_lectura_ia = not version.get("publicado")
        version["estado_ia"] = estado
        version["requiere_lectura_ia_publicacion"] = requiere_lectura_ia
        version["label_ia"] = (
            ESTADOS_IA_DOCUMENTO[estado]["label"] if requiere_lectura_ia else "No Leído"
        )
        version["bloqueada_publicacion_ia"] = (
            requiere_lectura_ia
            and estado != ESTADO_IA_LEIDO
        )


def _validar_publicacion_versiones_por_ia(versiones, ids_publicados):
    versiones_por_id = {int(version["id_version"]): version for version in versiones}
    bloqueadas = []
    for id_version in ids_publicados:
        version = versiones_por_id.get(int(id_version))
        if not version:
            continue
        if version.get("publicado"):
            continue
        if _normalizar_estado_ia(version.get("estado_ia")) != ESTADO_IA_LEIDO:
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


def _obtener_versiones_visibles(id_documento, usuario=None):
    usuario = usuario or _obtener_usuario_modulo()
    return _obtener_versiones(
        id_documento,
        solo_publicadas=usuario["rol_modulo"] != "EDITOR",
    )


def _seleccionar_version(versiones, id_version, preferir_vigente=True):
    if id_version is not None:
        for version in versiones:
            if version["id_version"] == id_version:
                return version
        raise Http404("La versiÃ³n solicitada no pertenece al documento.")
    if preferir_vigente:
        return next((version for version in versiones if version.get("vigente")), versiones[0])
    return versiones[0]


def _validar_cambio_vigencia_version(versiones, id_version, estado_version):
    if estado_version != "VIGENTE":
        return

    existe_otra_vigente = any(
        version["id_version"] != id_version
        and (version.get("vigente") or version.get("estado") == "VIGENTE")
        for version in versiones
    )
    if existe_otra_vigente:
        raise ValueError(
            "No se puede tener mas de una version vigente para el documento. "
            "Primero cambie la version vigente actual a No vigente y luego active "
            "la version seleccionada."
        )


def _version_esta_vigente(version):
    return bool(version.get("vigente") or version.get("estado") == "VIGENTE")


def _fecha_comparable(valor):
    if valor is None:
        return None
    if hasattr(valor, "date"):
        return valor.date()
    return valor


def _texto_comparable(valor):
    return str(valor or "").strip()


def _accesos_documento_combinaciones(id_documento):
    accesos = selectors.accesos_de_documento(id_documento)
    return {
        (
            acceso.get("id_perfil_externo"),
            acceso.get("id_grupo_externo"),
            acceso.get("id_tipo_periodo_externo"),
        )
        for acceso in accesos
    } or {(None, None, None)}


def _accesos_comparables(accesos):
    return set(accesos) or {(None, None, None)}


def _edicion_mantiene_metadata_actual(
    documento,
    id_documento,
    titulo,
    tipo,
    descripcion,
    palabras_clave,
    fecha_aprobacion,
    accesos,
):
    return (
        _texto_comparable(titulo) == _texto_comparable(documento.get("titulo"))
        and _texto_comparable(tipo) == _texto_comparable(documento.get("tipo"))
        and _texto_comparable(descripcion) == _texto_comparable(documento.get("descripcion"))
        and _texto_comparable(palabras_clave) == _texto_comparable(documento.get("palabras_clave"))
        and _fecha_comparable(fecha_aprobacion)
        == _fecha_comparable(documento.get("fecha_aprobacion"))
        and _accesos_comparables(accesos)
        == _accesos_documento_combinaciones(id_documento)
    )


def _validar_edicion_version_vigente(
    documento,
    version,
    estado_version,
    archivo,
    titulo,
    descripcion,
    palabras_clave,
    fecha_aprobacion,
    accesos,
):
    if not _version_esta_vigente(version):
        return

    # La edición directa de una versión vigente se permite; el guardado relanza
    # el análisis IA cuando detecta cambios en PDF, metadatos o accesos.
    return


def _eliminar_documento_logico(id_documento, motivo, usuario):
    services.eliminar_documento_logicamente(
        id_documento, motivo, usuario["id_usuario_externo"]
    )


def _documento_tiene_version_publicada(id_documento, id_version=None):
    if not _publicacion_habilitada():
        return False

    versiones = VersionDocumento.objects.filter(
        documento_id=id_documento, publicado=True
    )
    if id_version is not None:
        versiones = versiones.filter(pk=id_version)
    return versiones.exists()


def _eliminar_version_logica(id_documento, id_version, motivo, usuario):
    services.eliminar_version_logicamente(
        id_documento, id_version, motivo, usuario["id_usuario_externo"]
    )


def _restaurar_documento_logico(id_documento, usuario):
    services.restaurar_documento_logicamente(
        id_documento, usuario["id_usuario_externo"]
    )


def _restaurar_version_logica(id_documento, id_version):
    # Una versión puede restaurarse cuando su documento completo está en la
    # papelera. En ese caso, además de recuperar la versión, se debe retirar
    # la baja lógica del documento; de lo contrario la consulta principal lo
    # excluye por ``docs.fecha_eliminacion IS NOT NULL``.
    services.restaurar_version_logicamente(id_documento, id_version)


def _restaurar_versiones_logicas(id_documento, ids_versiones):
    """Restaura, en una sola operación, versiones seleccionadas de la papelera."""
    ids_versiones = list(dict.fromkeys(ids_versiones))
    if not ids_versiones:
        raise ValueError("Seleccione al menos una versión para restaurar.")

    services.restaurar_versiones_logicamente(id_documento, ids_versiones)


def _registrar_auditoria_django(
    usuario,
    usuario_django,
    id_documento,
    accion,
    motivo,
    resumen,
    mensaje=None,
):
    """Registra la auditoría documental usando la bitácora estándar de Django."""
    usuario_id = (
        getattr(usuario_django, "pk", None)
        if getattr(usuario_django, "is_authenticated", False)
        else None
    )
    if not usuario_id:
        modelo_usuario = get_user_model()
        usuario_id = (
            modelo_usuario.objects.filter(
                pk=usuario.get("id_usuario_externo")
            ).values_list("pk", flat=True).first()
            or modelo_usuario.objects.order_by("pk").values_list("pk", flat=True).first()
        )
    if not usuario_id:
        raise ValueError("No se pudo identificar el usuario de Django para la auditoría.")

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
        action_flag=DELETION,
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


def _mensaje_edicion_documento(usuario, titulo, cambios):
    mensaje = f"{usuario.get('nombre_usuario') or 'Usuario'} ha editado el documento {titulo}."
    if len(cambios) == 1:
        return f"{mensaje} Cambio realizado: {cambios[0]}."
    if cambios:
        return f"{mensaje} Cambios realizados: {', '.join(cambios)}."
    return mensaje


def _fecha_comparable(valor):
    return str(valor or "")[:10]


def _valor_auditoria(valor, limite=120):
    texto = " ".join(str(valor or "Sin valor").split())
    return texto if len(texto) <= limite else f"{texto[:limite - 3]}..."


def _resumen_accesos_auditoria(contexto):
    partes = []
    for campo, etiqueta in (("perfiles", "perfiles"), ("grupos", "grupos"), ("tipos_periodo", "periodos")):
        nombres = ", ".join(opcion["nombre"] for opcion in contexto.get(campo, []))
        partes.append(f"{etiqueta}: {nombres or 'Todos'}")
    return "; ".join(partes)


def _eliminar_documento_fisico(id_documento, motivo, usuario, usuario_django):
    """Elimina de la base un documento que ya se encuentra en la papelera."""
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


def _eliminar_archivo_version_fisico(version):
    ruta = str(version.get("archivo_path") or "").strip()
    if not ruta:
        return
    if ruta.startswith("documentos/"):
        default_storage.delete(ruta)
        return

    # Los documentos heredados se almacenan en FLASK_PDF_DIR y en la base
    # pueden tener una ruta distinta a la usada por el storage de Django.
    nombre = Path(ruta or str(version.get("archivo_nombre") or "")).name
    raiz = settings.FLASK_PDF_DIR.resolve()
    ruta_heredada = (raiz / nombre).resolve()
    if ruta_heredada != raiz and raiz not in ruta_heredada.parents:
        raise ValueError("La ruta del PDF heredado no es válida.")
    if ruta_heredada.exists():
        ruta_heredada.unlink()


def _eliminar_version_fisica(id_documento, id_version, motivo, usuario, usuario_django):
    """Elimina permanentemente una versión que ya se encuentra en la papelera."""
    with transaction.atomic():
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

    return version


def _eliminar_versiones_fisicas(id_documento, ids_versiones, motivo, usuario, usuario_django):
    """Elimina definitivamente varias versiones que permanecen en la papelera."""
    ids_versiones = list(dict.fromkeys(ids_versiones))
    if not ids_versiones:
        raise ValueError("Seleccione al menos una versión para eliminar.")

    with transaction.atomic():
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

    return versiones


# TEMPORAL: esta copia permite probar eliminaciones cuando el módulo usa el
# usuario simulado y aún no existe una sesión o usuario real de Django.
# Debe eliminarse al conectar el módulo con la autenticación real.
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


def _insertar_accesos_documento(id_documento, accesos, usuario):
    services.reemplazar_accesos_documento(
        id_documento, accesos, usuario["id_usuario_externo"]
    )


def _eliminar_accesos_documento(id_documento):
    AccesoDocumento.objects.filter(documento_id=id_documento).delete()


def _reemplazar_accesos_documento(id_documento, accesos, usuario):
    services.reemplazar_accesos_documento(
        id_documento, accesos, usuario["id_usuario_externo"]
    )


def _crear_documento_base(titulo, descripcion, palabras_clave, fecha_aprobacion, datos_archivo, usuario):
    return services.crear_documento(
        titulo, descripcion, palabras_clave, fecha_aprobacion, datos_archivo,
        usuario["id_usuario_externo"],
    )


def _validar_tipo_documento(tipo):
    if tipo not in TIPOS_DOCUMENTO:
        raise ValueError("El tipo de documento no es válido.")
    return tipo


def _tipo_documento_formulario(tipo_solicitado="", tipo_actual=""):
    """Resuelve el tipo sin perder soporte para reactivar el selector."""
    if SELECTOR_TIPO_DOCUMENTO_HABILITADO:
        return _validar_tipo_documento((tipo_solicitado or "").strip())
    return tipo_actual or TIPO_DOCUMENTO_PREDETERMINADO


def _actualizar_tipo_documento(id_documento, tipo):
    services.actualizar_tipo_documento(id_documento, tipo)


def _editar_documento_base(id_documento, titulo, descripcion, palabras_clave, fecha_aprobacion, id_version, usuario):
    services.editar_documento(
        id_documento, titulo, descripcion, palabras_clave, fecha_aprobacion,
        id_version, usuario["id_usuario_externo"],
    )


def _cambiar_estado_version_directo(id_documento, id_version, estado_version):
    services.cambiar_estado_version(id_documento, id_version, estado_version)


def _agregar_version_directa(id_documento, datos_archivo, descripcion_cambio, fecha_aprobacion, usuario):
    return services.agregar_version(
        id_documento, datos_archivo, descripcion_cambio, fecha_aprobacion,
        usuario["id_usuario_externo"],
    )


def _reemplazar_archivo_version_directo(id_documento, id_version, datos_archivo, usuario):
    services.reemplazar_archivo_version(
        id_documento, id_version, datos_archivo, usuario["id_usuario_externo"]
    )


def _guardar_publicacion_versiones(id_documento, ids_publicados, usuario):
    if not _publicacion_habilitada():
        raise ValueError(
            "La publicacion de versiones no esta disponible en esta base de datos."
        )

    services.guardar_publicacion_versiones(
        id_documento, ids_publicados, usuario["id_usuario_externo"]
    )


def visor_pdf(request, id_documento):
    """Muestra una version existente y registra su apertura para lectores."""
    try:
        id_version = int(request.GET["version"]) if request.GET.get("version") else None
    except ValueError as error:
        raise Http404("Versión no válida.") from error

    try:
        usuario = _obtener_usuario_modulo()
        documento = _obtener_documento_visible(id_documento)
        versiones = _obtener_versiones_visibles(id_documento, usuario)
    except DatabaseError as error:
        raise Http404("No fue posible consultar el documento.") from error

    version_actual = _seleccionar_version(
        versiones,
        id_version,
        preferir_vigente=usuario["rol_modulo"] == "EDITOR",
    )
    if usuario["rol_modulo"] == "LECTOR":
        services.registrar_lectura_documento(
            id_documento,
            version_actual["id_version"],
            usuario,
        )
    return render(
        request,
        "documentos/visor_pdf.html",
        {
            "documento": documento,
            "versiones": versiones,
            "version_actual": version_actual,
            "id_documento": id_documento,
        },
    )


@xframe_options_sameorigin
def servir_pdf(request, id_documento, id_version):
    """Entrega un PDF existente de Flask, restringido al documento y versiÃ³n visibles."""
    try:
        usuario = _obtener_usuario_modulo()
        _obtener_documento_visible(id_documento)
        version = _seleccionar_version(
            _obtener_versiones_visibles(id_documento, usuario),
            id_version,
            preferir_vigente=usuario["rol_modulo"] == "EDITOR",
        )
    except DatabaseError as error:
        raise Http404("No fue posible consultar el archivo.") from error

    nombre_archivo = Path(
        str(version.get("archivo_nombre") or version.get("archivo_path") or "")
    ).name
    if not nombre_archivo.lower().endswith(".pdf"):
        raise Http404("El archivo asociado no es un PDF válido.")

    try:
        contenido = _leer_pdf_version(version)
    except ValueError as error:
        raise Http404(str(error)) from error

    respuesta = FileResponse(BytesIO(contenido), content_type="application/pdf")
    respuesta["Content-Disposition"] = f'inline; filename="{nombre_archivo}"'
    respuesta["Cache-Control"] = "private, no-store"
    return respuesta


@xframe_options_sameorigin
def servir_pdf_version_papelera(request, id_documento, id_version):
    """Permite a los editores previsualizar un PDF eliminado sin restaurarlo."""
    usuario = _obtener_usuario_modulo()
    if usuario["rol_modulo"] != "EDITOR":
        raise Http404("No tienes permisos para ver esta versión.")

    version = VersionDocumento.objects.filter(
        documento_id=id_documento,
        pk=id_version,
        fecha_eliminacion__isnull=False,
    ).values("archivo_nombre", "archivo_path").first()
    if not version:
        raise Http404("La versión eliminada no está disponible.")
    nombre_archivo = Path(
        str(version.get("archivo_nombre") or version.get("archivo_path") or "")
    ).name
    if not nombre_archivo.lower().endswith(".pdf"):
        raise Http404("El archivo asociado no es un PDF válido.")
    try:
        contenido = _leer_pdf_version(version)
    except ValueError as error:
        raise Http404(str(error)) from error

    respuesta = FileResponse(BytesIO(contenido), content_type="application/pdf")
    respuesta["Content-Disposition"] = f'inline; filename="{nombre_archivo}"'
    respuesta["Cache-Control"] = "private, no-store"
    return respuesta


def papelera_documentos(request):
    """Lista documentos y versiones eliminados lÃ³gicamente para editores."""
    usuario = _obtener_usuario_modulo()
    if usuario["rol_modulo"] != "EDITOR":
        messages.error(request, "No tienes permisos para ver la papelera.")
        return redirect("documentos:lista")

    busqueda = request.GET.get("q", "").strip()
    anio = request.GET.get("anio", "").strip()
    vista_historial = request.GET.get("vista") == "historial"
    if vista_historial:
        try:
            historial_eliminaciones = list(
                HistorialEliminacion.objects.values(
                    "id_historial", "id_documento", "id_version",
                    "titulo_documento", "numero_version", "nombre_usuario",
                    "motivo_eliminacion", "total_versiones",
                    "versiones_eliminadas", "fecha_eliminacion",
                )
            )
            for eliminacion in historial_eliminaciones:
                versiones = eliminacion.get("versiones_eliminadas") or []
                eliminacion["versiones_eliminadas"] = (
                    json.loads(versiones) if isinstance(versiones, str) else versiones
                )
        except DatabaseError as error:
            messages.error(request, f"No se pudo consultar el historial: {error}")
            historial_eliminaciones = []
        return render(
            request,
            "documentos/papelera.html",
            {
                "usuario": usuario,
                "vista_historial": True,
                "historial_eliminaciones": historial_eliminaciones,
            },
        )
    documentos = []
    try:
        documentos = _listar_papelera_fallback(busqueda, anio or None)
    except (DatabaseError, ValueError) as error:
        messages.error(request, f"No se pudo consultar la papelera: {error}")

    documentos_para_anios = documentos
    if anio:
        try:
            documentos_para_anios = _listar_papelera_fallback(busqueda, None)
        except (DatabaseError, ValueError):
            documentos_para_anios = documentos

    anios_disponibles = _extraer_anios_disponibles(documentos_para_anios)
    grupos_papelera = _agrupar_papelera_por_documento(documentos)
    return render(
        request,
        "documentos/papelera.html",
        {
            "documentos": documentos,
            "grupos_papelera": grupos_papelera,
            "usuario": usuario,
            "busqueda": busqueda,
            "anio": anio,
            "anios_disponibles": anios_disponibles,
            "capacidades": _capacidades_base(),
        },
    )


@require_POST
def restaurar_documento(request, id_documento):
    """Restaura un documento mediante el procedimiento heredado."""
    usuario = _obtener_usuario_modulo()
    if usuario["rol_modulo"] != "EDITOR":
        messages.error(request, "No tienes permisos para restaurar documentos.")
        return redirect("documentos:lista")

    try:
        _restaurar_documento_logico(id_documento, usuario)
        messages.success(request, "Documento restaurado correctamente.")
    except DatabaseError as error:
        messages.error(request, f"No se pudo restaurar el documento: {error}")
    return redirect("documentos:papelera")


@require_POST
def restaurar_version_documento(request, id_documento, id_version):
    """Restaura una versiÃ³n mediante el procedimiento heredado."""
    usuario = _obtener_usuario_modulo()
    if usuario["rol_modulo"] != "EDITOR":
        messages.error(request, "No tienes permisos para restaurar versiones.")
        return redirect("documentos:lista")

    try:
        _restaurar_version_logica(id_documento, id_version)
        messages.success(request, "Versión restaurada correctamente.")
    except DatabaseError as error:
        messages.error(request, f"No se pudo restaurar la versión: {error}")
    return redirect("documentos:papelera")


@require_POST
def restaurar_versiones_documento(request, id_documento):
    """Restaura las versiones seleccionadas de un documento en la papelera."""
    usuario = _obtener_usuario_modulo()
    if usuario["rol_modulo"] != "EDITOR":
        messages.error(request, "No tienes permisos para restaurar versiones.")
        return redirect("documentos:lista")

    try:
        ids_versiones = _ids_enteros_formulario(request, "id_version")
        _restaurar_versiones_logicas(id_documento, ids_versiones)
        messages.success(request, f"Se restauraron {len(ids_versiones)} versiones correctamente.")
    except (DatabaseError, ValueError) as error:
        messages.error(request, f"No se pudieron restaurar las versiones: {error}")
    return redirect("documentos:papelera")


@require_POST
def eliminar_documento_definitivamente(request, id_documento):
    """Elimina permanentemente un documento previamente dado de baja lógica."""
    usuario = _requerir_editor(request)
    if not usuario:
        return redirect("documentos:lista")

    motivo = request.POST.get("motivo_eliminacion_definitiva", "").strip()
    if len(motivo) < 5:
        messages.error(
            request,
            "El motivo de la eliminación definitiva es obligatorio y debe tener al menos 5 caracteres.",
        )
        return redirect("documentos:papelera")

    try:
        versiones = _eliminar_documento_fisico(
            id_documento,
            motivo,
            usuario,
            request.user,
        )
        archivos_no_eliminados = []
        rutas_procesadas = set()
        for version in versiones:
            ruta = str(version.get("archivo_path") or "").strip()
            if not ruta or ruta in rutas_procesadas:
                continue
            rutas_procesadas.add(ruta)
            try:
                _eliminar_archivo_version_fisico(version)
            except (OSError, ValueError):
                archivos_no_eliminados.append(ruta)

        if archivos_no_eliminados:
            messages.warning(
                request,
                "El registro fue eliminado definitivamente, pero no se pudieron borrar "
                "todos los archivos físicos. Revisa el almacenamiento.",
            )
        else:
            messages.success(request, "Documento eliminado definitivamente.")
    except (DatabaseError, ValueError) as error:
        messages.error(request, f"No se pudo eliminar definitivamente el documento: {error}")
    return redirect("documentos:papelera")


@require_POST
def eliminar_version_definitivamente(request, id_documento, id_version):
    """Elimina permanentemente una versión eliminada lógicamente."""
    usuario = _requerir_editor(request)
    if not usuario:
        return redirect("documentos:lista")

    motivo = request.POST.get("motivo_eliminacion_definitiva", "").strip()
    if len(motivo) < 5:
        messages.error(
            request,
            "El motivo de la eliminación definitiva es obligatorio y debe tener al menos 5 caracteres.",
        )
        return redirect("documentos:papelera")

    try:
        version = _eliminar_version_fisica(
            id_documento,
            id_version,
            motivo,
            usuario,
            request.user,
        )
        try:
            _eliminar_archivo_version_fisico(version)
        except (OSError, ValueError):
            messages.warning(
                request,
                "La versión fue eliminada definitivamente, pero no se pudo borrar su archivo físico. "
                "Revisa el almacenamiento.",
            )
        else:
            messages.success(request, "Versión eliminada definitivamente.")
    except (DatabaseError, ValueError) as error:
        messages.error(request, f"No se pudo eliminar definitivamente la versión: {error}")
    return redirect("documentos:papelera")


@require_POST
def eliminar_versiones_definitivamente(request, id_documento):
    """Elimina en una sola operación las versiones seleccionadas de la papelera."""
    usuario = _requerir_editor(request)
    if not usuario:
        return redirect("documentos:lista")

    motivo = request.POST.get("motivo_eliminacion_definitiva", "").strip()
    try:
        ids_versiones = _ids_enteros_formulario(request, "id_version")
        if len(motivo) < 5:
            raise ValueError(
                "El motivo de eliminación definitiva es obligatorio y debe tener al menos 5 caracteres."
            )
        versiones = _eliminar_versiones_fisicas(
            id_documento,
            ids_versiones,
            motivo,
            usuario,
            request.user,
        )
        archivos_no_eliminados = []
        for version in versiones:
            try:
                _eliminar_archivo_version_fisico(version)
            except (OSError, ValueError):
                archivos_no_eliminados.append(str(version.get("archivo_path") or ""))

        if archivos_no_eliminados:
            messages.warning(
                request,
                f"Se eliminaron {len(versiones)} versiones, pero no se pudieron borrar "
                "todos sus archivos físicos. Revisa el almacenamiento.",
            )
        else:
            messages.success(request, f"Se eliminaron definitivamente {len(versiones)} versiones.")
    except (DatabaseError, ValueError) as error:
        messages.error(request, f"No se pudieron eliminar las versiones: {error}")
    return redirect("documentos:papelera")


@require_POST
def crear_documento(request):
    usuario = _requerir_editor(request)
    if not usuario:
        return redirect("documentos:lista")

    datos_archivo = None
    try:
        titulo = request.POST.get("titulo", "").strip()
        descripcion = request.POST.get("descripcion", "").strip()
        palabras_clave = request.POST.get("palabras_clave", "").strip()
        tipo = _tipo_documento_formulario(request.POST.get("tipo", ""))
        fecha_aprobacion = _fecha_formulario(
            request.POST.get("fecha_aprobacion"),
            requerido=True,
        )
        archivo = request.FILES.get("archivo")
        if not titulo:
            raise ValueError("El título del documento es obligatorio.")
        if not archivo:
            raise ValueError("Debe seleccionar un archivo PDF.")

        _validar_pdf_texto_minimo(archivo)
        _validar_titulo_unico(titulo)
        accesos = _combinaciones_acceso(request)
        contexto_accesos = _contexto_accesos_formulario(request)
        datos_archivo = _guardar_pdf_django(archivo)
        with transaction.atomic():
            id_documento = _crear_documento_base(
                titulo,
                descripcion,
                palabras_clave,
                fecha_aprobacion,
                datos_archivo,
                usuario,
            )
            _actualizar_tipo_documento(id_documento, tipo)
            _insertar_accesos_documento(id_documento, accesos, usuario)
            _sincronizar_estado_versiones(id_documento)
            _sincronizar_versionamiento_documento(id_documento)
        _registrar_auditoria_django_pruebas(
            usuario,
            request.user,
            id_documento,
            "CREACION_DOCUMENTO",
            "",
            {"titulo": titulo, "tipo": tipo, "fecha_aprobacion": str(fecha_aprobacion)},
            mensaje=(
                f"{usuario.get('nombre_usuario') or 'Usuario'} ha creado el documento {titulo}."
            ),
            action_flag=ADDITION,
        )
        version_nueva = _obtener_contexto_version_chroma(id_documento, vigente=True)
        contexto_version = _construir_contexto_reemplazo_version(version_nueva)
        _iniciar_analisis_ia_segundo_plano(
            id_documento,
            titulo,
            datos_archivo,
            contexto_version,
            contexto_accesos,
            tipo,
            documento_url=_construir_url_pdf_vigente(
                request, id_documento, contexto_version
            ),
        )
        messages.success(
            request,
            "Documento creado correctamente. Analisis de IA en segundo plano.",
        )
    except (DatabaseError, ValueError, RuntimeError) as error:
        if datos_archivo:
            default_storage.delete(datos_archivo["archivo_path"])
        messages.error(request, f"No se pudo crear el documento: {error}")
    return redirect("documentos:lista")


@require_POST
def editar_documento(request, id_documento):
    usuario = _requerir_editor(request)
    if not usuario:
        return redirect("documentos:lista")

    datos_archivo = None
    try:
        titulo = request.POST.get("titulo", "").strip()
        descripcion = request.POST.get("descripcion", "").strip()
        palabras_clave = request.POST.get("palabras_clave", "").strip()
        fecha_aprobacion = _fecha_formulario(
            request.POST.get("fecha_aprobacion"),
            requerido=True,
        )
        id_version = int(request.POST.get("id_version_vigente", ""))
        estado_version = request.POST.get("estado_version", "VIGENTE")
        if estado_version not in {"VIGENTE", "INACTIVO"}:
            raise ValueError("El estado de la versión no es válido.")
        documento = _obtener_documento_para_edicion(id_documento)
        tipo = _tipo_documento_formulario(
            request.POST.get("tipo", ""),
            documento.get("tipo") or TIPO_DOCUMENTO_PREDETERMINADO,
        )
        puede_cambiar_estado_version = _columna_existe("doc_versions", "estado")
        if estado_version != "VIGENTE" and not puede_cambiar_estado_version:
            raise ValueError(
                "El cambio de estado de versiones no esta disponible en esta base de datos."
            )
        if not titulo:
            raise ValueError("El titulo del documento es obligatorio.")
        cambios = []
        if titulo != (documento.get("titulo") or ""):
            cambios.append(f"Título: '{_valor_auditoria(documento.get('titulo'))}' → '{_valor_auditoria(titulo)}'")
        if descripcion != (documento.get("descripcion") or ""):
            cambios.append(f"Descripción: '{_valor_auditoria(documento.get('descripcion'))}' → '{_valor_auditoria(descripcion)}'")
        if palabras_clave != (documento.get("palabras_clave") or ""):
            cambios.append(f"Palabras clave: '{_valor_auditoria(documento.get('palabras_clave'))}' → '{_valor_auditoria(palabras_clave)}'")
        if tipo != (documento.get("tipo") or ""):
            cambios.append(f"Tipo de documento: '{_valor_auditoria(documento.get('tipo'))}' → '{_valor_auditoria(tipo)}'")
        if _fecha_comparable(fecha_aprobacion) != _fecha_comparable(
            documento.get("fecha_aprobacion")
        ):
            cambios.append(f"Fecha de aprobación: '{_fecha_comparable(documento.get('fecha_aprobacion'))}' → '{_fecha_comparable(fecha_aprobacion)}'")

        versiones = _obtener_versiones(id_documento)
        version_seleccionada = _seleccionar_version(versiones, id_version)
        if id_version != documento.get("id_version_vigente"):
            cambios.append(f"Versión vigente: '{documento.get('numero_version_vigente') or documento.get('id_version_vigente')}' → '{version_seleccionada.get('numero_version')}'")
        if estado_version != version_seleccionada.get("estado"):
            cambios.append(f"Estado de versión: '{version_seleccionada.get('estado')}' → '{estado_version}'")
        if puede_cambiar_estado_version:
            _validar_cambio_vigencia_version(versiones, id_version, estado_version)
        accesos = _combinaciones_acceso(request)
        contexto_accesos = _contexto_accesos_formulario(request)
        accesos_anteriores = _contexto_accesos_documento(id_documento)
        if accesos_anteriores != contexto_accesos:
            cambios.append(f"Permisos de acceso: '{_resumen_accesos_auditoria(accesos_anteriores)}' → '{_resumen_accesos_auditoria(contexto_accesos)}'")
        archivo = request.FILES.get("archivo")
        if archivo:
            cambios.append(f"Archivo PDF: reemplazado por '{archivo.name}'")
        if archivo and not _columna_existe("doc_versions", "archivo_path"):
            raise ValueError(
                "El reemplazo de archivos no esta disponible en esta base de datos."
            )
        _validar_edicion_version_vigente(
            documento,
            version_seleccionada,
            estado_version,
            archivo,
            titulo,
            descripcion,
            palabras_clave,
            fecha_aprobacion,
            accesos,
        )
        if not cambios:
            messages.info(
                request,
                "No se guardaron cambios porque el documento no fue modificado.",
            )
            return redirect("documentos:lista")

        version_vigente_anterior_chroma = _obtener_contexto_version_chroma(
            id_documento,
            vigente=True,
        )
        metadata_modificada = not _edicion_mantiene_metadata_actual(
            documento,
            id_documento,
            titulo,
            tipo,
            descripcion,
            palabras_clave,
            fecha_aprobacion,
            accesos,
        )
        _validar_titulo_unico(titulo, id_documento)
        if archivo:
            version_anterior_chroma = _obtener_contexto_version_chroma(
                id_documento,
                id_version=id_version,
            )
            _validar_pdf_texto_minimo(archivo)
            datos_archivo = _guardar_pdf_django(archivo)

        with transaction.atomic():
            _editar_documento_base(
                id_documento,
                titulo,
                descripcion,
                palabras_clave,
                fecha_aprobacion,
                id_version,
                usuario,
            )
            _actualizar_tipo_documento(id_documento, tipo)
            _reemplazar_accesos_documento(id_documento, accesos, usuario)
            if puede_cambiar_estado_version:
                _cambiar_estado_version_directo(id_documento, id_version, estado_version)
            if datos_archivo:
                _reemplazar_archivo_version_directo(id_documento, id_version, datos_archivo, usuario)
        _registrar_auditoria_django_pruebas(
            usuario,
            request.user,
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
                _mensaje_edicion_documento(usuario, titulo, cambios)
            ),
            action_flag=CHANGE,
        )
        version_vigente_actual_chroma = _obtener_contexto_version_chroma(
            id_documento,
            vigente=True,
        )
        try:
            _notificar_version_anterior_no_vigente(
                version_vigente_anterior_chroma,
                version_vigente_actual_chroma,
            )
        except RuntimeError as error_chroma_vigencia:
            messages.warning(request, str(error_chroma_vigencia))
        cambio_version_vigente = (
            estado_version == "VIGENTE"
            and version_vigente_actual_chroma.get("id_version") == id_version
            and _texto_uuid(version_vigente_anterior_chroma.get("uuid_version"))
            != _texto_uuid(version_vigente_actual_chroma.get("uuid_version"))
        )
        version_editada_quedo_vigente = (
            estado_version == "VIGENTE"
            and version_vigente_actual_chroma.get("id_version") == id_version
        )
        debe_reanalizar_ia = version_editada_quedo_vigente and (
            bool(datos_archivo) or metadata_modificada or cambio_version_vigente
        )
        if debe_reanalizar_ia:
            try:
                if datos_archivo:
                    version_nueva_chroma = _obtener_contexto_version_chroma(
                        id_documento,
                        id_version=id_version,
                    )
                    contexto_version = _construir_contexto_reemplazo_version(
                        version_nueva_chroma,
                        version_anterior_chroma,
                    )
                    datos_analisis = datos_archivo
                else:
                    contexto_version = _construir_contexto_reemplazo_version(
                        version_vigente_actual_chroma,
                        version_vigente_anterior_chroma,
                    )
                    datos_analisis = _datos_archivo_desde_contexto_version(
                        version_vigente_actual_chroma
                    )
                _iniciar_analisis_ia_segundo_plano(
                    id_documento,
                    titulo,
                    datos_analisis,
                    contexto_version,
                    contexto_accesos,
                    tipo,
                    documento_url=_construir_url_pdf_vigente(
                        request, id_documento, contexto_version
                    ),
                )
                messages.success(
                    request,
                    "Documento editado correctamente. Analisis de IA en segundo plano.",
                )
            except (RuntimeError, ValueError) as error_chroma:
                messages.warning(
                    request,
                    "Documento editado correctamente, pero no se pudo iniciar el "
                    f"analisis de IA de la version vigente: {error_chroma}",
                )
        else:
            messages.success(request, "Documento editado correctamente.")
    except (DatabaseError, ValueError, RuntimeError) as error:
        if datos_archivo:
            default_storage.delete(datos_archivo["archivo_path"])
        mensaje_error = f"No se pudo editar el documento: {error}"
        if "No se puede tener mas de una version vigente" in str(error):
            messages.info(request, mensaje_error)
        else:
            messages.error(request, mensaje_error)
    return redirect("documentos:lista")


@require_POST
def agregar_version_documento(request, id_documento):
    usuario = _requerir_editor(request)
    if not usuario:
        return redirect("documentos:lista")

    datos_archivo = None
    try:
        documento = _obtener_documento_para_edicion(id_documento)
        archivo = request.FILES.get("archivo")
        if not archivo:
            raise ValueError("Debe seleccionar un archivo PDF.")
        descripcion_cambio = request.POST.get("descripcion_cambio", "").strip() or "Nueva version"
        fecha_aprobacion = _fecha_formulario(
            request.POST.get("fecha_aprobacion"),
            requerido=True,
        )
        version_anterior_chroma = _obtener_contexto_version_chroma(id_documento, vigente=True)
        contexto_accesos = _contexto_accesos_documento(id_documento)
        _validar_pdf_texto_minimo(archivo)
        datos_archivo = _guardar_pdf_django(archivo)
        id_version_nueva = _agregar_version_directa(
            id_documento,
            datos_archivo,
            descripcion_cambio,
            fecha_aprobacion,
            usuario,
        )
        _registrar_auditoria_django_pruebas(
            usuario,
            request.user,
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
        version_nueva_chroma = _obtener_contexto_version_chroma(
            id_documento,
            id_version=id_version_nueva,
        )
        contexto_version = _construir_contexto_reemplazo_version(
            version_nueva_chroma,
            version_anterior_chroma,
        )
        _iniciar_analisis_ia_segundo_plano(
            id_documento,
            documento.get("titulo") or "",
            datos_archivo,
            contexto_version,
            contexto_accesos,
            documento.get("tipo") or "",
            documento_url=_construir_url_pdf_vigente(
                request, id_documento, contexto_version
            ),
        )
        messages.success(
            request,
            "Nueva version agregada correctamente. Analisis de IA en segundo plano.",
        )
    except (DatabaseError, ValueError, RuntimeError) as error:
        if datos_archivo:
            default_storage.delete(datos_archivo["archivo_path"])
        messages.error(request, f"No se pudo agregar la versión: {error}")
    return redirect("documentos:lista")


@require_POST
def publicar_versiones_documento(request, id_documento):
    usuario = _requerir_editor(request)
    if not usuario:
        return redirect("documentos:lista")

    try:
        documento = _obtener_documento_para_edicion(id_documento)
        versiones = _obtener_versiones(id_documento)
        ids_disponibles = {int(version["id_version"]) for version in versiones}
        retirar_todas = request.POST.get("accion_publicacion") == "retirar_todas"
        ids_publicados = (
            set()
            if retirar_todas
            else set(_ids_enteros_formulario(request, "id_version_publicada"))
        )
        ids_invalidos = ids_publicados - ids_disponibles
        if ids_invalidos:
            raise ValueError("Una o mas versiones seleccionadas no pertenecen al documento.")
        ids_publicados_actuales = {
            version["id_version"]
            for version in versiones
            if version.get("publicado")
        }
        if ids_publicados == ids_publicados_actuales:
            messages.info(
                request,
                "No se guardaron cambios porque la publicación no fue modificada.",
            )
            return redirect("documentos:lista")
        _validar_publicacion_versiones_por_ia(versiones, ids_publicados)

        with transaction.atomic():
            _guardar_publicacion_versiones(id_documento, ids_publicados, usuario)
        _registrar_auditoria_django_pruebas(
            usuario,
            request.user,
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
        if retirar_todas:
            messages.success(request, "Publicación del documento retirada correctamente.")
        else:
            messages.success(request, "Estado de publicación guardado correctamente.")
    except (DatabaseError, ValueError) as error:
        messages.error(request, f"No se pudo guardar la publicacion: {error}")
    return redirect("documentos:lista")


@require_POST
def eliminar_documento(request, id_documento):
    usuario = _requerir_editor(request)
    if not usuario:
        return redirect("documentos:lista")

    try:
        documento = _obtener_documento_para_edicion(id_documento)
        alcance = request.POST.get("alcance_eliminacion", "documento")
        motivo = request.POST.get("motivo_eliminacion", "").strip() or "Eliminación lógica desde Django"
        if alcance == "version":
            id_version = int(request.POST.get("id_version_eliminacion", ""))
            if _documento_tiene_version_publicada(id_documento, id_version):
                raise ValueError(
                    "Para eliminar esta versión, primero debe quitar su publicación."
                )
            version_vigente_anterior_chroma = _obtener_contexto_version_chroma(
                id_documento,
                vigente=True,
            )
            _eliminar_version_logica(id_documento, id_version, motivo, usuario)
            _registrar_auditoria_django_pruebas(
                usuario,
                request.user,
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
            version_vigente_actual_chroma = _obtener_contexto_version_chroma(
                id_documento,
                vigente=True,
            )
            _notificar_version_anterior_no_vigente_segundo_plano(
                version_vigente_anterior_chroma,
                version_vigente_actual_chroma,
            )
            messages.success(request, "Versión eliminada lógicamente.")
        elif alcance == "documento":
            if _documento_tiene_version_publicada(id_documento):
                raise ValueError(
                    "Para eliminar el documento, primero debe quitar la publicación de todas sus versiones."
                )
            version_vigente_anterior_chroma = _obtener_contexto_version_chroma(
                id_documento,
                vigente=True,
            )
            _eliminar_documento_logico(id_documento, motivo, usuario)
            _registrar_auditoria_django_pruebas(
                usuario,
                request.user,
                id_documento,
                "ELIMINACION_DOCUMENTO_LOGICA",
                motivo,
                {"titulo": documento.get("titulo")},
                mensaje=(
                    f"{usuario.get('nombre_usuario') or 'Usuario'} ha eliminado "
                    f"lógicamente el documento {documento.get('titulo') or id_documento}."
                ),
            )
            _notificar_version_anterior_no_vigente_segundo_plano(
                version_vigente_anterior_chroma,
                {},
            )
            messages.success(request, "Documento eliminado lógicamente.")
        else:
            raise ValueError("El alcance de eliminación no es válido.")
    except (DatabaseError, ValueError) as error:
        messages.error(request, f"No se pudo eliminar el documento: {error}")
    return redirect("documentos:lista")
