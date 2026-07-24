// ============================================
// SISTEMA DE GESTIÓN DE DISPOSITIVOS PWA
// SIN DUPLICACIÓN DE FIREBASE
// ============================================

// ============================================
// UTILIDADES PRINCIPALES
// ============================================

/**
 * Verificar si la PWA está instalada
 */
function isAppInstalled() {
    return window.matchMedia('(display-mode: standalone)').matches
        || window.navigator.standalone === true;
}

/**
 * Generar o recuperar UUID del dispositivo
 */
function generarUUID() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('app_storage', 1);

        request.onupgradeneeded = event => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('settings')) {
                db.createObjectStore('settings');
            }
        };

        request.onsuccess = event => {
            const db = event.target.result;
            const tx = db.transaction('settings', 'readonly');
            const store = tx.objectStore('settings');
            const getReq = store.get('device_uuid');

            getReq.onsuccess = () => {
                let uuid = getReq.result;

                if (!uuid) {
                    // Generar UUID v4
                    uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                        const r = Math.random() * 16 | 0;
                        const v = c === 'x' ? r : (r & 0x3 | 0x8);
                        return v.toString(16);
                    });

                    // Guardar en IndexedDB
                    const txAdd = db.transaction('settings', 'readwrite');
                    txAdd.objectStore('settings').put(uuid, 'device_uuid');
                    txAdd.oncomplete = () => {
                        console.log('[Dispositivo] UUID generado:');
                        resolve(uuid);
                    };
                    txAdd.onerror = () => reject('Error guardando UUID');
                } else {
                    console.log('[Dispositivo] UUID existente');
                    resolve(uuid);
                }
            };

            getReq.onerror = () => reject('Error leyendo UUID');
        };

        request.onerror = () => reject('Error abriendo IndexedDB');
    });
}

// ============================================
// DETECCIÓN DE TIPO DE DISPOSITIVO
// ============================================

/**
 * Detectar tipo de dispositivo de forma confiable
 * @returns {number} 1=Desktop, 2=Tablet, 3=Móvil
 */
function detectarTipoDispositivo() {
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const hasOrientation = 'orientation' in window;
    const screenWidth = window.screen.width;
    const screenHeight = window.screen.height;
    const maxDimension = Math.max(screenWidth, screenHeight);
    const minDimension = Math.min(screenWidth, screenHeight);
    const devicePixelRatio = window.devicePixelRatio || 1;
    const ua = navigator.userAgent.toLowerCase();

    // User Agent Data API
    if (navigator.userAgentData?.mobile) {
        return minDimension >= 600 ? 2 : 3;
    }

    // Detectar tablets
    if (/ipad/.test(ua) ||
        (/android/.test(ua) && !/mobile/.test(ua)) ||
        (hasTouch && minDimension >= 600 && maxDimension >= 800)) {
        return 2;
    }

    // Detectar móviles
    if (/iphone|ipod|android.*mobile|blackberry|iemobile|opera mini/i.test(ua)) {
        return 3;
    }

    // Verificación por características
    if (hasTouch && hasOrientation) {
        if (maxDimension <= 1024 && devicePixelRatio > 1) {
            return minDimension <= 600 ? 3 : 2;
        }
    }

    return 1; // Desktop
}

/**
 * Detectar sistema operativo
 * @returns {number} 0=Desconocido, 1=Android, 2=iOS, 3=ChromeOS, 4=macOS, 5=Windows, 6=Linux
 */
function detectarSistemaOperativo() {
    const ua = navigator.userAgent;
    const platform = navigator.platform || 'unknown';

    if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) return 2;
    if (/android/i.test(ua)) return 1;
    if (/CrOS/.test(ua)) return 3;
    if (/Mac/.test(platform) || /Macintosh/.test(ua)) return 4;
    if (/Win/.test(platform) || /Windows/.test(ua)) return 5;

    if (/Linux/.test(platform)) {
        const hasTouch = 'ontouchstart' in window;
        const hasOrientation = 'orientation' in window;
        return (hasTouch && hasOrientation) ? 1 : 6;
    }

    return 0;
}

/**
 * Detectar navegador
 * @returns {Object} {id: number, nombre: string}
 */
