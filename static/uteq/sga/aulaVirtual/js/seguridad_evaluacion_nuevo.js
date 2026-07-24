// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
// ----------------------------------------------------------------------

/**
 * Modulo de Seguridad para Evaluaciones en linea
 * Version 6.2.0 -- Refactorizacion completa en espanol
 *
 * Detecta y registra violaciones de forma silenciosa (sin alert/confirm/prompt).
 * Envia periodicamente el estado al servidor y sincroniza con su respuesta.
 * Compatible con Chrome, Firefox, Safari, Edge, iOS y Android.
 */

// Clave secreta usada para firmar los datos en localStorage.
// En produccion, inyectar desde el template con un valor unico por sesion:
//   <script>var CLAVE_FIRMA_SEGURIDAD = "{{ secret_key_fragment }}";</script>
const CLAVE_FIRMA = (typeof CLAVE_FIRMA_SEGURIDAD !== 'undefined')
    ? CLAVE_FIRMA_SEGURIDAD
    : 'uteq_seguridad_evaluacion_2026';

// Tiempo entre envios periodicos al servidor (ms)
const INTERVALO_ENVIO_MS = 60000; // 60 segundos

// Tiempo maximo sin envio exitoso antes de registrar fallo sostenido (ms)
const TIEMPO_MAX_SIN_ENVIO_MS = 300000; // 5 minutos

// Etiquetas descriptivas de cada tipo de violacion (para el panel visual del HTML)
const ETIQUETAS_VIOLACION = {
    copiar:            '📋 Copiar texto (Ctrl+C)',
    pegar:             '📌 Pegar texto (Ctrl+V)',
    cortar:            '✂️ Cortar texto (Ctrl+X)',
    clicDerecho:       '🖱️ Clic derecho',
    capturaPantalla:   '📸 Captura de pantalla',
    herramientasDev:   '🛠️ Herramientas de desarrollo',
    seleccionMasiva:   '🔲 Selección masiva (Ctrl+A)',
    arrastrarSoltar:   '🤚 Arrastrar y soltar',
    cambioOrientacion: '📱 Cambio de orientación (móvil)',
    perdidaFoco:       '👁️ Dejó de interactuar con la evaluación',
    intentoImpresion:  '🖨️ Intento de imprimir',
    cambioTab:         '🔀 Cambio de pestaña/ventana',
    pestanaDuplicada:  '🪟 Pestaña duplicada',
    manipulacionDatos: '⛔ Manipulación de datos',
};

// Estructura inicial de violaciones con todos los tipos en 0
function crearEstructuraViolaciones() {
    return {
        copiar: 0,
        pegar: 0,
        cortar: 0,
        clicDerecho: 0,
        capturaPantalla: 0,
        herramientasDev: 0,
        seleccionMasiva: 0,
        arrastrarSoltar: 0,
        cambioOrientacion: 0,
        perdidaFoco: 0,
        intentoImpresion: 0,
        cambioTab: 0,
        pestanaDuplicada: 0,
        manipulacionDatos: 0,
    };
}

function normalizarSegundos(valor) {
    var n = parseInt(valor, 10);
    return isNaN(n) || n < 0 ? 0 : n;
}

function formatearDuracionSegundos(totalSegundos) {
    var segundos = normalizarSegundos(totalSegundos);
    var horas = Math.floor(segundos / 3600);
    var minutos = Math.floor((segundos % 3600) / 60);
    var resto = segundos % 60;
    if (horas > 0) {
        return horas + 'h ' + String(minutos).padStart(2, '0') + 'm ' + String(resto).padStart(2, '0') + 's';
    }
    if (minutos > 0) {
        return minutos + 'm ' + String(resto).padStart(2, '0') + 's';
    }
    return resto + 's';
}

// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
// ----------------------------------------------------------------------

/**
 * Genera un UUID v4 compatible con todos los navegadores modernos.
 * Usa crypto.getRandomValues si esta disponible; si no, usa Math.random como fallback.
 * @returns {string}
 */
function generarUUID() {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
        return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, function(c) {
            return (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16);
        });
    }
    // Fallback para contextos sin Web Crypto
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Calcula la firma SHA-256 de un texto concatenado con la CLAVE_FIRMA.
 * Requiere HTTPS (Web Crypto API). Retorna null en contextos inseguros o sin soporte.
 * @param {string} texto
 * @returns {Promise<string|null>}
 */
async function calcularFirmaSHA256(texto) {
    try {
        if (!('crypto' in window) || !('subtle' in window.crypto)) {
            return null; // API no disponible (HTTP sin TLS o navegador muy antiguo)
        }
        const encoder = new TextEncoder();
        const buffer  = await window.crypto.subtle.digest(
            'SHA-256',
            encoder.encode(texto + CLAVE_FIRMA)
        );
        return Array.from(new Uint8Array(buffer))
            .map(function(b) { return b.toString(16).padStart(2, '0'); })
            .join('');
    } catch (e) {
        console.warn('[Seguridad] No se pudo calcular firma SHA-256:', e.message);
        return null;
    }
}

/**
 * Guarda el objeto de estado de violaciones en localStorage con firma SHA-256.
 * @param {object} datos -- objeto completo del estado de la sesion
 */
async function guardarViolacionesLocal(datos) {
    try {
        if (!('localStorage' in window)) return;
        const texto = JSON.stringify(datos);
        const firma = await calcularFirmaSHA256(texto);
        localStorage.setItem('evaluacion_violaciones', texto);
        if (firma) {
            localStorage.setItem('evaluacion_violaciones_firma', firma);
        }
    } catch (e) {
        console.warn('[Seguridad] Error al guardar en localStorage:', e.message);
    }
}

/**
 * Carga el estado desde localStorage y valida la firma SHA-256.
 * Si la firma no coincide -> datos manipulados -> retorna { manipulado: true }.
 * Si no hay firma almacenada (contexto HTTP) -> retorna datos sin validar.
 * @returns {Promise<object|null>}
 */
async function cargarViolacionesLocal() {
    try {
        if (!('localStorage' in window)) return null;

        const textoGuardado = localStorage.getItem('evaluacion_violaciones');
        const firmaGuardada = localStorage.getItem('evaluacion_violaciones_firma');

        if (!textoGuardado) return null;

        const datos = JSON.parse(textoGuardado);

        // Sin firma almacenada: contexto HTTP o primera carga, retornar sin validar
        if (!firmaGuardada) return datos;

        const firmaEsperada = await calcularFirmaSHA256(textoGuardado);

        if (firmaEsperada && firmaEsperada !== firmaGuardada) {
            console.warn('[Seguridad] Firma SHA-256 inválida — posible manipulación de datos.');
            return { manipulado: true };
        }

        return datos;
    } catch (e) {
        console.warn('[Seguridad] Error al cargar desde localStorage:', e.message);
        return null;
    }
}

/**
 * Elimina todos los datos de violaciones y claves de sesion de localStorage
 * al finalizar la evaluacion correctamente.
 */
function limpiarAlmacenamientoLocal() {
    try {
        if (!('localStorage' in window)) return;
        localStorage.removeItem('evaluacion_violaciones');
        localStorage.removeItem('evaluacion_violaciones_firma');
        localStorage.removeItem('evaluacion_violaciones_ultimoenvio');
        // Limpiar claves de control de sesion duplicada para no bloquear
        // la proxima sesion legitima del mismo estudiante en este navegador.
        const urlBase   = location.href.split('?')[0];
        const claveBase = 'exam_sesion_' + btoa(urlBase).replace(/=/g, '');
        localStorage.removeItem(claveBase);
        localStorage.removeItem(claveBase + '_hb');
    } catch (e) {
        console.warn('[Seguridad] Error al limpiar localStorage:', e.message);
    }
}

// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
// ----------------------------------------------------------------------

class IntegridadEvaluacion {

    /**
     * @param {object} opciones
     * @param {number} opciones.maxViolaciones          -- Num. de violaciones para bloquear (default 50)
     * @param {string} opciones.evaluacionId            -- ID de la evaluacion (inyectar desde template)
     * @param {string} opciones.usuarioId               -- ID del usuario (inyectar desde template)
     * @param {string} opciones.idPanelIncumplimientos  -- ID del div raiz del panel (default 'incumplimientocometidos')
     */
    constructor(opciones) {
        opciones = opciones || {};

        // ----------------------------------------------------------------------
        this.config = {
            maxViolaciones:         opciones.maxViolaciones         || 50,
            evaluacionId:           opciones.evaluacionId           || '',
            usuarioId:              opciones.usuarioId              || '',
            // ID del div raiz donde se renderiza el panel de incumplimientos.
            // Permite reutilizar el modulo en cualquier plantilla de evaluacion
            // solo con poner un <div id="[ese-id]"> en el HTML correspondiente.
            idPanelIncumplimientos: opciones.idPanelIncumplimientos || 'incumplimientocometidos',
        };

        // ----------------------------------------------------------------------
        // Controles habilitados por el profesor en ControlIntegridadEvaluacion.
        // Dict {nombreViolacion: true/false}. Si es null, se monitorea todo.
        this.controlesHabilitados = opciones.controlesHabilitados || null;

        // ----------------------------------------------------------------------
        this.sesionId = generarUUID();
        this.inicio   = new Date().toISOString();

        // ----------------------------------------------------------------------
        this.estado = {
            bloqueado:             false,
            manipulado:            false,
            tabActiva:             true,
            ultimoEnvioExitoso:    null,
            _falloConexionRegistrado: false,
        };

        this.tiempoFuera = {
            totalSegundos: 0,
            perdidaFocoSegundos: 0,
            cambioTabSegundos: 0,
        };

        this._tramosTiempoFuera = {
            totalInicioMs: null,
            perdidaFocoInicioMs: null,
            cambioTabInicioMs: null,
        };

        // ----------------------------------------------------------------------
        this.violaciones      = crearEstructuraViolaciones();
        this.totalViolaciones = 0;

        // ID del SessionIntentoCuestionario actual recibido del servidor.
        // Se actualiza mediante manejarSesionIntento() / procesarRespuestaServidor().
        this._sesionIntentoIdActual = null;

        // ----------------------------------------------------------------------
        this._inicializar();
    }

