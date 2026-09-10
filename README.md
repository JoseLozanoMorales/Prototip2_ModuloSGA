# DjangoProjectBase — módulo de documentos legales

Este repositorio contiene una aplicación Django 5.2 con el módulo de gestión de documentos legales montado en `/documentos/`. Utiliza PostgreSQL, guarda los PDF nuevos bajo `media/documentos/` y puede integrarse con servicios externos de análisis de documentos y Chroma.

## Requisitos

- Python 3.10 a 3.13. El entorno verificado actualmente usa Python 3.13.
- PostgreSQL 14 o posterior.
- Git.
- Acceso de lectura y escritura a la carpeta configurada como `MEDIA_ROOT`.
- Opcional: acceso al directorio de PDF heredados indicado por `FLASK_PDF_DIR`.
- Opcional: servicios HTTP de IA y Chroma compatibles con las rutas configuradas.

## 1. Clonar y crear el entorno

En PowerShell:

```powershell
git clone <URL_DEL_REPOSITORIO>
cd DjangoProjectBase
py -3.13 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

En Linux o macOS, active el entorno con `source .venv/bin/activate` y utilice `python` en los comandos siguientes.

Compruebe las dependencias:

```powershell
python -m pip check
```

## 2. Crear PostgreSQL

El siguiente ejemplo crea un usuario y una base vacía. Sustituya los nombres y la contraseña antes de ejecutarlo:

```sql
CREATE ROLE documentos_app WITH LOGIN PASSWORD 'CAMBIAR_ESTA_CONTRASENA';
CREATE DATABASE documentos_db OWNER documentos_app ENCODING 'UTF8';
```

Puede ejecutar estas instrucciones desde `psql` con un administrador de PostgreSQL. La aplicación utiliza el esquema `public`; el propietario de la base debe poder crear tablas, secuencias, índices y funciones en ese esquema.

## 3. Configurar el entorno

Copie el archivo de ejemplo sin versionar el resultado:

```powershell
Copy-Item .env.example .env
```

Configure al menos:

```dotenv
DJANGO_SECRET_KEY=una-clave-larga-y-unica
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1

DB_ENGINE=django.db.backends.postgresql
DB_NAME=documentos_db
DB_USER=documentos_app
DB_PASSWORD=CAMBIAR_ESTA_CONTRASENA
DB_HOST=localhost
DB_PORT=5432
```

Para desarrollo, `FLASK_PDF_DIR` puede apuntar a una carpeta local vacía. Las rutas relativas se resuelven desde la raíz del repositorio, por lo que el valor predeterminado portable es `media/documentos_heredados`. En una migración desde Flask puede utilizar una ruta absoluta al directorio que contiene los PDF heredados. Los archivos nuevos no se escriben allí: se guardan bajo `media/documentos/`.

## 4. Crear las tablas y funciones

Ejecute primero todas las migraciones Django:

```powershell
python manage.py migrate
```

La migración `documentos.0001_initial` crea las seis tablas documentales, sus relaciones, restricciones e índices cuando la base está vacía. En una base que ya contiene esas tablas, conserva sus datos. La migración `documentos.0002_funciones_consulta` crea las tres funciones PostgreSQL utilizadas por el código: `fn_usuario_es_editor`, `fn_listar_documentos_modulo` y `fn_listar_papelera_documentos`.

No hay que ejecutar scripts SQL manualmente en una instalación nueva.

Verifique la instalación:

```powershell
python manage.py check
python manage.py showmigrations documentos
```

La salida debe mostrar `[X] 0001_initial` y `[X] 0002_funciones_consulta`.

### Bases heredadas

No restaure `schema_documentosv2_tables.sql` sobre una base nueva preparada con `migrate`. Ese archivo es un respaldo histórico.

Antes de migrar una base existente, realice una copia de seguridad. Si aún contiene estados `INACTIVO` o variantes antiguas de columnas, aplique los scripts de adaptación que correspondan antes de ejecutar el script de funciones:

1. `schema_estado_ia_documentos.sql`
2. `schema_tipo_documento.sql`
3. `schema_tiene_versionamiento_documentos.sql`
4. `schema_estados_documentales.sql`
5. `schema_historial_eliminaciones.sql`
6. `schema_fecha_aprobacion_unica.sql`, solo si la base aún conserva la fecha de aprobación en `docs`.

Los scripts de adaptación son repetibles salvo que su cabecera indique lo contrario. Valide siempre el esquema y los datos en un entorno de prueba antes de aplicarlos en producción.

## 5. Catálogos y usuarios

Para cargar datos de demostración de perfiles y períodos en un entorno local:

```powershell
python manage.py seed_documentos_catalogos
```

Este comando crea datos de prueba y no debe ejecutarse automáticamente en producción.

Cree el primer administrador de forma interactiva:

```powershell
python manage.py createsuperuser
```

Después registre ese usuario como editor en `modulo_editores`. El procedimiento completo, incluida la creación de lectores, está en [MANUAL_CREACION_USUARIOS_DOCUMENTOS.md](MANUAL_CREACION_USUARIOS_DOCUMENTOS.md).

## 6. IA y Chroma

La aplicación Django y el servicio IA deben usar puertos o servidores diferentes. Configure la URL del servicio externo, no la URL del propio servidor Django:

```dotenv
IA_DOCUMENTOS_BASE_URL=http://localhost:8001
IA_DOCUMENTOS_ANALIZAR_PATH=/api/integracion/documentos/analizar/
IA_DOCUMENTOS_TIMEOUT=120
IA_DOCUMENTOS_REINTENTO_ESPERA=300
IA_DOCUMENTOS_PORCENTAJE_TEXTO_MINIMO=80
IA_SSL_VERIFY=True

IA_CHROMA_BASE_URL=http://localhost:8001
IA_CHROMA_GUARDAR_PATH=/api/integracion/documentos/guardar-chroma/
IA_CHROMA_QUITAR_VIGENCIA_PATH=/api/integracion/documentos/quitar-vigencia/
```

Si esos servicios no están disponibles, el servidor Django puede iniciar y se pueden crear documentos desmarcando **Procesar el documento con IA**. El análisis y la sincronización con Chroma no funcionarán hasta configurar un servicio compatible.

## 7. Ejecutar y probar

Servidor de desarrollo:

```powershell
python manage.py runserver
```

Abra `http://127.0.0.1:8000/documentos/login/`.

Pruebas aisladas —no utilizan el PostgreSQL configurado en `.env`—:

```powershell
python manage.py test sga.documentos.tests sga.documentos.test_services sga.documentos.test_architecture sga.documentos.tests_manual --settings=djangoprojectbase.settings_documentos_tests
```

Para producción, configure `DJANGO_DEBUG=False`, una clave secreta exclusiva, hosts permitidos, HTTPS, almacenamiento persistente de `media/` y un servidor WSGI/ASGI. Ejecute también:

```powershell
python manage.py collectstatic --noinput
python manage.py check --deploy
```

## Diagnóstico rápido

- `relation "docs" does not exist`: no se ejecutó `python manage.py migrate` sobre la base configurada.
- `function fn_listar_documentos_modulo(...) does not exist`: ejecute `python manage.py migrate` y confirme que `documentos.0002_funciones_consulta` esté aplicada.
- No aparecen PDF heredados: revise `FLASK_PDF_DIR` y sus permisos.
- La IA responde con error de conexión: revise `IA_DOCUMENTOS_BASE_URL`, el puerto y la disponibilidad del servicio externo.
- Un usuario entra como lector: compruebe su fila activa en `modulo_editores` o que sea superusuario.
