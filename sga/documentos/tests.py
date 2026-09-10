from datetime import date, timedelta
from types import SimpleNamespace
from unittest.mock import Mock, patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.contrib.auth import get_user_model
from django.db import DatabaseError
from django.http import QueryDict
from django.test import RequestFactory, SimpleTestCase, TestCase
from django.test import override_settings
from django.urls import reverse

from . import repositories, views
from .forms import CrearDocumentoForm, EditarDocumentoForm


class AutorizacionModuloTests(SimpleTestCase):
    def test_superusuario_django_es_editor(self):
        request = RequestFactory().get("/documentos/")
        request.user = SimpleNamespace(
            pk=7,
            is_authenticated=True,
            is_superuser=True,
            get_username=lambda: "jlozano",
        )

        usuario = views._obtener_usuario_modulo(request)

        self.assertEqual(usuario["id_usuario_externo"], 7)
        self.assertEqual(usuario["nombre_usuario"], "jlozano")
        self.assertEqual(usuario["rol_modulo"], "EDITOR")

    def test_usuario_normal_conserva_asignacion_de_modulo_editores(self):
        request = RequestFactory().get("/documentos/")
        request.user = SimpleNamespace(
            pk=8,
            is_authenticated=True,
            is_superuser=False,
            get_username=lambda: "editor_asignado",
        )
        with patch.object(views.EditorModulo.objects, "filter") as filtrar:
            filtrar.return_value.exists.return_value = True
            usuario = views._obtener_usuario_modulo(request)

        filtrar.assert_called_once_with(id_usuario_externo=8, activo=True)
        self.assertEqual(usuario["rol_modulo"], "EDITOR")


class SesionDocumentosTests(TestCase):
    def setUp(self):
        usuarios = get_user_model()
        self.editor = usuarios.objects.create_superuser("editor", password="Clave-Segura-123")
        self.lector = usuarios.objects.create_user("lector", password="Clave-Segura-456")

    def test_usuario_anonimo_es_redirigido_al_login(self):
        respuesta = self.client.get(reverse("documentos:lista"))

        self.assertRedirects(
            respuesta,
            f'{reverse("documentos:login")}?next={reverse("documentos:lista")}',
            fetch_redirect_response=False,
        )

    def test_editor_puede_iniciar_sesion(self):
        respuesta = self.client.post(
            reverse("documentos:login"),
            {"username": "editor", "password": "Clave-Segura-123"},
        )

        self.assertRedirects(respuesta, reverse("documentos:lista"), fetch_redirect_response=False)
        self.assertEqual(int(self.client.session["_auth_user_id"]), self.editor.pk)

    def test_lector_puede_iniciar_sesion(self):
        respuesta = self.client.post(
            reverse("documentos:login"),
            {"username": "lector", "password": "Clave-Segura-456"},
        )

        self.assertRedirects(respuesta, reverse("documentos:lista"), fetch_redirect_response=False)
        self.assertEqual(int(self.client.session["_auth_user_id"]), self.lector.pk)

    def test_cerrar_sesion_regresa_al_login(self):
        self.client.force_login(self.lector)

        respuesta = self.client.post(reverse("documentos:logout"))

        self.assertRedirects(respuesta, reverse("documentos:login"), fetch_redirect_response=False)
        self.assertNotIn("_auth_user_id", self.client.session)

class ListaDocumentosErroresTests(SimpleTestCase):
    def test_un_error_de_base_no_renderiza_documentos_a_medio_preparar(self):
        request = RequestFactory().get("/documentos/")
        usuario = {
            "id_usuario_externo": 1001,
            "id_perfil_externo": 2,
            "id_grupo_externo": 10,
            "id_tipo_periodo_externo": 2,
            "nombre_usuario": "Editor",
            "rol_modulo": "EDITOR",
        }
        catalogos = {"perfiles": [], "grupos": [], "tipos_periodo": []}
        documento_incompleto = {"id_documento": 29, "titulo": "Documento"}

        with (
            patch.object(views, "_obtener_usuario_modulo", return_value=usuario),
            patch.object(views, "_obtener_sessionid_chat", return_value="sesion"),
            patch.object(views, "_catalogos_acceso", return_value=catalogos),
            patch.object(views, "_capacidades_base", return_value={}),
            patch.object(
                views,
                "_listar_documentos_modulo",
                return_value=[documento_incompleto],
            ),
            patch.object(
                views,
                "_adjuntar_publicacion_documentos",
                side_effect=DatabaseError("Falta una columna"),
            ),
        ):
            respuesta = views.lista_documentos(request)

        self.assertEqual(respuesta.status_code, 200)
        self.assertContains(respuesta, "Falta una columna")
        self.assertNotContains(respuesta, "modal-editar-29")


