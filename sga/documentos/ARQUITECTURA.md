# Arquitectura del módulo documental

Última revisión: 3 de septiembre de 2026. Referencia de código: `f580dc2`.

Este documento describe la implementación de `sga/documentos`, no toda la plantilla SGA. Distingue lo implementado de lo pendiente. Una actualización de código no aplica automáticamente cambios en PostgreSQL ni garantiza que todos los entornos tengan el mismo esquema.

## 1. Responsabilidades y dependencias

| Archivo | Responsabilidad actual |
| --- | --- |
| `views.py` | Permisos de la petición, lectura y validación del formulario, consultas y preparación de datos de presentación, llamadas a servicios/integraciones y respuestas HTTP. |
| `services.py` | Escrituras ORM, reglas de negocio, bloqueos y transacciones. Los servicios agregados coordinan la operación con su auditoría. No importan vistas ni reciben `request`. |
| `audit.py` | Escrituras en `LogEntry` y en el historial de eliminación definitiva, dentro de la transacción del servicio llamador. |
| `storage.py` | Validación, guardado, lectura y borrado de PDFs. No ofrece transacciones de archivos. |
| `integrations.py` | Cliente HTTP de IA/Chroma, payloads, arranque de hilos y actualización del estado de análisis a través de servicios. |
| `selectors.py` | Lecturas ORM reutilizables: accesos, versiones, contexto documental y estados IA. |
| `repositories.py` | SQL parametrizado de lectura heredada e introspección de columnas. |
| `models.py` | Mapeo de tablas heredadas, relaciones, QuerySets y constantes de estados documentales. |
| `access.py` | Catálogos y representación de permisos compartidos por formularios e integración IA. |
| `constants.py` | Estados/etiquetas IA y mapas de nombres de perfiles, grupos y períodos; no define los estados documentales. |
| `urls.py` / `apps.py` | Rutas con namespace `documentos` y registro de la aplicación con label `documentos`. |
| `admin.py` | No registra modelos documentales; actualmente solo contiene un texto provisional. |

La aplicación está montada bajo `/documentos/`. La interfaz utiliza `templates/documentos/documentosV2.html`, `visor_pdf.html` y `static/js/documentos.js`. El manual usa `manual_editor.html` y `static/css/manual_editor.css`.

La separación no significa que las vistas solo llamen a un servicio: aún contienen lecturas ORM, comparaciones de metadatos y coordinación posterior al guardado. No contienen escrituras ORM documentales directas. La creación de la sesión del chat y las actualizaciones de diccionarios no son operaciones documentales que deban trasladarse a servicios.

## 2. ORM, tablas y SQL que permanece

| Modelo | Tabla |
| --- | --- |
| `Documento` | `docs` |
| `VersionDocumento` | `doc_versions` |
| `AccesoDocumento` | `documento_acceso` |
| `LecturaDocumento` | `documento_lectura` |
| `HistorialEliminacion` | `historial_eliminaciones` |
| `EditorModulo` | `modulo_editores` |

Todos estos modelos tienen `managed = False`: Django puede consultar y modificar sus filas con ORM, pero sus migraciones no administran la creación o modificación de esas tablas. Las migraciones de las demás aplicaciones Django siguen siendo necesarias.

`Documento.version_vigente` referencia una versión; las versiones pertenecen al documento. Los servicios coordinan el estado de la versión con esa referencia. El historial de eliminación guarda identificadores y datos descriptivos sin depender de que el documento eliminado siga existiendo.

Los QuerySets distinguen documentos visibles por ausencia de fecha de eliminación, versiones activas por estado distinto de `ELIMINADO`, versiones publicadas y versiones vigentes.

Las escrituras de este módulo se realizan con ORM. Todavía se invocan desde `repositories.py`:

- `fn_listar_documentos_modulo`: listado con visibilidad segmentada y unión con `docs` para obtener el tipo.
- `fn_listar_papelera_documentos`: listado de papelera.
- Introspección de columnas mediante la conexión Django.

Por tanto, el módulo todavía depende de PostgreSQL y de funciones SQL instaladas; no es portable íntegramente a otra base solo por usar ORM. Las consultas de presentación aún no están todas en `selectors.py`. El criterio para SQL excepcional es encapsularlo y parametrizarlo en repositorios, no añadirlo a las vistas.

## 3. Servicios utilizados por las vistas

