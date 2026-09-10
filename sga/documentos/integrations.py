"""Cliente IA/Chroma y ejecución en segundo plano, independiente de HTTP entrante."""

import json
import logging
import ssl
import threading
import urllib.error
import urllib.request
from uuid import uuid4
from pathlib import Path
from django.conf import settings
from django.db import DatabaseError, close_old_connections, transaction
from . import repositories, selectors, services
from .models import ESTADO_BORRADOR, ESTADO_VIGENTE
from .constants import (
    ESTADO_IA_PENDIENTE,
    ESTADO_IA_LEIDO,
    ESTADO_IA_OMITIDO,
    ESTADO_IA_OBSERVADO,
    ESTADO_IA_ERROR,
    ESTADOS_IA_DOCUMENTO,
)
from .access import (
    _contexto_accesos,
    _metadata_accesos,
)
from .storage import (
    _leer_pdf_version,
    _contar_caracteres_texto,
)

logger = logging.getLogger(__name__)
PDF_TEXTO_MINIMO_CARACTERES = 200

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
    transaction.on_commit(hilo.start)

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
        proteger_omision=estado != ESTADO_IA_OMITIDO,
    )

def _columna_existe(tabla, columna):
    try:
        return repositories.columna_existe(tabla, columna)
    except DatabaseError:
        return False

def _normalizar_estado_ia(estado):
    estado = str(estado or ESTADO_IA_PENDIENTE).upper()
    return estado if estado in ESTADOS_IA_DOCUMENTO else ESTADO_IA_PENDIENTE

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
    if contexto_version.get("estado") == ESTADO_VIGENTE:
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
    # Los borradores se analizan, pero no reemplazan contenido publicado en Chroma.
    if contexto_version.get("estado") == ESTADO_VIGENTE:
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

    services.guardar_resultado_ia(id_documento, id_version, respuesta_ia)
    _actualizar_estado_ia_version(
        id_documento,
        id_version,
        ESTADO_IA_LEIDO,
        porcentaje_texto,
        mensaje,
    )
    close_old_connections()


def _iniciar_sincronizacion_publicacion_segundo_plano(
    id_documento,
    titulo,
    datos_archivo,
    contexto_version,
    contexto_accesos,
    tipo_documento=None,
    contexto_version_anterior=None,
    documento_url="",
):
    """Publica en Chroma reutilizando el análisis almacenado de la versión."""
    def sincronizar():
        close_old_connections()
        try:
            _notificar_version_anterior_no_vigente(
                contexto_version_anterior, contexto_version
            )
            if contexto_version.get("estado_ia") == ESTADO_IA_OMITIDO:
                return

            respuesta_ia = contexto_version.get("resultado_ia")
            if not isinstance(respuesta_ia, dict) or not respuesta_ia:
                # Compatibilidad para versiones analizadas antes de que se
                # empezara a persistir el resultado completo.
                _procesar_ia_documento_segundo_plano(
                    id_documento,
                    titulo,
                    datos_archivo,
                    contexto_version,
                    contexto_accesos,
                    tipo_documento,
                    contexto_version_anterior,
                    documento_url,
                )
                return

            _guardar_documento_chroma(
                id_documento,
                titulo,
                datos_archivo,
                respuesta_ia,
                contexto_version,
                contexto_accesos,
                tipo_documento,
                documento_url,
            )
        except Exception:
            logger.exception(
                "No se pudo sincronizar en ChromaDB el documento %s al publicarlo.",
                id_documento,
            )
        finally:
            close_old_connections()

    hilo = threading.Thread(target=sincronizar, daemon=True)
    transaction.on_commit(hilo.start)

def _notificar_version_anterior_no_vigente(contexto_anterior, contexto_actual=None):
    uuid_anterior = _texto_uuid((contexto_anterior or {}).get("uuid_version"))
    uuid_actual = _texto_uuid((contexto_actual or {}).get("uuid_version"))
    if uuid_anterior and uuid_anterior != uuid_actual:
        return _quitar_vigencia_chroma(uuid_anterior)
    return {}

def _texto_uuid(valor):
    return str(valor) if valor else ""

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

def _contexto_ssl_ia():
    if getattr(settings, "IA_SSL_VERIFY", True):
        return None
    return ssl._create_unverified_context()

def _leer_json_http(respuesta):
    cuerpo = respuesta.read().decode("utf-8")
    try:
        return json.loads(cuerpo or "{}")
    except ValueError as error:
        raise RuntimeError(
            f"El servicio respondio con un formato no JSON. HTTP {respuesta.status}."
        ) from error

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

def _items_campos_multipart(campos):
    if hasattr(campos, "items"):
        return campos.items()
    return campos

def _formatear_valor_multipart(valor):
    if isinstance(valor, (dict, list, tuple)):
        return json.dumps(valor, ensure_ascii=False, default=str)
    return "" if valor is None else str(valor)

def _texto_comparable(valor):
    return str(valor or "").strip()

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

def _mensaje_ia_con_advertencias(mensaje, advertencias):
    mensaje = str(mensaje or "")
    advertencias = [str(advertencia) for advertencia in advertencias if advertencia]
    if not advertencias:
        return mensaje
    return f"{mensaje} Advertencias: {' '.join(advertencias)}"

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

def _obtener_interpretacion_ia(contenido):
    interpretacion_ia = contenido.get("interpretacion_ia") or {}
    return interpretacion_ia.get("interpretacion") or contenido

def _resolver_estado_vigencia_payload(id_documento, contexto_version):
    contexto_version = contexto_version or {}
    estado = _texto_comparable(contexto_version.get("estado")).upper()
    if estado:
        return estado
    return _obtener_estado_version(id_documento, contexto_version.get("id_version")) or ESTADO_BORRADOR

def _obtener_estado_version(id_documento, id_version):
    if not id_documento or not id_version:
        return ""
    return _texto_comparable(
        selectors.estado_version(id_documento, id_version)
    ).upper()

def _bool_a_texto(valor):
    return "true" if bool(valor) else "false"

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

def _lista_a_json_texto(valor):
    if valor is None:
        return ""
    if isinstance(valor, str):
        return valor
    return json.dumps(valor, ensure_ascii=False, default=str)

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
    transaction.on_commit(hilo.start)

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
