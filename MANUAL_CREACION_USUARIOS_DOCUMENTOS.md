# Manual de creación de usuarios del módulo de documentos

Este manual explica cómo crear las cuentas iniciales del módulo de documentos legales en una instalación nueva del proyecto.

## Usuarios requeridos

| Usuario | Correo | Rol esperado |
|---|---|---|
| `jlozano` | `jlozanom@uteq.edu.ec` | EDITOR |
| `jaucatomac` | `jaucatomac@uteq.edu.ec` | LECTOR |

Las contraseñas no deben almacenarse en este documento, en archivos versionados ni en comandos visibles en el historial de la terminal.

## 1. Preparar el proyecto

Abra PowerShell en la carpeta raíz del proyecto:

```powershell
cd C:\ruta\al\DjangoProjectBase
```

Compruebe que Django puede conectarse a la base de datos configurada en `.env`:

```powershell
.\.venv\Scripts\python.exe manage.py check
```

Ejecute las migraciones de Django antes de crear usuarios:

```powershell
.\.venv\Scripts\python.exe manage.py migrate
```

La tabla PostgreSQL `modulo_editores` también debe existir. Si la base documental todavía no fue preparada, aplique el script correspondiente según el procedimiento de instalación del proyecto:

```text
schema_modulo_editores.sql
```

## 2. Crear el usuario EDITOR `jlozano`

Ejecute el comando interactivo:

```powershell
.\.venv\Scripts\python.exe manage.py createsuperuser
```

Ingrese los siguientes datos cuando Django los solicite:

```text
Usuario: jlozano
Correo: jlozanom@uteq.edu.ec
Contraseña: una contraseña segura elegida para esta instalación
```

La contraseña no aparecerá en la pantalla mientras se escribe. Este comportamiento es normal.

### Registrar el usuario en `modulo_editores`

Ser superusuario permite administrar Django, pero la función PostgreSQL del módulo también consulta la tabla `modulo_editores`. Por eso se debe registrar allí a `jlozano`.

Abra el shell de Django:

```powershell
.\.venv\Scripts\python.exe manage.py shell
```

Ejecute estas instrucciones, una por una:

```python
from django.contrib.auth import get_user_model
from django.utils import timezone
from sga.documentos.models import EditorModulo

Usuario = get_user_model()
jlozano = Usuario.objects.get(username="jlozano")

EditorModulo.objects.update_or_create(
    id_usuario_externo=jlozano.pk,
    defaults={
        "nombre_usuario": jlozano.get_username(),
        "activo": True,
        "asignado_por": jlozano.pk,
        "fecha_asignacion": timezone.now(),
    },
)
```

Salga del shell:

```python
exit()
```

Con esto, `jlozano` será reconocido como EDITOR tanto por Django como por PostgreSQL.

## 3. Crear el usuario LECTOR `jaucatomac`

La manera más sencilla es utilizar el administrador de Django.

1. Inicie el servidor:

   ```powershell
   .\.venv\Scripts\python.exe manage.py runserver
   ```

2. Abra `/admin/` en el navegador.
3. Inicie sesión con `jlozano`.
4. Entre en **Usuarios** y seleccione **Añadir usuario**.
5. Use el nombre `jaucatomac` y establezca una contraseña segura.
6. Abra nuevamente el usuario creado y configure el correo `jaucatomac@uteq.edu.ec`.
7. Mantenga activada solamente la opción **Activo**.
8. No active **Es staff** ni **Es superusuario**.
9. Guarde los cambios.

No agregue a `jaucatomac` en `modulo_editores`. La ausencia de una asignación activa en esa tabla hace que el módulo le otorgue el rol LECTOR.

## 4. Verificar la configuración

Abra el shell de Django:

```powershell
.\.venv\Scripts\python.exe manage.py shell
```

Ejecute:

```python
from django.contrib.auth import get_user_model
from sga.documentos.models import EditorModulo

Usuario = get_user_model()
jlozano = Usuario.objects.get(username="jlozano")
jaucatomac = Usuario.objects.get(username="jaucatomac")

print(jlozano.is_active, jlozano.is_staff, jlozano.is_superuser)
print(jaucatomac.is_active, jaucatomac.is_staff, jaucatomac.is_superuser)
print(EditorModulo.objects.filter(id_usuario_externo=jlozano.pk, activo=True).exists())
print(EditorModulo.objects.filter(id_usuario_externo=jaucatomac.pk, activo=True).exists())
```

El resultado esperado es:

```text
True True True
True False False
True
False
```

Interpretación:

- `jlozano` está activo, es staff, es superusuario y posee una asignación activa de editor.
- `jaucatomac` está activo, no es staff, no es superusuario y no posee una asignación de editor.

Salga del shell con `exit()`.

## 5. Probar el inicio de sesión

Abra:

```text
http://127.0.0.1:8000/documentos/login/
```

Pruebe ambas cuentas por separado:

- `jlozano` debe ingresar como **EDITOR** y ver las herramientas de gestión.
- `jaucatomac` debe ingresar como **LECTOR** y ver únicamente la interfaz de consulta y los documentos autorizados.

Utilice el botón **Cambiar usuario** para cerrar la sesión actual y regresar al formulario de acceso.

## 6. Cambiar contraseñas

Para cambiar una contraseña sin escribirla dentro de un comando:

```powershell
.\.venv\Scripts\python.exe manage.py changepassword jlozano
```

Para el lector:

```powershell
.\.venv\Scripts\python.exe manage.py changepassword jaucatomac
```

Django solicitará la contraseña nueva y su confirmación de manera interactiva.

## 7. Consideraciones importantes

- Los usuarios se guardan en la base de datos y no se transfieren al clonar o descargar el repositorio.
- Cada instalación que utilice una base nueva debe crear sus propias cuentas.
- No incluya contraseñas reales en Git, `.env.example`, documentación, capturas o mensajes de commit.
- Realice una copia de seguridad antes de modificar directamente las tablas de autenticación o de roles.
- Un usuario LECTOR se convierte en EDITOR si recibe una asignación activa en `modulo_editores`.
- Desactivar esa asignación devuelve al usuario normal al rol LECTOR, siempre que no sea superusuario.

## 8. Lectores para probar la segmentación

Después de aplicar las migraciones, puede crear la matriz de lectores de prueba con:

```powershell
.\.venv\Scripts\python.exe manage.py configurar_lectores_prueba
```

El comando no almacena contraseñas y configura estas audiencias:

| Usuario | Perfiles | Grupos | Períodos |
|---|---|---|---|
| `jaucatomac` | Todos | Todos | Todos |
| `lector_estudiante` | Estudiante | Todos | Todos |
| `lector_docente` | Docente | Todos | Todos |
| `lector_mixto` | Estudiante y Docente | Todos | Todos |

Las cuentas nuevas se crean con contraseña inutilizable. Asígneles una de forma
interactiva antes de iniciar sesión, por ejemplo:

```powershell
.\.venv\Scripts\python.exe manage.py changepassword lector_estudiante
.\.venv\Scripts\python.exe manage.py changepassword lector_docente
.\.venv\Scripts\python.exe manage.py changepassword lector_mixto
```

Una fila de audiencia puede usar `Todos` en una dimensión sin eliminar las demás
restricciones. Un lector con una fila completamente en `Todos`, como
`jaucatomac`, puede consultar cualquier documento publicado.
