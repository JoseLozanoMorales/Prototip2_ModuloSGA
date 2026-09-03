"""Acceso al almacenamiento de PDFs, sin dependencia de vistas ni de HTTP."""

import re
from io import BytesIO
from pathlib import Path, PurePosixPath
from uuid import uuid4
from django.conf import settings
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile

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


def descartar_pdf_subido(datos_archivo):
    """Limpia una carga fallida sin ocultar el error original de persistencia."""
    try:
        default_storage.delete(datos_archivo["archivo_path"])
    except (OSError, ValueError):
        import logging
        logging.getLogger(__name__).exception("No se pudo limpiar el PDF de una carga fallida")


def eliminar_archivos_versiones(versiones):
    """Borra PDFs después del commit y devuelve las rutas cuya limpieza falló.

    Un fallo del almacenamiento no revierte ni oculta una eliminación en BD.
    La vista puede comunicar la advertencia y las rutas permiten reintentar.
    """
    fallidas = []
    procesadas = set()
    for version in versiones:
        ruta = str(version.get("archivo_path") or "").strip()
        if not ruta or ruta in procesadas:
            continue
        procesadas.add(ruta)
        try:
            _eliminar_archivo_version_fisico(version)
        except (OSError, ValueError):
            fallidas.append(ruta)
    return fallidas


PDF_TEXTO_MINIMO_CARACTERES = 200

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

def _contar_caracteres_texto(texto):
    """Cuenta contenido real, sin hacer que espacios y saltos inflen el total."""
    return len(re.sub(r"\s+", "", texto or ""))
