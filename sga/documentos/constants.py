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
        "label": "No Leído",
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
