from django.urls import path

from sga import persona

urlpatterns = [
    path('', persona.view, name='persona'),
]
