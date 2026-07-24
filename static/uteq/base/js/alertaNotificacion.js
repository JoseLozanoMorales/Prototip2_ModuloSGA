// $(document).on('DOMContentLoaded', function () {
//     const contenedorToast = document.getElementById('contenedor-toast');
//     obtener_lista_notificacion()
//         .then((response) => {
//             if (response.result) {
//                 response.lista.forEach(function (elemento) {
//                     agregarToast(elemento, contenedorToast);
//                 });
//             }
//         })
//         .catch((error) => {
//             console.error('Error al obtener actividades:', error);
//         });
//
//     contenedorToast.addEventListener('click', (e) => {
//         const toastId = e.target.closest('div.toast').id;
//
//         if (e.target.closest('button.btn-cerrar')) {
//             cerrarToast(toastId);
//         }
//     });
//
// });
//
// async function obtener_lista_notificacion(){
//     try {
//         const params = new URLSearchParams(window.location.search);
//         const id = params.get('id') || null;
//         const action = params.get('action') || null;
//         const currentPath = window.location.pathname;
//
//         if (currentPath === '/pro_planificacion'){
//             if (action){
//                 if (params.get('action') !== 'planificacionclase'){
//                     return false;
//                 }
//             }
//         }
//
//         const url = new URL('/notificacionalerta', window.location.origin);
//         if (id) url.searchParams.append('id', id);
//         url.searchParams.append('currentPath', currentPath);
//
//         // Realizar la petición
//         const response = await fetch(url, {
//             method: 'GET',
//             headers: {'Accept': 'application/json'},
//             credentials: 'include'
//         });
//         if (!response.ok) {
//             throw new Error(`Error HTTP: ${response.status}`);
//         }
//
//         const data = await response.json();
//         if (data.result) {
//             console.log('Actividades procesadas:', data.mensaje);
//             return data;
//
//         } else {
//             throw new Error(data.mensaje || 'Error al procesar actividades');
//         }
//
//     } catch (error) {
//         console.error('Error al enviar actividades:', error);
//         throw error;
//     }
// }
//
// // Función para cancelar manualmente
// function cancelar_notificaciones() {
//     if (abortController) {
//         abortController.abort();
//         abortController = null;
//     }
// }



/**
 * Sistema de Notificaciones con Cancelación
 * Integración completa: alertaNotificacion.js + notificacionAlert.js
 */

// ==================== VARIABLES GLOBALES ====================

let abortController = null;
let contenedorToast = null;
let toastQueue = [];
let isProcessing = false;

// Iconos SVG
const iconos = {
    exito: `<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 16">
        <path d="M2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2zm10.03 4.97a.75.75 0 0 1 .011 1.05l-3.992 4.99a.75.75 0 0 1-1.08.02L4.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093 3.473-4.425a.75.75 0 0 1 1.08-.022z"/>
    </svg>`,
    error: `<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 16">
        <path d="M11.46.146A.5.5 0 0 0 11.107 0H4.893a.5.5 0 0 0-.353.146L.146 4.54A.5.5 0 0 0 0 4.893v6.214a.5.5 0 0 0 .146.353l4.394 4.394a.5.5 0 0 0 .353.146h6.214a.5.5 0 0 0 .353-.146l4.394-4.394a.5.5 0 0 0 .146-.353V4.893a.5.5 0 0 0-.146-.353L11.46.146zM8 4c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995A.905.905 0 0 1 8 4zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
    </svg>`,
    info: `<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 16">
        <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm.93-9.412-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.47l-.451-.081.082-.381 2.29-.287zM8 5.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/>
    </svg>`,
    warning: `<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 16">
        <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
    </svg>`,
    infor: `<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 16">
        <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm.93-9.412l-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.47l-.451-.081.082-.381 2.29-.287zM8 5.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/>
    </svg>`
};

// ==================== INICIALIZACIÓN ====================

function inicializarNotificaciones() {
    contenedorToast = document.getElementById('contenedor-toast');

    if (!contenedorToast) {
        console.error('No se encontró el contenedor de toast');
        return;
    }

    // Cargar notificaciones
    cargarNotificaciones();

    // Cancelar al cambiar de página o recargar
    window.addEventListener('beforeunload', cancelarNotificaciones);

    // Cancelar cuando la página se oculta
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            cancelarNotificaciones();
        }
    });
}

// ==================== CARGA DE NOTIFICACIONES ====================

async function cargarNotificaciones() {
    try {
        // Cancelar petición anterior si existe
        cancelarNotificaciones();

        // Crear nuevo AbortController
        abortController = new AbortController();

        const data = await obtenerListaNotificacion(abortController.signal);

        if (data?.result && Array.isArray(data.lista)) {
            data.lista.forEach(elemento => {
                agregarToast(elemento, contenedorToast);
            });
            console.log('Notificaciones cargadas:', data.mensaje);
        }
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('Error al cargar notificaciones:', error);
        }
    }
}

async function obtenerListaNotificacion(signal) {
    const params = new URLSearchParams(window.location.search);
    const currentPath = window.location.pathname;

    // Validar si debe cargar en esta ruta
    if (!debeCargarNotificaciones(currentPath, params)) {
        return {result: false, lista: []};
    }

    // Construir URL
    const url = new URL('/notificacionalerta', window.location.origin);
    const id = params.get('id');
    if (id) url.searchParams.append('id', id);
    url.searchParams.append('currentPath', currentPath);

    // Timeout de 10 segundos
    const timeoutId = setTimeout(() => {
        if (abortController) abortController.abort();
    }, 10000);

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            credentials: 'include',
            signal: signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }

        const data = await response.json();

        if (!data.result) {
            throw new Error(data.mensaje || 'Error al procesar notificaciones');
        }

        return data;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

