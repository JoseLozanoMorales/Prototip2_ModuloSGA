# Autenticación y roles del módulo de documentos

Este documento explica cómo funciona el inicio de sesión, la asignación de roles y el acceso al módulo de documentos legales.

## Flujo general

```text
/documentos/login/
        |
        v
Autenticación de Django
        |
        +-- jlozano -----> EDITOR ----> ve los 6 documentos activos
        |
        +-- jaucatomac --> LECTOR ----> ve únicamente los documentos autorizados
```

## 1. Inicio de sesión

La dirección de acceso al módulo es:

```text
/documentos/login/
```

El formulario utiliza el sistema de autenticación de Django y comprueba el usuario y la contraseña almacenados en la tabla de usuarios.

Cuando las credenciales son correctas:

1. Django crea una sesión en el navegador.
2. El usuario es redirigido a `/documentos/`.
3. Las siguientes solicitudes reconocen automáticamente al usuario autenticado.

El panel `/admin/` continúa disponible para la administración de Django, pero no es necesario utilizarlo para acceder al módulo documental.

## 2. Protección de las rutas

El middleware `DocumentosLoginRequiredMiddleware` protege todas las direcciones bajo `/documentos/`.

Si una persona intenta entrar sin haber iniciado sesión, es redirigida al formulario de acceso:

```text
/documentos/ -> /documentos/login/?next=/documentos/
```

La protección también comprende las páginas de edición, archivos PDF, papelera y demás operaciones del módulo.

## 3. Asignación de roles

El proyecto combina la autenticación de Django con la tabla `modulo_editores` para determinar el rol efectivo de cada usuario.

### EDITOR: `jlozano`

El usuario `jlozano`:

- Es un superusuario de Django.
- Está registrado como editor activo en `modulo_editores`.

La segunda condición es necesaria porque la función de PostgreSQL que lista los documentos también consulta `modulo_editores`.

El EDITOR puede:

- Ver todos los documentos activos, incluidos borradores y documentos sin publicar.
- Crear y editar documentos.
- Agregar versiones.
- Publicar versiones.
- Ejecutar o reintentar el análisis de IA.
- Eliminar y restaurar documentos y versiones.
- Acceder a la papelera.
- Consultar el manual del editor.

### LECTOR: `jaucatomac`

El usuario `jaucatomac`:

- Está activo en Django.
- No pertenece al personal administrativo (`is_staff=False`).
- No es superusuario (`is_superuser=False`).
- No tiene una asignación activa en `modulo_editores`.

Por estas condiciones recibe el rol **LECTOR**.

El LECTOR puede:

- Ver documentos publicados.
- Ver únicamente documentos permitidos para su perfil, grupo y periodo.
- Abrir las versiones disponibles de esos documentos.

Actualmente este usuario ve dos documentos porque son los que coinciden con sus permisos de consulta.

## 4. Una plantilla con dos interfaces

Los dos roles acceden a `/documentos/`, pero la plantilla adapta el contenido mediante una condición equivalente a:

```django
{% if usuario.rol_modulo == 'EDITOR' %}
```

Para el EDITOR aparecen las herramientas de creación, edición, publicación y papelera. Para el LECTOR se muestra únicamente la interfaz de consulta.

La seguridad no depende solamente de ocultar botones. El servidor vuelve a comprobar el rol antes de ejecutar las operaciones restringidas.

## 5. Cambio de usuario

La interfaz principal contiene el botón **Cambiar usuario**. Al utilizarlo:

1. Se envía una solicitud segura de cierre de sesión.
2. Django elimina la sesión actual.
3. El navegador regresa a `/documentos/login/`.
4. Se puede iniciar sesión con otra cuenta.

No es necesario cerrar el navegador ni eliminar sus cookies manualmente.

## 6. Estado actual de los documentos

La base de datos contiene actualmente:

| Estado | Cantidad |
|---|---:|
| Documentos activos | 6 |
| Documentos eliminados en la papelera | 7 |
| Total de documentos | 13 |

El EDITOR puede ver los seis documentos activos. El LECTOR ve únicamente los dos documentos que cumplen sus reglas de acceso.

## 7. Resumen de cuentas

| Usuario | Rol | Acceso administrativo | Documentos visibles actualmente |
|---|---|---|---:|
| `jlozano` | EDITOR | Sí | 6 |
| `jaucatomac` | LECTOR | No | 2 |

Las contraseñas no se incluyen en este documento por seguridad.
