const VERSION = '20';
const CACHE_NAME = `SGA-UTEQ-V${VERSION}`;
const CACHE_STATIC = `${CACHE_NAME}-STATIC`;
const OFFLINE_URL = '/offline/';

// Lista de caches activos
const CACHES_ACTIVOS = [CACHE_NAME, CACHE_STATIC];

// ============================================
// EVENTO: INSTALL
// ============================================
self.addEventListener('install', event => {
    console.log(`[SW V${VERSION}] Instalando...`);

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Precaching pagina offline');
                return cache.add(OFFLINE_URL);
            })
            .then(() => {
                console.log('[SW] Instalacion completada, saltando espera');
                return self.skipWaiting();
            })
            .catch(error => {
                console.error('[SW] Error en install:', error);
                return self.skipWaiting(); // Continuar aunque falle
            })
    );
});

// ============================================
// EVENTO: ACTIVATE
// ============================================
self.addEventListener('activate', event => {
    console.log(`[SW V${VERSION}] Activando...`);

    event.waitUntil(
        (async () => {
            try {
                // 1. Habilitar Navigation Preload (mejora rendimiento)
                if ('navigationPreload' in self.registration) {
                    await self.registration.navigationPreload.enable();
                    console.log('[SW] Navigation Preload habilitado');
                }

                // 2. Limpiar caches antiguos
                const cacheNames = await caches.keys();
                const cachesToDelete = cacheNames.filter(name =>
                    name.startsWith('SGA-UTEQ-V') && !CACHES_ACTIVOS.includes(name)
                );

                if (cachesToDelete.length > 0) {
                    console.log(`[SW] Eliminando ${cachesToDelete.length} caches antiguos:`, cachesToDelete);
                    await Promise.all(cachesToDelete.map(name => caches.delete(name)));
                }

                // 3. Tomar control inmediato
                await self.clients.claim();

                // 4. Notificar a clientes
                const clients = await self.clients.matchAll({ type: 'window' });
                clients.forEach(client => {
                    client.postMessage({
                        type: 'SW_ACTIVATED',
                        version: VERSION,
                        timestamp: Date.now()
                    });
                });

                console.log(`[SW V${VERSION}] Activado y controlando ${clients.length} cliente(s)`);
            } catch (error) {
                console.error('[SW] Error en activate:', error);
            }
        })()
    );
});

// ============================================
// EVENTO: FETCH - ESTRATEGIAS DE CACHE
// ============================================
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // Ignorar solicitudes a dominios externos
    if (url.origin !== self.location.origin) {
        return;
    }

    // IGNORAR COMPLETAMENTE EL ADMIN DE DJANGO
    if (url.pathname.startsWith('/admin/')) {
        return; // No interceptar, dejar que el navegador maneje normalmente
    }

    // ========== ESTRATEGIA: NAVEGACION (paginas HTML) ==========
    // NETWORK FIRST: Siempre intenta la red primero
    if (request.mode === 'navigate') {
        event.respondWith(
            (async () => {
                try {
                    // 1. Intentar usar Navigation Preload (mas rapido)
                    const preloadResponse = await event.preloadResponse;
                    if (preloadResponse) {
                        console.log('[SW] Usando Navigation Preload');
                        return preloadResponse;
                    }

                    // 2. Fetch normal de la red
                    const networkResponse = await fetch(request);
                    if (networkResponse && networkResponse.ok) {
                        return networkResponse;
                    }
                    throw new Error('Respuesta no valida del servidor');

                } catch (error) {
                    // 3. Si falla, mostrar pagina offline
                    console.warn('[SW] Red no disponible, mostrando pagina offline:', error.message);
                    const cachedOffline = await caches.match(OFFLINE_URL);
                    if (cachedOffline) {
                        return cachedOffline;
                    }

                    // 4. Fallback de emergencia si no hay cache offline
                    return new Response(getFallbackHTML(), {
                        headers: {
                            'Content-Type': 'text/html; charset=utf-8',
                            'Cache-Control': 'no-store'
                        }
                    });
                }
            })()
        );
        return;
    }

    // === ARCHIVOS ESTATICOS: Cache First ===
    if (url.pathname.startsWith('/static/')) {
        event.respondWith(
            (async () => {
                const cache = await caches.open(CACHE_STATIC);
                const cachedResponse = await cache.match(request);

                // Fetch en background para actualizar cache
                const fetchPromise = fetch(request)
                    .then(networkResponse => {
                        if (networkResponse && networkResponse.ok) {
                            // Clonar antes de guardar
                            cache.put(request, networkResponse.clone());
                        }
                        return networkResponse;
                    })
                    .catch(() => null); // Ignorar errores de red

                // Retornar cache inmediatamente si existe
                if (cachedResponse) {
                    fetchPromise.catch(() => {}); // Ejecutar fetch pero no esperar
                    return cachedResponse;
                }

                // Si no hay cache, esperar el fetch
                const networkResponse = await fetchPromise;
                if (networkResponse) {
                    return networkResponse;
                }

                return new Response('Recurso no disponible offline', {
                    status: 503,
                    statusText: 'Service Unavailable',
                    headers: { 'Content-Type': 'text/plain' }
                });
            })()
        );
        return;
    }

    // Para APIs y otros recursos: Network Only (sin cache)
    // El browser los manejara normalmente
});

