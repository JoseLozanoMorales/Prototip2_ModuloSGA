from django.contrib import admin

from sga.models import (
    Persona, PerfilUsuario, Periodo, Modulo, Administrativo, Profesor,
    Empleador, InscripcionAspirante, Inscripcion,
)


@admin.register(Persona)
class PersonaAdmin(admin.ModelAdmin):
    list_display = ('id', 'nombres', 'apellido1', 'apellido2', 'cedula', 'nacimiento')
    search_fields = ('nombres', 'apellido1', 'apellido2', 'cedula')


@admin.register(Modulo)
class ModuloAdmin(admin.ModelAdmin):
    list_display = ('id', 'nombre', 'url', 'icono', 'activo', 'sga', 'sagest', 'posgrado', 'postulacion')
    list_filter = ('activo', 'sga', 'sagest', 'posgrado', 'postulacion')
    search_fields = ('nombre', 'url')


@admin.register(Administrativo)
class AdministrativoAdmin(admin.ModelAdmin):
    list_display = ('id', 'persona', 'status')
    search_fields = ('persona__nombres', 'persona__apellido1', 'persona__apellido2', 'persona__cedula')


@admin.register(Profesor)
class ProfesorAdmin(admin.ModelAdmin):
    list_display = ('id', 'persona', 'status')
    search_fields = ('persona__nombres', 'persona__apellido1', 'persona__apellido2', 'persona__cedula')


@admin.register(Empleador)
class EmpleadorAdmin(admin.ModelAdmin):
    list_display = ('id', 'persona', 'status')
    search_fields = ('persona__nombres', 'persona__apellido1', 'persona__apellido2', 'persona__cedula')


@admin.register(InscripcionAspirante)
class InscripcionAspiranteAdmin(admin.ModelAdmin):
    list_display = ('id', 'persona', 'status')
    search_fields = ('persona__nombres', 'persona__apellido1', 'persona__apellido2', 'persona__cedula')


@admin.register(Inscripcion)
class InscripcionAdmin(admin.ModelAdmin):
    list_display = ('id', 'persona', 'status')
    search_fields = ('persona__nombres', 'persona__apellido1', 'persona__apellido2', 'persona__cedula')


@admin.register(PerfilUsuario)
class PerfilUsuarioAdmin(admin.ModelAdmin):
    list_display = ('id', 'persona', 'administrativo', 'profesor', 'empleador', 'inscripcion', 'inscripcionprincipal', 'status')
    list_filter = ('inscripcionprincipal', 'status')
    search_fields = ('persona__nombres', 'persona__apellido1', 'persona__apellido2', 'persona__cedula')


@admin.register(Periodo)
class PeriodoAdmin(admin.ModelAdmin):
    list_display = ('id', 'nombre', 'inicio', 'fin', 'activo', 'status')
    list_filter = ('activo', 'status')
    search_fields = ('nombre',)