function detectarNavegador() {
    const ua = navigator.userAgent.toLowerCase();

    if (/edg/i.test(ua)) return { id: 3, nombre: "Edge" };
    if (/opr|opera/i.test(ua)) return { id: 4, nombre: "Opera" };
    if (/chrome|crios|crmo/i.test(ua)) return { id: 1, nombre: "Chrome" };
    if (/firefox|fxios/i.test(ua)) return { id: 2, nombre: "Firefox" };
    if (/samsungbrowser/i.test(ua)) return { id: 5, nombre: "Samsung Internet" };
    if (/safari/i.test(ua)) return { id: 6, nombre: "Safari" };

    return { id: 0, nombre: "Otro navegador" };
}

// ============================================
// REGISTRO DE DISPOSITIVO
// ============================================

/**
 * Registrar dispositivo en el servidor
 */
async function registrarDispositivo(password) {
    try {
        const uuid = await generarUUID();
        const tipodispositivo = detectarTipoDispositivo();
        const tiposistema = detectarSistemaOperativo();
        const tiponavegador = detectarNavegador();

        const response = await fetch('/notificacionpush/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrftoken
            },
            body: JSON.stringify({
                action: 'adddispositivo',
                uuid: uuid,
                tipodispositivo: tipodispositivo,
                tiposistema: tiposistema,
                tiponavegador: tiponavegador.id,
                password: password
            })
        });

        const data = await response.json();

        if (data.success || data.status === 'ok') {
            console.log('[Dispositivo] ✅ Registrado exitosamente');

            if (typeof window.inicializarPush === 'function') {
                await window.inicializarPush();
            }

            await actualizarVistaDispositivos();

            return true;
        } else if (data.result === 'bad_password') {
            $('#errorpasswordvinculo').text(data.mensaje || 'Contraseña incorrecta').show();
            return false;
        } else {
            throw new Error(data.mensaje || data.message || 'Error en el servidor');
        }
    } catch (error) {
        console.error('[Dispositivo] ❌ Error en registro:', error);
        if (typeof abrirnotificacionmodal === 'function') {
            abrirnotificacionmodal('Error al registrar dispositivo: ' + error.message);
        }
        return false;
    }
}

/**
 * Cerrar todas las sesiones/dispositivos vinculados excepto el actual
 */
async function cerrarTodasLasSesiones() {
    try {
        const uuid = await generarUUID();
        const response = await fetch('/notificacionpush/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrftoken
            },
            body: JSON.stringify({
                action: 'deltodoslosdispositivos',
                uuid: uuid
            })
        });

        const data = await response.json();

        if (data.success || data.status === 'ok') {
            console.log('[Dispositivo] Demas sesiones cerradas');
            await actualizarVistaDispositivos();
            return true;
        } else {
            throw new Error(data.mensaje || 'Error cerrando sesiones');
        }
    } catch (error) {
        console.error('[Dispositivo] Error cerrando sesiones:', error);
        if (typeof abrirnotificacionmodal === 'function') {
            abrirnotificacionmodal('Error al cerrar las demás sesiones');
        }
        return false;
    }
}

/**
 * Modal de confirmacion de contraseña antes de vincular un dispositivo nuevo
 */
function crearInputPasswordVinculo(valor) {
    // Algunos navegadores (Firefox) no permiten volver a poner type="password"
    // en un input que ya fue cambiado a type="text" via script. Para resetear
    // a oculto hay que recrear el elemento en vez de mutar su "type".
    const input = document.createElement('input');
    input.type = 'password';
    input.id = 'passwordvinculo';
    input.name = 'confirmarvinculo';
    input.placeholder = 'Contraseña';
    // "new-password" evita que el navegador autorellene con la clave guardada:
    // este campo es para CONFIRMAR identidad, no para iniciar sesión, y no debe
    // llenarse solo (ej. en un equipo compartido con la clave guardada).
    input.autocomplete = 'new-password';
    input.value = valor || '';
    return input;
}

