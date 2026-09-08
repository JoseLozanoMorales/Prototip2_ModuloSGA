from .tuplas import PERFILES
from .catalogos import ESTADO_IA_CHOICES as ESTADO_IA

ESTADO_IA_PENDIENTE = "PENDIENTE"
ESTADO_IA_LEIDO = "LEIDO"
ESTADO_IA_OMITIDO = "OMITIDO"
ESTADO_IA_OBSERVADO = "OBSERVADO"
ESTADO_IA_ERROR = "ERROR"

ESTADOS_IA_DOCUMENTO = {
    ESTADO_IA_PENDIENTE: {
        "label": dict(ESTADO_IA)[ESTADO_IA_PENDIENTE],
        "leido": False,
        "clase": "status-pending",
    },
    ESTADO_IA_LEIDO: {
        "label": dict(ESTADO_IA)[ESTADO_IA_LEIDO],
        "leido": True,
        "clase": "status-success",
    },
    ESTADO_IA_OMITIDO: {
        "label": dict(ESTADO_IA)[ESTADO_IA_OMITIDO],
        "leido": False,
        "clase": "status-skipped",
    },
    ESTADO_IA_OBSERVADO: {
        "label": dict(ESTADO_IA)[ESTADO_IA_OBSERVADO],
        "leido": False,
        "clase": "status-warning",
    },
    ESTADO_IA_ERROR: {
        "label": dict(ESTADO_IA)[ESTADO_IA_ERROR],
        "leido": False,
        "clase": "status-error",
    },
}

NOMBRES_PERFILES_ACCESO = dict(PERFILES)

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