| Operación | Servicio |
| --- | --- |
| Crear documento, primera versión y accesos | `crear_documento_con_accesos` |
| Editar metadatos, accesos, estado y PDF opcional | `editar_documento_con_accesos` |
| Agregar una versión | `agregar_version_auditada` |
| Cambiar publicaciones | `publicar_versiones_auditadas` |
| Baja lógica de documento / versión | `eliminar_documento_auditado` / `eliminar_version_auditada` |
| Restaurar documento / versión / selección | `restaurar_documento_logicamente` / `restaurar_version_logicamente` / `restaurar_versiones_logicamente` |
| Eliminación definitiva de documento / versión / selección | `eliminar_documento_fisico` / `eliminar_version_fisica` / `eliminar_versiones_fisicas` |
| Registrar apertura del visor por un lector | `registrar_lectura_documento` |

Los auxiliares ORM —por ejemplo, `crear_documento`, `editar_documento` o `agregar_version`— son piezas de composición; llamarlos directamente no sustituye el flujo completo con accesos y auditoría. No todos los auxiliares tienen su propia transacción: algunos requieren la del servicio coordinador.

Las operaciones agregadas y las eliminaciones definitivas incluyen sus escrituras de auditoría en la misma transacción. Si falla esa auditoría, se revierten las escrituras de la operación. `reemplazar_accesos_documento` también es atómico.

Las restauraciones actuales no registran una nueva entrada en `LogEntry` ni en `HistorialEliminacion`. Las lecturas del visor utilizan `LecturaDocumento`, no la bitácora de cambios.

## 4. Estados, publicación y versionamiento

Los estados documentales definidos en `models.py` son `BORRADOR`, `VIGENTE`, `NO_VIGENTE` y `ELIMINADO`. Son independientes de `estado_ia` y del booleano `publicado`.

- Crear un documento genera la versión 1 en borrador, sin publicación y sin referencia vigente.
- Agregar una versión toma el máximo número existente, incluidas las eliminadas, y suma uno. Crea un borrador y conserva la versión vigente y las publicaciones anteriores.
- Publicar valida que los identificadores pertenezcan a versiones activas del documento. Exige IA `LEIDO` para las versiones que pasan de no publicadas a publicadas; las ya publicadas están exceptuadas en esa validación.
- La mayor versión seleccionada para publicación pasa a vigente; las otras seleccionadas pasan a no vigentes. Las desmarcadas dejan de estar publicadas. Un borrador no seleccionado se conserva como borrador.
- Retirar todas las publicaciones limpia la referencia vigente y deja las antiguas versiones publicadas como no vigentes.
- Cambiar explícitamente una versión a vigente exige publicación e IA `LEIDO`; la operación retira la vigencia de la anterior en la misma transacción.
- Una versión publicada no puede cambiarse a borrador. Cambiarla a no vigente no retira por sí mismo su publicación.
- `tiene_versionamiento` se recalcula según existan al menos dos versiones no eliminadas.

El tipo predeterminado del modelo y del formulario es `Documento legal`. El selector de tipos está deshabilitado por `SELECTOR_TIPO_DOCUMENTO_HABILITADO = False`; al editar se conserva el tipo existente. El esquema debe admitir ese valor en `docs.tipo`.

### Papelera y eliminación definitiva

La baja lógica conserva las filas y los PDFs, y registra fecha, motivo y usuario. No permite eliminar contenido publicado: primero se retira su publicación. Tampoco permite eliminar aisladamente la única versión activa; en ese caso se elimina lógicamente el documento completo.

En el flujo normal, restaurar recupera las versiones como `NO_VIGENTE`, sin publicación. Existe una excepción de compatibilidad: si el documento conserva una referencia vigente a una versión restaurada, los servicios la restauran como vigente/publicada. No debe afirmarse que la restauración jamás publica. Restaurar una versión también retira la baja lógica del documento para que pueda volver a aparecer.

La eliminación definitiva exige un motivo de al menos cinco caracteres y verifica la pertenencia y la papelera. La comprobación actual de documento/versión individual usa la fecha de eliminación; la eliminación múltiple comprueba el estado `ELIMINADO`. Registra bitácora e historial antes de borrar las filas, todo dentro de una transacción. Los servicios devuelven los datos de archivos para su limpieza posterior.

## 5. Auditoría, identidad y acceso

`audit.py` usa el usuario Django autenticado cuando está disponible. En caso contrario crea o reutiliza `auditoria_documentos_pruebas`, un usuario técnico temporal. La bitácora guarda el mensaje proporcionado o, si no lo hay, el resumen JSON; no guarda ambos automáticamente.

La autorización del módulo todavía utiliza `USUARIO_SIMULADO`. Su rol se consulta en `modulo_editores`: una entrada activa concede rol editor; de lo contrario se utiliza lector. Esto no equivale a una integración terminada con la identidad real de `request.user`.

