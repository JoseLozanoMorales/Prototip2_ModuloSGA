"""Corrige documentos visibles que conservaron una baja lógica inconsistente."""

from django.core.management.base import BaseCommand
from django.db import connection, transaction


class Command(BaseCommand):
    help = (
        "Restaura la visibilidad de documentos con alguna versión activa, "
        "pero que aún tienen fecha_eliminacion."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Muestra cuántos documentos se corregirían sin modificarlos.",
        )

    def handle(self, *args, **options):
        consulta = """
            SELECT d.id_documento
            FROM docs d
            WHERE d.fecha_eliminacion IS NOT NULL
              AND EXISTS (
                  SELECT 1
                  FROM doc_versions v
                  WHERE v.id_documento = d.id_documento
                    AND COALESCE(v.estado, 'INACTIVO') <> 'ELIMINADO'
              )
            ORDER BY d.id_documento;
        """
        with connection.cursor() as cursor:
            cursor.execute(consulta)
            ids_documentos = [fila[0] for fila in cursor.fetchall()]

        if options["dry_run"]:
            self.stdout.write(f"Documentos que se corregirían: {len(ids_documentos)}.")
            return

        if not ids_documentos:
            self.stdout.write(self.style.SUCCESS("No hay documentos por corregir."))
            return

        with transaction.atomic(), connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE docs
                SET fecha_eliminacion = NULL,
                    motivo_eliminacion = NULL
                WHERE id_documento = ANY(%s);
                """,
                [ids_documentos],
            )

        self.stdout.write(
            self.style.SUCCESS(f"Documentos corregidos: {len(ids_documentos)}.")
        )
