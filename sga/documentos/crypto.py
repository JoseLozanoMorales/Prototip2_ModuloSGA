"""Cifrado autenticado de los documentos almacenados por el modulo."""

import base64
import binascii
import os

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured


MAGIC = b"SGADOC\x01"
NONCE_SIZE = 12
AAD = b"sga.documentos:pdf:v1"


def _clave_documentos():
    valor = getattr(settings, "DOCUMENTOS_ENCRYPTION_KEY", "")
    if not valor:
        raise ImproperlyConfigured(
            "Falta DOCUMENTOS_ENCRYPTION_KEY para cifrar los documentos."
        )
    try:
        clave = base64.b64decode(valor, validate=True)
    except (ValueError, binascii.Error) as error:
        raise ImproperlyConfigured(
            "DOCUMENTOS_ENCRYPTION_KEY debe estar codificada en Base64."
        ) from error
    if len(clave) != 32:
        raise ImproperlyConfigured(
            "DOCUMENTOS_ENCRYPTION_KEY debe representar exactamente 32 bytes."
        )
    return clave


def esta_cifrado(contenido):
    return contenido.startswith(MAGIC)


def cifrar_pdf(contenido):
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    nonce = os.urandom(NONCE_SIZE)
    cifrado = AESGCM(_clave_documentos()).encrypt(nonce, contenido, AAD)
    return MAGIC + nonce + cifrado


def descifrar_pdf(contenido):
    """Descifra el formato actual; permite leer documentos legados en claro."""
    if not esta_cifrado(contenido):
        return contenido

    from cryptography.exceptions import InvalidTag
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    inicio = len(MAGIC)
    nonce = contenido[inicio : inicio + NONCE_SIZE]
    cifrado = contenido[inicio + NONCE_SIZE :]
    if len(nonce) != NONCE_SIZE or not cifrado:
        raise ValueError("El documento cifrado esta incompleto.")
    try:
        return AESGCM(_clave_documentos()).decrypt(nonce, cifrado, AAD)
    except InvalidTag as error:
        raise ValueError(
            "No se pudo verificar el documento cifrado; la clave o el archivo no son validos."
        ) from error