    // ----------------------------------------------------------------------
    // ----------------------------------------------------------------------
    // ----------------------------------------------------------------------

    async _inicializar() {
        // (1) Detectar pestana duplicada PRIMERO (de forma sincrona).
        //    Si es duplicada, mostrar pantalla y detener toda inicializacion.
        if (this._estaHabilitado('pestanaDuplicada')) {
            if (this._verificarSesionDuplicada()) return;
        }

        // (2) Recuperar estado previo del localStorage (recarga de pagina)
        await this._recuperarEstadoPrevio();

        // (3) Registrar todos los escuchadores de eventos
        this._iniciarMonitoreoDeTeclado();
        this._iniciarMonitoreoDeRatonYPantalla();
        this._iniciarMonitoreoDeVisibilidadYFoco();
        this._iniciarHeartbeatYStorageListener();
        this._aplicarEstilosSeguridad();
        this._bloquearFuncionesPeligrosas();
        this._iniciarDeteccionHerramientasDev();

        // (4) Inicializar el panel de incumplimientos (CSS + divs + listener)
        this._iniciarPanelIncumplimientos();

        // Verificar fallo de conexion sostenido cada 60 s
        setInterval(function(self) {
            return function() { self._verificarFalloConexionSostenido(); };
        }(this), INTERVALO_ENVIO_MS);

        // Pintar el panel con los datos recuperados del localStorage.
        // Se usa setTimeout(0) para asegurarse de que el DOM ya este listo.
        setTimeout(function(self) {
            return function() {
                self._actualizarPanel(
                    self.violaciones,
                    self.totalViolaciones,
                    self._obtenerTiempoFueraSnapshot()
                );
            };
        }(this), 0);

        console.info('[Seguridad] Sistema inicializado -- sesion:', this.sesionId);
    }

    /**
     * Carga los datos previos de localStorage y los sincroniza con memoria
     * usando anti-regresion (siempre toma el valor mayor).
     *
     * IMPORTANTE: si el evaluacionId guardado es diferente al actual, significa
     * que el estudiante inicio un NUEVO intento. En ese caso se limpia el
     * localStorage y se empieza desde cero (sin arrastrar violaciones del intento anterior).
     */
    async _recuperarEstadoPrevio() {
        const datosPrevios = await cargarViolacionesLocal();
        if (!datosPrevios) return;

        // ── Nuevo intento: evaluacionId diferente al guardado ──────────────────
        // Si el ID de la evaluacion cambio, los datos del localStorage pertenecen
        // a un intento anterior. Se descartan completamente.
        if (datosPrevios.evaluacionId &&
            this.config.evaluacionId &&
            datosPrevios.evaluacionId !== this.config.evaluacionId) {
            console.info('[Seguridad] Nuevo intento detectado — limpiando localStorage del intento anterior.');
            limpiarAlmacenamientoLocal();
            return; // Empezar desde cero
        }

        // Datos manipulados externamente
        if (datosPrevios.manipulado === true) {
            this._registrarViolacion('manipulacionDatos');
            this._bloquearEvaluacion();
            return;
        }

        // Sincronizar contadores (anti-regresion): solo si es el MISMO intento
        if (datosPrevios.violaciones) {
            for (const tipo in this.violaciones) {
                const previo = datosPrevios.violaciones[tipo] || 0;
                if (previo > this.violaciones[tipo]) {
                    this.violaciones[tipo] = previo;
                }
            }
        }
        if ((datosPrevios.totalViolaciones || 0) > this.totalViolaciones) {
            this.totalViolaciones = datosPrevios.totalViolaciones;
        }
        if (datosPrevios.ultimoEnvioExitoso) {
            this.estado.ultimoEnvioExitoso = datosPrevios.ultimoEnvioExitoso;
        }
        if (datosPrevios.bloqueado) {
            this._bloquearEvaluacion();
        }

        var tiempoPrevio = datosPrevios.tiempoFuera || {};
        this.tiempoFuera.totalSegundos = Math.max(
            this.tiempoFuera.totalSegundos,
            normalizarSegundos(tiempoPrevio.totalSegundos)
        );
        this.tiempoFuera.perdidaFocoSegundos = Math.max(
            this.tiempoFuera.perdidaFocoSegundos,
            normalizarSegundos(tiempoPrevio.perdidaFocoSegundos)
        );
        this.tiempoFuera.cambioTabSegundos = Math.max(
            this.tiempoFuera.cambioTabSegundos,
            normalizarSegundos(tiempoPrevio.cambioTabSegundos)
        );
    }

    // ----------------------------------------------------------------------
    // ----------------------------------------------------------------------
    // ----------------------------------------------------------------------

    /**
     * Registra una violacion del tipo indicado de forma silenciosa.
     * Flujo: actualiza memoria -> persiste en localStorage -> dispara CustomEvent.
     * @param {string} tipo -- clave del tipo de violacion (debe existir en crearEstructuraViolaciones)
     */
    _registrarViolacion(tipo) {
        if (this.estado.bloqueado) return;

        // Verificar que el tipo sea valido
        if (!(tipo in this.violaciones)) {
            console.warn('[Seguridad] Tipo de violación desconocido ignorado:', tipo);
            return;
        }

        // Verificar que el tipo esté habilitado en ControlIntegridadEvaluacion
        if (this.controlesHabilitados && !this.controlesHabilitados[tipo]) {
            return; // Control no habilitado por el profesor, ignorar silenciosamente
        }

        // (1) Actualizar en memoria
        this.violaciones[tipo]++;
        this.totalViolaciones++;

        console.info('[Seguridad] Violación — tipo:', tipo, '| total:', this.totalViolaciones);

        // (2) Persistir en localStorage de forma asincrona
        this._persistirEstado();

        // (3) Disparar CustomEvent para que el panel HTML se actualice en tiempo real
        try {
            const evento = new CustomEvent('violacionRegistrada', {
                detail: {
                    tipo:       tipo,
                    conteo:     this.violaciones[tipo],
                    total:      this.totalViolaciones,
                    violaciones: Object.assign({}, this.violaciones),
                    tiempoFuera: this._obtenerTiempoFueraSnapshot(),
                },
                bubbles: true,
            });
            document.dispatchEvent(evento);
        } catch (e) {
            // CustomEvent no disponible en navegadores muy antiguos; ignorar
        }

        // (4) Sin bloqueo automatico: solo se registran las violaciones para su seguimiento.
        //    El bloqueo unicamente ocurre si el servidor lo indica o hay manipulacion de datos.
    }

    /**
     * Construye el payload completo y lo guarda en localStorage.
     */
    async _persistirEstado() {
        const datos = this._construirPayload('local');
        await guardarViolacionesLocal(datos);
    }

    /**
     * Construye el objeto con la estructura del contrato JSON definido.
     * @param {string} tipoEnvio -- 'periodico' | 'final' | 'manipulacion' | 'bloqueo' | 'local'
     * @returns {object}
     */
    _construirPayload(tipoEnvio) {
        var tiempoFuera = this._obtenerTiempoFueraSnapshot();
        return {
            sesionId:           this.sesionId,
            evaluacionId:       this.config.evaluacionId,
            usuarioId:          this.config.usuarioId,
            inicio:             this.inicio,
            ultimoEnvioExitoso: this.estado.ultimoEnvioExitoso,
            timestamp:          new Date().toISOString(),
            tipoEnvio:          tipoEnvio,
            bloqueado:          this.estado.bloqueado,
            manipulado:         this.estado.manipulado,
            violaciones:        Object.assign({}, this.violaciones),
            totalViolaciones:   this.totalViolaciones,
            tiempoFuera:        tiempoFuera,
        };
    }

    _obtenerTiempoFueraSnapshot() {
        var ahora = Date.now();
        var total = this.tiempoFuera.totalSegundos;
        var foco = this.tiempoFuera.perdidaFocoSegundos;
        var tab = this.tiempoFuera.cambioTabSegundos;

        if (this._tramosTiempoFuera.totalInicioMs !== null) {
            total += Math.floor((ahora - this._tramosTiempoFuera.totalInicioMs) / 1000);
        }
        if (this._tramosTiempoFuera.perdidaFocoInicioMs !== null) {
            foco += Math.floor((ahora - this._tramosTiempoFuera.perdidaFocoInicioMs) / 1000);
        }
        if (this._tramosTiempoFuera.cambioTabInicioMs !== null) {
            tab += Math.floor((ahora - this._tramosTiempoFuera.cambioTabInicioMs) / 1000);
        }

        return {
            totalSegundos: normalizarSegundos(total),
            perdidaFocoSegundos: normalizarSegundos(foco),
            cambioTabSegundos: normalizarSegundos(tab),
        };
    }

