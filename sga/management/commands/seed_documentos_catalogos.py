from datetime import date

from django.core.management.base import BaseCommand

from sga.models import (
    Administrativo,
    Empleador,
    Inscripcion,
    PerfilUsuario,
    Periodo,
    Persona,
    Profesor,
)


class Command(BaseCommand):
    help = "Crea datos de prueba para los catalogos de acceso de documentos."

    def handle(self, *args, **options):
        periodos_creados = self._crear_periodos()
        perfiles_creados = self._crear_perfiles()

        self.stdout.write(
            self.style.SUCCESS(
                f"Catalogos listos. Periodos nuevos: {periodos_creados}. "
                f"Perfiles nuevos: {perfiles_creados}."
            )
        )

    def _crear_periodos(self):
        periodos = [
            ("Nivelacion 2026", date(2026, 1, 1), date(2026, 4, 30)),
            ("Grado 2026", date(2026, 5, 1), date(2026, 9, 30)),
            ("Postgrado 2026", date(2026, 10, 1), date(2026, 12, 31)),
        ]
        creados = 0
        for nombre, inicio, fin in periodos:
            periodo = Periodo.objects.filter(
                nombre=nombre,
                inicio=inicio,
                fin=fin,
            ).first()
            if periodo:
                Periodo.objects.filter(pk=periodo.pk).update(activo=True, status=True)
                continue

            periodo = Periodo(
                nombre=nombre,
                inicio=inicio,
                fin=fin,
                activo=True,
                status=True,
            )
            periodo.save_base(raw=True, force_insert=True)
            creados += 1
        return creados

    def _crear_perfiles(self):
        perfiles = [
            ("9990000001", "Estudiante Prueba", "inscripcion"),
            ("9990000002", "Docente Prueba", "profesor"),
            ("9990000003", "Administrativo Prueba", "administrativo"),
            ("9990000004", "Empleador Prueba", "empleador"),
        ]
        creados = 0
        for cedula, nombres, tipo_perfil in perfiles:
            persona = self._obtener_o_crear_persona(cedula, nombres)
            perfil, creado = self._crear_perfil(persona, tipo_perfil)
            PerfilUsuario.objects.filter(pk=perfil.pk).update(status=True)
            creados += int(creado)
        return creados

    def _obtener_o_crear_persona(self, cedula, nombres):
        persona = Persona.objects.filter(cedula=cedula).first()
        if persona:
            Persona.objects.filter(pk=persona.pk).update(status=True)
            return persona

        persona = Persona(
            cedula=cedula,
            nombres=nombres,
            apellido1="Catalogo",
            apellido2="Documentos",
            nacimiento=date(1990, 1, 1),
            status=True,
        )
        persona.save_base(raw=True, force_insert=True)
        return persona

    def _crear_perfil(self, persona, tipo_perfil):
        datos = {
            "persona": persona,
            "administrativo": None,
            "profesor": None,
            "empleador": None,
            "inscripcion": None,
            "inscripcionprincipal": tipo_perfil == "inscripcion",
        }

        if tipo_perfil == "inscripcion":
            datos["inscripcion"] = self._obtener_o_crear_relacion(
                Inscripcion,
                persona,
            )
        elif tipo_perfil == "profesor":
            datos["profesor"] = self._obtener_o_crear_relacion(Profesor, persona)
        elif tipo_perfil == "administrativo":
            datos["administrativo"] = self._obtener_o_crear_relacion(
                Administrativo,
                persona,
            )
        elif tipo_perfil == "empleador":
            datos["empleador"] = self._obtener_o_crear_relacion(Empleador, persona)

        perfil = PerfilUsuario.objects.filter(**datos).first()
        if perfil:
            return perfil, False

        perfil = PerfilUsuario(**datos, status=True)
        perfil.save_base(raw=True, force_insert=True)
        return perfil, True

    def _obtener_o_crear_relacion(self, modelo, persona):
        relacion = modelo.objects.filter(persona=persona).first()
        if relacion:
            modelo.objects.filter(pk=relacion.pk).update(status=True)
            return relacion

        relacion = modelo(persona=persona, status=True)
        relacion.save_base(raw=True, force_insert=True)
        return relacion