// ============================================
// EVENTO: MESSAGE - Comunicacion con Clientes
// ============================================
self.addEventListener('message', event => {
    const { data } = event;

    if (!data || !data.type) return;

    switch (data.type) {
        case 'SKIP_WAITING':
            console.log('[SW] Cliente solicito skipWaiting');
            self.skipWaiting();
            break;

        case 'GET_VERSION':
            event.ports[0]?.postMessage({
                type: 'VERSION_INFO',
                version: VERSION
            });
            break;

        case 'CHECK_FIREBASE':
            event.ports[0]?.postMessage({
                ready: true,
                version: VERSION
            });
            break;

        case 'FORCE_SHOW_NOTIFICATION':
            {
                const { title, body, icon, image, url } = data.payload || {};
                mostrarNotificacionAgrupada(
                    title, body, icon, image, url, event.ports[0]
                );
            }
            break;

        default:
            console.log('[SW] Mensaje no reconocido:', data.type);
    }
});

// ============================================
// EVENTO: PUSH
// Listener nativo (no depende del SDK de Firebase).
// Se registra de forma sincrona en la primera pasada del script, por lo
// que siempre esta listo, incluso cuando el navegador revive el SW en frio
// para despachar este mismo evento tras un periodo de inactividad.
// ============================================
const mensajesAcumuladosSW = {};

self.addEventListener('push', event => {
    event.waitUntil(
        (async () => {
            try {
                let payload = {};
                if (event.data) {
                    try {
                        payload = event.data.json();
                    } catch (e) {
                        payload = { data: { body: event.data.text() } };
                    }
                }
                const data = payload.data || {};
                const notification = payload.notification || {};
                await mostrarNotificacionAgrupada(
                    data.title || notification.title || "SGA",
                    data.body  || notification.body  || "",
                    data.icon  || notification.icon  || "",
                    data.image || notification.image || null,
                    data.url   || "/"
                );
            } catch (error) {
                console.error('[SW] Error procesando push:', error);
            }
        })()
    );
});

