from django.urls import path

from . import views

app_name = "documentos"

urlpatterns = [
    path("login/", views.iniciar_sesion, name="login"),
    path("logout/", views.cerrar_sesion, name="logout"),
    path("", views.lista_documentos, name="lista"),
    path("manual/", views.manual_editor, name="manual"),
    path("analisis-ia/estado/", views.estado_analisis_ia_documentos, name="estado_analisis_ia"),
    path(
        "<int:id_documento>/analisis-ia/reintentar/",
        views.reintentar_analisis_ia_documento,
        name="reintentar_analisis_ia",
    ),
    path(
        "<int:id_documento>/analisis-ia/omitir/",
        views.omitir_analisis_ia_documento,
        name="omitir_analisis_ia",
    ),
    path("visor/<int:id_documento>/", views.visor_pdf, name="visor"),
    path("visor/<int:id_documento>/pdf/<int:id_version>/", views.servir_pdf, name="pdf"),
    path("papelera/", views.papelera_documentos, name="papelera"),
    path(
        "papelera/<int:id_documento>/versiones/<int:id_version>/ver/",
        views.servir_pdf_version_papelera,
        name="pdf_version_papelera",
    ),
    path("<int:id_documento>/restaurar/", views.restaurar_documento, name="restaurar"),
    path(
        "<int:id_documento>/eliminar-definitivamente/",
        views.eliminar_documento_definitivamente,
        name="eliminar_definitivamente",
    ),
    path(
        "<int:id_documento>/versiones/<int:id_version>/eliminar-definitivamente/",
        views.eliminar_version_definitivamente,
        name="eliminar_version_definitivamente",
    ),
    path(
        "<int:id_documento>/versiones/eliminar-definitivamente/",
        views.eliminar_versiones_definitivamente,
        name="eliminar_versiones_definitivamente",
    ),
    path(
        "<int:id_documento>/versiones/<int:id_version>/restaurar/",
        views.restaurar_version_documento,
        name="restaurar_version",
    ),
    path(
        "<int:id_documento>/versiones/restaurar/",
        views.restaurar_versiones_documento,
        name="restaurar_versiones",
    ),
    path("crear/", views.crear_documento, name="crear"),
    path("<int:id_documento>/editar/", views.editar_documento, name="editar"),
    path("<int:id_documento>/publicar/", views.publicar_versiones_documento, name="publicar"),
    path("<int:id_documento>/versiones/agregar/", views.agregar_version_documento, name="agregar_version"),
    path("<int:id_documento>/eliminar/", views.eliminar_documento, name="eliminar"),
]