function abrirModalConfirmarVinculo(onConfirm) {
    $('#passwordvinculo').replaceWith(crearInputPasswordVinculo(''));
    $('.mostrarpasswordvinculo').removeClass('fa-eye').addClass('fa-eye-slash');
    $('#errorpasswordvinculo').hide();
    $('#modalconfirmarvinculo').modal({ backdrop: 'static', width: '400' }).modal('show');

    $('.mostrarpasswordvinculo').off('click').on('click', function() {
        const input = document.getElementById('passwordvinculo');
        const icono = $(this);
        if (input.type === 'password') {
            input.type = 'text'; // password -> text si esta permitido
            icono.removeClass('fa-eye-slash').addClass('fa-eye');
        } else {
            // text -> password: recrear el input conservando lo escrito
            $(input).replaceWith(crearInputPasswordVinculo(input.value));
            icono.removeClass('fa-eye').addClass('fa-eye-slash');
        }
    });

    $('#btnconfirmarvinculo').off('click').on('click', async function() {
        const password = $('#passwordvinculo').val();
        if (!password) {
            $('#errorpasswordvinculo').text('Ingresa tu contraseña').show();
            return;
        }
        const boton = $(this);
        boton.prop('disabled', true).html('<i class="fa fa-spinner fa-spin"></i> Verificando...');
        const ok = await onConfirm(password);
        boton.prop('disabled', false).html('<i class="fa fa-check"></i> Vincular');
        if (ok) {
            $('#modalconfirmarvinculo').modal('hide');
        }
    });
}

$('.cerrartodaslassesiones').click(function() {
    $('#modalconfirmarcerrarsesiones').modal({ backdrop: 'static', width: '420' }).modal('show');

    $('#btnconfirmarcerrarsesiones').off('click').on('click', async function() {
        const botonModal = $(this);
        botonModal.prop('disabled', true).html('<i class="fa fa-spinner fa-spin"></i> Cerrando...');
        const ok = await cerrarTodasLasSesiones();
        botonModal.prop('disabled', false).html('<i class="fa fa-power-off"></i> Sí, cerrar todas');
        if (ok) {
            $('#modalconfirmarcerrarsesiones').modal('hide');
        }
    });
});

/**
 * Registrar token de notificaciones push
 * Usa el singleton _firebasePagina para evitar doble inicialización
 */
async function registrarNotificacionPush() {
    try {
        const uuid = await generarUUID();

        // Detener animación del botón mientras procesa
        $(`#noti${uuid}`).removeClass('btn-notificar-pwa');

        // Obtener messaging desde el singleton (init solo 1 vez, síncrono)
        const messaging = _firebasePagina.getMessaging();
        const registration = await navigator.serviceWorker.ready;

        // Solicitar permiso
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.log('[Dispositivo] Permiso de notificaciones denegado');
            await actualizarVistaDispositivos();
            return false;
        }

        // Obtener token FCM
        const token = await messaging.getToken({
            vapidKey: 'BBwbVdQvBiVE-EEL3KU-Pk85zEN7risbda9zZh514jtpZOcCOe5iNE40fKMufgc39mXJmSDG9ANHVTR6ZjOH-s0',
            serviceWorkerRegistration: registration
        });

        console.log('[Dispositivo] Token FCM obtenido');

        // Enviar al servidor
        const response = await fetch('/notificacionpush/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrftoken },
            body: JSON.stringify({ token: token, action: 'addtoken', uuid: uuid })
        });

        const data = await response.json();

        if (data.success || data.status === 'ok') {
            console.log('[Dispositivo] ✅ Token registrado');
            // Marcar como actualizado para que actualizarTokenFCM no repita el trabajo
            try { sessionStorage.setItem('fcm_actualizado', 'true'); } catch(ex) {}
            await actualizarVistaDispositivos();
            $('#mensajeadicionarapp').hide();
            return true;
        } else {
            throw new Error(data.message || 'Error registrando token');
        }

    } catch (error) {
        console.error('[Dispositivo] ❌ Error registrando notificaciones:', error);
        if (typeof abrirnotificacionmodal === 'function') {
            abrirnotificacionmodal('Error en notificaciones: ' + error.message);
        }
        return false;
    }
}

// ============================================
// SINGLETON DE FIREBASE (contexto de página)
// Los scripts firebase-app-compat.js y
// firebase-messaging-compat.js ya se cargan
// en basebs.html antes que este archivo,
// por lo que solo hay que inicializar 1 vez.
// ============================================
const _firebasePagina = (() => {
    const _config = {
        apiKey: "AIzaSyDU075BA2Sinh4ZHtrcMy7d2kC8TKKrPeA",
        authDomain: "sga-notificacion-push-41211.firebaseapp.com",
        projectId: "sga-notificacion-push-41211",
        storageBucket: "sga-notificacion-push-41211.firebasestorage.app",
        messagingSenderId: "765659764573",
        appId: "1:765659764573:web:0f789609c6cab5f6c3bab4"
    };
    let _messaging = null;

    return {
        getMessaging() {
            if (_messaging) return _messaging;  // reutilizar instancia existente
            if (typeof firebase === 'undefined') {
                throw new Error('Firebase no está disponible. Recarga la página.');
            }
            if (!firebase.apps || !firebase.apps.length) {
                firebase.initializeApp(_config);
                console.log('[Firebase] Inicializado (página)');
            } else {
                console.log('[Firebase] Reutilizando instancia existente (página)');
            }
            _messaging = firebase.messaging();
            return _messaging;
        }
    };
})();