Los lectores consultan las versiones publicadas de documentos visibles para sus accesos. Las rutas de visor/PDF comprueban visibilidad; la previsualización de papelera y el manual requieren editor. Registrar una apertura del visor por un lector no equivale a registrar todas las descargas del endpoint PDF.

`sga/admin.py` administra modelos generales de la plantilla. Ni ese archivo ni el `admin.py` documental trasladan automáticamente reglas o crean tablas. Si se habilita edición documental en Django Admin, habrá que integrar los servicios o impedir escrituras que los eludan.

## 6. Transacciones y almacenamiento de PDFs

Las cargas nuevas se guardan mediante `default_storage` en `documentos/`, con un prefijo UUID. Para leerlas, la implementación resuelve una ruta bajo `MEDIA_ROOT`; los PDFs heredados se localizan bajo `FLASK_PDF_DIR`. Por ello no basta con sustituir el backend de storage por uno remoto: la lectura actual depende del sistema de archivos local.

Se valida la extensión PDF, el tamaño no vacío y un mínimo de 200 caracteres de texto extraíble, sin contar espacios. La extracción usa `pypdf`, con alternativa `PyPDF2`.

El almacenamiento no participa en la transacción SQL:

1. La vista valida y guarda el PDF.
2. El servicio persiste los datos y la auditoría.
3. Si falla la persistencia, se intenta descartar la carga nueva.
4. Tras el éxito del servicio, un fallo posterior de IA no borra ese PDF ni revierte la operación ya confirmada.
5. En eliminaciones definitivas se borran primero las filas; después se intenta borrar los PDFs. Las rutas fallidas se devuelven para advertir al usuario.

No hay una cola durable de limpieza. Un fallo o cierre del proceso puede dejar archivos huérfanos. El reemplazo de PDF tampoco implementa una limpieza automática del archivo anterior.

El flujo presupone que no hay una transacción exterior de toda la petición (`ATOMIC_REQUESTS` no está configurado). Añadirla requiere revisar la limpieza de cargas, la eliminación de archivos y los mensajes de éxito frente al commit/rollback exterior. Los servicios que bloquean documentos y versiones reducen carreras, pero las pruebas SQLite no certifican su comportamiento concurrente en PostgreSQL.

## 7. IA y Chroma

Los estados IA son `PENDIENTE`, `LEIDO`, `OBSERVADO` y `ERROR`.

- Al iniciar análisis se registra pendiente y se programa el arranque del hilo con `transaction.on_commit`.
- El analizador recibe el PDF y el tipo documental por multipart.
- Una validación de texto no satisfactoria produce observado; los errores de ejecución/conexión producen error.
- El umbral porcentual se configura; un porcentaje inferior puede aceptarse si la IA extrae al menos 200 caracteres de texto sin espacios.
- Los borradores se analizan y pueden alcanzar leído, pero no reemplazan documentos en Chroma.
- Al cambiar la publicación, la vista inicia el análisis/sincronización de la vigente o solicita retirar la vigencia anterior si ya no existe una vigente.
- Las ediciones que cambian archivo o metadatos pueden relanzar el análisis de la versión editada, aunque sea borrador.
- El editor ve el estado IA de la última versión activa. El reintento también selecciona la última versión disponible, no necesariamente la vigente.
- La reserva de reintento es una actualización condicional: rechaza versiones ya leídas y pendientes recientes; permite recuperar pendientes sin fecha o vencidas según la espera configurada.

Para una versión vigente, Chroma recibe texto/metadata en JSON o el PDF por multipart cuando no existe texto extraído. La URL del PDF se incorpora únicamente cuando corresponde a una versión vigente; se construye desde la petición, por lo que hay que configurar correctamente host, proxy y accesibilidad desde el servicio IA.

`LEIDO` significa que el análisis fue satisfactorio, no que Chroma se haya sincronizado: un fallo de Chroma puede quedar en `mensaje_ia` manteniendo leído. El reintento actual no es un mecanismo específico para reparar ese caso porque rechaza estados leídos.

Los hilos son daemon, no una cola durable. No hay garantía de reanudación tras reinicios, ni una transacción distribuida entre PostgreSQL y Chroma. Los contextos usados por los trabajadores pueden quedar desfasados si el documento cambia mientras se analiza; no debe asumirse consistencia fuerte con el índice externo.

## 8. Configuración y despliegue

La configuración se encuentra en `djangoprojectbase/settings.py`, con valores de entorno. No versionar credenciales ni `.env`.

