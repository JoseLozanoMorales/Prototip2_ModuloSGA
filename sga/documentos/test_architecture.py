import ast
import builtins
import inspect
import symtable
from contextlib import ExitStack
from datetime import date, datetime
from unittest.mock import Mock, patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import RequestFactory, SimpleTestCase

from . import access, audit, integrations, services, storage, views


class SeparacionCapasTests(SimpleTestCase):
    def test_nombre_de_archivo_es_legible_unico_y_conserva_extension(self):
        momento = datetime(2026, 9, 9, 14, 3, 5)
        with patch.object(storage, "uuid4") as uuid:
            uuid.return_value.hex = "a1b2c3d4e5f67890"
            nombre = storage.generar_nombre_archivo(
                "documento", "Nombre MUY largo de usuario.PDF", momento
            )

        self.assertEqual(nombre, "documento_20260909_140305_a1b2c3d4.pdf")

    def test_validacion_de_archivos_centraliza_formato_mime_contenido_y_tamano(self):
        pdf = SimpleUploadedFile(
            "documento.PDF", b"%PDF-1.7\ncontenido", "application/pdf"
        )
        self.assertEqual(storage._validar_archivo_subido(pdf), b"%PDF-1.7\ncontenido")

        casos_invalidos = (
            (
                SimpleUploadedFile("imagen.jpg", b"imagen", "image/jpeg"),
                "extensión",
            ),
            (
                SimpleUploadedFile("documento.pdf", b"%PDF-1.7", "image/jpeg"),
                "tipo de contenido",
            ),
            (
                SimpleUploadedFile("documento.pdf", b"no es pdf", "application/pdf"),
                "PDF válido",
            ),
            (
                SimpleUploadedFile(
                    "documento.pdf",
                    b"%PDF-" + b"x" * storage.TAMANO_MAXIMO_ARCHIVO,
                    "application/pdf",
                ),
                "10 MB",
            ),
        )
        for archivo, mensaje in casos_invalidos:
            with self.subTest(nombre=archivo.name), self.assertRaisesMessage(ValueError, mensaje):
                storage._validar_archivo_subido(archivo)

    def test_borrador_se_analiza_sin_reemplazar_la_vigente_en_chroma(self):
        for estado in ("BORRADOR", "VIGENTE"):
            with self.subTest(estado=estado), ExitStack() as stack:
                stack.enter_context(patch.object(integrations, "close_old_connections"))
                analizar = stack.enter_context(patch.object(integrations, "_llamar_ia_documentos", return_value={}))
                stack.enter_context(patch.object(integrations, "_validar_porcentaje_texto_ia", return_value=100))
                actualizar = stack.enter_context(patch.object(integrations, "_actualizar_estado_ia_version"))
                guardar_resultado = stack.enter_context(patch.object(services, "guardar_resultado_ia"))
                quitar = stack.enter_context(patch.object(integrations, "_notificar_version_anterior_no_vigente"))
                chroma = stack.enter_context(patch.object(integrations, "_guardar_documento_chroma"))
                integrations._procesar_ia_documento_segundo_plano(
                    1, "Prueba", {}, {"id_version": 2, "estado": estado}, {},
                    contexto_version_anterior={"id_version": 1},
                )
                analizar.assert_called_once()
                guardar_resultado.assert_called_once_with(1, 2, {})
                self.assertEqual(actualizar.call_args.args[2], "LEIDO")
                self.assertEqual(chroma.call_count, int(estado == "VIGENTE"))
                self.assertEqual(quitar.call_count, int(estado == "VIGENTE"))

    def test_contexto_borrador_no_identifica_version_a_reemplazar(self):
        contexto = views._construir_contexto_reemplazo_version(
            {"id_version": 2, "estado": "BORRADOR"},
            {"id_version": 1, "uuid_version": "anterior"},
        )
        self.assertIsNone(contexto["id_version_anterior"])
        self.assertEqual(contexto["uuid_version_anterior"], "")

    def test_limpieza_deduplica_y_reporta_fallos_sin_abortar(self):
        versiones = [{"archivo_path": "documentos/a.pdf"}, {"archivo_path": "documentos/a.pdf"}, {"archivo_path": "documentos/b.pdf"}]
        with patch.object(storage, "_eliminar_archivo_version_fisico", side_effect=[OSError("sin acceso"), None]) as borrar:
            self.assertEqual(storage.eliminar_archivos_versiones(versiones), ["documentos/a.pdf"])
            self.assertEqual(borrar.call_count, 2)

    def test_vistas_sin_escrituras_orm_ni_transporte_externo(self):
        tree = ast.parse(inspect.getsource(views))
        escrituras = {"save", "delete", "create", "update", "bulk_create", "bulk_update", "get_or_create"}
        for node in ast.walk(tree):
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
                if node.func.attr in escrituras:
                    self.assertNotIn(".objects", ast.unparse(node.func))
                self.assertNotIn("default_storage", ast.unparse(node.func))
                self.assertNotIn("threading.Thread", ast.unparse(node.func))
                self.assertNotIn("urllib.request", ast.unparse(node.func))

    def test_modulos_movidos_no_tienen_referencias_globales_sin_importar(self):
        def revisar(tabla, globales):
            for child in tabla.get_children():
                for symbol in child.get_symbols():
                    if symbol.is_referenced() and symbol.is_global():
                        self.assertIn(symbol.get_name(), globales, child.get_name())
                revisar(child, globales)

        for module in (views, services, integrations, access, audit, storage):
            tabla = symtable.symtable(inspect.getsource(module), module.__name__, "exec")
            revisar(tabla, set(module.__dict__) | set(dir(builtins)))

    def test_ia_se_inicia_solo_despues_del_commit(self):
        with patch.object(integrations, "_actualizar_estado_ia_version"), \
                patch.object(integrations.threading, "Thread") as thread, \
                patch.object(integrations.transaction, "on_commit") as on_commit:
            integrations._iniciar_analisis_ia_segundo_plano(1, "Titulo", {}, {"id_version": 2}, {})
            thread.return_value.start.assert_not_called()
            on_commit.call_args.args[0]()
            thread.return_value.start.assert_called_once()

    def test_publicacion_reutiliza_resultado_sin_reanalizar(self):
        resultado = {"texto_extraido": "contenido analizado", "porcentaje_texto": 100}
        with patch.object(integrations, "close_old_connections"), \
                patch.object(integrations, "_notificar_version_anterior_no_vigente"), \
                patch.object(integrations, "_llamar_ia_documentos") as analizar, \
                patch.object(integrations, "_guardar_documento_chroma") as chroma, \
                patch.object(integrations.threading, "Thread") as thread, \
                patch.object(integrations.transaction, "on_commit") as on_commit:
            integrations._iniciar_sincronizacion_publicacion_segundo_plano(
                1, "Titulo", {},
                {"id_version": 2, "estado_ia": "LEIDO", "resultado_ia": resultado},
                {},
            )
            on_commit.call_args.args[0]()
            thread.call_args.kwargs["target"]()
            analizar.assert_not_called()
            self.assertIs(chroma.call_args.args[3], resultado)

    def test_publicacion_omitida_no_contacta_ia_ni_chroma(self):
        with patch.object(integrations, "close_old_connections"), \
                patch.object(integrations, "_notificar_version_anterior_no_vigente"), \
                patch.object(integrations, "_llamar_ia_documentos") as analizar, \
                patch.object(integrations, "_guardar_documento_chroma") as chroma, \
                patch.object(integrations.threading, "Thread") as thread, \
                patch.object(integrations.transaction, "on_commit") as on_commit:
            integrations._iniciar_sincronizacion_publicacion_segundo_plano(
                1, "Titulo", {},
                {"id_version": 2, "estado_ia": "OMITIDO", "resultado_ia": None},
                {},
            )
            on_commit.call_args.args[0]()
            thread.call_args.kwargs["target"]()
            analizar.assert_not_called()
            chroma.assert_not_called()


