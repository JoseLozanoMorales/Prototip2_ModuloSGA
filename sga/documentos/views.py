import json
import re
import threading
import urllib.error
import urllib.request
from datetime import date
from io import BytesIO
from itertools import product
from pathlib import Path, PurePosixPath
from uuid import uuid4

from django.conf import settings
from django.contrib import messages
from django.db import DatabaseError, close_old_connections, connection
from django.http import FileResponse, Http404, HttpResponse, JsonResponse
from django.shortcuts import redirect, render
from django.core.files.storage import default_storage
from django.db import transaction
from django.views.decorators.clickjacking import xframe_options_sameorigin
from django.views.decorators.http import require_POST

from sga.models import PerfilUsuario, Periodo


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
        "label": "Observado",
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
    catalogos_acceso = _catalogos_acceso()
    busqueda = request.GET.get("q", "").strip()
    anio = request.GET.get("anio", "").strip()
    try:
        documentos = _listar_documentos_modulo(usuario, busqueda, anio or None)
        _adjuntar_estado_ia_documentos(documentos)
        if usuario["rol_modulo"] == "EDITOR":
            _adjuntar_detalles_editor(documentos, catalogos_acceso)
    except (DatabaseError, ValueError) as error:
        # La pÃ¡gina sigue siendo Ãºtil para comprobar el servidor aunque PostgreSQL
        # aÃºn no estÃ© disponible o falten variables en .env.
        error_base_datos = str(error)

    documentos_para_anios = documentos
    if anio and error_base_datos is None:
        try:
            documentos_para_anios = _listar_documentos_modulo(usuario, busqueda, None)
            _adjuntar_estado_ia_documentos(documentos_para_anios)
        except (DatabaseError, ValueError):
            documentos_para_anios = documentos

    anios_disponibles = _extraer_anios_disponibles(documentos_para_anios)

    return render(
        request,
        "documentos/documentosV2.html",
        {
            "documentos": documentos,
            "usuario": usuario,
            "busqueda": busqueda,
            "anio": anio,
            "anios_disponibles": anios_disponibles,
            "fecha_aprobacion_minima": FECHA_APROBACION_MINIMA.isoformat(),
            "fecha_aprobacion_maxima": date.today().isoformat(),
            "error_base_datos": error_base_datos,
            "capacidades": _capacidades_base() if usuario["rol_modulo"] == "EDITOR" else {},
            "catalogos_acceso": catalogos_acceso,
        },
    )


def pendiente_de_migrar(request, *args, **kwargs):
    """Placeholder temporal para flujos todavÃ­a atendidos por Flask."""
    return HttpResponse("Pendiente de migrar desde Flask a Django.", status=501)


def _consultar_filas(sql, parametros):
    """Ejecuta una consulta de lectura y devuelve filas como diccionarios."""
    with connection.cursor() as cursor:
        cursor.execute(sql, parametros)
        columnas = [columna[0] for columna in cursor.description]
        return [dict(zip(columnas, fila)) for fila in cursor.fetchall()]


def _obtener_usuario_modulo():
    """Obtiene el rol del usuario simulado desde la misma funcion de Flask."""
    usuario = dict(USUARIO_SIMULADO)
    try:
        filas = _consultar_filas(
            "SELECT fn_usuario_es_editor(%s) AS editor;",
            [usuario["id_usuario_externo"]],
        )
        usuario["rol_modulo"] = "EDITOR" if filas and filas[0]["editor"] else "LECTOR"
    except DatabaseError:
        usuario["rol_modulo"] = "LECTOR"
    return usuario


def _ejecutar_procedimiento(sql, parametros):
    """Ejecuta un procedimiento heredado; Django confirma por autocommit."""
    with connection.cursor() as cursor:
        cursor.execute(sql, parametros)


def _ejecutar_procedimiento_y_obtener_fila(sql, parametros):
    """Ejecuta un procedimiento con parÃ¡metros OUT y devuelve su fila."""
    with connection.cursor() as cursor:
        cursor.execute(sql, parametros)
        columnas = [columna[0] for columna in cursor.description]
        fila = cursor.fetchone()
        return dict(zip(columnas, fila)) if fila else None


