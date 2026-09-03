"""Regresión de servicios en SQLite temporal; no utiliza datos del usuario."""

from datetime import date
from unittest import skipUnless
from unittest.mock import patch

from django.conf import settings
from django.contrib.admin.models import LogEntry
from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TestCase

from . import services
from .models import AccesoDocumento, Documento, HistorialEliminacion, LecturaDocumento, VersionDocumento


@skipUnless(getattr(settings, "DOCUMENTOS_SQLITE_TESTS", False), "Usar settings_documentos_tests")
class OperacionesDocumentalesTests(TestCase):
    databases = {"default"} if getattr(settings, "DOCUMENTOS_SQLITE_TESTS", False) else set()

    @classmethod
    def setUpClass(cls):
        # Las tablas heredadas son unmanaged: se crean solo en esta BD temporal.
        with connection.schema_editor() as editor:
            for model in (Documento, VersionDocumento, AccesoDocumento, LecturaDocumento, HistorialEliminacion):
                editor.create_model(model)
        super().setUpClass()

    def setUp(self):
        self.actor = get_user_model().objects.create_user(username="editor_test")
        self.usuario = {"id_usuario_externo": 1001, "nombre_usuario": "Editor"}
        self.archivo = {
            "archivo_nombre": "prueba.pdf", "archivo_path": "documentos/prueba.pdf",
            "archivo_tipo": "application/pdf", "archivo_tamano": 20,
        }

    def crear(self, publicar=False):
        pk = services.crear_documento_con_accesos(
            "Prueba", "Descripción", "clave", date(2025, 1, 1), self.archivo,
            self.usuario, "Manual", [(2, 10, 2)], self.actor,
        )
        if publicar:
            self.publicar(pk, VersionDocumento.objects.get(documento_id=pk).pk)
        return pk

    def publicar(self, pk, *ids):
        for version in ids:
            services.actualizar_estado_ia(pk, version, "LEIDO")
        services.guardar_publicacion_versiones(pk, ids, 1001)

    def agregar(self, id_documento):
        return services.agregar_version_auditada(
            id_documento, self.archivo, "Cambio", date(2025, 2, 1),
            self.usuario, {"titulo": "Prueba"}, self.actor,
        )

    def test_creacion_incluye_accesos_y_auditoria(self):
        pk = self.crear()
        self.assertEqual(VersionDocumento.objects.filter(documento_id=pk).count(), 1)
        self.assertEqual(AccesoDocumento.objects.filter(documento_id=pk).count(), 1)
        self.assertEqual(LogEntry.objects.count(), 1)

    def test_fallo_auditoria_revierte_creacion_completa(self):
        with patch.object(services, "_registrar_auditoria_django_pruebas", side_effect=RuntimeError("auditoria")):
            with self.assertRaises(RuntimeError):
                self.crear()
        self.assertFalse(Documento.objects.exists())
        self.assertFalse(VersionDocumento.objects.exists())
        self.assertFalse(AccesoDocumento.objects.exists())

    def test_fallo_auditoria_revierte_nueva_version_y_vigencia(self):
        pk = self.crear(publicar=True)
        vigente = Documento.objects.get(pk=pk).version_vigente_id
        with patch.object(services, "_registrar_auditoria_django_pruebas", side_effect=RuntimeError("auditoria")):
            with self.assertRaises(RuntimeError):
                self.agregar(pk)
        self.assertEqual(Documento.objects.get(pk=pk).version_vigente_id, vigente)
        self.assertEqual(VersionDocumento.objects.filter(documento_id=pk).count(), 1)
        self.assertEqual(VersionDocumento.objects.get(pk=vigente).estado, "VIGENTE")

    def test_reemplazo_accesos_es_atomico(self):
        pk = self.crear()
        with patch.object(AccesoDocumento.objects, "bulk_create", side_effect=RuntimeError("accesos")):
            with self.assertRaises(RuntimeError):
                services.reemplazar_accesos_documento(pk, [(3, 20, 2)], 1001)
        self.assertEqual(AccesoDocumento.objects.get(documento_id=pk).id_perfil_externo, 2)

    def test_edicion_inactiva_no_pierde_referencia_a_otra_vigente(self):
        pk = self.crear(publicar=True)
        primera = VersionDocumento.objects.get(documento_id=pk).pk
        segunda = self.agregar(pk)
        self.publicar(pk, primera, segunda)
        services.editar_documento_con_accesos(
            pk, "Editado", "Descripción", "clave", date(2025, 1, 1), primera,
            self.usuario, "Manual", [(2, 10, 2)], "NO_VIGENTE", True, None,
            ["Título"], self.actor,
        )
        self.assertEqual(Documento.objects.get(pk=pk).version_vigente_id, segunda)

    def test_fallo_auditoria_revierte_edicion_y_reemplazo_pdf(self):
        pk = self.crear(publicar=True)
        version = VersionDocumento.objects.get(documento_id=pk).pk
        archivo = dict(self.archivo, archivo_path="documentos/nuevo.pdf")
        with patch.object(services, "_registrar_auditoria_django_pruebas", side_effect=RuntimeError("auditoria")):
            with self.assertRaises(RuntimeError):
                services.editar_documento_con_accesos(
                    pk, "Editado", "Descripción", "clave", date(2025, 1, 1), version,
                    self.usuario, "Manual", [(3, 20, 2)], "NO_VIGENTE", True, archivo,
                    ["Título"], self.actor,
                )
        self.assertEqual(Documento.objects.get(pk=pk).titulo, "Prueba")
        self.assertEqual(Documento.objects.get(pk=pk).version_vigente_id, version)
        self.assertEqual(VersionDocumento.objects.get(pk=version).archivo_path, self.archivo["archivo_path"])
        self.assertEqual(VersionDocumento.objects.get(pk=version).estado, "VIGENTE")
        self.assertEqual(AccesoDocumento.objects.get(documento_id=pk).id_perfil_externo, 2)

    def test_fallo_auditoria_revierte_publicacion(self):
        pk = self.crear()
        version = VersionDocumento.objects.get(documento_id=pk).pk
        services.actualizar_estado_ia(pk, version, "LEIDO")
        with patch.object(services, "_registrar_auditoria_django_pruebas", side_effect=RuntimeError("auditoria")):
            with self.assertRaises(RuntimeError):
                services.publicar_versiones_auditadas(pk, [version], self.usuario, {"titulo": "Prueba"}, self.actor)
        self.assertFalse(VersionDocumento.objects.get(pk=version).publicado)

    def test_fallo_auditoria_revierte_eliminacion_logica(self):
        pk = self.crear()
        with patch.object(services, "_registrar_auditoria_django_pruebas", side_effect=RuntimeError("auditoria")):
            with self.assertRaises(RuntimeError):
                services.eliminar_documento_auditado(pk, "Motivo", self.usuario, {"titulo": "Prueba"}, self.actor)
        self.assertIsNone(Documento.objects.get(pk=pk).fecha_eliminacion)
        self.assertEqual(VersionDocumento.objects.get(documento_id=pk).estado, "BORRADOR")

    def test_servicio_no_publica_sin_lectura_ia(self):
        pk = self.crear()
        version = VersionDocumento.objects.get(documento_id=pk).pk
        with self.assertRaisesMessage(ValueError, "lectura de IA"):
            services.guardar_publicacion_versiones(pk, [version], 1001)
        self.assertFalse(VersionDocumento.objects.get(pk=version).publicado)
        services.actualizar_estado_ia(pk, version, "LEIDO")
        services.guardar_publicacion_versiones(pk, [version], 1001)
        self.assertTrue(VersionDocumento.objects.get(pk=version).publicado)

    def test_publicacion_rechaza_version_ajena(self):
        pk = self.crear()
        with self.assertRaisesMessage(ValueError, "no pertenecen"):
            services.guardar_publicacion_versiones(pk, [99999], 1001)

    def test_servicio_no_elimina_documento_publicado(self):
        pk = self.crear()
        VersionDocumento.objects.filter(documento_id=pk).update(publicado=True)
        with self.assertRaisesMessage(ValueError, "publicación"):
            services.eliminar_documento_logicamente(pk, "Motivo", 1001)
        self.assertIsNone(Documento.objects.get(pk=pk).fecha_eliminacion)

    def test_servicio_no_elimina_version_publicada(self):
        pk = self.crear()
        version = self.agregar(pk)
        VersionDocumento.objects.filter(pk=version).update(publicado=True)
        with self.assertRaisesMessage(ValueError, "publicación"):
            services.eliminar_version_logicamente(pk, version, "Motivo", 1001)
        self.assertEqual(VersionDocumento.objects.get(pk=version).estado, "BORRADOR")

    def test_cambiar_vigencia_no_deja_dos_versiones_vigentes(self):
        pk = self.crear()
        primera = VersionDocumento.objects.get(documento_id=pk).pk
        segunda = self.agregar(pk)
        self.publicar(pk, primera, segunda)
        services.cambiar_estado_version(pk, primera, "VIGENTE")
        self.assertEqual(Documento.objects.get(pk=pk).version_vigente_id, primera)
        self.assertEqual(VersionDocumento.objects.get(pk=segunda).estado, "NO_VIGENTE")
        self.assertEqual(VersionDocumento.objects.filter(documento_id=pk, estado="VIGENTE").count(), 1)

    def test_eliminacion_definitiva_exige_papelera(self):
        pk = self.crear()
        with self.assertRaisesMessage(ValueError, "papelera"):
            services.eliminar_documento_fisico(pk, "Motivo", self.usuario, self.actor)
        self.assertTrue(Documento.objects.filter(pk=pk).exists())

    def test_eliminacion_definitiva_conserva_historial(self):
        pk = self.crear()
        services.eliminar_documento_logicamente(pk, "Motivo", 1001)
        archivos = services.eliminar_documento_fisico(pk, "Definitiva", self.usuario, self.actor)
        self.assertEqual(len(archivos), 1)
        self.assertFalse(Documento.objects.filter(pk=pk).exists())
        self.assertEqual(HistorialEliminacion.objects.get(id_documento=pk).total_versiones, 1)

    def test_fallo_historial_revierte_eliminacion_y_auditoria(self):
        pk = self.crear()
        services.eliminar_documento_logicamente(pk, "Motivo", 1001)
        with patch.object(services, "_registrar_historial_eliminacion", side_effect=RuntimeError("historial")):
            with self.assertRaises(RuntimeError):
                services.eliminar_documento_fisico(pk, "Definitiva", self.usuario, self.actor)
        self.assertTrue(Documento.objects.filter(pk=pk).exists())
        self.assertEqual(VersionDocumento.objects.filter(documento_id=pk).count(), 1)
        self.assertEqual(LogEntry.objects.count(), 1)

    def test_eliminacion_definitiva_versiones_individual_y_multiple(self):
        pk = self.crear()
        primera = VersionDocumento.objects.get(documento_id=pk).pk
        segunda = self.agregar(pk)
        self.agregar(pk)
        services.eliminar_version_logicamente(pk, primera, "Motivo", 1001)
        services.eliminar_version_logicamente(pk, segunda, "Motivo", 1001)
        services.eliminar_version_fisica(pk, primera, "Definitiva", self.usuario, self.actor)
        services.eliminar_versiones_fisicas(pk, [segunda, segunda], "Definitiva", self.usuario, self.actor)
        self.assertEqual(VersionDocumento.objects.filter(documento_id=pk).count(), 1)
        self.assertEqual(HistorialEliminacion.objects.count(), 2)

    def test_creacion_es_borrador_sin_vigente_ni_publicacion(self):
        pk = self.crear()
        version = VersionDocumento.objects.get(documento_id=pk)
        self.assertEqual(version.estado, "BORRADOR")
        self.assertFalse(version.publicado)
        self.assertIsNone(Documento.objects.get(pk=pk).version_vigente_id)

    def test_agregar_borrador_conserva_la_vigente_anterior(self):
        pk = self.crear(publicar=True)
        anterior = Documento.objects.get(pk=pk).version_vigente_id
        nueva = self.agregar(pk)
        self.assertEqual(Documento.objects.get(pk=pk).version_vigente_id, anterior)
        self.assertEqual(VersionDocumento.objects.get(pk=anterior).estado, "VIGENTE")
        self.assertTrue(VersionDocumento.objects.get(pk=anterior).publicado)
        self.assertEqual(VersionDocumento.objects.get(pk=nueva).estado, "BORRADOR")
        self.assertFalse(VersionDocumento.objects.get(pk=nueva).publicado)

    def test_retirar_publicacion_limpia_vigencia_y_conserva_borradores(self):
        pk = self.crear(publicar=True)
        anterior = Documento.objects.get(pk=pk).version_vigente_id
        nueva = self.agregar(pk)
        services.guardar_publicacion_versiones(pk, [], 1001)
        self.assertIsNone(Documento.objects.get(pk=pk).version_vigente_id)
        self.assertEqual(VersionDocumento.objects.get(pk=anterior).estado, "NO_VIGENTE")
        self.assertEqual(VersionDocumento.objects.get(pk=nueva).estado, "BORRADOR")
        self.assertFalse(VersionDocumento.objects.filter(documento_id=pk, publicado=True).exists())

    def test_vigencia_exige_publicacion_y_lectura_positiva(self):
        pk = self.crear()
        version = VersionDocumento.objects.get(documento_id=pk).pk
        with self.assertRaisesMessage(ValueError, "publicada"):
            services.cambiar_estado_version(pk, version, "VIGENTE")
        VersionDocumento.objects.filter(pk=version).update(publicado=True)
        with self.assertRaisesMessage(ValueError, "IA exitoso"):
            services.cambiar_estado_version(pk, version, "VIGENTE")
        self.assertIsNone(Documento.objects.get(pk=pk).version_vigente_id)

    def test_version_publicada_no_puede_volver_a_borrador(self):
        pk = self.crear(publicar=True)
        version = Documento.objects.get(pk=pk).version_vigente_id
        with self.assertRaisesMessage(ValueError, "borrador"):
            services.cambiar_estado_version(pk, version, "BORRADOR")
        self.assertEqual(Documento.objects.get(pk=pk).version_vigente_id, version)

    def test_estados_del_formulario_se_aceptan_desde_servicio(self):
        pk = self.crear()
        version = VersionDocumento.objects.get(documento_id=pk).pk
        for estado in ("NO_VIGENTE", "BORRADOR"):
            services.editar_documento_con_accesos(
                pk, "Prueba", "Descripción", "clave", date(2025, 1, 1), version,
                self.usuario, "Manual", [(2, 10, 2)], estado, True, None, ["Estado"], self.actor,
            )
            self.assertEqual(VersionDocumento.objects.get(pk=version).estado, estado)
            self.assertIsNone(Documento.objects.get(pk=pk).version_vigente_id)

    def test_estado_ia_del_editor_refleja_ultimo_borrador(self):
        from . import selectors
        pk = self.crear(publicar=True)
        nueva = self.agregar(pk)
        services.actualizar_estado_ia(pk, nueva, "ERROR", mensaje="Error del borrador")
        self.assertEqual(selectors.estados_ia_ultimas_versiones([pk])[pk]["estado_ia"], "ERROR")

    def test_restaurar_no_publica_automaticamente(self):
        pk = self.crear()
        services.eliminar_documento_logicamente(pk, "Motivo", 1001)
        services.restaurar_documento_logicamente(pk, 1001)
        version = VersionDocumento.objects.get(documento_id=pk)
        self.assertEqual(version.estado, "NO_VIGENTE")
        self.assertFalse(version.publicado)
        self.assertIsNone(Documento.objects.get(pk=pk).version_vigente_id)