/**
 * Eliminar dispositivo
 */
async function eliminarDispositivo(uuid) {
    try {
        const response = await fetch('/notificacionpush/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrftoken
            },
            body: JSON.stringify({
                action: 'deldispositivo',
                uuid: uuid
            })
        });

        const data = await response.json();

        if (data.success || data.status === 'ok') {
            console.log('[Dispositivo] Eliminado');
            await actualizarVistaDispositivos();
            return true;
        } else {
            throw new Error(data.message || 'Error eliminando dispositivo');
        }
    } catch (error) {
        console.error('[Dispositivo] Error eliminando:', error);
        if (typeof abrirnotificacionmodal === 'function') {
            abrirnotificacionmodal('Error al eliminar dispositivo');
        }
        return false;
    }
}

/**
 * Confirmar antes de desvincular un dispositivo (evita borrados por clic accidental)
 */
function confirmarEliminarDispositivo(uuid) {
    $('#modalconfirmardesvincular').modal({ backdrop: 'static', width: '420' }).modal('show');

    $('#btnconfirmardesvincular').off('click').on('click', async function() {
        const boton = $(this);
        boton.prop('disabled', true).html('<i class="fa fa-spinner fa-spin"></i> Desvinculando...');
        const ok = await eliminarDispositivo(uuid);
        boton.prop('disabled', false).html('<i class="fa fa-reply"></i> Sí, desvincular');
        if (ok) {
            $('#modalconfirmardesvincular').modal('hide');
        }
    });
}

// ============================================
// ACTUALIZACIÓN DE VISTA
// ============================================
async function actualizarVistaDispositivos() {
    try {
        if (typeof obtenerDato !== 'function') {
            console.error('[Dispositivo] Función obtenerDato no disponible');
            return;
        }

        const data = await obtenerDato('POST', 'th_hojavida', {
            'action': 'segmentodispositivos'
        });

        var segmentodispositivo = $('#segmentodispositivos')
        if (segmentodispositivo.length) {
            segmentodispositivo.html(data.data);
        }

        await verificarDispositivo();

    } catch (error) {
        console.error('[Dispositivo] Error actualizando vista:', error);
    }
}

// ============================================
// BOTÓN INSTALAR PWA
// ============================================

