"""Acceso excepcional a SQL heredado que todavía no se expresa con ORM.

Cada consulta debe tener un nombre de negocio. No se deben añadir cadenas SQL
directamente a las vistas; cuando una consulta no sea razonable con el ORM se
encapsula aquí y se documenta el motivo.
"""

import unicodedata

from django.db import connection


def consultar_filas(sql, parametros):
    with connection.cursor() as cursor:
        cursor.execute(sql, parametros)
        columnas = [columna[0] for columna in cursor.description]
        return [dict(zip(columnas, fila)) for fila in cursor.fetchall()]


def columna_existe(tabla, columna):
    with connection.cursor() as cursor:
        columnas = connection.introspection.get_table_description(cursor, tabla)
    return any(campo.name == columna for campo in columnas)


def _terminos_busqueda(busqueda):
    texto = unicodedata.normalize("NFKD", busqueda or "")
    texto = "".join(caracter for caracter in texto if not unicodedata.combining(caracter))
    return list(dict.fromkeys(texto.casefold().split()))


def listar_documentos_modulo(usuario, busqueda, anio):
    """Consulta heredada compleja de visibilidad segmentada por usuario."""
    terminos = _terminos_busqueda(busqueda)
    texto_buscable = """
        TRANSLATE(
            LOWER(CONCAT_WS(' ', listado.titulo, listado.descripcion,
                            listado.palabras_clave, d.tipo, listado.anio::text)),
            'áéíóúü', 'aeiouu'
        )
    """
    condiciones = "".join(
        f" AND {texto_buscable} LIKE %s ESCAPE '!'" for _termino in terminos
    )
    parametros_busqueda = [
        "%" + termino.replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%"
        for termino in terminos
    ]
    return consultar_filas(
        f"""
        SELECT listado.*, d.tipo
        FROM fn_listar_documentos_modulo(%s, %s, %s, %s, %s, %s) AS listado
        JOIN docs d ON d.id_documento = listado.id_documento
        WHERE d.fecha_eliminacion IS NULL
        {condiciones};
        """,
        [
            usuario["id_usuario_externo"], usuario["id_perfil_externo"],
            usuario["id_grupo_externo"], usuario["id_tipo_periodo_externo"],
            "", anio,
        ] + parametros_busqueda,
    )


def listar_papelera(busqueda, anio):
    return consultar_filas(
        "SELECT * FROM fn_listar_papelera_documentos(%s, %s);",
        [busqueda, anio],
    )
