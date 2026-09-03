import json
from datetime import date
from io import BytesIO
from itertools import product
from pathlib import Path

from django.contrib import messages
from django.db import DatabaseError
from django.http import FileResponse, Http404, HttpResponse, JsonResponse
from django.shortcuts import redirect, render
from django.urls import reverse
from django.views.decorators.clickjacking import xframe_options_sameorigin
from django.views.decorators.http import require_POST

from .models import (
    ESTADO_BORRADOR, ESTADO_NO_VIGENTE, ESTADO_VIGENTE,
    Documento, EditorModulo, HistorialEliminacion,
    VersionDocumento,
)
from . import repositories, selectors, services
from . import storage
from .constants import (
    ESTADO_IA_PENDIENTE,
    ESTADO_IA_LEIDO,
    ESTADO_IA_OBSERVADO,
    ESTADO_IA_ERROR,
    ESTADOS_IA_DOCUMENTO,
)
from .access import (
    _contexto_accesos,
    _catalogos_acceso,
    _opciones_acceso,
    _nombres_catalogo,
    _metadata_accesos,
    _ids_opciones_acceso,
)
from .integrations import (
    _iniciar_analisis_ia_segundo_plano,
    _actualizar_estado_ia_version,
    _columna_existe,
    _normalizar_estado_ia,
    _notificar_version_anterior_no_vigente,
    _texto_uuid,
    _items_campos_multipart,
    _texto_comparable,
    _validar_porcentaje_texto_ia,  # Compatibilidad con las pruebas previas del módulo.
    _resolver_estado_vigencia_payload,
    _notificar_version_anterior_no_vigente_segundo_plano,
    _reservar_reintento_ia,
    _datos_archivo_desde_contexto_version,
)
from .storage import (
    _validar_pdf_texto_minimo,
    _guardar_pdf_django,
    _leer_pdf_version,
)


USUARIO_SIMULADO = {
    "id_usuario_externo": 1001,
    "id_perfil_externo": 2,
    "id_grupo_externo": 10,
    "id_tipo_periodo_externo": 2,
    "nombre_usuario": "Usuario simulado",
    "rol_modulo": "CONSULTA",
}

FECHA_APROBACION_MINIMA = date(1984, 1, 1)
TIPOS_DOCUMENTO = (
    "Documento legal",
    "Manual",
    "Reglamento",
    "Guías",
    "Ordenes",
    "Modelos",
    "Procedimiento",
    "Videos",
)
# Preparado para habilitar la clasificación cuando el módulo maneje más tipos.
# Debe coincidir con el modelo y el default de public.docs.tipo.
TIPO_DOCUMENTO_PREDETERMINADO = "Documento legal"
SELECTOR_TIPO_DOCUMENTO_HABILITADO = False


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


def manual_editor(request):
    """Guía del módulo, disponible únicamente para sus editores."""
    usuario = _requerir_editor(request)
    if not usuario:
        return redirect("documentos:lista")
    return render(request, "documentos/manual_editor.html", {"usuario": usuario})


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
        estados_vigentes = selectors.estados_ia_ultimas_versiones(ids_documentos)
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


def _nombres_campos_multipart(campos):
    return [nombre for nombre, _valor in _items_campos_multipart(campos)]


def _obtener_contexto_version_chroma(id_documento, id_version=None, vigente=None):
    return selectors.contexto_version_chroma(id_documento, id_version, vigente)


def _obtener_fecha_aprobacion_version(id_documento, id_version):
    contexto = selectors.contexto_version_chroma(id_documento, id_version)
    return contexto.get("fecha_aprobacion")


def _anio_fecha(valor):
    if not valor:
        return ""
    return str(valor.year) if hasattr(valor, "year") else str(valor)[:4]


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
    if version_nueva.get("estado") != ESTADO_VIGENTE:
        version_anterior = {}
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


@require_POST
def reintentar_analisis_ia_documento(request, id_documento):
    usuario = _requerir_editor(request)
    if not usuario:
        return redirect("documentos:lista")

    id_version = None
    reintento_reservado = False
    try:
        documento = _obtener_documento_para_edicion(id_documento)
        contexto_version = _obtener_contexto_version_chroma(id_documento)
        id_version = contexto_version.get("id_version")
        if not id_version:
            raise ValueError("El documento no tiene una versión disponible para analizar.")

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


def _validar_tipo_documento(tipo):
    if tipo not in TIPOS_DOCUMENTO:
        raise ValueError("El tipo de documento no es válido.")
    return tipo


def _tipo_documento_formulario(tipo_solicitado="", tipo_actual=""):
    """Resuelve el tipo sin perder soporte para reactivar el selector."""
    if SELECTOR_TIPO_DOCUMENTO_HABILITADO:
        return _validar_tipo_documento((tipo_solicitado or "").strip())
    return tipo_actual or TIPO_DOCUMENTO_PREDETERMINADO


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
        versiones = services.eliminar_documento_fisico(
            id_documento,
            motivo,
            usuario,
            request.user,
        )
        archivos_no_eliminados = storage.eliminar_archivos_versiones(versiones)

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
        version = services.eliminar_version_fisica(
            id_documento,
            id_version,
            motivo,
            usuario,
            request.user,
        )
        if storage.eliminar_archivos_versiones([version]):
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
        versiones = services.eliminar_versiones_fisicas(
            id_documento,
            ids_versiones,
            motivo,
            usuario,
            request.user,
        )
        archivos_no_eliminados = storage.eliminar_archivos_versiones(versiones)

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
    persistido = False
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
        id_documento = services.crear_documento_con_accesos(
            titulo,
            descripcion,
            palabras_clave,
            fecha_aprobacion,
            datos_archivo,
            usuario,
            tipo,
            accesos,
            request.user,
        )
        persistido = True
        version_nueva = _obtener_contexto_version_chroma(id_documento)
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
        if persistido:
            messages.warning(request, f"Los cambios se guardaron, pero falló un paso posterior: {error}")
            return redirect("documentos:lista")
        if datos_archivo:
            storage.descartar_pdf_subido(datos_archivo)
        messages.error(request, f"No se pudo crear el documento: {error}")
    return redirect("documentos:lista")


