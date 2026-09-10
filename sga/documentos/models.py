"""Mapeo ORM de las tablas documentales heredadas.

Las tablas siguen siendo administradas por PostgreSQL y por los scripts
``schema_*.sql``. ``managed = False`` permite usar el ORM sin que las
migraciones de Django intenten crear, alterar o eliminar esas tablas.
"""

from django.db import models

from .tuplas import PERFILES
from .catalogos import TIPO_DOCUMENTO_CHOICES as TIPO_DOCUMENTO, ESTADO_CHOICES as ESTADO, ESTADO_IA_CHOICES as ESTADO_IA

ESTADO_BORRADOR = "BORRADOR"
ESTADO_VIGENTE = "VIGENTE"
ESTADO_NO_VIGENTE = "NO_VIGENTE"
ESTADO_ELIMINADO = "ELIMINADO"


class DocumentoQuerySet(models.QuerySet):
    def visibles(self):
        return self.filter(fecha_eliminacion__isnull=True)


class VersionDocumentoQuerySet(models.QuerySet):
    def activas(self):
        return self.exclude(estado=ESTADO_ELIMINADO)

    def publicadas(self):
        return self.filter(publicado=True)

    def vigentes(self):
        return self.filter(estado=ESTADO_VIGENTE)


class Documento(models.Model):
    id_documento = models.BigAutoField(primary_key=True)
    titulo = models.TextField()
    descripcion = models.TextField(blank=True, null=True)
    version_vigente = models.ForeignKey(
        "VersionDocumento", db_column="id_version_vigente", related_name="+",
        blank=True, null=True, on_delete=models.SET_NULL,
    )
    creado_por = models.BigIntegerField(blank=True, null=True)
    fecha_creacion = models.DateTimeField()
    actualizado_por = models.BigIntegerField(blank=True, null=True)
    fecha_actualizacion = models.DateTimeField(blank=True, null=True)
    eliminado_por = models.BigIntegerField(blank=True, null=True)
    fecha_eliminacion = models.DateTimeField(blank=True, null=True)
    motivo_eliminacion = models.TextField(blank=True, null=True)
    palabras_clave = models.TextField(default="")
    tipo = models.CharField(max_length=20, choices=TIPO_DOCUMENTO, default="Documento legal")
    # tipodocumento = models.IntegerField(choices=TIPO_DOCUMENTO, default=1)
    tiene_versionamiento = models.BooleanField(default=False)
    uuid_documento = models.UUIDField()

    objects = DocumentoQuerySet.as_manager()

    class Meta:
        managed = False
        db_table = "docs"

    def __str__(self):
        return self.titulo


class VersionDocumento(models.Model):
    id_version = models.BigAutoField(primary_key=True)
    documento = models.ForeignKey(Documento, db_column="id_documento", related_name="versiones",on_delete=models.PROTECT)
    # documento = models.ForeignKey(Documento, verbose_name="versiones", on_delete=models.PROTECT)
    numero_version = models.IntegerField()
    archivo_nombre = models.TextField()
    archivo_path = models.TextField()
    archivo_tipo = models.CharField(max_length=100, blank=True, null=True)
    archivo_tamano = models.BigIntegerField(blank=True, null=True)
    descripcion_cambio = models.TextField(blank=True, null=True)
    mensaje_auditoria = models.TextField(blank=True, null=True)
    fecha_subida = models.DateTimeField()
    subido_por = models.BigIntegerField(blank=True, null=True)
    fecha_aprobacion = models.DateTimeField()
    uuid_version = models.UUIDField()
    estado = models.TextField(choices=ESTADO, default=ESTADO_BORRADOR)
    estado_ia = models.TextField(choices=ESTADO_IA, default="PENDIENTE")
    porcentaje_texto_ia = models.DecimalField(
        max_digits=5, decimal_places=2, blank=True, null=True
    )
    mensaje_ia = models.TextField(blank=True, null=True)
    fecha_analisis_ia = models.DateTimeField(blank=True, null=True)
    resultado_ia = models.JSONField(blank=True, null=True)
    publicado = models.BooleanField(default=False)
    eliminado_por = models.BigIntegerField(blank=True, null=True)
    fecha_eliminacion = models.DateTimeField(blank=True, null=True)
    motivo_eliminacion = models.TextField(blank=True, null=True)

    objects = VersionDocumentoQuerySet.as_manager()

    class Meta:
        managed = False
        db_table = "doc_versions"
        ordering = ("-numero_version", "-id_version")

    def __str__(self):
        return f"{self.documento_id} - versión {self.numero_version}"