async function mostrarNotificacionAgrupada(title, body, icon, image, url, messagePort = null) {
    try {
        // Inicializar array para este titulo si no existe
        if (!mensajesAcumuladosSW[title]) {
            mensajesAcumuladosSW[title] = [];
        }

        // Evitar duplicados
        const ultimoMensaje = mensajesAcumuladosSW[title].slice(-1)[0];
        if (ultimoMensaje !== body) {
            mensajesAcumuladosSW[title].push(body);
        }

        // Mantener solo ultimos 5 mensajes
        const mensajesRecientes = mensajesAcumuladosSW[title].slice(-5);
        const bodyConcatenado = mensajesRecientes.join("\n ");

        const options = {
            body: mensajesRecientes.length > 1
                ? `- ${bodyConcatenado}`
                : body,
            icon: icon,
            badge: icon,
            tag: title, // Agrupa notificaciones del mismo titulo
            renotify: true,
            requireInteraction: false,
            silent: false,
            vibrate: [200, 100, 200],
            timestamp: Date.now(),
            data: { url: url || "/", originalTitle: title },
            actions: [
                { action: 'open', title: 'Abrir', icon: icon },
                { action: 'close', title: 'Cerrar' }
            ]
        };

        if (image) {
            options.image = image;
        }

        await self.registration.showNotification(title, options);

        // Notificar a clientes abiertos
        const clients = await self.clients.matchAll({ type: "window" });
        clients.forEach(client => {
            client.postMessage({
                type: 'BACKGROUND_NOTIFICATION',
                payload: { title, body: bodyConcatenado, icon, url }
            });
        });

        if (messagePort) {
            messagePort.postMessage({ success: true });
        }

        console.log('[SW] Notificacion mostrada:', title);
    } catch (error) {
        console.error('[SW] Error mostrando notificacion:', error);
        if (messagePort) {
            messagePort.postMessage({
                success: false,
                error: error.message
            });
        }
    }
}

// ============================================
// EVENTO: NOTIFICATION CLICK
// ============================================
self.addEventListener('notificationclick', event => {
    event.notification.close();

    const action = event.action;
    const urlToOpen = event.notification.data?.url || '/';

    if (action === 'close') {
        return; // Solo cerrar
    }

    event.waitUntil(
        self.clients.matchAll({
            type: "window",
            includeUncontrolled: true
        }).then(clients => {
            // Buscar ventana ya abierta del origen
            const appClient = clients.find(client => {
                const clientUrl = new URL(client.url);
                return clientUrl.origin === self.location.origin;
            });

            if (appClient) {
                // Navegar si es necesario y enfocar
                if (urlToOpen !== '/' && !appClient.url.includes(urlToOpen)) {
                    return appClient.navigate(urlToOpen)
                        .then(() => appClient.focus());
                }
                return appClient.focus();
            }

            // Abrir nueva ventana
            return self.clients.openWindow(self.location.origin + urlToOpen);
        })
    );
});

// ============================================
// PAGINA OFFLINE DE EMERGENCIA
// ============================================
function getFallbackHTML() {
    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>SIN CONEXION - SGA UTEQ</title>
    <style>
        * { 
            margin: 0; 
            padding: 0; 
            box-sizing: border-box; 
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 20px;
            padding: 3rem 2rem;
            max-width: 500px;
            text-align: center;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            animation: slideIn 0.5s ease-out;
        }
        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateY(-20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        .logo {
            width: 80px;
            height: 80px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 2rem;
            font-size: 2rem;
            font-weight: bold;
            color: white;
        }
        h1 { 
            color: #2d3748; 
            margin-bottom: 1rem; 
            font-size: 2rem; 
        }
        p { 
            color: #718096; 
            line-height: 1.6; 
            margin-bottom: 2rem; 
        }
        button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 1rem 2.5rem;
            font-size: 1rem;
            border-radius: 50px;
            cursor: pointer;
            font-weight: 600;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        button:hover { 
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(102, 126, 234, 0.4);
        }
        button:active {
            transform: translateY(0);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">SGA</div>
        <h1>Sin conexion</h1>
        <p>No se pudo conectar con el servidor. Verifica tu conexion a internet e intenta nuevamente.</p>
        <button onclick="window.location.reload()">Reintentar</button>
    </div>
</body>
</html>`;
}

console.log(`[SW V${VERSION}] Cargado y listo`);