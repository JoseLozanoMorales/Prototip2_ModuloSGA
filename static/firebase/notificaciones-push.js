// ============================================
// NOTIFICACIONES PUSH + GESTIÓN DE SERVICE WORKER
// Sistema unificado que NO conflictúa con django-pwa
// ============================================

(function() {
    'use strict';

    // ============================================
    // 1. GESTIÓN DEL SERVICE WORKER
    // ============================================

    let swVersion = null;
    let refreshing = false;

    /**
     * Configurar manejo de actualizaciones del SW
     * Django-PWA ya lo registró, nosotros solo gestionamos updates
     */
    function setupServiceWorkerManagement() {
        if (!('serviceWorker' in navigator)) {
            console.warn('[PWA] Service Worker no soportado');
            return;
        }

        // Obtener el SW ya registrado por django-pwa
        navigator.serviceWorker.ready.then(registration => {
            // console.log('[PWA] Service Worker detectado');

            // Obtener versión actual
            if (registration.active) {
                const channel = new MessageChannel();
                channel.port1.onmessage = (event) => {
                    if (event.data.type === 'VERSION_INFO') {
                        swVersion = event.data.version;
                        // console.log('[PWA] Versión SW:', swVersion);
                    }
                };
                registration.active.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
            }

            // Detectar actualizaciones
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                // console.log('[PWA] 🔄 Actualización del SW detectada');

                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed') {
                        if (navigator.serviceWorker.controller) {
                            // console.log('[PWA] ⚡ Activando nuevo SW...');
                            newWorker.postMessage({ type: 'SKIP_WAITING' });
                        } else {
                            // console.log('[PWA] SW instalado por primera vez');
                        }
                    }
                });
            });

            // Configurar verificación periódica de updates
            setupUpdateChecks(registration);
        });

        // Escuchar mensajes del SW
        navigator.serviceWorker.addEventListener('message', handleSWMessage);

        // Manejar cambio de controller
        navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    }

    /**
     * Configurar verificación periódica de actualizaciones
     */
    function setupUpdateChecks(registration) {
        const isMobile = isMobileDevice();

        if (isMobile) {
            // Móviles: verificar cada 5 minutos cuando visible
            let lastCheck = Date.now();
            const CHECK_INTERVAL = 5 * 60 * 1000;

            const checkForUpdates = () => {
                if (document.visibilityState === 'visible') {
                    const now = Date.now();
                    if (now - lastCheck >= CHECK_INTERVAL) {
                        lastCheck = now;
                        registration.update().catch(() => {});
                    }
                }
            };

            setInterval(checkForUpdates, 60000);
        } else {
            // Desktop: verificar al recuperar foco
            let lastCheck = Date.now();
            const CHECK_COOLDOWN = 10 * 60 * 1000;

            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    const now = Date.now();
                    if (now - lastCheck >= CHECK_COOLDOWN) {
                        lastCheck = now;
                        registration.update().catch(() => {});
                    }
                }
            });
        }
    }

    /**
     * Manejar mensajes del Service Worker
     */
    function handleSWMessage(event) {
        const { data } = event;
        if (!data || !data.type) return;

        switch (data.type) {
            case 'SW_ACTIVATED':
                handleSWActivation(data);
                break;

            case 'BACKGROUND_NOTIFICATION':
                // console.log('[PWA] 📬 Notificación en background:', data.payload);
                window.dispatchEvent(new CustomEvent('pwa-notification', {
                    detail: data.payload
                }));
                break;

            case 'VERSION_INFO':
                swVersion = data.version;
                break;
        }
    }

    /**
     * Manejar activación del SW
     */
    function handleSWActivation(data) {
        const newVersion = data.version;

        if (swVersion !== null && newVersion !== swVersion) {
            // console.log(`[PWA] 📦 SW actualizado: V${swVersion} → V${newVersion}`);

            if (!refreshing) {
                refreshing = true;
                // console.log('[PWA] Recargando página...');
                setTimeout(() => window.location.reload(), 500);
            }
        } else {
            swVersion = newVersion;
            // console.log(`[PWA] SW V${newVersion} activo`);
        }
    }

    /**
     * Manejar cambio de controller
     */
    function handleControllerChange() {
        if (!refreshing) {
            // console.log('[PWA] Controller cambiado');
        }
    }

    // ============================================
    // 2. VERIFICACIONES DE NOTIFICACIONES
    // ============================================

    // Solo ejecutar si hay usuario autenticado
    if (typeof csrftoken === 'undefined') {
        // console.log('[Push] No hay sesión activa');
        // Pero SÍ configurar gestión del SW
        setupServiceWorkerManagement();
        return;
    }

    // ============================================
    // 3. UTILIDADES
    // ============================================

    function obtenerUUID() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('app_storage', 1);

            request.onupgradeneeded = event => {
                if (!event.target.result.objectStoreNames.contains('settings')) {
                    event.target.result.createObjectStore('settings');
                }
            };

            request.onsuccess = event => {
                const db = event.target.result;
                const tx = db.transaction('settings', 'readonly');
                const store = tx.objectStore('settings');
                const getReq = store.get('device_uuid');

                getReq.onsuccess = () => resolve(getReq.result || null);
                getReq.onerror = () => reject('Error leyendo UUID');
            };

            request.onerror = () => reject('Error abriendo IndexedDB');
        });
    }

    function isMobileDevice() {
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const hasSmallScreen = window.screen.width <= 1024;
        const mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        return isTouchDevice && (hasSmallScreen || mobileUA);
    }

    // ============================================
    // 4. CONFIGURACIÓN FIREBASE
    // Los scripts firebase-app-compat.js y
    // firebase-messaging-compat.js se cargan
    // directamente en basebs.html.
    // ============================================

    const firebaseConfig = {
        apiKey: "AIzaSyDU075BA2Sinh4ZHtrcMy7d2kC8TKKrPeA",
        authDomain: "sga-notificacion-push-41211.firebaseapp.com",
        projectId: "sga-notificacion-push-41211",
        storageBucket: "sga-notificacion-push-41211.firebasestorage.app",
        messagingSenderId: "765659764573",
        appId: "1:765659764573:web:0f789609c6cab5f6c3bab4"
    };

    // ============================================
    // 5. INICIALIZAR FIREBASE
    // ============================================

    function initFirebase() {
        try {
            if (typeof firebase === 'undefined') {
                throw new Error('Firebase no está disponible. Recarga la página.');
            }

            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
                // console.log('[Push] Firebase inicializado');
            } else {
                // console.log('[Push] Reutilizando instancia existente');
            }

            if (!firebase.messaging) {
                throw new Error('Firebase Messaging no disponible');
            }

            return firebase.messaging();

        } catch (error) {
            console.error('[Push] Error inicializando Firebase:', error);
            return null;
        }
    }

    // ============================================
    // 6. ACTUALIZAR TOKEN FCM
    // ============================================

    async function actualizarTokenFCM(uuid) {
        try {
            const fcmActualizado = sessionStorage.getItem('fcm_actualizado');
            if (fcmActualizado) {
                // console.log('[Push] Token ya actualizado en esta sesión');
                return true;
            }

            const messaging = initFirebase();
            if (!messaging) throw new Error('Firebase no disponible');

            if (Notification.permission !== 'granted') {
                // console.log('[Push] Permiso no concedido');
                return false;
            }

            const registration = await navigator.serviceWorker.ready;

            const token = await messaging.getToken({
                vapidKey: 'BBwbVdQvBiVE-EEL3KU-Pk85zEN7risbda9zZh514jtpZOcCOe5iNE40fKMufgc39mXJmSDG9ANHVTR6ZjOH-s0',
                serviceWorkerRegistration: registration
            });

            if (!token) throw new Error('No se pudo obtener token FCM');

            // console.log('[Push] Token obtenido');

            const response = await fetch('/notificacionpush/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrftoken
                },
                body: JSON.stringify({
                    token: token,
                    uuid: uuid,
                    action: 'actualizadispositivo'
                })
            });

            const data = await response.json();

            if (data.success || data.status === 'ok') {
                sessionStorage.setItem('fcm_actualizado', 'true');
                // console.log('[Push] ✅ Token actualizado');
                return true;
            } else {
                throw new Error(data.message || 'Error en servidor');
            }

        } catch (error) {
            console.error('[Push] Error actualizando token:', error);
            return false;
        }
    }

    // ============================================
    // 7. NOTIFICACIONES EN PRIMER PLANO
    // ============================================

    async function setupForegroundNotifications() {
        try {
            const messaging = initFirebase();
            if (!messaging) {
                console.error('[Push] No se pudo inicializar Firebase');
                return;
            }

            window.mensajesAcumulados = window.mensajesAcumulados || {};

            messaging.onMessage(async (payload) => {
                // console.log("[Push] 📨 Mensaje en primer plano");

                const data = payload.data || {};
                const notification = payload.notification || {};

                const title = data.title || notification.title || "SGA";
                const body = data.body || notification.body || "";
                const icon = data.icon || notification.icon || "";
                const image = data.image || notification.image || null;
                const url = data.url || "/";

                // Acumular mensajes
                if (!window.mensajesAcumulados[title]) {
                    window.mensajesAcumulados[title] = [];
                }

                const ultimoBody = window.mensajesAcumulados[title].slice(-1)[0];
                if (ultimoBody !== body) {
                    window.mensajesAcumulados[title].push(body);
                }

                const mensajesRecientes = window.mensajesAcumulados[title].slice(-5);
                const bodyConcatenado = mensajesRecientes.join("\n• ");

                // Estrategia según dispositivo
                if (isMobileDevice()) {
                    await forzarNotificacionSW(title, bodyConcatenado, icon, image, url);
                    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
                    mostrarToastVisual(title, bodyConcatenado, icon);
                } else {
                    mostrarNotificacionEstandar(title, bodyConcatenado, icon, image, url);
                }
            });

            // console.log('[Push] ✅ Listener configurado');

        } catch (error) {
            console.error('[Push] Error configurando notificaciones:', error);
        }
    }

    async function forzarNotificacionSW(title, body, icon, image, url) {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            try {
                const channel = new MessageChannel();

                return new Promise((resolve) => {
                    const timeout = setTimeout(() => resolve(false), 3000);

                    channel.port1.onmessage = (event) => {
                        clearTimeout(timeout);
                        resolve(event.data.success);
                    };

                    navigator.serviceWorker.controller.postMessage({
                        type: 'FORCE_SHOW_NOTIFICATION',
                        payload: { title, body, icon, image, url }
                    }, [channel.port2]);
                });

            } catch (error) {
                console.error('[Push] Error con SW:', error);
                return false;
            }
        }
        return false;
    }

    function mostrarNotificacionEstandar(title, body, icon, image, url) {
        if (Notification.permission !== "granted") {
            mostrarToastVisual(title, body, icon);
            return;
        }

        const options = {
            body: body,
            icon: icon,
            badge: icon,
            tag: title,
            renotify: true,
            requireInteraction: false,
            silent: false,
            vibrate: [200, 100, 200],
            data: { url: url }
        };

        if (image) options.image = image;

        try {
            const notification = new Notification(title, options);

            notification.onclick = function(event) {
                event.preventDefault();
                window.focus();
                if (url && url !== '/') window.location.href = url;
                notification.close();
            };

        } catch (error) {
            console.error('[Push] Error:', error);
            mostrarToastVisual(title, body, icon);
        }
    }

    function mostrarToastVisual(title, body, icon) {
        const existing = document.getElementById('pwa-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.id = 'pwa-toast';
        toast.style.cssText = `
            position: fixed; top: 20px; left: 50%; 
            transform: translateX(-50%) translateY(-120%);
            width: calc(100% - 40px); max-width: 400px;
            background: rgba(255,255,255,0.98); color: #000;
            padding: 16px 18px; z-index: 999999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            box-shadow: 0 12px 40px rgba(0,0,0,0.15);
            border-radius: 18px;
            transition: transform 0.35s cubic-bezier(0.36,0.66,0.04,1);
            cursor: pointer; backdrop-filter: blur(20px);
        `;

        toast.innerHTML = `
            <div style="display: flex; align-items: center; gap: 14px;">
                <img src="${icon}" style="width: 44px; height: 44px; border-radius: 10px; object-fit: cover;">
                <div style="flex: 1; min-width: 0;">
                    <div style="font-weight: 600; font-size: 15px; margin-bottom: 3px;">${title}</div>
                    <div style="font-size: 13px; color: #86868b; line-height: 1.4; white-space: pre-line;">${body}</div>
                </div>
            </div>
        `;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.transform = 'translateX(-50%) translateY(0)';
        }, 100);

        const hideTimer = setTimeout(() => {
            toast.style.transform = 'translateX(-50%) translateY(-120%)';
            setTimeout(() => toast.remove(), 400);
        }, 5000);

        toast.addEventListener('click', () => {
            clearTimeout(hideTimer);
            toast.style.transform = 'translateX(-50%) translateY(-120%)';
            setTimeout(() => toast.remove(), 400);
        });

        if (navigator.vibrate && isMobileDevice()) navigator.vibrate([100]);
    }

    // ============================================
    // 8. INICIALIZACIÓN PRINCIPAL
    // ============================================

    window.inicializarPush = async function() {
        try {
            // console.log('[Push] 🚀 Iniciando...');

            // PRIMERO: Configurar gestión del Service Worker
            setupServiceWorkerManagement();

            // SEGUNDO: Configurar notificaciones
            const uuid = await obtenerUUID();

            if (!uuid) {
                // console.log('[Push] No hay UUID, dispositivo no registrado');
                return;
            }

            await actualizarTokenFCM(uuid);
            await setupForegroundNotifications();

            // console.log('[Push] ✅ Sistema completo listo');

        } catch (error) {
            console.error('[Push] Error en inicialización:', error);
        }
    }

    // ============================================
    // 9. EJECUTAR
    // ============================================

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => window.inicializarPush());
    } else {
        window.inicializarPush();
    }

    // Exponer función de actualización manual
    window.actualizarTokenPush = async function() {
        try {
            const uuid = await obtenerUUID();
            if (uuid) {
                sessionStorage.removeItem('fcm_actualizado');
                await actualizarTokenFCM(uuid);
                return true;
            }
            return false;
        } catch (error) {
            console.error('[Push] Error:', error);
            return false;
        }
    };

})();

// console.log('[Push] 🔔 Módulo cargado (con gestión de SW integrada)');