"""Opciones documentales en formato (identificador numérico, etiqueta).

Los números identifican opciones del catálogo; los tipos y estados siguen
guardándose como texto mediante las equivalencias de catalogos.py.
Los perfiles representan categorías, no identificadores de PerfilUsuario.
"""

TIPO_DOCUMENTO = (
    (1, u'Documento legal'),
    (2, u'Manual'),
    (3, u'Reglamento'),
    (4, u'Guías'),
    (5, u'Ordenes'),
    (6, u'Modelos'),
    (7, u'Procedimiento'),
    (8, u'Videos'),
)

PERFILES = (
    (None, u'Todos'),
    (1, u'Estudiante'),
    (2, u'Docente'),
    (3, u'Administrativo'),
    (4, u'Empleador'),
)

ESTADO_IA = (
    (1, u'Pendiente'),
    (2, u'Leido'),
    (3, u'Lectura omitida'),
    (4, u'No Leído'),
    (5, u'Error'),
)

ESTADO = (
    (1, u'Borrador'),
    (2, u'Vigente'),
    (3, u'No vigente'),
    (4, u'Eliminado'),
)