| Configuración | Uso |
| --- | --- |
| `DATABASES` | Conexión PostgreSQL del entorno; comprobar base y esquema antes de aplicar SQL. |
| `MEDIA_ROOT`, `FLASK_PDF_DIR` | Archivos nuevos y heredados, respectivamente. |
| `IA_DOCUMENTOS_BASE_URL`, `IA_DOCUMENTOS_ANALIZAR_PATH` | Endpoint del analizador. |
| `IA_CHROMA_BASE_URL`, `IA_CHROMA_GUARDAR_PATH`, `IA_CHROMA_QUITAR_VIGENCIA_PATH` | Endpoints de sincronización y retiro de vigencia. |
| `IA_DOCUMENTOS_TIMEOUT` | Timeout HTTP; default de código: 120 segundos. |
| `IA_DOCUMENTOS_REINTENTO_ESPERA` | Ventana para recuperar pendientes; default: 300 segundos. |
| `IA_DOCUMENTOS_PORCENTAJE_TEXTO_MINIMO` | Umbral porcentual; default: 80. |
| `IA_SSL_VERIFY` | Verificación TLS; habilitada por defecto. |

Antes de desplegar:

1. Revisar las migraciones Django y la existencia de todas las tablas mapeadas, columnas y funciones SQL utilizadas. No considerar el dump heredado una instalación completa y actualizada.
2. Respaldar la base y aplicar de forma controlada `schema_estados_documentales.sql` si el entorno aún usa los estados antiguos.
3. Verificar que `docs.tipo` acepte `Documento legal` y que existan las tablas de lecturas, accesos e historial.
4. Verificar rutas/permisos de PDFs y configuración de los endpoints IA/Chroma.
5. Ejecutar comprobaciones y pruebas aisladas. Validar además el flujo real en un entorno de prueba PostgreSQL antes de producción.

`schema_estados_documentales.sql` actúa sobre `public.doc_versions`: en una transacción y con timeout de bloqueo de cinco segundos, sustituye la restricción de estados, convierte únicamente `INACTIVO` a `NO_VIGENTE` y cambia el default a `BORRADOR`. No modifica publicaciones ni referencias vigentes. El dump `schema_documentosv2_tables.sql` aún describe estados antiguos; después de restaurarlo también se necesita esta adaptación. `manage.py migrate` no ejecuta este script automáticamente.

Registro de la aplicación local autorizada del 3 de septiembre de 2026: se convirtieron cinco versiones, se comprobó que publicaciones y referencias vigentes no cambiaron y se guardó un respaldo de los campos afectados en `tmp/`. Ese respaldo es local y no se versiona; esto no certifica la aplicación del script en otros entornos.

## 9. Pruebas y archivos versionados

Desde la raíz del proyecto:

```powershell
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe manage.py test sga.documentos.tests sga.documentos.test_services sga.documentos.test_architecture sga.documentos.tests_manual --settings=djangoprojectbase.settings_documentos_tests
```

`settings_documentos_tests.py` usa SQLite en memoria. Las pruebas crean allí las tablas unmanaged y la base temporal se descarta al terminar; no escriben en el PostgreSQL configurado para la aplicación.

| Archivo | Cobertura |
| --- | --- |
| `tests.py` | Validación de respuesta IA, tipo documental y registro de lectura desde el visor. |
| `test_services.py` | Transacciones, rollback de auditoría, accesos, estados, publicación, versiones y eliminaciones. |
| `test_architecture.py` | Límites de capas, referencias globales, protección del PDF ante fallos posteriores, arranque tras commit y separación borrador/Chroma. |
| `tests_manual.py` | Ruta, contenido y permisos del manual, y visibilidad de su botón. |

La batería comprobada para esta revisión contiene 45 pruebas. No valida funciones/triggers SQL reales, concurrencia y bloqueos PostgreSQL, servicios IA externos ni todas las interacciones del navegador.

Deben acompañar al código los tests, su configuración, el script de estados, este documento, el HTML/CSS del manual y los demás assets usados por las vistas. No incluir respaldos, PDFs privados, temporales ni configuración personal del IDE. Antes de cada commit, revisar archivos sin seguimiento: el hecho de que funcionen localmente no garantiza que estén disponibles al clonar el repositorio.

## 10. Criterios para futuras modificaciones

- Incorporar una nueva escritura al servicio adecuado y a su transacción; no escribir ORM documental directamente desde la vista.
- Probar la llamada directa al servicio para comprobar que las reglas no dependen exclusivamente del formulario.
- Usar selectores para lecturas reutilizables; aislar SQL excepcional y parametrizado en repositorios.
- Distinguir operación confirmada de fallo posterior de integración o almacenamiento.
- No atribuir al módulo garantías todavía ausentes: autenticación real, auditoría de todas las acciones, limpieza durable, portabilidad completa o sincronización fuerte con Chroma.
- Actualizar este documento, el manual y los tests al cambiar estados, permisos, transacciones, esquema o contratos externos.
