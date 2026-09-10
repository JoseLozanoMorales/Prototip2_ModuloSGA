"""Pruebas reales de la función PostgreSQL que protege la consulta documental."""

from datetime import datetime
from unittest import skipUnless
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TransactionTestCase
from django.utils import timezone

from .models import AccesoDocumento, AccesoLectorModulo, Documento, VersionDocumento
from .repositories import listar_documentos_modulo


@skipUnless(connection.vendor == "postgresql", "La segmentación se ejecuta en PostgreSQL")
class VisibilidadLectoresPostgreSQLTests(TransactionTestCase):
    reset_sequences = True

    def crear_lector(self, nombre, perfiles):
        usuario = get_user_model().objects.create_user(nombre)
        AccesoLectorModulo.objects.bulk_create(
            [
                AccesoLectorModulo(
                    id_usuario_externo=usuario.pk,
                    id_perfil_externo=perfil,
                    id_grupo_externo=None,
                    id_tipo_periodo_externo=None,
                    fecha_asignacion=timezone.now(),
                )
                for perfil in perfiles
            ]
        )
        return usuario

    def crear_documento_publicado(self, titulo, perfil):
        documento = Documento.objects.create(
            titulo=titulo,
            descripcion="Prueba de visibilidad",
            palabras_clave="acceso",
            fecha_creacion=timezone.now(),
            uuid_documento=uuid4(),
        )
        version = VersionDocumento.objects.create(
            documento=documento,
            numero_version=1,
            archivo_nombre=f"{titulo}.pdf",
            archivo_path=f"documentos/{titulo}.pdf",
            fecha_subida=timezone.now(),
            fecha_aprobacion=timezone.make_aware(datetime(2026, 1, 1)),
            uuid_version=uuid4(),
            estado="VIGENTE",
            estado_ia="OMITIDO",
            publicado=True,
        )
        Documento.objects.filter(pk=documento.pk).update(version_vigente=version)
        AccesoDocumento.objects.create(
            documento=documento,
            id_perfil_externo=perfil,
            id_grupo_externo=None,
            id_tipo_periodo_externo=None,
            fecha_asignacion=timezone.now(),
        )

    def titulos_visibles(self, usuario):
        identidad_heredada = {
            "id_usuario_externo": usuario.pk,
            "id_perfil_externo": 99,
            "id_grupo_externo": 99,
            "id_tipo_periodo_externo": 99,
        }
        return {fila["titulo"] for fila in listar_documentos_modulo(identidad_heredada, "", None)}

    def test_universal_estudiante_docente_y_mixto(self):
        universal = self.crear_lector("universal", [None])
        estudiante = self.crear_lector("estudiante", [1])
        docente = self.crear_lector("docente", [2])
        mixto = self.crear_lector("mixto", [1, 2])

        self.crear_documento_publicado("Global", None)
        self.crear_documento_publicado("Solo estudiantes", 1)
        self.crear_documento_publicado("Solo docentes", 2)
        self.crear_documento_publicado("Solo administrativos", 3)

        self.assertEqual(
            self.titulos_visibles(universal),
            {"Global", "Solo estudiantes", "Solo docentes", "Solo administrativos"},
        )
        self.assertEqual(self.titulos_visibles(estudiante), {"Global", "Solo estudiantes"})
        self.assertEqual(self.titulos_visibles(docente), {"Global", "Solo docentes"})
        self.assertEqual(
            self.titulos_visibles(mixto),
            {"Global", "Solo estudiantes", "Solo docentes"},
        )
