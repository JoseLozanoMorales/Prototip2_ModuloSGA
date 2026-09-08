"""Compatibilidad entre los catálogos numéricos y los textos persistidos.

Los identificadores de tuplas.py no cambian el formato de la base de datos,
los formularios ni los contratos de IA. Las equivalencias usan identificadores
explícitos para que reordenar las opciones no cambie su significado.
"""

from .tuplas import TIPO_DOCUMENTO, ESTADO, ESTADO_IA


TIPO_DOCUMENTO_CODIGOS = {
    1: 'Documento legal',
    2: 'Manual',
    3: 'Reglamento',
    4: 'Guías',
    5: 'Ordenes',
    6: 'Modelos',
    7: 'Procedimiento',
    8: 'Videos',
}

ESTADO_CODIGOS = {
    1: 'BORRADOR',
    2: 'VIGENTE',
    3: 'NO_VIGENTE',
    4: 'ELIMINADO',
}

ESTADO_IA_CODIGOS = {
    1: 'PENDIENTE',
    2: 'LEIDO',
    3: 'OMITIDO',
    4: 'OBSERVADO',
    5: 'ERROR',
}

TIPO_DOCUMENTO_CHOICES = tuple(
    (TIPO_DOCUMENTO_CODIGOS[identificador], etiqueta)
    for identificador, etiqueta in TIPO_DOCUMENTO
)
ESTADO_CHOICES = tuple(
    (ESTADO_CODIGOS[identificador], etiqueta)
    for identificador, etiqueta in ESTADO
)
ESTADO_IA_CHOICES = tuple(
    (ESTADO_IA_CODIGOS[identificador], etiqueta)
    for identificador, etiqueta in ESTADO_IA
)
