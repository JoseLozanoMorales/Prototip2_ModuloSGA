"""Pruebas aisladas: nunca conecta con el PostgreSQL configurado en .env."""

from .settings import *  # noqa: F403

DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}
DOCUMENTOS_SQLITE_TESTS = True
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
