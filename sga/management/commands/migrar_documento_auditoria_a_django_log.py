"""Migra la bitácora documental heredada a la bitácora estándar de Django."""

import json

from django.contrib.admin.models import ADDITION, CHANGE, DELETION, LogEntry
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction


MARCADOR_ORIGEN = "[MIGRADO_DOCUMENTO_AUDITORIA:{id_auditoria}]"
USUARIO_TECNICO = "auditoria_documentos_pruebas"


class Command(BaseCommand):
    help = (
        "Copia documento_auditoria a django_admin_log sin duplicar registros. "
        "No elimina la tabla ni su información de origen."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Muestra cuántos registros se migrarían, sin escribir en django_admin_log.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            help="Procesa como máximo esta cantidad de registros pendientes.",
        )

    def handle(self, *args, **options):
        if "documento_auditoria" not in connection.introspection.table_names():
            raise CommandError("La tabla documento_auditoria no existe en esta base de datos.")

        registros = self._obtener_registros(options.get("limit"))
        pendientes = [registro for registro in registros if not self._ya_migrado(registro["id_auditoria"])]

        if options["dry_run"]:
            self.stdout.write(
                f"Registros encontrados: {len(registros)}. Pendientes de migrar: {len(pendientes)}."
            )
            return

        if not pendientes:
            self.stdout.write(self.style.SUCCESS("No hay registros pendientes por migrar."))
            return

        tipo_contenido, _ = ContentType.objects.get_or_create(
            app_label="documentos", model="documento"
        )
        migrados = 0
        with transaction.atomic():
            for registro in pendientes:
                LogEntry.objects.create(
                    user_id=self._resolver_usuario(registro).pk,
                    content_type=tipo_contenido,
                    object_id=str(registro["id_documento"] or ""),
                    object_repr=str(registro.get("titulo_documento") or registro["id_documento"] or "Documento")[:200],
                    action_flag=self._accion_django(registro["accion"]),
                    action_time=registro["fecha_hora"],
                    change_message=self._mensaje_django(registro),
                )
                migrados += 1

        self.stdout.write(self.style.SUCCESS(f"Registros migrados a django_admin_log: {migrados}."))

    @staticmethod
    def _obtener_registros(limit):
        consulta = """
            SELECT da.id_auditoria, da.id_documento, da.id_version,
                   da.id_usuario_externo, da.nombre_usuario, da.accion,
                   da.mensaje, da.datos_anteriores, da.datos_nuevos,
                   da.fecha_hora, d.titulo AS titulo_documento
            FROM documento_auditoria da
            LEFT JOIN docs d ON d.id_documento = da.id_documento
            ORDER BY da.id_auditoria
        """
        parametros = []
        if limit is not None:
            if limit <= 0:
                raise CommandError("--limit debe ser mayor que cero.")
            consulta += " LIMIT %s"
            parametros.append(limit)

        with connection.cursor() as cursor:
            cursor.execute(consulta, parametros)
            columnas = [columna[0] for columna in cursor.description]
            return [dict(zip(columnas, fila)) for fila in cursor.fetchall()]

    @staticmethod
    def _ya_migrado(id_auditoria):
        return LogEntry.objects.filter(
            change_message__startswith=MARCADOR_ORIGEN.format(id_auditoria=id_auditoria)
        ).exists()

    @staticmethod
    def _accion_django(accion):
        accion = str(accion or "").upper()
        if "ELIMIN" in accion:
            return DELETION
        if any(texto in accion for texto in ("CREA", "INSERT", "REGISTR")):
            return ADDITION
        return CHANGE

    @staticmethod
    def _resolver_usuario(registro):
        modelo_usuario = get_user_model()
        usuario_externo = registro.get("id_usuario_externo")
        if usuario_externo:
            usuario = modelo_usuario.objects.filter(pk=usuario_externo).first()
            if usuario:
                return usuario

        nombre_usuario = str(registro.get("nombre_usuario") or "").strip()
        campo_usuario = modelo_usuario.USERNAME_FIELD
        if nombre_usuario:
            usuario = modelo_usuario.objects.filter(**{campo_usuario: nombre_usuario}).first()
            if usuario:
                return usuario

        # LogEntry exige un usuario Django. El nombre original se conserva en
        # change_message cuando no existe una equivalencia en auth_user.
        usuario, _ = modelo_usuario.objects.get_or_create(**{campo_usuario: USUARIO_TECNICO})
        return usuario

    @staticmethod
    def _mensaje_django(registro):
        datos = {
            "origen": "documento_auditoria",
            "id_auditoria_origen": registro["id_auditoria"],
            "accion": registro["accion"],
            "id_documento": registro["id_documento"],
            "id_version": registro["id_version"],
            "id_usuario_externo": registro["id_usuario_externo"],
            "nombre_usuario": registro["nombre_usuario"],
            "mensaje_original": registro["mensaje"],
            "datos_anteriores": registro["datos_anteriores"],
            "datos_nuevos": registro["datos_nuevos"],
        }
        marcador = MARCADOR_ORIGEN.format(id_auditoria=registro["id_auditoria"])
        return f"{marcador} {json.dumps(datos, ensure_ascii=False, default=str)}"