function debeCargarNotificaciones(currentPath, params) {
    // No cargar en rutas específicas
    const rutasExcluidas = ['/login', '/logout'];
    if (rutasExcluidas.includes(currentPath)) {
        return false;
    }

    // Validación para pro_planificacion
    if (currentPath === '/pro_planificacion') {
        const action = params.get('action');
        return !action || action === 'planificacionclase';
    }

    return true;
}


// ==================== GESTIÓN DE TOASTS ====================

function agregarToast({id, tipo, titulo, descripcion, autoCierre, url}, contenedorToast) {
    // Crear elemento base
    const nuevoToast = crearElementoToast(id, tipo, autoCierre);

    // Agregar contenido
    agregarContenidoToast(nuevoToast, tipo, titulo, descripcion, url);

    // Configurar eventos
    configurarEventosToast(nuevoToast, url, id, autoCierre);

    // Agregar al DOM
    contenedorToast.appendChild(nuevoToast);
}

function crearElementoToast(id, tipo, autoCierre) {
    const nuevoToast = document.createElement('div');
    nuevoToast.classList.add('toast', tipo);
    if (autoCierre) {
        nuevoToast.classList.add('autoCierre');
    }
    nuevoToast.id = id;
    return nuevoToast;
}

function agregarContenidoToast(nuevoToast, tipo, titulo, descripcion, url) {
    nuevoToast.innerHTML = `
        <div class="contenido" data-url="${url || ''}">
            <div class="icono">
                ${iconos[tipo] || iconos.info}
            </div>
            <div class="texto">
                <p class="titulo">${titulo}</p>
                <p class="descripcion">${descripcion}</p>
            </div>
        </div>
        <button class="btn-cerrar" aria-label="Cerrar notificación">
            <div class="icono">
                <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                </svg>
            </div>
        </button>
    `;
}

function configurarEventosToast(nuevoToast, url, id, autoCierre) {
    // Click en el contenido
    const contenido = nuevoToast.querySelector('.contenido');
    if (url) {
        contenido.addEventListener('click', () => {
            marcarComoLeidaYRedirigir(id, url);
        });
        contenido.style.cursor = 'pointer';
    }

    // Auto-cierre
    if (autoCierre) {
        setTimeout(() => {
            agregarToastACola(id);
        }, 6000);
    }

    // Animación de cierre
    nuevoToast.addEventListener('animationend', (e) => {
        if (e.animationName === 'cierre') {
            nuevoToast.remove();
        }
    });

    // Botón cerrar
    const btnCerrar = nuevoToast.querySelector('.btn-cerrar');
    btnCerrar.addEventListener('click', () => {
        agregarToastACola(id);
    });
}

function marcarComoLeidaYRedirigir(id, url) {
    $.post("/datos_alerta_notificaciones", {
        'action': 'leer_notificacion',
        'id': id
    }, function (data) {
        if (data.result === 'ok') {
            window.location.href = url;
        }
        $.unblockUI();
    }, "json").fail(function () {
        console.error('Error al marcar notificación como leída');
        $.unblockUI();
    });
}

// ==================== GESTIÓN DE COLA DE CIERRE ====================

function cerrarToast(id) {
    const toast = document.getElementById(id);
    if (!toast) return;

    toast.classList.add('cerrando');

    const handleAnimacionCierre = (e) => {
        if (e.animationName === 'cierre') {
            toast.removeEventListener('animationend', handleAnimacionCierre);
            toast.remove();
            procesarColaCierres();
        }
    };

    toast.addEventListener('animationend', handleAnimacionCierre);
}

function procesarColaCierres() {
    if (toastQueue.length === 0) {
        isProcessing = false;
        return;
    }

    isProcessing = true;
    const toastId = toastQueue.shift();
    cerrarToast(toastId);
}

function agregarToastACola(toastId) {
    toastQueue.push(toastId);
    if (!isProcessing) {
        procesarColaCierres();
    }
}

// ==================== CANCELACIÓN ====================

function cancelarNotificaciones() {
    if (abortController) {
        abortController.abort();
        abortController = null;
        console.log('Petición de notificaciones canceladaa');
    }
}

function limpiarNotificaciones() {
    const toasts = contenedorToast?.querySelectorAll('.toast');
    toasts?.forEach(toast => toast.remove());
    toastQueue = [];
    isProcessing = false;
}

function alCambiarPerfil() {
    console.log('Cambio de perfil detectado');
    cancelarNotificaciones();
    limpiarNotificaciones();

    // Recargar después de cambiar perfil
    setTimeout(() => {
        cargarNotificaciones();
    }, 500);
}

// ==================== AUTO-INICIALIZACIÓN ====================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarNotificaciones);
} else {
    inicializarNotificaciones();
}


// ==================== EXPORTAR FUNCIONES ====================

window.cargarNotificaciones = cargarNotificaciones;
window.cancelarNotificaciones = cancelarNotificaciones;
window.limpiarNotificaciones = limpiarNotificaciones;
window.alCambiarPerfil = alCambiarPerfil;