    _cambiarEstadoTiempoFuera(motivo, estaActivo) {
        var claveInicio = motivo + 'InicioMs';
        if (!(claveInicio in this._tramosTiempoFuera)) return;

        var ahora = Date.now();
        var inicioActual = this._tramosTiempoFuera[claveInicio];

        if (estaActivo && inicioActual === null) {
            this._tramosTiempoFuera[claveInicio] = ahora;
        } else if (!estaActivo && inicioActual !== null) {
            var segundosMotivo = Math.floor((ahora - inicioActual) / 1000);
            if (motivo === 'perdidaFoco') {
                this.tiempoFuera.perdidaFocoSegundos += normalizarSegundos(segundosMotivo);
            } else if (motivo === 'cambioTab') {
                this.tiempoFuera.cambioTabSegundos += normalizarSegundos(segundosMotivo);
            }
            this._tramosTiempoFuera[claveInicio] = null;
        }

        var fueraPorFoco = this._tramosTiempoFuera.perdidaFocoInicioMs !== null;
        var fueraPorTab = this._tramosTiempoFuera.cambioTabInicioMs !== null;
        var estaFuera = fueraPorFoco || fueraPorTab;

        if (estaFuera && this._tramosTiempoFuera.totalInicioMs === null) {
            this._tramosTiempoFuera.totalInicioMs = ahora;
        } else if (!estaFuera && this._tramosTiempoFuera.totalInicioMs !== null) {
            var segundosTotal = Math.floor((ahora - this._tramosTiempoFuera.totalInicioMs) / 1000);
            this.tiempoFuera.totalSegundos += normalizarSegundos(segundosTotal);
            this._tramosTiempoFuera.totalInicioMs = null;
            this._persistirEstado();
        }
    }

    sincronizarTiempoFueraDesdeServidor(tiempoFueraConfirmado) {
        if (!tiempoFueraConfirmado || typeof tiempoFueraConfirmado !== 'object') return;

        var huboCambio = false;
        var snapshot = this._obtenerTiempoFueraSnapshot();
        var estabaTotalActivo = this._tramosTiempoFuera.totalInicioMs !== null;
        var estabaFocoActivo = this._tramosTiempoFuera.perdidaFocoInicioMs !== null;
        var estabaTabActivo = this._tramosTiempoFuera.cambioTabInicioMs !== null;
        var ahora = Date.now();
        var totalServidor = normalizarSegundos(tiempoFueraConfirmado.totalSegundos);
        var focoServidor = normalizarSegundos(tiempoFueraConfirmado.perdidaFocoSegundos);
        var tabServidor = normalizarSegundos(tiempoFueraConfirmado.cambioTabSegundos);

        if (totalServidor > snapshot.totalSegundos) {
            this.tiempoFuera.totalSegundos = totalServidor;
            this._tramosTiempoFuera.totalInicioMs = estabaTotalActivo ? ahora : null;
            huboCambio = true;
        }
        if (focoServidor > snapshot.perdidaFocoSegundos) {
            this.tiempoFuera.perdidaFocoSegundos = focoServidor;
            this._tramosTiempoFuera.perdidaFocoInicioMs = estabaFocoActivo ? ahora : null;
            huboCambio = true;
        }
        if (tabServidor > snapshot.cambioTabSegundos) {
            this.tiempoFuera.cambioTabSegundos = tabServidor;
            this._tramosTiempoFuera.cambioTabInicioMs = estabaTabActivo ? ahora : null;
            huboCambio = true;
        }

        if (huboCambio) {
            this._persistirEstado();
            this._actualizarPanel(this.violaciones, this.totalViolaciones, this._obtenerTiempoFueraSnapshot());
        }
    }

    // ----------------------------------------------------------------------
    // ----------------------------------------------------------------------
    // ----------------------------------------------------------------------

    /**
     * Verifica si han pasado mas de 5 minutos sin un envio exitoso.
     * Registra en consola para el administrador (no es violacion del alumno).
     */
    _verificarFalloConexionSostenido() {
        if (!this.estado.ultimoEnvioExitoso) return;

        const msSinEnvio = Date.now() - new Date(this.estado.ultimoEnvioExitoso).getTime();

        if (msSinEnvio > TIEMPO_MAX_SIN_ENVIO_MS) {
            if (!this.estado._falloConexionRegistrado) {
                this.estado._falloConexionRegistrado = true;
                console.warn('[Seguridad] Fallo de conexión sostenido por más de 5 minutos.');
            }
        } else {
            this.estado._falloConexionRegistrado = false;
        }
    }


    // ----------------------------------------------------------------------
    // ----------------------------------------------------------------------
    // ----------------------------------------------------------------------

    /**
     * Verifica de forma SINCRONA e INMEDIATA si ya existe otra pestana activa
     * con la misma evaluacion. Se llama como primer paso en _inicializar().
     *
     * Si hay duplicacion: registra la violacion, muestra la pantalla de duplicacion
     * y retorna true (la inicializacion debe detenerse).
     * Si no hay duplicacion: toma el control de la sesion y retorna false.
     *
     * @returns {boolean} -- true si es pestana duplicada
     */
    _verificarSesionDuplicada() {
        if (!('localStorage' in window)) return false;

        const urlBase        = location.href.split('?')[0];
        const claveBase      = 'exam_sesion_'    + btoa(urlBase).replace(/=/g, '');
        const claveHeartbeat = claveBase          + '_hb';
        const claveBloqueada = 'exam_bloqueada_' + btoa(urlBase).replace(/=/g, '');
        const claveNotif     = claveBase          + '_dup_notif';
        const ahora          = Date.now();

        // (A) Esta pestana ya fue marcada como duplicada en sessionStorage.
        //     PERO antes de bloquear, verificar si la pestana original todavia
        //     esta activa consultando su heartbeat en localStorage.
        //     Si el heartbeat expiro (> 6 s sin actualizar), la original se cerro:
        //     limpiar la marca y dejar que esta pestana tome el control.
        if ('sessionStorage' in window && sessionStorage.getItem(claveBloqueada) === '1') {
            const ultimoHbA = localStorage.getItem(claveHeartbeat);
            const originalSigueActiva = ultimoHbA &&
                                        (ahora - parseInt(ultimoHbA, 10)) < 6000;

            if (!originalSigueActiva) {
                // La pestana original ya no esta: limpiar bloqueo y tomar control
                sessionStorage.removeItem(claveBloqueada);
                // Continuar hacia el bloque de toma de control al final del metodo
            } else {
                // La original sigue activa: mantener bloqueo y re-notificar
                localStorage.setItem(claveNotif, ahora.toString());
                this._mostrarPantallaSesionDuplicada();
                return true;
            }
        }

        const tokenExistente = localStorage.getItem(claveBase);
        const ultimoHb       = localStorage.getItem(claveHeartbeat);

        // (B) Hay otra pestana activa con heartbeat reciente (< 6 s)
        if (tokenExistente && tokenExistente !== this.sesionId) {
            if (ultimoHb && (ahora - parseInt(ultimoHb, 10)) < 6000) {
                // Marcar esta pestana como bloqueada en sessionStorage
                if ('sessionStorage' in window) {
                    sessionStorage.setItem(claveBloqueada, '1');
                }
                // Notificar a la pestana original para que registre la violacion
                localStorage.setItem(claveNotif, ahora.toString());
                this._mostrarPantallaSesionDuplicada();
                return true;
            }
        }

        // Esta pestana toma el control de la sesion
        this._claveBaseSesion      = claveBase;
        this._claveHeartbeatSesion = claveHeartbeat;
        this._claveNotifSesion     = claveNotif;
        localStorage.setItem(claveBase, this.sesionId);
        localStorage.setItem(claveHeartbeat, ahora.toString());
        return false;
    }

    /**
     * Activa el heartbeat periodico y el listener del evento 'storage'
     * para detectar si otra pestana intenta abrir la misma evaluacion
     * mientras esta ya esta activa.
     * Se llama despues de confirmar que no hay duplicacion.
     */
    _iniciarHeartbeatYStorageListener() {
        if (!('localStorage' in window)) return;

        const claveBase      = this._claveBaseSesion;
        const claveHeartbeat = this._claveHeartbeatSesion;
        const claveNotif     = this._claveNotifSesion;
        const tokenActual    = this.sesionId;
        const self           = this;

        if (!claveBase) return;

        // Heartbeat activo cada 2 s SIEMPRE (sin importar visibilidad/foco)
        const intervaloHb = setInterval(function() {
            localStorage.setItem(claveHeartbeat, Date.now().toString());
        }, 2000);

        window.addEventListener('storage', function(e) {
            // Caso 1: otra pestana escribio su token en claveBase
            // (primera duplicacion sin sessionStorage previo)
            if (e.key === claveBase && e.newValue && e.newValue !== tokenActual) {
                const hb = localStorage.getItem(claveHeartbeat);
                // Ventana amplia de 8 s para cubrir arranques lentos de la duplicada
                if (hb && (Date.now() - parseInt(hb, 10)) < 8000) {
                    self._registrarViolacion('pestanaDuplicada');
                }
            }

            // Caso 2: la pestana duplicada escribio la clave de notificacion
            // (primera duplicacion Y recargas posteriores de la duplicada)
            if (e.key === claveNotif && e.newValue) {
                self._registrarViolacion('pestanaDuplicada');
            }
        });

        // Limpiar al salir
        window.addEventListener('beforeunload', function() {
            localStorage.removeItem(claveBase);
            localStorage.removeItem(claveHeartbeat);
            if (claveNotif) localStorage.removeItem(claveNotif);
            clearInterval(intervaloHb);
        });
    }

