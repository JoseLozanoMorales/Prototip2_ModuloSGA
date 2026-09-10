from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from django.utils import timezone

from sga.documentos.models import AccesoLectorModulo, EditorModulo


LECTORES = {
    "jaucatomac": [(None, None, None)],
    "lector_estudiante": [(1, None, None)],
    "lector_docente": [(2, None, None)],
    "lector_mixto": [(1, None, None), (2, None, None)],
}


class Command(BaseCommand):
    help = "Crea lectores de prueba y configura sus audiencias documentales."

    def handle(self, *args, **options):
        if connection.vendor != "postgresql":
            raise CommandError("Este comando requiere PostgreSQL y las migraciones aplicadas.")

        Usuario = get_user_model()
        with transaction.atomic():
            for nombre, audiencias in LECTORES.items():
                usuario, creado = Usuario.objects.get_or_create(
                    username=nombre,
                    defaults={"is_active": True, "is_staff": False, "is_superuser": False},
                )
                if creado:
                    usuario.set_unusable_password()
                    usuario.save(update_fields=["password"])

                EditorModulo.objects.filter(id_usuario_externo=usuario.pk).update(activo=False)
                AccesoLectorModulo.objects.filter(id_usuario_externo=usuario.pk).delete()
                AccesoLectorModulo.objects.bulk_create(
                    [
                        AccesoLectorModulo(
                            id_usuario_externo=usuario.pk,
                            id_perfil_externo=perfil,
                            id_grupo_externo=grupo,
                            id_tipo_periodo_externo=periodo,
                            asignado_por=None,
                            fecha_asignacion=timezone.now(),
                        )
                        for perfil, grupo, periodo in audiencias
                    ]
                )
                estado = "creado" if creado else "actualizado"
                self.stdout.write(f"{nombre}: {estado}, {len(audiencias)} audiencia(s)")

        self.stdout.write(self.style.SUCCESS("Lectores de prueba configurados."))
