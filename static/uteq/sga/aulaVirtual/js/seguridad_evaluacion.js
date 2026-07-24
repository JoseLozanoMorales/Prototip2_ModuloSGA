class SeguridadEvaluacion {
    constructor(options = {}) {
        this.config = {
            showAlerts: options.showAlerts !== false,
            strictMode: options.strictMode || false,
            allowedViolations: options.allowedViolations || 3,
            sessionId: this.generateSessionId(),
            ...options
        };

        this.violations = {
            count: 0,
            types: {},
            timeline: []
        };

        this.state = {
            isDevToolsOpen: false,
            isTabActive: true,
            lastActivity: Date.now(),
            examStartTime: Date.now()
        };

        this.init();
    }

    generateSessionId() {
        return 'exam_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    init() {
        this.blockKeyboardShortcuts();
        this.blockContextMenu();
        this.blockTextSelection();
        this.detectTabChange();
        this.blockClipboard();
        this.blockZoom();
        this.blockPrint();
        this.applySecurityStyles();
        // this.detectDevTools();
        this.controlMultipleTabs();
        // this.monitorUserBehavior();
        this.blockDangerousFunctions();

        this.logEvent('system_initialized');
    }

    // 1. BLOQUEO DE ATAJOS DE TECLADO
    blockKeyboardShortcuts() {
        const blockedKeys = {
            // Teclas de función
            112: 'F1', 113: 'F2', 114: 'F3', 115: 'F4',
            116: 'F5', 117: 'F6', 118: 'F7', 119: 'F8',
            120: 'F9', 121: 'F10', 123: 'F12',
            // Otras teclas problemáticas
            44: 'PrintScreen', 145: 'ScrollLock', 19: 'Pause'
        };

        const self = this;
        document.addEventListener('keydown', function(e) {
            const key = e.key || '';
            const code = e.keyCode || e.which;

            // Escape
            if (key === 'Escape' || code === 27) {
                self.handleViolation('escape_key', 'Tecla Escape bloqueada');
                return self.preventDefault(e);
            }

            // Teclas bloqueadas
            if (blockedKeys[code]) {
                self.handleViolation('function_key', `Tecla ${blockedKeys[code]} bloqueada`);
                return self.preventDefault(e);
            }

            // Combinaciones con Ctrl/Cmd
            if (e.ctrlKey || e.metaKey) {
                const allowedCombinations = ['KeyV', 'KeyC']; // Solo en campos de texto
                const isTextInput = self.isTextInputActive();

                if (!isTextInput || !allowedCombinations.includes(e.code)) {
                    self.handleViolation('keyboard_shortcut', `Combinación bloqueada: ${e.ctrlKey ? 'Ctrl' : 'Cmd'}+${key}`);
                    return self.preventDefault(e);
                }
            }

            // Alt + Tab/F4
            if (e.altKey && (code === 9 || code === 115)) {
                self.handleViolation('alt_combination', 'Combinación Alt bloqueada');
                return self.preventDefault(e);
            }

        }, true);
    }

    // 2. DETECTOR DE HERRAMIENTAS DE DESARROLLADOR
    detectDevTools() {
        const self = this;
        let devtoolsOpen = false;
        let detectionHistory = [];
        const MAX_HISTORY = 5;
        const CONFIDENCE_THRESHOLD = 0.7; // 70% de confianza

        // Función para detectar navegador y sistema operativo
        function getBrowserInfo() {
            const ua = navigator.userAgent.toLowerCase();
            const platform = navigator.platform.toLowerCase();

            return {
                isChrome: ua.includes('chrome') && !ua.includes('edge') && !ua.includes('opr'),
                isFirefox: ua.includes('firefox'),
                isEdge: ua.includes('edge') || ua.includes('edg/'),
                isSafari: ua.includes('safari') && !ua.includes('chrome'),
                isOpera: ua.includes('opr') || ua.includes('opera'),
                isBrave: navigator.brave !== undefined,
                isWindows: platform.includes('win'),
                isMac: platform.includes('mac'),
                isLinux: platform.includes('linux'),
                isMobile: /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua)
            };
        }

        // Detectar navegador y sistema operativo
        const browserInfo = getBrowserInfo();

        // Metodo 1: Detección por tamaño de ventana (adaptativo)
        function checkWindowSize() {
            try {
                // Saltar en móviles
                if (browserInfo.isMobile) return false;

                // Umbrales adaptativos por navegador y SO
                let threshold = 160;

                if (browserInfo.isFirefox) {
                    threshold = browserInfo.isWindows ? 140 : 120;
                } else if (browserInfo.isEdge) {
                    threshold = browserInfo.isWindows ? 200 : 180;
                } else if (browserInfo.isSafari) {
                    threshold = 100; // Safari tiene menos chrome
                } else if (browserInfo.isBrave) {
                    threshold = 190;
                } else if (browserInfo.isOpera) {
                    threshold = 170;
                }

                // Ajustes por sistema operativo
                if (browserInfo.isMac) threshold -= 20;
                if (browserInfo.isLinux) threshold -= 10;

                const widthDiff = window.outerWidth - window.innerWidth;
                const heightDiff = window.outerHeight - window.innerHeight;

                // Validaciones adicionales
                const hasValidDimensions =
                    window.outerWidth > 0 &&
                    window.outerHeight > 0 &&
                    window.innerWidth > 100 &&
                    window.innerHeight > 100;

                const isVisible =
                    document.visibilityState === 'visible' &&
                    !document.hidden;

                const hasFocus = document.hasFocus();

                if (!hasValidDimensions || !isVisible || !hasFocus) {
                    return false;
                }

                return widthDiff > threshold || heightDiff > threshold;

            } catch(e) {
                return false;
            }
        }

        // Metodo 2: Detección silenciosa por console
        function checkConsoleAccess() {
            try {
                let detected = false;
                const startTime = performance.now();

                // Crear objeto trampa
                const trap = {
                    get triggered() {
                        detected = true;
                        return '';
                    }
                };

                // Metodo específico por navegador
                if (browserInfo.isFirefox) {
                    // Firefox maneja console.log diferente
                    const tempFunc = () => {};
                    tempFunc.toString = () => { detected = true; return ''; };
                    console.debug(tempFunc);
                } else {
                    // Chrome, Edge, Safari, etc.
                    console.log('%c%s', 'color: transparent;', trap.triggered);
                }

                // Limpiar inmediatamente si es posible
                if (typeof console.clear === 'function') {
                    setTimeout(() => console.clear(), 0);
                }

                const endTime = performance.now();

                // Si toma demasiado tiempo, podría ser devtools
                return detected || (endTime - startTime) > 50;

            } catch(e) {
                return false;
            }
        }

        // Metodo 3: Detección por performance del debugger
        function checkDebuggerTiming() {
            try {
                const iterations = 3;
                let totalTime = 0;

                for (let i = 0; i < iterations; i++) {
                    const start = performance.now();

                    // Función anónima para evitar optimizaciones del motor JS
                    (function() {
                        debugger;
                    })();

                    const end = performance.now();
                    totalTime += (end - start);
                }

                const averageTime = totalTime / iterations;

                // Umbrales por navegador
                let threshold = 100;
                if (browserInfo.isFirefox) threshold = 150;
                if (browserInfo.isSafari) threshold = 80;
                if (browserInfo.isEdge) threshold = 120;

                return averageTime > threshold;

            } catch(e) {
                return false;
            }
        }

        // Metodo 4: Detección por inspección de objetos
        function checkObjectInspection() {
            try {
                let detected = false;
                const testObj = {};

                // Configurar diferentes trampas según el navegador
                if (browserInfo.isFirefox) {
                    Object.defineProperty(testObj, 'toString', {
                        get: function() {
                            detected = true;
                            return function() { return '[object Object]'; };
                        },
                        configurable: true
                    });
                } else {
                    Object.defineProperty(testObj, Symbol.toPrimitive, {
                        get: function() {
                            detected = true;
                            return function() { return ''; };
                        },
                        configurable: true
                    });
                }

                // Intentar activar la trampa
                console.debug(testObj);
                setTimeout(() => {
                    if (typeof console.clear === 'function') {
                        console.clear();
                    }
                }, 0);

                return detected;

            } catch(e) {
                return false;
            }
        }

        // Metodo 5: Detección por función toString override
        function checkFunctionStringify() {
            try {
                let detected = false;

                const testFunc = function devToolsDetector() {};
                const originalToString = testFunc.toString;

                testFunc.toString = function() {
                    detected = true;
                    return originalToString.call(this);
                };

                // Diferentes enfoques por navegador
                if (browserInfo.isChrome || browserInfo.isEdge || browserInfo.isBrave) {
                    console.log('%O', testFunc);
                } else if (browserInfo.isFirefox) {
                    console.debug(testFunc);
                } else if (browserInfo.isSafari) {
                    console.info(testFunc);
                } else {
                    console.log(testFunc);
                }

                // Restaurar función original
                testFunc.toString = originalToString;

                // Limpiar console
                setTimeout(() => {
                    if (typeof console.clear === 'function') {
                        console.clear();
                    }
                }, 0);

                return detected;

            } catch(e) {
                return false;
            }
        }

        // Metodo 6: Detección por timing de renderizado
        function checkRenderingDelay() {
            try {
                const start = performance.now();

                // Crear elemento temporal
                const element = document.createElement('div');
                element.style.cssText = 'position:absolute;left:-9999px;top:-9999px;';
                document.body.appendChild(element);

                // Forzar reflow
                element.offsetHeight;

                // Remover elemento
                document.body.removeChild(element);

                const end = performance.now();
                const renderTime = end - start;

                // DevTools puede ralentizar el renderizado
                return renderTime > 5;

            } catch(e) {
                return false;
            }
        }

        // Sistema de puntuación con pesos por navegador
        function calculateDetectionScore(results) {
            const weights = {
                windowSize: browserInfo.isMobile ? 0 : (browserInfo.isFirefox ? 0.8 : 1.0),
                consoleAccess: browserInfo.isFirefox ? 1.2 : 1.0,
                debuggerTiming: browserInfo.isSafari ? 0.8 : 1.0,
                objectInspection: 1.0,
                functionStringify: browserInfo.isEdge ? 0.9 : 1.0,
                renderingDelay: 0.6
            };

            let score = 0;
            let maxScore = 0;

            Object.keys(weights).forEach((key, index) => {
                const weight = weights[key];
                maxScore += weight;
                if (results[index]) {
                    score += weight;
                }
            });

            return score / maxScore;
        }

        // Función principal de verificación
        function runDevToolsCheck() {
            try {
                // Validar contexto
                if (browserInfo.isMobile ||
                    document.hidden ||
                    !document.hasFocus() ||
                    window.innerWidth < 300 ||
                    window.innerHeight < 200) {
                    return;
                }

                // Ejecutar todos los métodos
                const results = [
                    checkWindowSize(),
                    checkConsoleAccess(),
                    checkDebuggerTiming(),
                    checkObjectInspection(),
                    checkFunctionStringify(),
                    checkRenderingDelay()
                ];

                // Calcular puntuación
                const score = calculateDetectionScore(results);

                // Agregar a historial
                detectionHistory.push({
                    timestamp: Date.now(),
                    score: score,
                    results: results
                });

                // Mantener solo los últimos N resultados
                if (detectionHistory.length > MAX_HISTORY) {
                    detectionHistory.shift();
                }

                // Calcular confianza basada en historial
                if (detectionHistory.length >= 3) {
                    const recentScores = detectionHistory.slice(-3).map(h => h.score);
                    const averageScore = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
                    const consistency = 1 - (Math.max(...recentScores) - Math.min(...recentScores));

                    const confidence = averageScore * consistency;

                    if (confidence >= CONFIDENCE_THRESHOLD && !devtoolsOpen) {
                        devtoolsOpen = true;
                        self.handleViolation('devtools_open', `Herramientas de desarrollador detectadas (confianza: ${Math.round(confidence * 100)}%)`);
                    } else if (confidence < CONFIDENCE_THRESHOLD * 0.5 && devtoolsOpen) {
                        devtoolsOpen = false;
                    }
                }

            } catch(e) {
                console.warn('Error en detección de DevTools:', e);
            }
        }

        // Intervalo adaptativo según el navegador
        const interval = browserInfo.isSafari ? 8000 : 6000;
        const detectionTimer = setInterval(runDevToolsCheck, interval);

        // Override mejorado de console.clear
        const originalClear = console.clear;
        console.clear = function() {
            // if (devtoolsOpen) {
            //     self.handleViolation('console_clear', 'Intento de limpiar consola detectado');
            // }
            return originalClear.apply(console, arguments);
        };

        // Función de limpieza
        return function cleanup() {
            clearInterval(detectionTimer);
            console.clear = originalClear;
        };
    }

    // 3. CONTROL DE MÚLTIPLES PESTAÑAS
    controlMultipleTabs() {
        const self = this;
        const storageKey = `exam_session_${btoa(location.href.split('?')[0])}`;
        const heartbeatKey = `${storageKey}_heartbeat`;

        // Generar ID único para esta pestaña
        const tabId = this.config.sessionId;
        let isMainTab = false;

        function checkMultipleTabs() {
            const existingSession = localStorage.getItem(storageKey);
            const lastHeartbeat = localStorage.getItem(heartbeatKey);
            const now = Date.now();

            if (existingSession && existingSession !== tabId) {
                // Verificar si la otra pestaña sigue activa (heartbeat < 5 segundos)
                if (lastHeartbeat && (now - parseInt(lastHeartbeat)) < 5000) {
                    self.showTabDuplicationError();
                    return false;
                }
            }

            // Esta pestaña es la principal
            localStorage.setItem(storageKey, tabId);
            localStorage.setItem(heartbeatKey, now.toString());
            isMainTab = true;
            return true;
        }

        // Verificar al cargar con delay para evitar false positives
        setTimeout(() => {
            if (!checkMultipleTabs()) return;

            // Mantener heartbeat
            const heartbeatInterval = setInterval(() => {
                if (document.hidden) return; // No actualizar si la pestaña no está activa
                localStorage.setItem(heartbeatKey, Date.now().toString());
            }, 2000);

            // Escuchar cambios en localStorage de otras pestañas
            window.addEventListener('storage', (e) => {
                if (e.key === storageKey && e.newValue && e.newValue !== tabId) {
                    // Otra pestaña se registro
                    const otherTabHeartbeat = localStorage.getItem(heartbeatKey);
                    if (otherTabHeartbeat && (Date.now() - parseInt(otherTabHeartbeat)) < 3000) {
                        self.showTabDuplicationError();
                    }
                }
            });

            // Limpiar al salir
            window.addEventListener('beforeunload', () => {
                if (isMainTab) {
                    localStorage.removeItem(storageKey);
                    localStorage.removeItem(heartbeatKey);
                }
                clearInterval(heartbeatInterval);
            });

        }, 1500);
    }

    // 4. MONITOREO DE COMPORTAMIENTO DEL USUARIO
    monitorUserBehavior() {
        const self = this;
        let inactivityTimer;
        let rapidClickCount = 0;
        let lastClickTime = 0;

        // Detectar inactividad prolongada
        function resetInactivityTimer() {
            clearTimeout(inactivityTimer);
            self.state.lastActivity = Date.now();

            inactivityTimer = setTimeout(() => {
                self.handleViolation('inactivity', 'Inactividad prolongada detectada');
            }, 300000); // 5 minutos
        }

        // Detectar clics rápidos sospechosos (posible automatizacion)
        document.addEventListener('click', function(e) {
            const now = Date.now();
            if (now - lastClickTime < 100) {
                rapidClickCount++;
                if (rapidClickCount > 10) {
                    self.handleViolation('rapid_clicks', 'Comportamiento automatizado detectado');
                    rapidClickCount = 0;
                }
            } else {
                rapidClickCount = 0;
            }
            lastClickTime = now;
            resetInactivityTimer();
        });

        // Monitorear actividad de teclado y mouse
        ['keypress', 'mousemove', 'scroll'].forEach(event => {
            document.addEventListener(event, resetInactivityTimer);
        });

        resetInactivityTimer();
    }

    // 5. DETECTAR CAMBIO DE PESTAÑA/VENTANA
    detectTabChange() {
        const self = this;
        let tabSwitchCount = 0;
        let wasHidden = false;

        function handleVisibilityChange() {
            const isHidden = document.hidden ||
                document.webkitHidden ||
                document.msHidden ||
                !document.hasFocus();

            if (isHidden && !wasHidden) {
                wasHidden = true;
                tabSwitchCount++;
                self.state.isTabActive = false;

                if (tabSwitchCount > 5) {
                    self.handleViolation('excessive_tab_switches', 'Demasiados cambios de pestaña');
                } else {
                    self.handleViolation('tab_switch', `Cambio de pestaña detectado (${tabSwitchCount}/5)`);
                }
            } else if (!isHidden && wasHidden) {
                wasHidden = false;
                self.state.isTabActive = true;
            }
        }

        // Múltiples eventos para máxima compatibilidad
        const visibilityEvents = [
            'visibilitychange', 'webkitvisibilitychange', 'msvisibilitychange',
            'blur', 'focus', 'focusin', 'focusout'
        ];

        visibilityEvents.forEach(event => {
            document.addEventListener(event, handleVisibilityChange);
            window.addEventListener(event, handleVisibilityChange);
        });
    }

    // FUNCIONES AUXILIARES
    preventDefault(e) {
        if (e.preventDefault) e.preventDefault();
        if (e.stopPropagation) e.stopPropagation();
        e.returnValue = false;
        return false;
    }

    isTextInputActive() {
        const active = document.activeElement;
        return active && (
            active.tagName === 'INPUT' ||
            active.tagName === 'TEXTAREA' ||
            active.contentEditable === 'true'
        );
    }

    handleViolation(type, message) {
        this.violations.count++;
        this.violations.types[type] = (this.violations.types[type] || 0) + 1;
        this.violations.timeline.push({
            type, message,
            timestamp: Date.now(),
            timeFromStart: Date.now() - this.state.examStartTime
        });

        this.logEvent('violation', { type, message });

        // if (this.config.showAlerts) {
        //     this.showAlert(message, type);
        // }

        // if (this.violations.count >= this.config.allowedViolations) {
        //     this.handleMaxViolationsReached();
        // }
    }

    showAlert(message, type = 'warning') {
        // Usar alert nativo como fallback si no hay funcion personalizada
        if (typeof abrirnotificacionmodal === 'function') {
            var controlmodal = $('.notificacionmodal')
            if (!(controlmodal.hasClass('show') || controlmodal.is(':visible'))) {
                abrirnotificacionmodal(message, 'Alerta de evaluación', true, true, 'fa fa-exclamation-triangle', 'black');
            }
        } else {
            alert(`⚠️ ALERTA DE EVALUACIÓN\n\n${message}`);
        }
    }

    showTabDuplicationError() {
        document.body.innerHTML = `
            <div style="position:fixed;top:0;left:0;width:100vw;height:100vh;
                       background:white;
                       display:flex;justify-content:center;align-items:center;
                       font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
                       z-index:999999;">
                <div style="background:white;padding:40px;border-radius:15px;
                           box-shadow:0 20px 60px rgba(0,0,0,0.3);text-align:center;
                           max-width:500px;margin:20px;">
                    <h1 style="color:#d32f2f;margin:0 0 20px 0;font-size:1.8rem;">
                        EVALUACIÓN DUPLICADA
                    </h1>
                    <p style="color:#666;font-size:1.1rem;line-height:1.5;margin-bottom:30px;">
                        Esta evaluación ya está abierta en otra pestaña o ventana. 
                        Solo se permite una sesión activa por estudiante.
                    </p>
                    <div style="background:#fff3cd;border:1px solid #ffeaa7;
                               padding:15px;border-radius:8px;margin-bottom:30px;">
                        <strong style="color:#856404;">Instrucciones:</strong><br>
                        <span style="color:#856404;">Cierre todas las demás pestañas y recargue esta página</span>
                    </div>
                    <button onclick="location.reload()" 
                            style="background:lightskyblue;color:white;border:none;
                                   padding:12px 30px;border-radius:6px;font-size:1.1rem;
                                   cursor:pointer;font-weight:500;">
                        Recargar página
                    </button>
                </div>
            </div>
        `;
    }

    handleMaxViolationsReached() {
        const report = this.generateViolationReport();
        document.body.innerHTML = `
            <div style="position:fixed;top:0;left:0;width:100vw;height:100vh;
                       background:#d32f2f;display:flex;justify-content:center;align-items:center;
                       font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
                       z-index:999999;">
                <div style="background:white;padding:40px;border-radius:15px;
                           text-align:center;max-width:600px;margin:20px;">
                    <div style="font-size:4rem;margin-bottom:20px;">⛔</div>
                    <h1 style="color:#d32f2f;margin:0 0 20px 0;">EVALUACIÓN SUSPENDIDA</h1>
                    <p style="color:#666;margin-bottom:30px;font-size:1.1rem;">
                        Se han detectado demasiadas violaciones de seguridad.
                        La evaluación ha sido suspendida automáticamente.
                    </p>
                    <div style="background:#f5f5f5;padding:20px;border-radius:8px;margin-bottom:30px;text-align:left;">
                        <h3 style="margin:0 0 15px 0;color:#333;">Reporte de Violaciones:</h3>
                        <pre style="font-size:0.9rem;color:#666;white-space:pre-wrap;">${report}</pre>
                    </div>
                    <p style="color:#999;font-size:0.9rem;">
                        Contacte con su instructor para más información.
                    </p>
                </div>
            </div>
        `;
    }

    generateViolationReport() {
        const duration = Math.round((Date.now() - this.state.examStartTime) / 1000);
        let report = `Sesión: ${this.config.sessionId}\n`;
        report += `Duración: ${duration} segundos\n`;
        report += `Total violaciones: ${this.violations.count}\n\n`;

        report += "Tipos de violaciones:\n";
        for (const [type, count] of Object.entries(this.violations.types)) {
            report += `- ${type}: ${count}\n`;
        }

        report += "\nÚltimas 5 violaciones:\n";
        this.violations.timeline.slice(-5).forEach(v => {
            const time = Math.round(v.timeFromStart / 1000);
            report += `[${time}s] ${v.type}: ${v.message}\n`;
        });

        return report;
    }

    logEvent(event, data = {}) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            sessionId: this.config.sessionId,
            event,
            data,
            userAgent: navigator.userAgent
        };

        // Guardar en memoria para posterior análisis
        if (!window.examLogs) window.examLogs = [];
        window.examLogs.push(logEntry);

        console.log('ExamSecurity:', logEntry);
    }

    // FUNCIONES BÁSICAS RESTANTES (simplificadas)
    blockContextMenu() {
        const self = this;
        document.addEventListener('contextmenu', function(e) {
            self.handleViolation('context_menu', 'Menú contextual bloqueado');
            return self.preventDefault(e);
        });
    }

    blockTextSelection() {
        document.addEventListener('selectstart', e => this.preventDefault(e));
        document.addEventListener('dragstart', e => this.preventDefault(e));
    }

    blockClipboard() {
        const self = this;
        ['copy', 'cut', 'paste'].forEach(event => {
            document.addEventListener(event, function(e) {
                if (!self.isTextInputActive()) {
                    self.handleViolation('clipboard', `Operación ${event} bloqueada`);
                    return self.preventDefault(e);
                }
            });
        });
    }

    blockZoom() {
        const self = this;
        // Bloquear zoom con teclado
        document.addEventListener('keydown', function(e) {
            if ((e.ctrlKey || e.metaKey) &&
                [61, 107, 173, 109, 187, 189, 48].includes(e.keyCode)) {
                self.handleViolation('zoom_keyboard', 'Zoom con teclado bloqueado');
                return self.preventDefault(e);
            }
        });

        // Bloquear zoom con rueda del mouse
        document.addEventListener('wheel', function(e) {
            if (e.ctrlKey || e.metaKey) {
                self.handleViolation('zoom_wheel', 'Zoom con mouse bloqueado');
                return self.preventDefault(e);
            }
        }, { passive: false });
    }

    blockPrint() {
        const self = this;
        window.print = function() {
            self.handleViolation('print_attempt', 'Intento de impresión bloqueado');
            return false;
        };
    }

    applySecurityStyles() {
        const style = document.createElement('style');
        style.textContent = `
            * {
                -webkit-user-select: none !important;
                -moz-user-select: none !important;
                -ms-user-select: none !important;
                user-select: none !important;
                -webkit-touch-callout: none !important;
            }
            input, textarea, [contenteditable] {
                -webkit-user-select: text !important;
                -moz-user-select: text !important;
                user-select: text !important;
            }
            img {
                -webkit-user-drag: none !important;
                user-drag: none !important;
                pointer-events: none !important;
            }
        `;
        document.head.appendChild(style);
    }

    blockDangerousFunctions() {
        try {
            window.eval = () => { throw new Error('eval() deshabilitado'); };
            window.Function = () => { throw new Error('Function() deshabilitado'); };
        } catch(e) {}
    }

    // MÉTODOS PÚBLICOS
    getViolationReport() {
        return {
            count: this.violations.count,
            types: {...this.violations.types},
            timeline: [...this.violations.timeline],
            sessionInfo: {
                id: this.config.sessionId,
                startTime: this.state.examStartTime,
                duration: Date.now() - this.state.examStartTime
            }
        };
    }

    resetViolations() {
        this.violations = { count: 0, types: {}, timeline: [] };
    }
}

// INICIALIZACION AUTOMÁTICA
document.addEventListener('DOMContentLoaded', function() {
    window.examSecurity = new SeguridadEvaluacion({
        showAlerts: true,
        strictMode: true,
        allowedViolations: 5
    });
});

// Fallback para navegadores que no soportan DOMContentLoaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        if (!window.examSecurity) {
            window.examSecurity = new SeguridadEvaluacion({
                showAlerts: true,
                strictMode: true,
                allowedViolations: 5
            });
        }
    });
} else {
    window.examSecurity = new SeguridadEvaluacion({
        showAlerts: true,
        strictMode: true,
        allowedViolations: 5
    });
}