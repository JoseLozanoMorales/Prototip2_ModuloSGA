"""Catálogos y representación de permisos compartidos por formularios e IA."""

from django.db import DatabaseError
from sga.models import PerfilUsuario, Periodo
from .constants import (
    NOMBRES_PERFILES_ACCESO,
    NOMBRES_GRUPOS_ACCESO,
    NOMBRES_PERIODOS_ACCESO,
)

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

def _opciones_desde_mapa(nombres):
    return [
        {"id": "" if identificador is None else identificador, "nombre": nombre}
        for identificador, nombre in nombres.items()
    ]

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

def _nombres_catalogo(opciones):
    nombres = {}
    for opcion in opciones:
        identificador = opcion["id"]
        identificador = None if identificador == "" else int(identificador)
        nombres[identificador] = opcion["nombre"]
    return nombres

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
