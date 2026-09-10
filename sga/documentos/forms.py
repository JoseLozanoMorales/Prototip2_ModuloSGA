from datetime import date

from django import forms

from .models import ESTADO_BORRADOR, ESTADO_NO_VIGENTE, ESTADO_VIGENTE
from .catalogos import TIPO_DOCUMENTO_CHOICES as TIPO_DOCUMENTO


FECHA_APROBACION_MINIMA = date(1984, 1, 1)
TIPO_DOCUMENTO_PREDETERMINADO = "Documento legal"
ESTADOS_EDITABLES = (
    (ESTADO_BORRADOR, "Borrador"),
    (ESTADO_VIGENTE, "Vigente"),
    (ESTADO_NO_VIGENTE, "No vigente"),
)


class DocumentoBaseForm(forms.Form):
    """Campos compartidos por los modales de creación y edición."""

    titulo = forms.CharField(
        required=True,
        strip=True,
        error_messages={"required": "El título del documento es obligatorio."},
    )
    descripcion = forms.CharField(required=False, strip=True, widget=forms.Textarea)
    palabras_clave = forms.CharField(required=False, strip=True, widget=forms.Textarea)
    fecha_aprobacion = forms.DateField(
        required=True,
        input_formats=("%Y-%m-%d",),
        widget=forms.DateInput(attrs={"type": "date"}),
        error_messages={
            "required": "La fecha de aprobación es obligatoria.",
            "invalid": "La fecha debe tener el formato AAAA-MM-DD.",
        },
    )
    tipo = forms.ChoiceField(choices=TIPO_DOCUMENTO, required=False)
    archivo = forms.FileField(required=False)

    def __init__(self, *args, tipo_actual=TIPO_DOCUMENTO_PREDETERMINADO,
                 selector_tipo_habilitado=False, **kwargs):
        super().__init__(*args, **kwargs)
        self.tipo_actual = tipo_actual or TIPO_DOCUMENTO_PREDETERMINADO
        self.selector_tipo_habilitado = selector_tipo_habilitado

    def clean_fecha_aprobacion(self):
        fecha = self.cleaned_data["fecha_aprobacion"]
        if fecha < FECHA_APROBACION_MINIMA or fecha > date.today():
            raise forms.ValidationError(
                "La fecha de aprobación debe estar entre "
                f"{FECHA_APROBACION_MINIMA.isoformat()} y {date.today().isoformat()}."
            )
        return fecha

    def clean_tipo(self):
        if not self.selector_tipo_habilitado:
            return self.tipo_actual
        tipo = self.cleaned_data.get("tipo")
        if not tipo:
            raise forms.ValidationError("El tipo de documento es obligatorio.")
        return tipo

    def clean_palabras_clave(self):
        """Guarda etiquetas separadas, limpias y sin duplicados."""
        valor = self.cleaned_data.get("palabras_clave", "")
        etiquetas = []
        vistas = set()

        for fragmento in valor.replace("\r", "\n").replace(";", ",").split(","):
            for etiqueta in fragmento.split("\n"):
                etiqueta = " ".join(etiqueta.split())
                if not etiqueta:
                    continue
                if len(etiqueta) > 80:
                    raise forms.ValidationError(
                        "Cada palabra clave puede tener como máximo 80 caracteres."
                    )
                clave = etiqueta.casefold()
                if clave not in vistas:
                    vistas.add(clave)
                    etiquetas.append(etiqueta)

        if len(etiquetas) > 30:
            raise forms.ValidationError("Puede registrar como máximo 30 palabras clave.")

        return ", ".join(etiquetas)

    def mensaje_error(self):
        for errores in self.errors.as_data().values():
            if errores:
                return errores[0].message
        return "Los datos del formulario no son válidos."


class CrearDocumentoForm(DocumentoBaseForm):
    procesar_ia = forms.BooleanField(required=False, initial=True)

    def clean_archivo(self):
        archivo = self.cleaned_data.get("archivo")
        if not archivo:
            raise forms.ValidationError("Debe seleccionar un archivo PDF.")
        return archivo


class EditarDocumentoForm(DocumentoBaseForm):
    id_version_vigente = forms.IntegerField(
        required=True,
        min_value=1,
        error_messages={
            "required": "Debe seleccionar una versión del documento.",
            "invalid": "La versión seleccionada no es válida.",
            "min_value": "La versión seleccionada no es válida.",
        },
    )
    estado_version = forms.ChoiceField(
        choices=ESTADOS_EDITABLES,
        initial=ESTADO_BORRADOR,
        error_messages={
            "required": "El estado de la versión es obligatorio.",
            "invalid_choice": "El estado de la versión no es válido.",
        },
    )
