from datetime import datetime, timedelta, date
from django.db import models
from django.contrib.auth.models import User, Group


class Perms(models.Model):
    class Meta:
        permissions = (
            ("puede_modificar_", "Descripción del permiso"),
        )


class ModeloBase(models.Model):
    """ Modelo base para todos los modelos del proyecto """
    from django.contrib.auth.models import User
    status = models.BooleanField(default=True)
    usuario_creacion = models.ForeignKey(User, related_name='+', blank=True, null=True, on_delete=models.CASCADE)
    fecha_creacion = models.DateTimeField(blank=True, null=True)
    usuario_modificacion = models.ForeignKey(User, related_name='+', blank=True, null=True, on_delete=models.CASCADE)
    fecha_modificacion = models.DateTimeField(blank=True, null=True)

    def save(self, *args, **kwargs):
        usuario = None
        if len(args):
            # usuario = args[0]
            usuario = args[0].user.id
        if self.id:
            self.usuario_modificacion_id = usuario if usuario else 1
            self.fecha_modificacion = datetime.now()
        else:
            self.usuario_creacion_id = usuario if usuario else 1
            self.fecha_creacion = datetime.now()
        models.Model.save(self)

    class Meta:
        abstract = True
        ordering = ['-fecha_creacion']


class Modulo(ModeloBase):
    url = models.CharField(default='', max_length=100, verbose_name=u'URL')
    nombre = models.CharField(default='', max_length=100, verbose_name=u'Nombre')
    icono = models.CharField(default='', max_length=100, verbose_name=u'Icono')
    descripcion = models.CharField(default='', max_length=200, verbose_name=u'Descripción')
    activo = models.BooleanField(default=True, verbose_name=u'Activo')
    sga = models.BooleanField(default=False, verbose_name=u'Activo para SGA')
    sagest = models.BooleanField(default=False, verbose_name=u'Activo para SAGEST')
    posgrado = models.BooleanField(default=False, verbose_name=u'Activo para POSGRADO')
    postulacion = models.BooleanField(default=False, verbose_name=u'Activo para Postulción')

    def __str__(self):
        return u'%s (/%s)' % (self.nombre, self.url)

    class Meta:
        verbose_name = u"Modulo"
        verbose_name_plural = u"Modulos"
        ordering = ['nombre']
        unique_together = ('url',)

    def save(self, *args, **kwargs):
        self.url = self.url.strip()
        self.nombre = self.nombre.strip()
        self.icono = self.icono.strip()
        self.descripcion = self.descripcion.strip()
        super(Modulo, self).save(*args, **kwargs)


class Persona(ModeloBase):
    nombres = models.CharField(default='', max_length=100, verbose_name=u'Nombre')
    apellido1 = models.CharField(default='', max_length=50, verbose_name=u"1er Apellido")
    apellido2 = models.CharField(default='', max_length=50, verbose_name=u"2do Apellido")
    cedula = models.CharField(default='', max_length=20, verbose_name=u"Cedula", blank=True)
    pasaporte = models.CharField(default='', max_length=20, blank=True, verbose_name=u"Pasaporte")
    ruc = models.CharField(default='', max_length=20, blank=True, null=True, verbose_name=u"Ruc")
    nacimiento = models.DateField(verbose_name=u"Fecha de nacimiento o constitución")
    usuario = models.ForeignKey(User, on_delete=models.CASCADE, null=True)

    def __str__(self):
        return u'%s' % self.nombres

    class Meta:
        verbose_name = u"Persona"
        verbose_name_plural = u"Personas"
        ordering = ['nombres']

    def save(self, *args, **kwargs):
        self.nombres = self.nombres.strip()
        self.apellido1 = self.apellido1.strip()
        self.apellido2 = self.apellido2.strip()
        super(Persona, self).save(*args, **kwargs)


class Administrativo(ModeloBase):
    persona = models.ForeignKey(Persona, on_delete=models.CASCADE, verbose_name=u'Persona')


class Profesor(ModeloBase):
    persona = models.ForeignKey(Persona, on_delete=models.CASCADE, verbose_name=u'Persona')


class Empleador(ModeloBase):
    persona = models.ForeignKey(Persona, on_delete=models.CASCADE, verbose_name=u'Persona')


class InscripcionAspirante(ModeloBase):
    persona = models.ForeignKey(Persona, on_delete=models.CASCADE, verbose_name=u'Persona')


class Inscripcion(ModeloBase):
    persona = models.ForeignKey(Persona, on_delete=models.CASCADE, verbose_name=u'Persona')


class PerfilUsuario(ModeloBase):
    persona = models.ForeignKey(Persona, on_delete=models.CASCADE)
    administrativo = models.ForeignKey(Administrativo, on_delete=models.CASCADE, blank=True, null=True, verbose_name=u'Administrativo')
    profesor = models.ForeignKey(Profesor, on_delete=models.CASCADE, blank=True, null=True, verbose_name=u'Profesor')
    empleador = models.ForeignKey(Empleador, on_delete=models.CASCADE, blank=True, null=True, verbose_name=u'Empleador bolsa laboral')
    inscripcion = models.ForeignKey(Inscripcion, on_delete=models.CASCADE, blank=True, null=True, verbose_name=u'Inscripción')
    inscripcionprincipal = models.BooleanField(default=False, verbose_name=u'Inscripción principal')

    def __str__(self):
        if self.es_estudiante():
            return u'%s' % "ESTUDIANTE"
        elif self.es_profesor():
            return u'%s' % "PROFESOR"
        elif self.es_administrativo():
            return u'%s' % "ADMINISTRATIVO"
        elif self.es_empleador():
            return u'%s' % "EMPLEADOR"
        elif self.es_instructor():
            return u'%s' % "INSTRUCTOR"
        else:
            return u'%s' % "OTRO PERFIL"

    class Meta:
        ordering = ['persona', 'inscripcion', 'administrativo', 'profesor']
        unique_together = ('persona', 'inscripcion', 'administrativo', 'profesor')


class Periodo(ModeloBase):
    nombre = models.CharField(default='', max_length=200, verbose_name=u'Nombre')
    inicio = models.DateField(verbose_name=u'Fecha inicio', null=True, blank=True)
    fin = models.DateField(verbose_name=u'Fecha fin', null=True, blank=True)
    activo = models.BooleanField(default=True, verbose_name=u'Activo')

    def __str__(self):
        return self.nombre

    class Meta:
        verbose_name = u"Periodo"
        verbose_name_plural = u"Periodos"
        ordering = ['nombre']
        unique_together = ('nombre', 'inicio', 'fin')