class FallosPosterioresAlGuardadoTests(SimpleTestCase):
    def test_edicion_acepta_estados_ofrecidos_por_el_formulario(self):
        for estado in ("BORRADOR", "NO_VIGENTE"):
            with self.subTest(estado=estado):
                self.comprobar(views.editar_documento, "editar_documento_con_accesos", False, estado)

    def test_crear_editar_y_agregar_no_borran_pdf_si_falla_paso_posterior(self):
        for vista, servicio in (
            (views.crear_documento, "crear_documento_con_accesos"),
            (views.editar_documento, "editar_documento_con_accesos"),
            (views.agregar_version_documento, "agregar_version_auditada"),
        ):
            for falla_persistencia in (False, True):
                with self.subTest(vista=vista.__name__, falla_persistencia=falla_persistencia):
                    self.comprobar(vista, servicio, falla_persistencia)

    def comprobar(self, vista, servicio, falla_persistencia, estado="VIGENTE"):
        request = RequestFactory().post("/", {
            "titulo": "Editado", "id_version_vigente": "2", "estado_version": estado,
            "fecha_aprobacion": "2025-01-01",
            "procesar_ia": "1",
            "archivo": SimpleUploadedFile("prueba.pdf", b"pdf", "application/pdf"),
        })
        request.user = Mock()
        usuario = {"id_usuario_externo": 1001, "nombre_usuario": "Editor"}
        documento = {"titulo": "Anterior", "tipo": "Manual", "id_version_vigente": 2}
        archivo = {"archivo_path": "documentos/prueba.pdf"}
        with ExitStack() as stack:
            guardar = stack.enter_context(patch.object(services, servicio, return_value=1))
            if falla_persistencia:
                guardar.side_effect = RuntimeError("fallo persistencia")
            mocks = {
                "_requerir_editor": usuario,
                "_fecha_formulario": date(2025, 1, 1),
                "_validar_pdf_texto_minimo": None,
                "_validar_titulo_unico": None,
                "_combinaciones_acceso": [(2, 10, 2)],
                "_contexto_accesos_formulario": {},
                "_contexto_accesos_documento": {},
                "_guardar_pdf_django": archivo,
                "_obtener_documento_para_edicion": documento,
                "_obtener_versiones": [{"id_version": 2, "estado": "VIGENTE"}],
                "_columna_existe": True,
                "_edicion_mantiene_metadata_actual": False,
            }
            for nombre, resultado in mocks.items():
                stack.enter_context(patch.object(views, nombre, return_value=resultado))

            def contexto(*args, **kwargs):
                if guardar.called:
                    raise RuntimeError("fallo posterior")
                return {"id_version": 2, "uuid_version": "anterior"}

            stack.enter_context(patch.object(views, "_obtener_contexto_version_chroma", side_effect=contexto))
            limpiar = stack.enter_context(patch.object(storage, "descartar_pdf_subido"))
            mensajes = stack.enter_context(patch.object(views, "messages"))
            response = vista(request) if vista is views.crear_documento else vista(request, 1)
            self.assertEqual(response.status_code, 302)
            guardar.assert_called_once()
            if falla_persistencia:
                limpiar.assert_called_once_with(archivo)
                mensajes.error.assert_called_once()
            else:
                limpiar.assert_not_called()
                mensajes.warning.assert_called_once()