(function inicializarBotonInstalacionPWA() {
    let _deferredPrompt = null;
    let _instalando = false;

    function _mostrarConfirmacionYActualizar(contenedor) {
        if (contenedor) contenedor.innerHTML = '';
        const msgDiv = document.getElementById('mensajeaplicacioninstalada');
        if (msgDiv) {
            msgDiv.style.display = 'block';
        }
        if (typeof actualizarVistaDispositivos === 'function') {
            actualizarVistaDispositivos();
        }
    }

    function _crearBotonInstalar() {
        const contenedor = document.getElementById('addinstalarapp');
        if (!contenedor) return;

        if (isAppInstalled()) {
            contenedor.innerHTML = '';
            return;
        }

        const bar = document.createElement('div');
        bar.className = 'pwa-install-bar';

        const icon = document.createElement('span');
        icon.className = 'pwa-install-bar__icon';
        icon.innerHTML = '<i class="fa fa-download"></i>';

        const text = document.createElement('span');
        text.className = 'pwa-install-bar__text';
        text.textContent = 'Instala la app del SGA para acceder más rápido desde tu pantalla de inicio.';

        const btn = document.createElement('a');
        btn.href = 'javascript:;';
        btn.className = 'pwa-install-bar__btn';
        btn.innerHTML = '<i class="fa fa-download"></i> Instalar';

        btn.addEventListener('click', async function () {
            if (!_deferredPrompt) return;

            btn.classList.add('pwa-install-bar__btn--loading');
            btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Instalando…';
            _instalando = true;

            _deferredPrompt.prompt();
            const { outcome } = await _deferredPrompt.userChoice;
            _deferredPrompt = null;

            if (outcome === 'accepted') {
                setTimeout(function () {
                    if (_instalando) {
                        _instalando = false;
                        _mostrarConfirmacionYActualizar(document.getElementById('addinstalarapp'));
                    }
                }, 800);
            } else {
                _instalando = false;
                contenedor.innerHTML = '';
                _crearBotonInstalar();
            }
        });

        bar.appendChild(icon);
        bar.appendChild(text);
        bar.appendChild(btn);

        contenedor.innerHTML = '';
        contenedor.appendChild(bar);
    }

    // Escuchar el evento nativo del navegador
    window.addEventListener('beforeinstallprompt', function (e) {
        e.preventDefault();
        _deferredPrompt = e;
        window._pwaPromptDisponible = true;
        try { localStorage.setItem('pwa_soportada', '1'); } catch(ex) {}
        // Ocultar mensaje de incompatibilidad si el navegador sí soporta PWA
        var msgIncompat = document.getElementById('mensajeaplicacionnocompatible');
        if (msgIncompat) msgIncompat.style.display = 'none';
        _crearBotonInstalar();
    });

    // appinstalled: fuente más fiable para saber que se instaló
    window.addEventListener('appinstalled', function () {
        _instalando = false;
        try { localStorage.setItem('pwa_instalada', '1'); } catch(ex) {}
        _mostrarConfirmacionYActualizar(document.getElementById('addinstalarapp'));
    });

    // Si ya teníamos prompt (DOMContentLoaded ya pasó), crear botón inmediatamente
    if (_deferredPrompt) {
        _crearBotonInstalar();
    }
})();

/**
 * Verificar estado del dispositivo actual
 */
async function verificarDispositivo() {
    try {
        const currentUUID = await generarUUID();
        const dispositivos = obtenerDispositivosActivos();
        const instalado = isAppInstalled();
        const controladd = $('#adddispositivo');

        if (!controladd.length) return;

        controladd.empty().hide();

        // Verificar si este dispositivo está registrado
        const existeidu = dispositivos.includes(currentUUID);

        $('#mensajenegado').hide();

        // Mostrar botón de instalar app si no está instalada (independiente del registro)
        if (!instalado) {
            $('#addinstalarapp').show();
        }

        if (existeidu) {
            // Dispositivo ya registrado
            $(`#sesionidu${currentUUID}`).show();

            const permiso = Notification.permission;
            if (permiso === 'granted') {
                $('#mensajeadicionarapp').hide();
            } else {
                $('#mensajeadicionarapp').hide();
            }
            if (permiso === 'default' || permiso === 'granted') {
                $(`#noti${currentUUID}`).show();
            } else if (permiso === 'denied') {
                mostrarMensajeNotificaciones();
            }
        } else {
            // Dispositivo no registrado - mostrar mensaje y botón de vincular
            $('#mensajeadicionarapp').show();


            const btn = $(`
                <a class="btn btn-success btn-form btn-instalar-pwa" href="javascript:;" style="margin-bottom: 10px;">
                    <i class="fa fa-plus"></i> Vincular este dispositivo
                </a>
            `);

            btn.on('click', async function() {
                const botonVincular = $(this);
                abrirModalConfirmarVinculo(async (password) => {
                    botonVincular.prop('disabled', true).removeClass('btn-instalar-pwa').html('<i class="fa fa-spinner fa-spin"></i> Registrando...');
                    const ok = await registrarDispositivo(password);
                    if (!ok) {
                        botonVincular.prop('disabled', false).addClass('btn-instalar-pwa').html('<i class="fa fa-plus"></i> Vincular este dispositivo');
                    }
                    return ok;
                });
            });

            controladd.html(btn).show();
        }
    } catch (error) {
        console.error('[Dispositivo] Error verificando:', error);
    }
}

/**
 * Obtener lista de UUIDs de dispositivos activos
 */
function obtenerDispositivosActivos() {
    const dispositivos = [];
    $('.sesionidu').each(function() {
        const idu = $(this).attr('idu');
        if (idu) dispositivos.push(idu);
    });
    return dispositivos;
}

/**
 * Mostrar mensaje cuando las notificaciones están bloqueadas
 */
