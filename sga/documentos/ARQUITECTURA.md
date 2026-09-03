# Responsabilidades del módulo documental

- `views.py`: permisos de la petición, lectura del formulario, consultas para presentar información y respuestas HTTP.
- `services.py`: operaciones ORM, reglas de negocio y transacciones. Los servicios agregados coordinan creación/edición con accesos, versiones, publicación y bajas con su auditoría.
- `audit.py`: escrituras en la bitácora y el historial. Participan en la misma transacción que la operación; no se registra éxito si una de ellas falla.
- `storage.py`: guardar, leer y borrar PDFs. El almacenamiento no participa en las transacciones SQL.
- `integrations.py`: cliente IA/Chroma, payloads y trabajo en segundo plano. El arranque de hilos se difiere hasta después del commit.
- `access.py` y `constants.py`: catálogos y representación compartida de permisos/estados.
- `selectors.py`: lecturas reutilizables. Aún existen consultas de presentación en las vistas; no se ha trasladado toda lectura a este archivo.
- `repositories.py`: consultas SQL heredadas complejas.
- `models.py`: mapeo ORM de tablas existentes (`managed = False`). No se cambia quién administra esas tablas.

## Transacciones y archivos

Las vistas llaman a los servicios agregados `crear_documento_con_accesos`, `editar_documento_con_accesos`, `agregar_version_auditada`, `publicar_versiones_auditadas`, `eliminar_documento_auditado` y `eliminar_version_auditada`. Sus auxiliares ORM son piezas de composición, no sustitutos del flujo completo con auditoría.

La eliminación definitiva está en `eliminar_documento_fisico`, `eliminar_version_fisica` y `eliminar_versiones_fisicas`: validan la papelera, registran auditoría/historial y borran las filas en una transacción. Devuelven los datos de los PDFs; después se ejecuta la limpieza del almacenamiento y se informa si falla.

En altas y reemplazos, si falla la persistencia se intenta descartar el PDF recién subido. Después de que el servicio devuelve éxito, un error posterior de IA no debe borrar ese archivo ni comunicar que los datos fueron revertidos.

El flujo actual presupone vistas sin una transacción exterior (`ATOMIC_REQUESTS` deshabilitado). Si se añade una, habrá que coordinar también limpieza y confirmaciones con su commit/rollback.

## Estados y publicación tras integrar el merge

Las altas crean `BORRADOR`, sin publicación y sin cambiar la versión vigente anterior. Publicar exige lectura IA positiva; la mayor versión seleccionada pasa a `VIGENTE` y las otras publicadas a `NO_VIGENTE`. Retirar toda publicación limpia la referencia vigente, sin convertir los borradores en versiones publicadas. El cambio explícito a vigente exige publicación y lectura positiva, y retira la vigencia anterior en la misma transacción.

Los borradores se analizan sin reemplazar la versión publicada en Chroma. Al publicar se inicia la sincronización de la vigente. El editor ve el análisis de la última versión disponible y puede reintentarlo aunque todavía sea borrador.

Antes de ejecutar este código contra una base antigua, aplicar de forma controlada `schema_estados_documentales.sql`: cambia la restricción y el default de `doc_versions.estado` y convierte `INACTIVO` a `NO_VIGENTE`. El dump heredado `schema_documentosv2_tables.sql` todavía describe los estados anteriores; después de restaurarlo también se necesita esta adaptación. El script no se aplica automáticamente al desplegar el código; verificar su aplicación en cada entorno.

## Archivos que deben acompañar el commit

Incluir los módulos modificados, las pruebas (`tests.py`, `test_services.py`, `test_architecture.py`, `tests_manual.py`), `djangoprojectbase/settings_documentos_tests.py`, `schema_estados_documentales.sql`, este documento y el HTML/CSS del manual. No incluir `.env`, temporales ni configuraciones personales del IDE.

## Límites conservados

La auditoría todavía admite el usuario técnico de pruebas cuando no hay autenticación real. Los hilos IA son los del sistema existente, no una cola durable: reiniciar el proceso puede interrumpirlos. Esta refactorización no cambia esas decisiones ni las funciones SQL de lectura pendientes.

## Verificación aislada

Ejecutar desde la raíz:

```powershell
.\.venv\Scripts\python.exe manage.py test sga.documentos.tests sga.documentos.test_services sga.documentos.test_architecture sga.documentos.tests_manual --settings=djangoprojectbase.settings_documentos_tests
```

Usa SQLite en memoria, crea allí las tablas unmanaged y descarta la base al terminar. Comprueba rollback, reglas de negocio, auditoría, protección de archivos y separación de capas. No prueba los bloqueos/concurrencia ni los triggers específicos de PostgreSQL, ni llama a servicios IA reales.