class AccesoDocumento(models.Model):
    id_acceso = models.BigAutoField(primary_key=True)
    documento = models.ForeignKey(
        Documento, db_column="id_documento", related_name="accesos",
        on_delete=models.CASCADE,
    )
    id_perfil_externo = models.BigIntegerField(choices=PERFILES, blank=True, null=True)
    id_grupo_externo = models.BigIntegerField(blank=True, null=True)
    id_tipo_periodo_externo = models.BigIntegerField(blank=True, null=True)
    activo = models.BooleanField(default=True)
    asignado_por = models.BigIntegerField(blank=True, null=True)
    fecha_asignacion = models.DateTimeField()

    class Meta:
        managed = False
        db_table = "documento_acceso"


class LecturaDocumento(models.Model):
    id_lectura = models.BigAutoField(primary_key=True)
    documento = models.ForeignKey(
        Documento, db_column="id_documento", related_name="lecturas",
        on_delete=models.CASCADE,
    )
    version = models.ForeignKey(
        VersionDocumento, db_column="id_version", related_name="lecturas",
        blank=True, null=True, on_delete=models.SET_NULL,
    )
    id_usuario_externo = models.BigIntegerField(blank=True, null=True)
    nombre_usuario = models.TextField(blank=True, null=True)
    accion = models.CharField(max_length=30)
    fecha_hora = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = "documento_lectura"


class HistorialEliminacion(models.Model):
    id_historial = models.BigAutoField(primary_key=True)
    id_documento = models.BigIntegerField()
    id_version = models.BigIntegerField(blank=True, null=True)
    titulo_documento = models.TextField()
    numero_version = models.IntegerField(blank=True, null=True)
    nombre_usuario = models.TextField()
    motivo_eliminacion = models.TextField()
    total_versiones = models.IntegerField()
    versiones_eliminadas = models.JSONField(default=list)
    fecha_eliminacion = models.DateTimeField()

    class Meta:
        managed = False
        db_table = "historial_eliminaciones"
        ordering = ("-fecha_eliminacion", "-id_historial")


class EditorModulo(models.Model):
    id_editor = models.BigAutoField(primary_key=True)
    id_usuario_externo = models.BigIntegerField(unique=True)
    nombre_usuario = models.TextField(blank=True, null=True)
    activo = models.BooleanField(default=True)
    asignado_por = models.BigIntegerField(blank=True, null=True)
    fecha_asignacion = models.DateTimeField()

    class Meta:
        managed = False
        db_table = "modulo_editores"


class AccesoLectorModulo(models.Model):
    """Audiencias que representa un lector dentro del módulo documental.

    Un valor nulo funciona como comodín para esa dimensión. Por ejemplo,
    ``(1, NULL, NULL)`` representa a estudiantes de cualquier grupo y período;
    una fila completamente nula concede acceso universal al lector.
    """

    id_acceso_lector = models.BigAutoField(primary_key=True)
    id_usuario_externo = models.BigIntegerField()
    id_perfil_externo = models.BigIntegerField(choices=PERFILES, blank=True, null=True)
    id_grupo_externo = models.BigIntegerField(blank=True, null=True)
    id_tipo_periodo_externo = models.BigIntegerField(blank=True, null=True)
    activo = models.BooleanField(default=True)
    asignado_por = models.BigIntegerField(blank=True, null=True)
    fecha_asignacion = models.DateTimeField()

    class Meta:
        managed = False
        db_table = "modulo_lectores_acceso"
