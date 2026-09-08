from urllib.parse import urlencode

from django.shortcuts import redirect
from django.urls import reverse


class DocumentosLoginRequiredMiddleware:
    """Exige una sesión Django para cualquier recurso del módulo documental."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        login_url = reverse("documentos:login")
        rutas_publicas = {login_url}
        if (
            request.path.startswith(reverse("documentos:lista"))
            and request.path not in rutas_publicas
            and not request.user.is_authenticated
        ):
            return redirect(f"{login_url}?{urlencode({'next': request.get_full_path()})}")
        return self.get_response(request)
