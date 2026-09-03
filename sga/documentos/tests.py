from unittest.mock import Mock, patch

from django.test import RequestFactory, SimpleTestCase
from django.test import override_settings

from . import views


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