function mostrarMensajeNotificaciones() {
    const navegador = detectarNavegador().nombre;
    let instrucciones = "";

    switch(navegador) {
        case "Chrome":
        case "Samsung Internet":
            instrucciones = "Configuración → Sitios web → Notificaciones → Permitir";
            break;
        case "Firefox":
            instrucciones = "Configuración → Privacidad → Notificaciones → Permitir";
            break;
        case "Edge":
            instrucciones = "Configuración → Permisos → Notificaciones → Permitir";
            break;
        case "Safari":
            instrucciones = "Configuración → Sitios web → Notificaciones → Permitir";
            break;
        default:
            instrucciones = "Configuración del navegador → Notificaciones → Permitir";
    }

    const mensaje = `
        <div style="padding: 15px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; margin: 10px 0;">
            <strong style="color: #856404;">🔔 Notificaciones bloqueadas</strong><br>
            <p style="color: #856404; margin: 8px 0;">
                Has desactivado las notificaciones. Para activarlas en <b>${navegador}</b>:
            </p>
            <em style="color: #856404;">${instrucciones}</em>
        </div>
    `;

    if ($('#mensajenegado').length) {
        $('#mensajenegado').html(mensaje).show();
    }
}

$('.configurarnotificacion').click(async function() {
    await configurarNotificacion();
});

async function configurarNotificacion() {
    bloqueointerface()
    try {
        const response = await fetch('/notificacionpush/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrftoken
            },
            body: JSON.stringify({
                action: 'segmentoconfigurarnotificacion',
            })
        });

        const data = await response.json();

        $.unblockUI();
        if (data.success || data.status === 'ok') {
            $('.modalconfigurarnotificacion').html(data.html).modal({'backdrop': 'static', 'width':'500'}).modal('show');
            return true;
        } else {
            throw new Error(data.message || 'Error al configurar notificaciones');
        }
    } catch (error) {
        $.unblockUI();
        console.error('[Dispositivo] Error configurar notificaciones:', error);
        if (typeof abrirnotificacionmodal === 'function') {
            abrirnotificacionmodal('Error configurar notificaciones');
        }
        return false;
    }
}

// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('[Dispositivo] 📱 Inicializando sistema...');

    try {
        // Solo ejecutar si estamos en la página correcta
        if ($('#segmentodispositivos').length) {
            await actualizarVistaDispositivos();
        }
    } catch (error) {
        console.error('[Dispositivo] Error en inicialización:', error);
    }

    // Detectar navegador no compatible con PWA
    // Esperar 3s para dar tiempo a que se dispare beforeinstallprompt
    if (!isAppInstalled()) {
        setTimeout(function () {
            if (typeof _pwaPromptDisponible === 'undefined' || !_pwaPromptDisponible) {
                // El navegador soporta PWA si tiene BeforeInstallPromptEvent (todos los Chromium lo tienen)
                if ('BeforeInstallPromptEvent' in window) {
                    return; // Navegador compatible, la app probablemente ya está instalada
                }
                // Fallback: verificar si previamente se registró soporte o instalación
                try {
                    if (localStorage.getItem('pwa_soportada') || localStorage.getItem('pwa_instalada')) {
                        return;
                    }
                } catch(ex) {}
                var msgIncompat = document.getElementById('mensajeaplicacionnocompatible');
                if (msgIncompat && msgIncompat.style.display === 'none') {
                    msgIncompat.innerHTML = '<i class="fa fa-exclamation-triangle"></i> <strong>Tu navegador no permite instalar la aplicación SGA.</strong><br><span style="font-weight:normal;">No te preocupes, puedes vincular este dispositivo y recibir notificaciones normalmente desde aquí.<br>Si deseas instalar la aplicación, utiliza alguno de estos navegadores: <b>Google Chrome</b>, <b>Microsoft Edge</b>, <b>Opera</b>, <b>Brave</b>, <b>Vivaldi</b> o <b>Samsung Internet</b>.</span>';
                    msgIncompat.style.display = 'block';
                }
            }
        }, 3000);
    }
});

// Exponer funciones globalmente
window.registrarDispositivo = registrarDispositivo;
window.registrarNotificacionPush = registrarNotificacionPush;
window.eliminarDispositivo = eliminarDispositivo;
window.confirmarEliminarDispositivo = confirmarEliminarDispositivo;
window.actualizarVistaDispositivos = actualizarVistaDispositivos;