    // ----------------------------------------------------------------------
    // ----------------------------------------------------------------------
    // ----------------------------------------------------------------------

    _iniciarMonitoreoDeTeclado() {
        const self = this;

        // capture:true para interceptar antes que cualquier otro manejador de la pagina
        document.addEventListener('keydown', function(e) {
            const tecla  = e.key  || '';
            const codigo = e.code || '';

            // ----------------------------------------------------------------------
            if (tecla === 'PrintScreen' || codigo === 'PrintScreen') {
                if (self._estaHabilitado('capturaPantalla')) {
                    self._registrarViolacion('capturaPantalla');
                    self._prevenirEvento(e);
                }
                return;
            }

            // ----------------------------------------------------------------------
            if (tecla === 'F12') {
                if (self._estaHabilitado('herramientasDev')) {
                    self._registrarViolacion('herramientasDev');
                    self._prevenirEvento(e);
                }
                return;
            }

            // ----------------------------------------------------------------------
            if (/^F([1-9]|1[01])$/.test(tecla)) {
                self._prevenirEvento(e);
                return;
            }

            // ----------------------------------------------------------------------
            if (tecla === 'Escape') {
                self._prevenirEvento(e);
                return;
            }

            // ----------------------------------------------------------------------
            if (e.ctrlKey || e.metaKey) {

                // Ctrl+P -> imprimir
                if (codigo === 'KeyP') {
                    if (self._estaHabilitado('intentoImpresion')) {
                        self._registrarViolacion('intentoImpresion');
                        self._prevenirEvento(e);
                    }
                    return;
                }
                // Ctrl+S -> guardar pagina
                if (codigo === 'KeyS') {
                    self._prevenirEvento(e);
                    return;
                }
                // Ctrl+U -> ver codigo fuente
                if (codigo === 'KeyU') {
                    if (self._estaHabilitado('herramientasDev')) {
                        self._registrarViolacion('herramientasDev');
                        self._prevenirEvento(e);
                    }
                    return;
                }
                // Ctrl+A -> seleccion masiva
                if (codigo === 'KeyA') {
                    if (self._estaHabilitado('seleccionMasiva')) {
                        self._registrarViolacion('seleccionMasiva');
                        self._prevenirEvento(e);
                    }
                    return;
                }
                // Ctrl+C -> copiar (solo bloqueado fuera de campos de texto)
                if (codigo === 'KeyC') {
                    if (!self._esCampoDeTextoActivo() && self._estaHabilitado('copiar')) {
                        self._registrarViolacion('copiar');
                        self._prevenirEvento(e);
                    }
                    return;
                }
                // Ctrl+X -> cortar (solo bloqueado fuera de campos de texto)
                if (codigo === 'KeyX') {
                    if (!self._esCampoDeTextoActivo() && self._estaHabilitado('cortar')) {
                        self._registrarViolacion('cortar');
                        self._prevenirEvento(e);
                    }
                    return;
                }
                // Ctrl+V -> pegar (solo bloqueado fuera de campos de texto)
                if (codigo === 'KeyV') {
                    if (!self._esCampoDeTextoActivo() && self._estaHabilitado('pegar')) {
                        self._registrarViolacion('pegar');
                        self._prevenirEvento(e);
                    }
                    return;
                }
                // Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+Shift+C -> inspector/consola
                if (e.shiftKey && (codigo === 'KeyI' || codigo === 'KeyJ' || codigo === 'KeyC')) {
                    if (self._estaHabilitado('herramientasDev')) {
                        self._registrarViolacion('herramientasDev');
                        self._prevenirEvento(e);
                    }
                    return;
                }
                // Ctrl++/- / Ctrl+0 -> zoom con teclado
                const codigosZoom = [61, 107, 173, 109, 187, 189, 48];
                if (codigosZoom.indexOf(e.keyCode || e.which) !== -1) {
                    self._prevenirEvento(e);
                    return;
                }
                // Bloquear cualquier otra combinacion Ctrl/Cmd no explicitamente permitida
                self._prevenirEvento(e);
                return;
            }

            // ----------------------------------------------------------------------
            if (e.altKey) {
                self._prevenirEvento(e);
            }

        }, true);

        // ----------------------------------------------------------------------
        if ('onbeforeprint' in window) {
            window.addEventListener('beforeprint', function() {
                if (self._estaHabilitado('intentoImpresion')) {
                    self._registrarViolacion('intentoImpresion');
                }
            });
        }

        // ----------------------------------------------------------------------
        document.addEventListener('wheel', function(e) {
            if (e.ctrlKey || e.metaKey) {
                self._prevenirEvento(e);
            }
        }, { passive: false });
    }

    // ----------------------------------------------------------------------
    // ----------------------------------------------------------------------
    // ----------------------------------------------------------------------

    _iniciarMonitoreoDeRatonYPantalla() {
        const self = this;

        // Variables compartidas entre contextmenu y touchstart para evitar doble conteo.
        var longPressTimer      = null;
        var longPressRegistrado = false;

        // contextmenu: clic derecho en escritorio y long-press en la mayoría de móviles.
        // No se cuenta dentro de campos de texto para evitar falsos positivos en móvil
        // (el estudiante hace long-press en el textarea para seleccionar su respuesta).
        document.addEventListener('contextmenu', function(e) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
            if (!longPressRegistrado) {
                if (self._estaHabilitado('clicDerecho') && !self._esCampoDeTextoActivo()) {
                    self._registrarViolacion('clicDerecho');
                }
            }
            longPressRegistrado = false;
            self._prevenirEvento(e);
        });

        // Long-press táctil: fallback para dispositivos donde contextmenu no dispara.
        // Solo se activa en móvil y si el control clicDerecho está habilitado.
        if (/android|iphone|ipad|ipod/i.test(navigator.userAgent.toLowerCase()) &&
            self._estaHabilitado('clicDerecho')) {
            document.addEventListener('touchstart', function(e) {
                if (self._esCampoDeTextoActivo()) return;
                longPressRegistrado = false;
                longPressTimer = setTimeout(function() {
                    longPressTimer      = null;
                    longPressRegistrado = true; // Evita doble conteo si contextmenu dispara luego
                    self._registrarViolacion('clicDerecho');
                }, 600);
            }, { passive: true });

            ['touchend', 'touchmove', 'touchcancel'].forEach(function(ev) {
                document.addEventListener(ev, function() {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                });
            });
        }

        // ----------------------------------------------------------------------
        document.addEventListener('copy', function(e) {
            if (!self._esCampoDeTextoActivo() && self._estaHabilitado('copiar')) {
                self._registrarViolacion('copiar');
                self._prevenirEvento(e);
            }
        });
        document.addEventListener('cut', function(e) {
            if (!self._esCampoDeTextoActivo() && self._estaHabilitado('cortar')) {
                self._registrarViolacion('cortar');
                self._prevenirEvento(e);
            }
        });
        document.addEventListener('paste', function(e) {
            if (!self._esCampoDeTextoActivo() && self._estaHabilitado('pegar')) {
                self._registrarViolacion('pegar');
                self._prevenirEvento(e);
            }
        });

        // ----------------------------------------------------------------------
        document.addEventListener('dragstart', function(e) {
            if (self._estaHabilitado('arrastrarSoltar')) {
                self._registrarViolacion('arrastrarSoltar');
                self._prevenirEvento(e);
            }
        });
        document.addEventListener('drop', function(e) {
            if (self._estaHabilitado('arrastrarSoltar')) {
                self._registrarViolacion('arrastrarSoltar');
                self._prevenirEvento(e);
            }
        });
        document.addEventListener('dragover', function(e) {
            if (self._estaHabilitado('arrastrarSoltar')) {
                self._prevenirEvento(e);
            }
        });

        // ----------------------------------------------------------------------
        document.addEventListener('selectstart', function(e) {
            if (!self._esCampoDeTextoActivo()) {
                self._prevenirEvento(e);
            }
        });