@override_settings(IA_DOCUMENTOS_PORCENTAJE_TEXTO_MINIMO=80)
class ValidacionPorcentajeTextoTests(SimpleTestCase):
    def test_acepta_porcentaje_bajo_si_la_ia_extrajo_texto_suficiente(self):
        respuesta = {
            "porcentaje_texto": 35,
            "texto_extraido": "contenido " * 25,
        }

        self.assertEqual(views._validar_porcentaje_texto_ia(respuesta), 35)

    def test_rechaza_porcentaje_bajo_si_el_texto_extraido_es_insuficiente(self):
        respuesta = {
            "porcentaje_texto": 35,
            "texto_extraido": "contenido corto",
        }

        with self.assertRaisesMessage(ValueError, "bajo porcentaje de texto"):
            views._validar_porcentaje_texto_ia(respuesta)

    def test_acepta_porcentaje_que_supera_el_umbral(self):
        respuesta = {"porcentaje_texto": 80, "texto_extraido": ""}

        self.assertEqual(views._validar_porcentaje_texto_ia(respuesta), 80)


class VisorPdfLecturasTests(SimpleTestCase):
    def setUp(self):
        self.request = RequestFactory().get("/documentos/visor/7/")
        self.documento = {"id_documento": 7, "titulo": "Manual"}
        self.versiones = [{"id_version": 19, "numero_version": 1}]

    def _abrir_visor(self, rol):
        usuario = {
            "id_usuario_externo": 1001,
            "nombre_usuario": "Usuario simulado",
            "rol_modulo": rol,
        }
        with (
            patch.object(views, "_obtener_usuario_modulo", return_value=usuario),
            patch.object(views, "_obtener_documento_visible", return_value=self.documento),
            patch.object(views, "_obtener_versiones_visibles", return_value=self.versiones),
            patch.object(views, "_seleccionar_version", return_value=self.versiones[0]),
            patch.object(views, "render", return_value=Mock(status_code=200)),
            patch.object(views.services, "registrar_lectura_documento") as registrar,
        ):
            respuesta = views.visor_pdf(self.request, 7)
        return respuesta, usuario, registrar

    def test_lector_registra_una_lectura_de_la_version_mostrada(self):
        respuesta, usuario, registrar = self._abrir_visor("LECTOR")

        self.assertEqual(respuesta.status_code, 200)
        registrar.assert_called_once_with(7, 19, usuario)

    def test_editor_no_registra_lectura(self):
        respuesta, _, registrar = self._abrir_visor("EDITOR")

        self.assertEqual(respuesta.status_code, 200)
        registrar.assert_not_called()


class TipoDocumentoFormularioTests(SimpleTestCase):
    def test_creacion_usa_tipo_predeterminado_con_selector_deshabilitado(self):
        self.assertEqual(
            views._tipo_documento_formulario("Reglamento"),
            "Documento legal",
        )

    def test_edicion_conserva_tipo_actual_con_selector_deshabilitado(self):
        self.assertEqual(
            views._tipo_documento_formulario("Manual", "Reglamento"),
            "Reglamento",
        )

    @patch.object(views, "SELECTOR_TIPO_DOCUMENTO_HABILITADO", True)
    def test_selector_puede_reactivarse_y_valida_el_tipo_enviado(self):
        self.assertEqual(views._tipo_documento_formulario("Documento legal"), "Documento legal")
        self.assertEqual(
            views._tipo_documento_formulario("Reglamento"),
            "Reglamento",
        )
        with self.assertRaisesMessage(ValueError, "El tipo de documento no es válido."):
            views._tipo_documento_formulario("Desconocido")