def _columna_existe(tabla, columna):
    try:
        filas = _consultar_filas(
            """
            SELECT fn_columna_existe(%s, %s) AS existe;
            """,
            [tabla, columna],
        )
        return bool(filas and filas[0]["existe"])
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


def _adjuntar_estado_ia_documentos(documentos):
    if not documentos:
        return

    estado_por_defecto = _datos_estado_ia(ESTADO_IA_PENDIENTE)
    if not _columna_existe("doc_versions", "estado_ia"):
        for documento in documentos:
            documento.update(estado_por_defecto)
        return

    ids_documentos = [documento["id_documento"] for documento in documentos]
    filas = _consultar_filas(
        """
        SELECT
            d.id_documento,
            COALESCE(v.estado_ia, %s) AS estado_ia,
            v.porcentaje_texto_ia,
            COALESCE(v.mensaje_ia, '') AS mensaje_ia
        FROM docs d
        LEFT JOIN doc_versions v ON v.id_version = d.id_version_vigente
        WHERE d.id_documento = ANY(%s);
        """,
        [ESTADO_IA_PENDIENTE, ids_documentos],
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
        documento.update(estados.get(documento["id_documento"], estado_por_defecto))


def estado_analisis_ia_documentos(request):
    """Devuelve el estado IA de documentos visibles para refrescar la UI."""
    try:
        ids_solicitados = _ids_documentos_consulta(request.GET.get("ids", ""))
        if not ids_solicitados:
            return JsonResponse({"documentos": []})

        usuario = _obtener_usuario_modulo()
        documentos_visibles = _listar_documentos_modulo(usuario, "", None)
        documentos = [
            documento
            for documento in documentos_visibles
            if documento.get("id_documento") in ids_solicitados
        ]
        _adjuntar_estado_ia_documentos(documentos)
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


def _listar_documentos_modulo(usuario, busqueda, anio):
    return _consultar_filas(
        """
        SELECT *
        FROM fn_listar_documentos_modulo(%s, %s, %s, %s, %s, %s);
        """,
        [
            usuario["id_usuario_externo"],
            usuario["id_perfil_externo"],
            usuario["id_grupo_externo"],
            usuario["id_tipo_periodo_externo"],
            busqueda or "",
            _anio_entero(anio),
        ],
    )


def _listar_papelera_fallback(busqueda, anio):
    """Consulta documentos eliminados cuando la funciÃ³n nueva aÃºn no existe."""
    return _consultar_filas(
        """
        SELECT *
        FROM fn_listar_papelera_documentos(%s, %s);
        """,
        [busqueda or "", _anio_entero(anio)],
    )


def _extraer_anios_disponibles(documentos):
    return sorted(
        {str(documento["anio"]) for documento in documentos if documento.get("anio") is not None},
        reverse=True,
    )


def _capacidades_base():
    return {
        "puede_cambiar_estado_version": _columna_existe("doc_versions", "estado"),
        "puede_reemplazar_archivo": _columna_existe("doc_versions", "archivo_path"),
        "puede_eliminar_version": _columna_existe("doc_versions", "estado"),
        "puede_restaurar_version": _columna_existe("doc_versions", "estado"),
    }


def _adjuntar_detalles_editor(documentos, catalogos_acceso):
    """Completa versiones y accesos necesarios por los formularios de editor."""
    if not documentos:
        return

    for documento in documentos:
        versiones = _obtener_versiones(documento["id_documento"])
        documento["versiones"] = versiones
        id_version_vigente = documento.get("id_version_vigente")
        if not any(version["id_version"] == id_version_vigente for version in versiones):
            id_version_vigente = None
        version_vigente = _seleccionar_version(versiones, id_version_vigente)
        documento["id_version_preview"] = version_vigente["id_version"]

    ids_documentos = [documento["id_documento"] for documento in documentos]
    accesos = _consultar_filas(
        "SELECT * FROM fn_obtener_accesos_documentos(%s);", [ids_documentos]
    )
    accesos_por_documento = {}
    for acceso in accesos:
        accesos_por_documento.setdefault(acceso["id_documento"], []).append(acceso)

    for documento in documentos:
        accesos_documento = accesos_por_documento.get(documento["id_documento"], [])
        documento["perfiles_seleccionados"] = _opciones_acceso(
            _valores_acceso(accesos_documento, "id_perfil_externo"),
            _nombres_catalogo(catalogos_acceso["perfiles"]),
        )
        documento["grupos_seleccionados"] = _opciones_acceso(
            _valores_acceso(accesos_documento, "id_grupo_externo"),
            _nombres_catalogo(catalogos_acceso["grupos"]),
        )
        documento["periodos_seleccionados"] = _opciones_acceso(
            _valores_acceso(accesos_documento, "id_tipo_periodo_externo"),
            _nombres_catalogo(catalogos_acceso["tipos_periodo"]),
        )


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
    accesos = _consultar_filas(
        "SELECT * FROM fn_obtener_accesos_documentos(%s);", [[id_documento]]
    )
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
        ("metadata", json.dumps(metadata_accesos, ensure_ascii=False)),
        ("perfiles_acceso", json.dumps(perfiles, ensure_ascii=False)),
        ("grupos_acceso", json.dumps(grupos, ensure_ascii=False)),
        ("tipos_periodo_acceso", json.dumps(tipos_periodo, ensure_ascii=False)),
        ("perfiles_acceso_ids", json.dumps(_ids_opciones_acceso(perfiles), ensure_ascii=False)),
        ("grupos_acceso_ids", json.dumps(_ids_opciones_acceso(grupos), ensure_ascii=False)),
        (
            "tipos_periodo_acceso_ids",
            json.dumps(_ids_opciones_acceso(tipos_periodo), ensure_ascii=False),
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
        return json.dumps(valor, ensure_ascii=False)
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
    caracteres = len(re.sub(r"\s+", "", texto or ""))
    if caracteres < PDF_TEXTO_MINIMO_CARACTERES:
        raise ValueError(
            "El PDF debe contener al menos "
            f"{PDF_TEXTO_MINIMO_CARACTERES} caracteres de texto extraible; "
            f"se detectaron {caracteres}. Verifique que no sea un PDF netamente escaneado."
        )
    return caracteres


def _guardar_pdf_django(archivo):
    nombre_original = Path(archivo.name).name
    if not nombre_original.lower().endswith(".pdf"):
        raise ValueError("Solo se permiten archivos PDF.")
    if archivo.size <= 0:
        raise ValueError("El archivo PDF está¡ vacio.")

    nombre_guardado = f"{uuid4().hex}_{nombre_original}"
    ruta_relativa = default_storage.save(f"documentos/{nombre_guardado}", archivo)
    return {
        "archivo_nombre": nombre_guardado,
        "archivo_path": ruta_relativa,
        "archivo_tipo": archivo.content_type or "application/pdf",
        "archivo_tamano": default_storage.size(ruta_relativa),
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


def _leer_json_http(respuesta):
    cuerpo = respuesta.read().decode("utf-8")
    try:
        return json.loads(cuerpo or "{}")
    except ValueError as error:
        raise RuntimeError(
            f"El servicio respondio con un formato no JSON. HTTP {respuesta.status}."
        ) from error


def _publicar_json(url, payload):
    datos = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    solicitud = urllib.request.Request(
        url,
        data=datos,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(solicitud, timeout=settings.IA_DOCUMENTOS_TIMEOUT) as respuesta:
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
        with urllib.request.urlopen(solicitud, timeout=settings.IA_DOCUMENTOS_TIMEOUT) as respuesta:
            return _leer_json_http(respuesta)
    except urllib.error.HTTPError as error:
        contenido = _leer_json_http(error)
        mensaje = contenido.get("error") or contenido.get("mensaje") or error.reason
        raise RuntimeError(f"HTTP {error.code}: {mensaje}") from error
    except urllib.error.URLError as error:
        raise RuntimeError(str(error.reason)) from error


def _llamar_ia_documentos(datos_archivo, contexto_accesos=None):
    url = f"{settings.IA_DOCUMENTOS_BASE_URL}{settings.IA_DOCUMENTOS_ANALIZAR_PATH}"
    ruta_pdf = _ruta_media_segura(datos_archivo["archivo_path"])
    campos_accesos = _campos_multipart_accesos(contexto_accesos)
    try:
        contenido = _publicar_multipart(
            url,
            campos_accesos,
            {
                "archivo": {
                    "filename": datos_archivo["archivo_nombre"],
                    "content": ruta_pdf.read_bytes(),
                    "content_type": "application/pdf",
                }
            },
        )
    except RuntimeError as error:
        campos = ", ".join(_nombres_campos_multipart(campos_accesos))
        raise RuntimeError(
            f"No se pudo conectar con la IA documental en {url}. "
            f"Campos enviados: {campos}. Error: {error}"
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
    filas = _consultar_filas(
        """
        SELECT *
        FROM fn_obtener_contexto_version_chroma(%s, %s, %s);
        """,
        [id_documento, id_version, vigente],
    )
    contexto = filas[0] if filas else {}
    if contexto.get("id_version"):
        contexto["fecha_aprobacion"] = _obtener_fecha_aprobacion_version(
            id_documento,
            contexto["id_version"],
        )
    return contexto


def _obtener_fecha_aprobacion_version(id_documento, id_version):
    filas = _consultar_filas(
        """
        SELECT fecha_aprobacion
        FROM doc_versions
        WHERE id_documento = %s
          AND id_version = %s;
        """,
        [id_documento, id_version],
    )
    return filas[0]["fecha_aprobacion"] if filas else None


def _texto_uuid(valor):
    return str(valor) if valor else ""


def _anio_fecha(valor):
    if not valor:
        return ""
    return str(valor.year) if hasattr(valor, "year") else str(valor)[:4]


def _construir_contexto_reemplazo_version(version_nueva, version_anterior=None):
    version_anterior = version_anterior or {}
    return {
        "id_version": version_nueva.get("id_version"),
        "numero_version": version_nueva.get("numero_version"),
        "fecha_aprobacion": version_nueva.get("fecha_aprobacion"),
        "anio_aprobacion": _anio_fecha(version_nueva.get("fecha_aprobacion")),
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
    return json.dumps(valor, ensure_ascii=False)


def _bool_a_texto(valor):
    return "true" if bool(valor) else "false"


def _construir_payload_chroma(
    id_documento,
    titulo,
    datos_archivo,
    respuesta_ia,
    contexto_version=None,
    contexto_accesos=None,
):
    interpretacion = _obtener_interpretacion_ia(respuesta_ia)
    contexto_version = contexto_version or {}
    contexto_accesos = contexto_accesos or _contexto_accesos(None, None, None)
    anio_documento = (
        contexto_version.get("anio_aprobacion")
        or interpretacion.get("anio_documento_sugerido")
        or ""
    )
    metadata_accesos = _metadata_accesos(contexto_accesos)
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
        "tipo_documento": interpretacion.get("tipo_documento_sugerido") or "GENERAL",
        "ambito": interpretacion.get("ambito_sugerido") or "PUBLICO",
        "estado_vigencia": interpretacion.get("estado_vigencia_sugerido") or "VIGENTE",
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
            "uuid_documento": contexto_version.get("uuid_documento") or "",
            "uuid_version": contexto_version.get("uuid_version") or "",
            "id_version_anterior": str(contexto_version.get("id_version_anterior") or ""),
            "numero_version_anterior": str(contexto_version.get("numero_version_anterior") or ""),
            "uuid_version_anterior": contexto_version.get("uuid_version_anterior") or "",
            "porcentaje_texto": respuesta_ia.get("porcentaje_texto"),
            "porcentaje_imagenes": respuesta_ia.get("porcentaje_imagenes"),
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
):
    url = f"{settings.IA_CHROMA_BASE_URL}{settings.IA_CHROMA_GUARDAR_PATH}"
    payload = _construir_payload_chroma(
        id_documento,
        titulo,
        datos_archivo,
        respuesta_ia,
        contexto_version,
        contexto_accesos,
    )
    try:
        if payload["texto_extraido"]:
            return _publicar_json(url, payload)

        ruta_pdf = _ruta_pdf_version_segura(datos_archivo)
        return _publicar_multipart(
            url,
            _convertir_payload_chroma_multipart(payload),
            {
                "archivo": {
                    "filename": datos_archivo["archivo_nombre"],
                    "content": ruta_pdf.read_bytes(),
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

    _ejecutar_procedimiento(
        """
        UPDATE doc_versions
        SET estado_ia = %s,
            porcentaje_texto_ia = %s,
            mensaje_ia = %s,
            fecha_analisis_ia = CASE
                WHEN %s = %s THEN NULL
                ELSE CURRENT_TIMESTAMP
            END
        WHERE id_documento = %s
          AND id_version = %s;
        """,
        [
            _normalizar_estado_ia(estado),
            porcentaje_texto,
            str(mensaje or "")[:1000],
            _normalizar_estado_ia(estado),
            ESTADO_IA_PENDIENTE,
            id_documento,
            id_version,
        ],
    )


def _procesar_ia_documento_segundo_plano(
    id_documento,
    titulo,
    datos_archivo,
    contexto_version,
    contexto_accesos,
):
    close_old_connections()
    id_version = contexto_version.get("id_version")
    respuesta_ia = {}
    try:
        respuesta_ia = _llamar_ia_documentos(datos_archivo, contexto_accesos)
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
            error,
        )
        close_old_connections()
        return
    except RuntimeError as error:
        _actualizar_estado_ia_version(
            id_documento,
            id_version,
            ESTADO_IA_ERROR,
            None,
            error,
        )
        close_old_connections()
        return

    mensaje = "Analisis de IA completado."
    try:
        respuesta_chroma = _guardar_documento_chroma(
            id_documento,
            titulo,
            datos_archivo,
            respuesta_ia,
            contexto_version,
            contexto_accesos,
        )
        estado_chroma = respuesta_chroma.get("estado_procesamiento", "PROCESADO")
        fragmentos = respuesta_chroma.get("fragmentos_generados", 0)
        mensaje = f"{mensaje} ChromaDB: {estado_chroma}, fragmentos generados: {fragmentos}."
    except RuntimeError as error_chroma:
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
        args=(id_documento, titulo, datos_archivo, contexto_version, contexto_accesos),
        daemon=True,
    )
    hilo.start()


def _datos_archivo_desde_contexto_version(contexto_version):
    archivo_path = str((contexto_version or {}).get("archivo_path") or "")
    archivo_nombre = str((contexto_version or {}).get("archivo_nombre") or Path(archivo_path).name)
    if not archivo_nombre:
        raise ValueError("La version vigente no tiene archivo asociado.")
    ruta_pdf = _ruta_pdf_version_segura(
        {
            "archivo_nombre": archivo_nombre,
            "archivo_path": archivo_path,
        }
    )
    return {
        "archivo_nombre": archivo_nombre,
        "archivo_path": archivo_path,
        "archivo_tipo": "application/pdf",
        "archivo_tamano": ruta_pdf.stat().st_size,
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


def _validar_titulo_unico(titulo, id_documento=None):
    _ejecutar_procedimiento(
        "SELECT fn_validar_titulo_documento_unico(%s, %s);",
        [titulo, id_documento],
    )


def _consultar_documento_accion(id_documento):
    filas = _consultar_filas(
        """
        SELECT *
        FROM fn_obtener_documento_para_accion(%s);
        """,
        [id_documento],
    )
    return filas[0] if filas else None


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


def _obtener_versiones(id_documento):
    versiones = _consultar_filas(
        """
        SELECT *
        FROM fn_obtener_versiones_documento(%s);
        """,
        [id_documento],
    )
    if not versiones:
        raise Http404("El documento no tiene versiones disponibles.")
    return versiones


def _seleccionar_version(versiones, id_version):
    if id_version is not None:
        for version in versiones:
            if version["id_version"] == id_version:
                return version
        raise Http404("La versiÃ³n solicitada no pertenece al documento.")
    return next((version for version in versiones if version.get("vigente")), versiones[0])


def _eliminar_documento_logico(id_documento, motivo, usuario):
    _ejecutar_procedimiento(
        """
        CALL sp_eliminar_documento_logico(%s, %s, %s);
        """,
        [id_documento, motivo, usuario["id_usuario_externo"]],
    )


def _documento_tiene_version_vigente(id_documento):
    filas = _consultar_filas(
        """
        SELECT fn_documento_tiene_version_vigente(%s) AS tiene_vigente;
        """,
        [id_documento],
    )
    return bool(filas and filas[0]["tiene_vigente"])


def _eliminar_version_logica(id_documento, id_version, motivo, usuario):
    _ejecutar_procedimiento(
        """
        CALL sp_eliminar_version_documento_logico(%s, %s, %s, %s, %s);
        """,
        [
            id_documento,
            id_version,
            motivo,
            usuario["id_usuario_externo"],
            usuario.get("nombre_usuario", ""),
        ],
    )


def _restaurar_documento_logico(id_documento, usuario):
    _ejecutar_procedimiento(
        """
        CALL sp_restaurar_documento_logico(%s, %s);
        """,
        [id_documento, usuario["id_usuario_externo"]],
    )


def _restaurar_version_logica(id_documento, id_version):
    _ejecutar_procedimiento(
        """
        CALL sp_restaurar_version_documento_logico(%s, %s);
        """,
        [id_documento, id_version],
    )


def _insertar_acceso_documento(id_documento, perfil, grupo, periodo, usuario):
    _ejecutar_procedimiento(
        """
        CALL sp_insertar_acceso_documento(%s, %s, %s, %s, %s);
        """,
        [id_documento, perfil, grupo, periodo, usuario["id_usuario_externo"]],
    )


def _insertar_accesos_documento(id_documento, accesos, usuario):
    for perfil, grupo, periodo in accesos:
        _insertar_acceso_documento(id_documento, perfil, grupo, periodo, usuario)


def _eliminar_accesos_documento(id_documento):
    _ejecutar_procedimiento(
        """
        DELETE FROM documento_acceso
        WHERE id_documento = %s;
        """,
        [id_documento],
    )


def _reemplazar_accesos_documento(id_documento, accesos, usuario):
    _eliminar_accesos_documento(id_documento)
    _insertar_accesos_documento(id_documento, accesos, usuario)


def _crear_documento_base(titulo, descripcion, palabras_clave, fecha_aprobacion, datos_archivo, usuario):
    resultado = _ejecutar_procedimiento_y_obtener_fila(
        """
        SELECT fn_crear_documento_base(%s, %s, %s, %s, %s, %s, %s, %s, %s) AS id_documento;
        """,
        [
            titulo,
            descripcion,
            palabras_clave,
            fecha_aprobacion,
            datos_archivo["archivo_nombre"],
            datos_archivo["archivo_path"],
            datos_archivo["archivo_tipo"],
            datos_archivo["archivo_tamano"],
            usuario["id_usuario_externo"],
        ],
    )
    if not resultado or not resultado.get("id_documento"):
        raise DatabaseError("No se pudo crear el documento.")
    return resultado["id_documento"]


def _editar_documento_base(id_documento, titulo, descripcion, palabras_clave, fecha_aprobacion, id_version, usuario):
    _ejecutar_procedimiento(
        """
        CALL sp_editar_documento_base(%s, %s, %s, %s, %s, %s, %s);
        """,
        [
            id_documento,
            titulo,
            descripcion,
            palabras_clave,
            fecha_aprobacion,
            id_version,
            usuario["id_usuario_externo"],
        ],
    )


def _cambiar_estado_version_directo(id_documento, id_version, estado_version):
    _ejecutar_procedimiento(
        """
        CALL sp_cambiar_estado_version_documento(%s, %s, %s);
        """,
        [id_documento, id_version, estado_version],
    )


def _agregar_version_directa(id_documento, datos_archivo, descripcion_cambio, fecha_aprobacion, usuario):
    version = _ejecutar_procedimiento_y_obtener_fila(
        """
        SELECT fn_agregar_version_documento(%s, %s, %s, %s, %s, %s, %s, %s) AS id_version;
        """,
        [
            id_documento,
            datos_archivo["archivo_nombre"],
            datos_archivo["archivo_path"],
            datos_archivo["archivo_tipo"],
            datos_archivo["archivo_tamano"],
            descripcion_cambio,
            fecha_aprobacion,
            usuario["id_usuario_externo"],
        ],
    )
    if not version or not version.get("id_version"):
        raise DatabaseError("No se pudo crear la nueva version.")


def _reemplazar_archivo_version_directo(id_documento, id_version, datos_archivo, usuario):
    _ejecutar_procedimiento(
        """
        CALL sp_reemplazar_archivo_version_documento(%s, %s, %s, %s, %s, %s, %s);
        """,
        [
            id_documento,
            id_version,
            datos_archivo["archivo_nombre"],
            datos_archivo["archivo_path"],
            datos_archivo["archivo_tipo"],
            datos_archivo["archivo_tamano"],
            usuario["id_usuario_externo"],
        ],
    )


def visor_pdf(request, id_documento):
    """Muestra una versiÃ³n existente sin registrar eventos ni modificar la base."""
    try:
        id_version = int(request.GET["version"]) if request.GET.get("version") else None
    except ValueError as error:
        raise Http404("Versión no válida.") from error

    try:
        documento = _obtener_documento_visible(id_documento)
        versiones = _obtener_versiones(id_documento)
    except DatabaseError as error:
        raise Http404("No fue posible consultar el documento.") from error

    version_actual = _seleccionar_version(versiones, id_version)
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
        _obtener_documento_visible(id_documento)
        version = _seleccionar_version(_obtener_versiones(id_documento), id_version)
    except DatabaseError as error:
        raise Http404("No fue posible consultar el archivo.") from error

    nombre_archivo = Path(
        str(version.get("archivo_path") or version.get("archivo_nombre") or "")
    ).name
    if not nombre_archivo.lower().endswith(".pdf"):
        raise Http404("El archivo asociado no es un PDF válido.")

    ruta_relativa = str(version.get("archivo_path") or "")
    if ruta_relativa.startswith("documentos/"):
        raiz_media = settings.MEDIA_ROOT.resolve()
        ruta_pdf = (raiz_media / PurePosixPath(ruta_relativa)).resolve()
        if raiz_media not in ruta_pdf.parents:
            raise Http404("La ruta del PDF no es válida.")
    else:
        ruta_pdf = settings.FLASK_PDF_DIR / nombre_archivo
    if not ruta_pdf.is_file():
        raise Http404("El PDF original no está¡ disponible.")

    respuesta = FileResponse(ruta_pdf.open("rb"), content_type="application/pdf")
    respuesta["Content-Disposition"] = f'inline; filename="{nombre_archivo}"'
    return respuesta


def papelera_documentos(request):
    """Lista documentos y versiones eliminados lÃ³gicamente para editores."""
    usuario = _obtener_usuario_modulo()
    if usuario["rol_modulo"] != "EDITOR":
        messages.error(request, "No tienes permisos para ver la papelera.")
        return redirect("documentos:lista")

    busqueda = request.GET.get("q", "").strip()
    anio = request.GET.get("anio", "").strip()
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
    return render(
        request,
        "documentos/papelera.html",
        {
            "documentos": documentos,
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
def crear_documento(request):
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
            _insertar_accesos_documento(id_documento, accesos, usuario)
            _sincronizar_estado_versiones(id_documento)
        version_nueva = _obtener_contexto_version_chroma(id_documento, vigente=True)
        contexto_version = _construir_contexto_reemplazo_version(version_nueva)
        _iniciar_analisis_ia_segundo_plano(
            id_documento,
            titulo,
            datos_archivo,
            contexto_version,
            contexto_accesos,
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
        _obtener_documento_para_edicion(id_documento)
        puede_cambiar_estado_version = _columna_existe("doc_versions", "estado")
        if estado_version != "VIGENTE" and not puede_cambiar_estado_version:
            raise ValueError(
                "El cambio de estado de versiones no esta disponible en esta base de datos."
            )
        if not titulo:
            raise ValueError("El titulo del documento es obligatorio.")

        _seleccionar_version(_obtener_versiones(id_documento), id_version)
        _validar_titulo_unico(titulo, id_documento)
        accesos = _combinaciones_acceso(request)
        contexto_accesos = _contexto_accesos_formulario(request)
        version_vigente_anterior_chroma = _obtener_contexto_version_chroma(
            id_documento,
            vigente=True,
        )
        archivo = request.FILES.get("archivo")
        if archivo and not _columna_existe("doc_versions", "archivo_path"):
            raise ValueError(
                "El reemplazo de archivos no esta disponible en esta base de datos."
            )
        if archivo:
            version_anterior_chroma = _obtener_contexto_version_chroma(
                id_documento,
                id_version=id_version,
            )
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
            _reemplazar_accesos_documento(id_documento, accesos, usuario)
            if puede_cambiar_estado_version:
                _cambiar_estado_version_directo(id_documento, id_version, estado_version)
            if datos_archivo:
                _reemplazar_archivo_version_directo(id_documento, id_version, datos_archivo, usuario)
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
        if datos_archivo:
            version_nueva_chroma = _obtener_contexto_version_chroma(
                id_documento,
                id_version=id_version,
            )
            contexto_version = _construir_contexto_reemplazo_version(
                version_nueva_chroma,
                version_anterior_chroma,
            )
            _iniciar_analisis_ia_segundo_plano(
                id_documento,
                titulo,
                datos_archivo,
                contexto_version,
                contexto_accesos,
            )
            messages.success(
                request,
                "Documento editado correctamente. Analisis de IA en segundo plano.",
            )
        else:
            cambio_version_vigente = (
                estado_version == "VIGENTE"
                and version_vigente_actual_chroma.get("id_version") == id_version
                and _texto_uuid(version_vigente_anterior_chroma.get("uuid_version"))
                != _texto_uuid(version_vigente_actual_chroma.get("uuid_version"))
            )
            if cambio_version_vigente:
                contexto_version = _construir_contexto_reemplazo_version(
                    version_vigente_actual_chroma,
                    version_vigente_anterior_chroma,
                )
                try:
                    respuesta_chroma = _guardar_documento_chroma(
                        id_documento,
                        titulo,
                        _datos_archivo_desde_contexto_version(version_vigente_actual_chroma),
                        {},
                        contexto_version,
                        contexto_accesos,
                    )
                    estado_chroma = respuesta_chroma.get("estado_procesamiento", "PROCESADO")
                    fragmentos = respuesta_chroma.get("fragmentos_generados", 0)
                    messages.success(
                        request,
                        "Documento editado correctamente. "
                        f"ChromaDB: {estado_chroma}, fragmentos generados: {fragmentos}.",
                    )
                except (RuntimeError, ValueError) as error_chroma:
                    messages.warning(
                        request,
                        "Documento editado correctamente, pero no se pudo enviar la "
                        f"version vigente a ChromaDB: {error_chroma}",
                    )
            else:
                messages.success(request, "Documento editado correctamente.")
    except (DatabaseError, ValueError, RuntimeError) as error:
        if datos_archivo:
            default_storage.delete(datos_archivo["archivo_path"])
        messages.error(request, f"No se pudo editar el documento: {error}")
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
        datos_archivo = _guardar_pdf_django(archivo)
        _agregar_version_directa(
            id_documento,
            datos_archivo,
            descripcion_cambio,
            fecha_aprobacion,
            usuario,
        )
        version_nueva_chroma = _obtener_contexto_version_chroma(id_documento, vigente=True)
        contexto_version = _construir_contexto_reemplazo_version(
            version_nueva_chroma,
            version_anterior_chroma,
        )
        try:
            _notificar_version_anterior_no_vigente(
                version_anterior_chroma,
                version_nueva_chroma,
            )
        except RuntimeError as error_chroma_vigencia:
            messages.warning(request, str(error_chroma_vigencia))
        _iniciar_analisis_ia_segundo_plano(
            id_documento,
            documento.get("titulo") or "",
            datos_archivo,
            contexto_version,
            contexto_accesos,
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
            _eliminar_version_logica(id_documento, id_version, motivo, usuario)
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
            messages.success(request, "Versión eliminada lógicamente.")
        elif alcance == "documento":
            if documento.get("estado") == "VIGENTE" or _documento_tiene_version_vigente(id_documento):
                raise ValueError(
                    "Para eliminar el documento completo no debe existir ninguna version vigente."
                )
            _eliminar_documento_logico(id_documento, motivo, usuario)
            messages.success(request, "Documento eliminado lógicamente.")
        else:
            raise ValueError("El alcance de eliminación no es válido.")
    except (DatabaseError, ValueError) as error:
        messages.error(request, f"No se pudo eliminar el documento: {error}")
    return redirect("documentos:lista")