        // ----------------------------------------------------------------------
        if ('onorientationchange' in window) {
            window.addEventListener('orientationchange', function() {
                if (self._estaHabilitado('cambioOrientacion')) {
                    self._registrarViolacion('cambioOrientacion');
                }
            });
        }
    }

    // ----------------------------------------------------------------------
    // ----------------------------------------------------------------------
    // ----------------------------------------------------------------------

    _iniciarMonitoreoDeVisibilidadYFoco() {
        const self      = this;
        let estabaOculta  = false;
        // Evita que visibilitychange disparado durante recarga/navegación cuente como cambioTab.
        let navegandoFuera = false;

        /**
         * Detecta cambio de pestana o minimizacion de ventana.
         * Registra 'cambioTab' cuando la pagina se oculta.
         */
        function manejarCambioVisibilidad() {
            // Si la página está siendo descargada (F5, link, back), ignorar.
            if (navegandoFuera) return;

            const estaOculta = document.hidden ||
                               document.webkitHidden ||
                               document.msHidden ||
                               false;

            if (estaOculta && !estabaOculta) {
                estabaOculta           = true;
                self.estado.tabActiva = false;
                if (self._estaHabilitado('cambioTab')) {
                    self._registrarViolacion('cambioTab');
                }
                self._cambiarEstadoTiempoFuera('cambioTab', true);
            } else if (!estaOculta && estabaOculta) {
                estabaOculta           = false;
                self.estado.tabActiva = true;
                self._cambiarEstadoTiempoFuera('cambioTab', false);
            }
        }

        // Registrar en todos los prefijos de navegador
        ['visibilitychange', 'webkitvisibilitychange', 'msvisibilitychange'].forEach(function(ev) {
            document.addEventListener(ev, manejarCambioVisibilidad);
        });

        // Oscurecer .vistapregunta al perder el foco
        window.addEventListener('blur', function() {
            if (self._estaHabilitado('perdidaFoco')) {
                self._registrarViolacion('perdidaFoco');
            }
            self.estado.tabActiva = false;
            self._cambiarEstadoTiempoFuera('perdidaFoco', true);
            self._oscurecerVistaPregunta(true);

            // Fallback: algunos navegadores no disparan visibilitychange al cambiar de pestaña
            // pero sí disparan blur. Se verifica 150ms después si la página quedó oculta.
            setTimeout(function() {
                if (!navegandoFuera && (document.hidden || document.webkitHidden || document.msHidden)) {
                    manejarCambioVisibilidad();
                }
            }, 150);
        });

        window.addEventListener('focus', function() {
            navegandoFuera         = false; // Cancelación de navegación: restablecer bandera
            self.estado.tabActiva = true;
            self._cambiarEstadoTiempoFuera('perdidaFoco', false);
            self._oscurecerVistaPregunta(false);
        });

        // beforeunload se dispara antes de visibilitychange en navegaciones (F5, links, etc.)
        // Marcar navegandoFuera para ignorar el visibilitychange del unload.
        window.addEventListener('beforeunload', function() {
            navegandoFuera = true;
            self._cambiarEstadoTiempoFuera('perdidaFoco', false);
            self._cambiarEstadoTiempoFuera('cambioTab', false);
        });
    }

    // ----------------------------------------------------------------------
    // ----------------------------------------------------------------------
    // ----------------------------------------------------------------------

    /**
     * Detecta apertura de DevTools mediante diferencia de tamano de ventana.
     * Es el metodo mas confiable y compatible cross-browser (sin usar debugger).
     * No aplica en dispositivos moviles donde la diferencia es falsa.
     */
    _iniciarDeteccionHerramientasDev() {
        if (!this._estaHabilitado('herramientasDev')) return; // No habilitado

        const self   = this;
        const UA     = navigator.userAgent.toLowerCase();
        const esMobil = /android|iphone|ipad|ipod/i.test(UA);

        if (esMobil) return; // No confiable en móviles

        let devToolsAbierto = false;
        const UMBRAL_PX     = 160; // px de diferencia considerado como DevTools abierto

        function verificarDevTools() {
            try {
                if (document.hidden || !document.hasFocus()) return;

                const anchoDif = window.outerWidth  - window.innerWidth;
                const altoDif  = window.outerHeight - window.innerHeight;
                const abierto  = anchoDif > UMBRAL_PX || altoDif > UMBRAL_PX;

                if (abierto && !devToolsAbierto) {
                    devToolsAbierto = true;
                    self._registrarViolacion('herramientasDev');
                } else if (!abierto && devToolsAbierto) {
                    devToolsAbierto = false;
                }
            } catch (e) {
                // Ignorar errores de acceso a propiedades de ventana
            }
        }

        setInterval(verificarDevTools, 3000);
    }

    // ----------------------------------------------------------------------
    // ----------------------------------------------------------------------
    // ----------------------------------------------------------------------

    /**
     * Bloquea la evaluacion de forma controlada reemplazando el body.
     * Solo se ejecuta una vez (comprueba this.estado.bloqueado).
     */
    _bloquearEvaluacion() {
        if (this.estado.bloqueado) return;
        this.estado.bloqueado = true;

        console.warn('[Seguridad] Evaluación bloqueada. Total violaciones:', this.totalViolaciones);

        document.body.innerHTML =
            '<div style="position:fixed;top:0;left:0;width:100vw;height:100vh;' +
            'background:#f5f5f5;display:flex;justify-content:center;align-items:center;' +
            'font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;z-index:999999;">' +
            '<div style="background:#fff;padding:40px;border-radius:8px;text-align:center;' +
            'max-width:520px;margin:20px;border:1px solid #e0e0e0;border-top:4px solid #7f1d1d;' +
            'box-shadow:0 8px 32px rgba(0,0,0,0.08);">' +
            '<div style="font-size:3.5rem;margin-bottom:16px;">&#9940;</div>' +
            '<h1 style="color:#7f1d1d;margin:0 0 12px 0;font-size:1.4rem;font-weight:700;letter-spacing:0.5px;">EVALUACIÓN SUSPENDIDA</h1>' +
            '<p style="color:#5a5a5a;margin-bottom:20px;font-size:0.95rem;line-height:1.6;">' +
            'Se han detectado violaciones de seguridad.<br>' +
            'La evaluación ha sido suspendida automáticamente.</p>' +
            '<p style="color:#aaa;font-size:0.82rem;padding-top:16px;border-top:1px solid #e0e0e0;">' +
            'Contacte con su instructor para más información.<br>' +
            '<strong style="color:#5a5a5a;">Sesión:</strong> ' + this.sesionId + '</p>' +
            '</div></div>';
    }

    /**
     * Muestra la pantalla de sesion duplicada.
     * Incluye un vigilante que detecta cuando la pestana original se cierra
     * y libera automaticamente esta pestana mostrando un boton de recarga.
     */
    _mostrarPantallaSesionDuplicada() {
        const urlBase        = location.href.split('?')[0];
        const claveBase      = 'exam_sesion_'    + btoa(urlBase).replace(/=/g, '');
        const claveHeartbeat = claveBase          + '_hb';
        const claveBloqueada = 'exam_bloqueada_' + btoa(urlBase).replace(/=/g, '');

        document.body.innerHTML =
            '<div id="seg-dup-overlay" style="position:fixed;top:0;left:0;width:100vw;height:100vh;' +
            'background:#f5f5f5;display:flex;justify-content:center;align-items:center;' +
            'font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;z-index:999999;">' +
            '<div style="background:#fff;padding:36px 40px;border-radius:8px;border:1px solid #e8e8e8;' +
            'border-top:4px solid #5a9e78;box-shadow:0 4px 20px rgba(0,0,0,0.07);text-align:center;max-width:480px;margin:20px;">' +
            '<div style="font-size:3rem;margin-bottom:12px;">&#128683;</div>' +
            '<h1 id="seg-dup-titulo" style="color:#2c2c2c;margin:0 0 12px 0;font-size:1.35rem;font-weight:700;letter-spacing:0.3px;">' +
            'EVALUACI&Oacute;N DUPLICADA</h1>' +
            '<p id="seg-dup-mensaje" style="color:#707070;font-size:0.92rem;line-height:1.65;margin-bottom:18px;">' +
            'Esta evaluaci&oacute;n ya est&aacute; abierta en otra pesta&ntilde;a o ventana.<br>' +
            'Solo se permite <strong style="color:#2c2c2c;">una sesi&oacute;n activa</strong> por estudiante.</p>' +
            '<div id="seg-dup-instruccion" style="background:#fafafa;border:1px solid #e8e8e8;padding:12px 16px;' +
            'border-radius:6px;margin-bottom:18px;text-align:left;border-left:3px solid #5a9e78;">' +
            '<strong style="color:#2c2c2c;">&#9888; Acci&oacute;n requerida:</strong><br>' +
            '<span style="color:#707070;font-size:0.88rem;">Cierre <u>esta pesta&ntilde;a</u> y contin&uacute;e<br>' +
            'en la pesta&ntilde;a donde la evaluaci&oacute;n ya estaba abierta.</span>' +
            '</div>' +
            '<p id="seg-dup-footer" style="color:#bbb;font-size:0.8rem;margin:0;">' +
            'Verificando estado de la otra sesi&oacute;n...' +
            '</p>' +
            '</div></div>';

        // Vigilar cada 3 s si la pestana original sigue activa.
        // Cuando su heartbeat expira, liberar esta pestana automaticamente.
        var intervaloVigilancia = setInterval(function() {
            var ultimoHb = localStorage.getItem(claveHeartbeat);
            var ahora    = Date.now();
            var sigueActiva = ultimoHb && (ahora - parseInt(ultimoHb, 10)) < 6000;

            if (!sigueActiva) {
                // La pestana original se cerro: limpiar bloqueo y mostrar liberacion
                clearInterval(intervaloVigilancia);
                if ('sessionStorage' in window) {
                    sessionStorage.removeItem(claveBloqueada);
                }

                // Actualizar la pantalla para indicar que ya puede continuar
                var titulo      = document.getElementById('seg-dup-titulo');
                var mensaje     = document.getElementById('seg-dup-mensaje');
                var instruccion = document.getElementById('seg-dup-instruccion');
                var footer      = document.getElementById('seg-dup-footer');
                var overlay     = document.getElementById('seg-dup-overlay');

                if (titulo)      titulo.style.color   = '#3d8b5c';
                if (titulo)      titulo.innerHTML      = '&#10003; SESI&Oacute;N LIBERADA';
                if (overlay)     overlay.style.background = '#f5f5f5';
                if (mensaje)     mensaje.innerHTML     =
                    'La otra sesi&oacute;n ha sido cerrada.<br>' +
                    'Ya puedes continuar tu evaluaci&oacute;n en esta pesta&ntilde;a.';
                if (instruccion) instruccion.style.display = 'none';
                if (footer)      footer.innerHTML =
                    '<button onclick="location.reload()" ' +
                    'style="background:#1c1c1c;color:#fff;border:none;padding:10px 28px;' +
                    'border-radius:6px;font-size:0.95rem;cursor:pointer;font-weight:600;' +
                    'box-shadow:0 2px 8px rgba(0,0,0,0.20);">' +
                    '&#8635; Continuar evaluaci&oacute;n</button>';
            }
        }, 3000);
    }

    // ----------------------------------------------------------------------
    // ----------------------------------------------------------------------
    // ----------------------------------------------------------------------

    /**
     * Oscurece o libera el panel .vistapregunta segun el foco de la ventana.
     * Inyecta el CSS de transicion la primera vez (una sola vez via data-attr).
     * @param {boolean} oscurecer -- true para oscurecer, false para liberar
     */
    _oscurecerVistaPregunta(oscurecer) {
        // Inyectar CSS de la capa solo la primera vez
        if (!document.getElementById('seg-blur-css')) {
            var css = document.createElement('style');
            css.id  = 'seg-blur-css';
            css.textContent = [
                '@keyframes seg-fadeInDown {',
                '    from { opacity: 0; transform: translateY(-18px) scale(0.97); }',
                '    to   { opacity: 1; transform: translateY(0)   scale(1);    }',
                '}',
                '@keyframes seg-pulse {',
                '    0%, 100% { transform: scale(1); }',
                '    50%      { transform: scale(1.12); }',
                '}',
                '.vistapregunta {',
                '    position: relative;',
                '}',
                '#seg-blur-overlay {',
                '    position: absolute;',
                '    inset: 0;',
                '    background: linear-gradient(135deg, rgba(245,245,245,0.97) 0%, rgba(255,255,255,0.98) 100%);',
                '    backdrop-filter: blur(8px);',
                '    -webkit-backdrop-filter: blur(8px);',
                '    z-index: 9000;',
                '    display: flex;',
                '    flex-direction: column;',
                '    justify-content: center;',
                '    align-items: center;',
                '    border-radius: 6px;',
                '    opacity: 0;',
                '    pointer-events: none;',
                '    user-select: none;',
                '    transition: opacity 0.25s ease;',
                '}',
                '#seg-blur-overlay.visible {',
                '    opacity: 1;',
                '    pointer-events: all;',
                '}',
                '#seg-blur-overlay .seg-blur-tarjeta {',
                '    background: #ffffff;',
                '    border: 1px solid #e8e8e8;',
                '    border-top: 4px solid #5a9e78;',
                '    border-radius: 8px;',
                '    box-shadow: 0 8px 32px rgba(0,0,0,0.10), 0 1.5px 6px rgba(0,0,0,0.05);',
                '    padding: 36px 44px 30px;',
                '    display: flex;',
                '    flex-direction: column;',
                '    align-items: center;',
                '    max-width: 420px;',
                '    width: 90%;',
                '    animation: seg-fadeInDown 0.35s cubic-bezier(.4,0,.2,1) both;',
                '}',
                '#seg-blur-overlay .seg-blur-badge {',
                '    background: #f0f0f0;',
                '    border: 1px solid #d8d8d8;',
                '    color: #555;',
                '    font-size: 0.72rem;',
                '    font-weight: 700;',
                '    letter-spacing: 1.5px;',
                '    text-transform: uppercase;',
                '    border-radius: 20px;',
                '    padding: 3px 14px;',
                '    margin-bottom: 18px;',
                '    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;',
                '}',
                '#seg-blur-overlay .seg-blur-icono {',
                '    font-size: 3.4rem;',
                '    margin-bottom: 16px;',
                '    animation: seg-pulse 1.8s ease-in-out infinite;',
                '    line-height: 1;',
                '}',
                '#seg-blur-overlay .seg-blur-titulo {',
                '    color: #2c2c2c;',
                '    font-size: 1.15rem;',
                '    font-weight: 700;',
                '    margin: 0 0 10px 0;',
                '    letter-spacing: 0.2px;',
                '    text-align: center;',
                '    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;',
                '}',
                '#seg-blur-overlay .seg-blur-sub {',
                '    color: #5a5a5a;',
                '    font-size: 0.9rem;',
                '    margin: 0 0 22px 0;',
                '    text-align: center;',
                '    line-height: 1.55;',
                '    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;',
                '}',
                '#seg-blur-overlay .seg-blur-hint {',
                '    display: flex;',
                '    align-items: center;',
                '    gap: 7px;',
                '    background: #f5f5f5;',
                '    border: 1px solid #e0e0e0;',
                '    border-radius: 6px;',
                '    padding: 8px 16px;',
                '    font-size: 0.8rem;',
                '    color: #5a5a5a;',
                '    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;',
                '}',
            ].join('\n');
            document.head.appendChild(css);
        }

        var contenedor = document.querySelector('.vistapregunta');
        if (!contenedor) return;

        var capa = document.getElementById('seg-blur-overlay');

        if (oscurecer) {
            // Crear la capa si no existe aun
            if (!capa) {
                capa = document.createElement('div');
                capa.id = 'seg-blur-overlay';
                capa.innerHTML =
                    '<div class="seg-blur-tarjeta">' +
                        '<div class="seg-blur-badge">⚠️ Atención</div>' +
                        '<div class="seg-blur-icono">👁️</div>' +
                        '<p class="seg-blur-titulo">Dejaste de interactuar con la evaluación</p>' +
                        '<p class="seg-blur-sub">Esta ventana está en espera.<br>Regresa para continuar con tu evaluación.</p>' +
                        '<div class="seg-blur-hint">🖱️ Haz clic aquí para continuar</div>' +
                    '</div>';
                contenedor.appendChild(capa);
            }
            // Forzar reflow para que la transicion CSS se active
            void capa.offsetWidth;
            capa.classList.add('visible');
        } else {
            if (capa) {
                capa.classList.remove('visible');
            }
        }
    }

    // ----------------------------------------------------------------------
    // ----------------------------------------------------------------------
    // ----------------------------------------------------------------------

    /**
     * Inyecta CSS de seguridad: deshabilita seleccion de texto, arrastre de imagenes, etc.
     * Permite seleccion y escritura dentro de campos de formulario.
     */
    _aplicarEstilosSeguridad() {
        const estilo = document.createElement('style');
        estilo.textContent = [
            '* {',
            '    -webkit-user-select: none !important;',
            '    -moz-user-select: none !important;',
            '    -ms-user-select: none !important;',
            '    user-select: none !important;',
            '    -webkit-touch-callout: none !important;',
            '}',
            'input, textarea, [contenteditable="true"] {',
            '    -webkit-user-select: text !important;',
            '    -moz-user-select: text !important;',
            '    user-select: text !important;',
            '    -webkit-touch-callout: default !important;',
            '}',
            'img {',
            '    -webkit-user-drag: none !important;',
            '    user-drag: none !important;',
            '    pointer-events: none !important;',
            '}',
        ].join('\n');
        document.head.appendChild(estilo);

        // Bloquear impresion programatica desde el menu del navegador
        const self = this;
        if (self._estaHabilitado('intentoImpresion')) {
            window.print = function() {
                self._registrarViolacion('intentoImpresion');
                return false;
            };
        }
    }

    /**
     * Sobrescribe eval() y Function() para bloquear ejecucion de codigo arbitrario.
     */
    _bloquearFuncionesPeligrosas() {
        if (!this._estaHabilitado('manipulacionDatos')) return;
        try {
            window.eval     = function() { throw new Error('[Seguridad] eval() está deshabilitado.'); };
            window.Function = function() { throw new Error('[Seguridad] Function() está deshabilitado.'); };
        } catch (e) {
            // Algunos navegadores no permiten sobrescribir; ignorar silenciosamente
        }
    }

    // ----------------------------------------------------------------------
    // ----------------------------------------------------------------------
    // ----------------------------------------------------------------------

    /**
     * Previene el comportamiento por defecto y detiene la propagacion del evento.
     * @param {Event} e
     */
    _prevenirEvento(e) {
        if (!e) return false;
        if (e.preventDefault)  e.preventDefault();
        if (e.stopPropagation) e.stopPropagation();
        e.returnValue = false;
        return false;
    }

    /**
     * Retorna true si el elemento actualmente enfocado es un campo de texto editable.
     * Se usa para permitir Ctrl+C/V/X dentro de textareas e inputs de respuesta.
     * @returns {boolean}
     */
    _esCampoDeTextoActivo() {
        const activo = document.activeElement;
        return !!(activo && (
            activo.tagName === 'INPUT'    ||
            activo.tagName === 'TEXTAREA' ||
            activo.contentEditable === 'true'
        ));
    }

    /**
     * Retorna true si el tipo de violacion esta habilitado por el profesor.
     * Si no se configuro controlesHabilitados (null), todo esta habilitado.
     * @param {string} tipo -- clave del tipo de violacion
     * @returns {boolean}
     */
    _estaHabilitado(tipo) {
        if (!this.controlesHabilitados) return true;
        return !!this.controlesHabilitados[tipo];
    }

    // ----------------------------------------------------------------------
    // ----------------------------------------------------------------------
    // ----------------------------------------------------------------------

    /**
     * Llama a este metodo desde el handler de exito de 'finalizarintento'
     * para limpiar los datos de localStorage y cerrar los tramos de tiempo.
     * El envio final de violaciones se realiza en el POST de finalizarevaluacion()
     * del template (campo 'integridadevaluacion'), NO desde este metodo.
     */
    finalizarEvaluacion() {
        this._cambiarEstadoTiempoFuera('perdidaFoco', false);
        this._cambiarEstadoTiempoFuera('cambioTab', false);
        limpiarAlmacenamientoLocal();
        console.info('[Seguridad] Evaluacion finalizada -- datos locales eliminados.');
    }

    /**
     * Resetea todos los contadores de violaciones a 0 y limpia el localStorage.
     * Se llama desde chequearintento() cuando el servidor devuelve un
     * sesionIntentoId diferente al que teniamos (nueva sesion Django = nuevo intento).
     */
    resetearViolaciones() {
        // Resetear todos los contadores en memoria
        for (var tipo in this.violaciones) {
            this.violaciones[tipo] = 0;
        }
        this.totalViolaciones = 0;
        this.tiempoFuera = {
            totalSegundos: 0,
            perdidaFocoSegundos: 0,
            cambioTabSegundos: 0,
        };
        this._tramosTiempoFuera = {
            totalInicioMs: null,
            perdidaFocoInicioMs: null,
            cambioTabInicioMs: null,
        };
        this.estado.ultimoEnvioExitoso = null;

        // Limpiar localStorage para que no se arrastren datos del intento anterior
        limpiarAlmacenamientoLocal();

        // Actualizar el panel visual mostrando todo en 0
        this._actualizarPanel(this.violaciones, this.totalViolaciones, this._obtenerTiempoFueraSnapshot());

        console.info('[Seguridad] Violaciones reseteadas por cambio de sesion de intento.');
    }

    /**
     * Retorna una copia del estado actual (para uso externo o debugging).
     * @returns {object}
     */
    obtenerReporte() {
        return this._construirPayload('local');
    }

    /**
     * Construye y retorna el string JSON del payload de integridad listo para
     * enviarse al servidor como campo 'integridadevaluacion'.
     *
     * Uso desde el template:
     *   var integridadevaluacion = window.integridadEvaluacion
     *       ? window.integridadEvaluacion.obtenerPayloadIntegridad()
     *       : '';
     *
     * @returns {string} JSON serializado con sesionId, violaciones, manipulado y bloqueado.
     *                   Cadena vacía si el módulo no está disponible.
     */
    obtenerPayloadIntegridad() {
        var reporte = this._construirPayload('local');
        return JSON.stringify({
            sesionId:    reporte.sesionId,
            violaciones: reporte.violaciones,
            manipulado:  reporte.manipulado,
            bloqueado:   reporte.bloqueado,
            tiempoFuera: reporte.tiempoFuera,
        });
    }

    /**
     * Gestiona el cambio de sesión de intento recibido del servidor.
     * Si el sesionIntentoId recibido difiere del que se tenía en memoria,
     * se interpreta como un NUEVO intento: se limpian el localStorage y los
     * contadores, y se actualiza el ID almacenado.
     *
     * Uso desde el template (dentro del bloque success de chequearintento):
     *   if (window.integridadEvaluacion && data.sesionIntentoId != null) {
     *       window.integridadEvaluacion.manejarSesionIntento(data.sesionIntentoId);
     *   }
     *
     * @param {string|number} sesionIntentoId -- ID recibido del servidor
     */
    manejarSesionIntento(sesionIntentoId) {
        if (sesionIntentoId === null || sesionIntentoId === undefined) return;

        if (this._sesionIntentoIdActual !== null &&
            this._sesionIntentoIdActual !== sesionIntentoId) {
            // La sesión Django cambió → nuevo intento: resetear violaciones
            this.resetearViolaciones();
            console.info('[Seguridad] Sesión de intento cambió:',
                this._sesionIntentoIdActual, '→', sesionIntentoId);
        }

        this._sesionIntentoIdActual = sesionIntentoId;
    }

    /**
     * Procesa la respuesta completa del servidor recibida en chequearintento().
     * Centraliza en un solo método:
     *   1. Gestión del cambio de sesión de intento  (manejarSesionIntento).
     *   2. Sincronización de violaciones confirmadas (sincronizarDesdeServidor).
     *   3. Registro de último envío exitoso y chequeo de bloqueo del servidor.
     *
     * Uso desde el template (reemplaza los dos bloques inline):
     *   if (window.integridadEvaluacion) {
     *       window.integridadEvaluacion.procesarRespuestaServidor(data);
     *   }
     *
     * @param {object} data -- objeto de respuesta JSON del servidor con las claves:
     *   - sesionIntentoId        {string|number|null}
     *   - violacionesConfirmadas {object|null}
     *   - totalConfirmado        {number|null}
     *   - tiempoFueraConfirmado  {object|null}
     *   - bloqueado              {boolean|null}
     */
    procesarRespuestaServidor(data) {
        if (!data || typeof data !== 'object') return;

        // (1) Gestionar cambio de sesión de intento
        if (data.sesionIntentoId !== null && data.sesionIntentoId !== undefined) {
            this.manejarSesionIntento(data.sesionIntentoId);
        }

        // (2) Sincronizar violaciones confirmadas por el servidor
        if (data.violacionesConfirmadas) {
            this.sincronizarDesdeServidor(
                data.violacionesConfirmadas,
                data.totalConfirmado || 0
            );
        }

        // (3) Sincronizar tiempo fuera confirmado
        if (data.tiempoFueraConfirmado) {
            this.sincronizarTiempoFueraDesdeServidor(data.tiempoFueraConfirmado);
        }

        // (4) Registrar timestamp del ultimo envio exitoso
        this.estado.ultimoEnvioExitoso = new Date().toISOString();
        try {
            if ('localStorage' in window) {
                localStorage.setItem(
                    'evaluacion_violaciones_ultimoenvio',
                    this.estado.ultimoEnvioExitoso
                );
            }
        } catch (e) { /* ignorar errores de localStorage */ }

        // (5) Respetar bloqueo indicado por el servidor
        if (data.bloqueado && !this.estado.bloqueado) {
            this._bloquearEvaluacion();
        }

        // (6) Re-persistir estado con los valores actualizados
        this._persistirEstado();
    }

    /**
     * Sincroniza los contadores locales con los valores confirmados por el servidor.
     * Aplica anti-regresion: nunca baja un contador, solo sube.
     * Si el servidor devuelve un valor mayor al local (rechazo de manipulacion),
     * el panel se actualiza en tiempo real con los valores correctos.
     *
     * Llamado desde chequearintento() en evaluacioncuestionario.html
     * cada vez que el servidor responde al ciclo de 60 segundos.
     *
     * @param {object} violacionesConfirmadas -- dict {tipo: conteo} del servidor
     * @param {number} totalConfirmado        -- total confirmado por el servidor
     */
    sincronizarDesdeServidor(violacionesConfirmadas, totalConfirmado) {
        if (!violacionesConfirmadas || typeof violacionesConfirmadas !== 'object') return;

        var huboCorrecion = false;

        for (var tipo in this.violaciones) {
            var valorServidor = violacionesConfirmadas[tipo] || 0;
            if (valorServidor > this.violaciones[tipo]) {
                // El servidor tiene un valor mayor: el cliente estaba por debajo (manipulación detectada)
                console.warn('[Seguridad] Corrección desde servidor — tipo:', tipo,
                    '| cliente:', this.violaciones[tipo], '→ servidor:', valorServidor);
                this.violaciones[tipo] = valorServidor;
                huboCorrecion = true;
            }
        }

        if ((totalConfirmado || 0) > this.totalViolaciones) {
            this.totalViolaciones = totalConfirmado;
            huboCorrecion = true;
        }

        if (huboCorrecion) {
            // Persistir los valores corregidos en localStorage
            this._persistirEstado();

            // Actualizar el panel visual con los valores correctos del servidor
            this._actualizarPanel(this.violaciones, this.totalViolaciones, this._obtenerTiempoFueraSnapshot());

            // Disparar CustomEvent para que cualquier otro listener externo se entere
            try {
                var evento = new CustomEvent('violacionRegistrada', {
                    detail: {
                        tipo:        'sincronizacion_servidor',
                        conteo:      0,
                        total:       this.totalViolaciones,
                        violaciones: Object.assign({}, this.violaciones),
                    },
                    bubbles: true,
                });
                document.dispatchEvent(evento);
            } catch (e) { /* navegadores muy antiguos */ }
        }
    }

    // ----------------------------------------------------------------------
    // -- PANEL DE INCUMPLIMIENTOS ------------------------------------------
    // ----------------------------------------------------------------------

    /**
     * Inicializa el panel de incumplimientos:
     *   1. Inyecta los estilos CSS necesarios (una sola vez).
     *   2. Genera los divs internos dentro del contenedor raiz si no existen.
     *   3. Registra el listener del CustomEvent 'violacionRegistrada'.
     *
     * Se llama desde _inicializar(). Funciona en cualquier plantilla que
     * tenga un <div id="[idPanelIncumplimientos]"> en el HTML.
     * Si el div no existe en la pagina actual, no hace nada.
     */
    _iniciarPanelIncumplimientos() {
        var idRaiz = this.config.idPanelIncumplimientos;
        var raiz   = document.getElementById(idRaiz);
        if (!raiz) return; // El div no existe en esta plantilla

        // (1) Inyectar CSS del panel (solo la primera vez, marcado con data-attr)
        if (!document.getElementById('seguridad-panel-css')) {
            var estilo = document.createElement('style');
            estilo.id  = 'seguridad-panel-css';
            estilo.textContent = [
                '#incumplimientocometidos {',
                '    display: block;',
                '}',
                '#panel-violaciones-lista {',
                '    display: flex;',
                '    flex-direction: column;',
                '    gap: 5px;',
                '}',
                '.incump-fila {',
                '    display: flex;',
                '    justify-content: space-between;',
                '    align-items: flex-start;',
                '    gap: 8px;',
                '    padding: 6px 8px;',
                '    margin-bottom: 0;',
                '    border-radius: 5px;',
                '    font-size: 11px;',
                '    background: #fafafa;',
                '    border: 1px solid #eaeaea;',
                '    box-shadow: none;',
                '}',
                '.incump-fila:hover {',
                '    background: #f2f2f2;',
                '}',
                '.incump-fila.critica {',
                '    background: #fdf4f4;',
                '    border-color: #e8c8c8;',
                '    color: #7f1d1d;',
                '    font-weight: bold;',
                '}',
                '.incump-etiqueta {',
                '    flex: 1;',
                '    line-height: 1.3;',
                '    color: #2c2c2c;',
                '    word-break: break-word;',
                '}',
                '.incump-conteo {',
                '    font-weight: 700;',
                '    min-width: 28px;',
                '    text-align: center;',
                '    padding: 2px 6px;',
                '    border-radius: 999px;',
                '    background: #efefef;',
                '    color: #2c2c2c;',
                '    border: 1px solid #d8d8d8;',
                '}',
                '#panel-tiempo-fuera {',
                '    margin-top: 6px;',
                '    padding-top: 6px;',
                '    border-top: 1px dashed #e2e2e2;',
                '}',
                '.incump-tiempo-titulo {',
                '    font-size: 11px;',
                '    font-weight: 700;',
                '    color: #2c2c2c;',
                '    margin-bottom: 4px;',
                '    letter-spacing: 0.2px;',
                '}',
                '.incump-vacio {',
                '    padding: 7px 9px;',
                '    border: 1px dashed #e2e2e2;',
                '    border-radius: 5px;',
                '    background: #fafafa;',
                '    color: #888;',
                '    text-align: center;',
                '    line-height: 1.3;',
                '}',
                '@media (max-width: 767px) {',
                '    .incump-fila {',
                '        padding: 6px 7px;',
                '    }',
                '    .incump-conteo {',
                '        min-width: 28px;',
                '    }',
                '    .incump-tiempo-titulo {',
                '        margin-bottom: 4px;',
                '    }',
                '}',
            ].join('\n');
            document.head.appendChild(estilo);
        }

        // (2) Generar divs internos si no existen ya en el HTML
        if (!document.getElementById('panel-violaciones-lista')) {
            raiz.innerHTML =
                '<div id="panel-violaciones-lista"></div>' +
                '<div id="panel-violaciones-total" ' +
                '     style="display:none;margin-top:6px;padding:6px 8px;' +
                '            border:1px solid #dceaf8;border-radius:8px;background:#f7fbff;font-size:11px;color:#335b7e;">' +
                '    Total de incumplimientos: ' +
                '    <span id="panel-violaciones-numero" style="font-weight:700;color:#184c7d;">0</span>' +
                '</div>';
        }

        if (!document.getElementById('panel-tiempo-fuera')) {
            raiz.insertAdjacentHTML('beforeend', '<div id="panel-tiempo-fuera" style="display:none"></div>');
        }

        // (3) Escuchar el CustomEvent 'violacionRegistrada' emitido por _registrarViolacion()
        var self = this;
        document.addEventListener('violacionRegistrada', function(e) {
            if (!e || !e.detail) return;
            self._actualizarPanel(
                e.detail.violaciones,
                e.detail.total,
                e.detail.tiempoFuera || self._obtenerTiempoFueraSnapshot()
            );
        });
    }

    /**
     * Reconstruye el contenido del panel con los contadores actuales.
     * Solo muestra filas cuyo conteo sea mayor a 0.
     * La fila 'manipulacionDatos' se resalta en rojo como violacion critica.
     *
     * @param {object} violaciones -- objeto con los contadores por tipo
     * @param {number} total       -- total acumulado de violaciones
     * @param {object} tiempoFuera -- acumulados de tiempo fuera (total/foco/pestana)
     */
    _actualizarPanel(violaciones, total, tiempoFuera) {
        var lista    = document.getElementById('panel-violaciones-lista');
        var divTotal = document.getElementById('panel-violaciones-total');
        var numTotal = document.getElementById('panel-violaciones-numero');
        if (!lista) return;

        var html      = '';
        var hayAlguna = false;

        var filas = [];
        for (var tipo in ETIQUETAS_VIOLACION) {
            // Solo mostrar tipos habilitados
            if (this.controlesHabilitados && !this.controlesHabilitados[tipo]) continue;
            var conteo = violaciones[tipo] || 0;
            if (conteo === 0) continue;
            filas.push({ tipo: tipo, conteo: conteo });
        }

        filas.sort(function(a, b) {
            if (b.conteo !== a.conteo) return b.conteo - a.conteo;
            return a.tipo.localeCompare(b.tipo);
        });

        for (var i = 0; i < filas.length; i++) {
            var fila = filas[i];
            hayAlguna = true;
            var esCritica = (fila.tipo === 'manipulacionDatos');
            html +=
                '<div class="incump-fila' + (esCritica ? ' critica' : '') + '">' +
                '<span class="incump-etiqueta">' + ETIQUETAS_VIOLACION[fila.tipo] + '</span>' +
                '<span class="incump-conteo">' + fila.conteo + '</span>' +
                '</div>';
        }

        lista.innerHTML = hayAlguna
            ? html
            : '<div class="incump-vacio">No se registran incidentes por el momento.</div>';

        if (divTotal && numTotal) {
            if (hayAlguna) {
                numTotal.textContent  = total;
                divTotal.style.display = 'block';
            } else {
                divTotal.style.display = 'none';
            }
        }

        var tiempo = tiempoFuera || this._obtenerTiempoFueraSnapshot();
        var panelTiempo = document.getElementById('panel-tiempo-fuera');
        if (panelTiempo) {
            var totalFuera = normalizarSegundos(tiempo.totalSegundos);
            panelTiempo.style.display = 'block';
            panelTiempo.innerHTML =
                '<div class="incump-fila"><span class="incump-etiqueta">Total fuera de la evaluación:</span><span class="incump-conteo">' + formatearDuracionSegundos(totalFuera) + '</span></div>';
        }
    }

} // -- fin class IngegridadEvaluacion --
// ----------------------------------------------------------------------
// ----------------------------------------------------------------------

(function inicializarIntegridadEvaluacion() {
    /**
     * Crea la instancia global de IntegridadEvaluacion.
     * Los valores de EVAL_ID y USER_ID pueden inyectarse desde el template Django:
     *   <script>var EVAL_ID = "{{ intentocuestionario.id|encrypt_alu }}";</script>
     *   <script>var USER_ID = "{{ request.user.id }}";</script>
     */
    function crear() {
        if (window.integridadEvaluacion) return; // Evitar doble instancia

        window.integridadEvaluacion = new IntegridadEvaluacion({
            maxViolaciones: 50,
            evaluacionId:   (typeof EVAL_ID !== 'undefined') ? EVAL_ID : '',
            usuarioId:      (typeof USER_ID !== 'undefined') ? USER_ID : '',
            controlesHabilitados: (typeof CONTROLES_HABILITADOS !== 'undefined') ? CONTROLES_HABILITADOS : null,
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', crear);
    } else {
        crear();
    }
})();