class DocumentoFormsTests(SimpleTestCase):
    def datos_base(self):
        return {
            "titulo": "Reglamento académico",
            "descripcion": "Descripción",
            "palabras_clave": "reglamento, estudiantes",
            "fecha_aprobacion": "2025-01-01",
        }

    def test_creacion_exige_archivo(self):
        formulario = CrearDocumentoForm(self.datos_base())

        self.assertFalse(formulario.is_valid())
        self.assertEqual(
            formulario.errors["archivo"],
            ["Debe seleccionar un archivo PDF."],
        )

    def test_edicion_conserva_tipo_actual_si_el_selector_esta_oculto(self):
        datos = {
            **self.datos_base(),
            "tipo": "Reglamento",
            "id_version_vigente": "12",
            "estado_version": "BORRADOR",
        }
        formulario = EditarDocumentoForm(
            datos,
            tipo_actual="Manual",
            selector_tipo_habilitado=False,
        )

        self.assertTrue(formulario.is_valid(), formulario.errors)
        self.assertEqual(formulario.cleaned_data["tipo"], "Manual")
        self.assertEqual(formulario.cleaned_data["id_version_vigente"], 12)

    def test_rechaza_fecha_de_aprobacion_futura(self):
        datos = self.datos_base()
        datos["fecha_aprobacion"] = (date.today() + timedelta(days=1)).isoformat()
        archivo = SimpleUploadedFile("documento.pdf", b"contenido", "application/pdf")
        formulario = CrearDocumentoForm(datos, {"archivo": archivo})

        self.assertFalse(formulario.is_valid())
        self.assertIn("fecha_aprobacion", formulario.errors)

    def test_palabras_clave_se_normalizan_y_eliminan_duplicados(self):
        datos = self.datos_base()
        datos["palabras_clave"] = (
            " reglamento,  estudiantes ; Reglamento\nmatrícula "
        )
        archivo = SimpleUploadedFile("documento.pdf", b"contenido", "application/pdf")
        formulario = CrearDocumentoForm(datos, {"archivo": archivo})

        self.assertTrue(formulario.is_valid(), formulario.errors)
        self.assertEqual(
            formulario.cleaned_data["palabras_clave"],
            "reglamento, estudiantes, matrícula",
        )

    def test_palabra_clave_demasiado_extensa_se_rechaza(self):
        datos = self.datos_base()
        datos["palabras_clave"] = "x" * 81
        archivo = SimpleUploadedFile("documento.pdf", b"contenido", "application/pdf")
        formulario = CrearDocumentoForm(datos, {"archivo": archivo})

        self.assertFalse(formulario.is_valid())
        self.assertIn("palabras_clave", formulario.errors)

    @patch("sga.documentos.views._obtener_fecha_aprobacion_version")
    def test_edicion_recupera_fecha_persistida_si_el_navegador_no_la_envia(
        self, obtener_fecha
    ):
        obtener_fecha.return_value = date(2025, 1, 1)
        datos = QueryDict("id_version_vigente=12&fecha_aprobacion=")

        resultado = views._completar_fecha_aprobacion_edicion(datos, 7)

        self.assertEqual(resultado["fecha_aprobacion"], "2025-01-01")
        obtener_fecha.assert_called_once_with(7, "12")


class BusquedaDocumentosTests(SimpleTestCase):
    def test_normaliza_tildes_mayusculas_y_espacios(self):
        self.assertEqual(
            repositories._terminos_busqueda("  ARTÍCULO   matrícula artículo "),
            ["articulo", "matricula"],
        )

    @patch("sga.documentos.repositories.consultar_filas", return_value=[])
    def test_aplica_cada_termino_sin_filtrado_estricto_de_la_funcion(self, consultar):
        usuario = {
            "id_usuario_externo": 1,
            "id_perfil_externo": 2,
            "id_grupo_externo": 3,
            "id_tipo_periodo_externo": 4,
        }

        repositories.listar_documentos_modulo(usuario, "Artículo académico", None)

        sql, parametros = consultar.call_args.args
        self.assertEqual(parametros[4], "")
        self.assertEqual(parametros[-2:], ["%articulo%", "%academico%"])
        self.assertEqual(sql.count(" LIKE %s "), 2)
