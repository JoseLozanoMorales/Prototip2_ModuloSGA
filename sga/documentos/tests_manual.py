from unittest.mock import patch
from pathlib import Path

from django.conf import settings
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

    def test_formularios_post_sincronizan_el_token_csrf_vigente(self):
        javascript = Path(settings.BASE_DIR, "static", "js", "documentos.js").read_text(
            encoding="utf-8"
        )

        self.assertIn("function syncCsrfToken(form)", javascript)
        self.assertIn("cookieValue('csrftoken')", javascript)
        self.assertIn("document.addEventListener('submit'", javascript)

    def test_editor_recibe_aviso_y_bloqueo_para_documento_publicado(self):
        html = render_to_string(
            "documentos/documentosV2.html",
            {
                "usuario": {"rol_modulo": "EDITOR"},
                "documentos": [
                    {
                        "id_documento": 7,
                        "titulo": "Reglamento",
                        "descripcion": "Descripción",
                        "publicado": True,
                        "estado": "VIGENTE",
                        "id_version_preview": 19,
                        "versiones": [
                            {
                                "id_version": 19,
                                "numero_version": 1,
                                "estado": "VIGENTE",
                                "publicado": True,
                            }
                        ],
                    }
                ],
                "capacidades": {
                    "puede_reemplazar_archivo": True,
                    "puede_cambiar_estado_version": True,
                },
                "perfiles_acceso": [],
                "grupos_acceso": [],
                "tipos_periodo_acceso": [],
                "estados_version": [("VIGENTE", "Vigente")],
            },
        )

        self.assertIn('data-document-published="true"', html)
        self.assertIn('data-publicado="true"', html)
        self.assertIn("Este documento está publicado", html)
        self.assertIn('name="descripcion" data-edit-locked-field', html)
        self.assertIn("data-version-status-select data-published-locked-control", html)

        javascript = Path(settings.BASE_DIR, "static", "js", "documentos.js").read_text(
            encoding="utf-8"
        )
        self.assertIn("documentPublished || versionPublished", javascript)
        self.assertIn("const publishedLocked = documentPublished || versionPublished", javascript)

    def test_estado_error_ofrece_popup_con_el_motivo(self):
        html = render_to_string(
            "documentos/documentosV2.html",
            {
                "usuario": {"rol_modulo": "EDITOR"},
                "documentos": [
                    {
                        "id_documento": 9,
                        "titulo": "Documento con error",
                        "estado_ia": "ERROR",
                        "label_ia": "Error",
                        "clase_ia": "status-error",
                        "mensaje_ia": "El servicio de IA no está disponible.",
                        "id_version_preview": 20,
                        "estado": "BORRADOR",
                        "versiones": [
                            {
                                "id_version": 20,
                                "numero_version": 1,
                                "estado": "BORRADOR",
                                "publicado": False,
                            }
                        ],
                    }
                ],
                "capacidades": {},
                "perfiles_acceso": [],
                "grupos_acceso": [],
                "tipos_periodo_acceso": [],
                "estados_version": [],
            },
        )

        self.assertIn("data-ia-error-trigger", html)
        self.assertIn('data-ia-state="ERROR"', html)
        self.assertIn("El servicio de IA no está disponible.", html)
        self.assertIn("Motivo del fallo de IA", html)

        javascript = Path(settings.BASE_DIR, "static", "js", "documentos.js").read_text(
            encoding="utf-8"
        )
        self.assertIn("function openIaErrorModal(trigger)", javascript)
        self.assertIn("badge.dataset.iaMessage", javascript)
