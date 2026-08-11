from django.urls import path

from . import views

app_name = "documentos"

urlpatterns = [
    path("", views.lista_documentos, name="lista"),
    path("analisis-ia/estado/", views.estado_analisis_ia_documentos, name="estado_analisis_ia"),
    path(
        "<int:id_documento>/analisis-ia/reintentar/",
        views.reintentar_analisis_ia_documento,
        name="reintentar_analisis_ia",
    ),
    path("visor/<int:id_documento>/", views.visor_pdf, name="visor"),
    path("visor/<int:id_documento>/pdf/<int:id_version>/", views.servir_pdf, name="pdf"),
    path("papelera/", views.papelera_documentos, name="papelera"),
    path("<int:id_documento>/restaurar/", views.restaurar_documento, name="restaurar"),
    path(
        "<int:id_documento>/eliminar-definitivamente/",
        views.eliminar_documento_definitivamente,
        name="eliminar_definitivamente",
    ),
    path(
        "<int:id_documento>/versiones/<int:id_version>/restaurar/",
        views.restaurar_version_documento,
        name="restaurar_version",
    ),
    path("crear/", views.crear_documento, name="crear"),
    path("<int:id_documento>/editar/", views.editar_documento, name="editar"),
    path("<int:id_documento>/publicar/", views.publicar_versiones_documento, name="publicar"),
    path("<int:id_documento>/versiones/agregar/", views.agregar_version_documento, name="agregar_version"),
    path("<int:id_documento>/eliminar/", views.eliminar_documento, name="eliminar"),
]