@require_POST
def editar_documento(request, id_documento):
    usuario = _requerir_editor(request)
    if not usuario:
        return redirect("documentos:lista")

    datos_archivo = None
    persistido = False
    try:
        titulo = request.POST.get("titulo", "").strip()
        descripcion = request.POST.get("descripcion", "").strip()
        palabras_clave = request.POST.get("palabras_clave", "").strip()
        fecha_aprobacion = _fecha_formulario(
            request.POST.get("fecha_aprobacion"),
            requerido=True,
        )
        id_version = int(request.POST.get("id_version_vigente", ""))
        estado_version = request.POST.get("estado_version", ESTADO_BORRADOR)
        if estado_version not in {ESTADO_VIGENTE, ESTADO_BORRADOR, ESTADO_NO_VIGENTE}:
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
        if estado_version == ESTADO_VIGENTE and id_version != documento.get("id_version_vigente"):
            cambios.append(f"Versión vigente: '{documento.get('numero_version_vigente') or documento.get('id_version_vigente')}' → '{version_seleccionada.get('numero_version')}'")
        if estado_version != version_seleccionada.get("estado"):
            cambios.append(f"Estado de versión: '{version_seleccionada.get('estado')}' → '{estado_version}'")
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

        services.editar_documento_con_accesos(
            id_documento,
            titulo,
            descripcion,
            palabras_clave,
            fecha_aprobacion,
            id_version,
            usuario,
            tipo,
            accesos,
            estado_version,
            puede_cambiar_estado_version,
            datos_archivo,
            cambios,
            request.user,
        )
        persistido = True
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
        debe_reanalizar_ia = bool(datos_archivo) or metadata_modificada or cambio_version_vigente
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
                    version_editada = _obtener_contexto_version_chroma(id_documento, id_version=id_version)
                    contexto_version = _construir_contexto_reemplazo_version(
                        version_editada, version_vigente_anterior_chroma,
                    )
                    datos_analisis = _datos_archivo_desde_contexto_version(version_editada)
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
        if persistido:
            messages.warning(request, f"Los cambios se guardaron, pero falló un paso posterior: {error}")
            return redirect("documentos:lista")
        if datos_archivo:
            storage.descartar_pdf_subido(datos_archivo)
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
    persistido = False
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
        id_version_nueva = services.agregar_version_auditada(
            id_documento,
            datos_archivo,
            descripcion_cambio,
            fecha_aprobacion,
            usuario,
            documento,
            request.user,
        )
        persistido = True
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
        if persistido:
            messages.warning(request, f"Los cambios se guardaron, pero falló un paso posterior: {error}")
            return redirect("documentos:lista")
        if datos_archivo:
            storage.descartar_pdf_subido(datos_archivo)
        messages.error(request, f"No se pudo agregar la versión: {error}")
    return redirect("documentos:lista")


@require_POST
def publicar_versiones_documento(request, id_documento):
    usuario = _requerir_editor(request)
    if not usuario:
        return redirect("documentos:lista")

    persistido = False
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
        services.validar_publicacion_versiones_por_ia(versiones, ids_publicados)

        contexto_anterior = _obtener_contexto_version_chroma(id_documento, vigente=True)
        contexto_accesos = _contexto_accesos_documento(id_documento)
        services.publicar_versiones_auditadas(
            id_documento,
            ids_publicados,
            usuario,
            documento,
            request.user,
        )
        persistido = True
        contexto_actual = _obtener_contexto_version_chroma(id_documento, vigente=True)
        if contexto_actual:
            contexto_reemplazo = _construir_contexto_reemplazo_version(contexto_actual, contexto_anterior)
            _iniciar_analisis_ia_segundo_plano(
                id_documento, documento.get("titulo") or "",
                _datos_archivo_desde_contexto_version(contexto_actual),
                contexto_reemplazo, contexto_accesos, documento.get("tipo") or "",
                contexto_version_anterior=contexto_anterior,
                documento_url=_construir_url_pdf_vigente(request, id_documento, contexto_actual),
            )
        else:
            _notificar_version_anterior_no_vigente_segundo_plano(contexto_anterior, {})
        if retirar_todas:
            messages.success(request, "Publicación del documento retirada correctamente.")
        else:
            messages.success(request, "Estado de publicación guardado correctamente.")
    except (DatabaseError, ValueError, RuntimeError) as error:
        if persistido:
            messages.warning(request, f"La publicación se guardó, pero falló la sincronización con IA: {error}")
            return redirect("documentos:lista")
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
            version_vigente_anterior_chroma = _obtener_contexto_version_chroma(
                id_documento,
                vigente=True,
            )
            services.eliminar_version_auditada(id_documento, id_version, motivo, usuario, documento, request.user)
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
            version_vigente_anterior_chroma = _obtener_contexto_version_chroma(
                id_documento,
                vigente=True,
            )
            services.eliminar_documento_auditado(id_documento, motivo, usuario, documento, request.user)
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
