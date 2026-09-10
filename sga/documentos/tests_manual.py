from unittest.mock import patch

from django.contrib.messages.storage.fallback import FallbackStorage
from django.template.loader import render_to_string
from django.test import RequestFactory, SimpleTestCase
from django.urls import resolve, reverse

from . import views


class ManualEditorTests(SimpleTestCase):
    def test_ruta_del_manual(self):
        self.assertEqual(resolve(reverse("documentos:manual")).func, views.manual_editor)

    def test_editor_puede_leer_manual(self):
        request = RequestFactory().get(reverse("documentos:manual"))
        with patch.object(views, "_obtener_usuario_modulo", return_value={"rol_modulo": "EDITOR"}):
            response = views.manual_editor(request)
        self.assertEqual(response.status_code, 200)
        for section in ("conceptos", "crear", "editar", "versiones", "ia", "publicar", "eliminar", "papelera", "consultar"):
            self.assertContains(response, f'id="{section}"')
            self.assertContains(response, f'href="#{section}"')
        self.assertContains(response, "No basta con cambiar la vigencia.")
        self.assertContains(response, "Acciones → Gestionar publicación", count=2)
        self.assertContains(response, "Lectura omitida")
        self.assertContains(response, "hasta 30 palabras clave")
        self.assertContains(response, "máximo de 80 caracteres")
        self.assertContains(response, "hasta 10 MB")
        self.assertContains(response, "al menos 200 caracteres")
        self.assertContains(response, "motivo de al menos cinco caracteres")
        self.assertContains(response, "No distingue mayúsculas ni tildes")
        self.assertContains(response, "pertenecen al documento completo")
        self.assertContains(response, "pertenecen únicamente a la versión seleccionada")

    def test_lector_no_puede_abrir_manual_por_url(self):
        request = RequestFactory().get(reverse("documentos:manual"))
        request.session = {}
        request._messages = FallbackStorage(request)
        with patch.object(views, "_obtener_usuario_modulo", return_value={"rol_modulo": "LECTOR"}):
            response = views.manual_editor(request)
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, reverse("documentos:lista"))

    def test_boton_solo_visible_para_editor(self):
        for role in ("EDITOR", "LECTOR"):
            with self.subTest(role=role):
                html = render_to_string("documentos/documentosV2.html", {"usuario": {"rol_modulo": role}})
                self.assertEqual('href="' + reverse("documentos:manual") + '"' in html, role == "EDITOR")

    def test_busqueda_inmediata_incluye_palabras_clave(self):
        html = render_to_string(
            "documentos/documentosV2.html",
            {
                "usuario": {"rol_modulo": "LECTOR"},
                "documentos": [
                    {
                        "id_documento": 7,
                        "titulo": "Documento",
                        "descripcion": "Descripción",
                        "palabras_clave": "buscable-unica, matrícula",
                        "versiones": [],
                    }
                ],
            },
        )

        self.assertIn("buscable-unica", html)
        self.assertIn('data-search-text="Documento Descripción buscable-unica, matrícula', html)
