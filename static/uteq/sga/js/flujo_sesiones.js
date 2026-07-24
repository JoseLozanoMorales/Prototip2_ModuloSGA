/**
 * flujo_sesiones.js  v1.0.0
 * Flujo dinámico en tiempo real de SessionIntentoCuestionario
 * para la vista detallesesion.html (pro_planificacion)
 *
 * Requisitos: jQuery (ya incluido en el proyecto)
 */
(function ($) {
    'use strict';

    /* ────────────────────────────────────────────────────────
       Etiquetas de violaciones (clave → nombre legible)
    ──────────────────────────────────────────────────────── */
    var ETIQUETAS_VIOLACION = {
        copiar:            'Copiar (Ctrl+C)',
        pegar:             'Pegar (Ctrl+V)',
        cortar:            'Cortar (Ctrl+X)',
        clicDerecho:       'Clic derecho',
        capturaPantalla:   'Captura de pantalla',
        herramientasDev:   'Herramientas Dev',
        seleccionMasiva:   'Selección masiva',
        arrastrarSoltar:   'Arrastrar y soltar',
        cambioOrientacion: 'Cambio de orientación',
        perdidaFoco:       'Dejó de interactuar con la evaluación',
        intentoImpresion:  'Intento de impresión',
        cambioTab:         'Cambio de pestaña',
        pestanaDuplicada:  'Pestaña duplicada',
        manipulacionDatos: 'Manipulación de datos'
    };

    /* ────────────────────────────────────────────────────────
       Estado en memoria de la llamada anterior
       { [idSesion]: { total_violaciones, estado_texto } }
    ──────────────────────────────────────────────────────── */
    var estadoPrevio = {};

    /* Controles habilitados recibidos del servidor (null = todos activos) */
    var controlesHabilitados = null;

    /* Filtro de estado activo (id del contador) */
    var filtroEstadoActivo = null;

    /* Criterio de orden activo: null | 'nombre' | 'restricciones' | 'tiempo-fuera' */
    var ordenActivo = null;

    /* ────────────────────────────────────────────────────────
       Ayudantes
    ──────────────────────────────────────────────────────── */
    function claseNivelViolacion(total) {
        if (total === 0) return 'nivel-correcto';
        if (total < 5)  return 'nivel-advertencia';
        return 'nivel-peligro';
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

    /**
     * Construye el HTML interno de una tarjeta a partir de un objeto sesión.
     * @param {Object} sesion - Objeto devuelto por el servidor (un ítem de sesiones[])
     */
    function construirContenidoTarjeta(sesion) {
        var claseEstado    = sesion.estado_clase         || 'label';
        var textoEstado    = sesion.estado_texto         || '—';
        var totalViol      = sesion.total_violaciones    || 0;
        var claseNivel     = claseNivelViolacion(totalViol);
        var nombreCompleto = sesion.nombre_completo      || '(sin nombre)';
        var numIntento     = sesion.numero_intento       || 1;
        var ipCliente      = sesion.ipcliente            || '—';
        var sistemaOp      = sesion.sistemaoperativo     || '—';
        var ultimoAcceso   = sesion.ultimo_acceso        || '—';
        var tiempoTrans    = sesion.tiempo_transcurrido  || '—';
        var tiempoFuera    = sesion.tiempo_fuera         || {};
        var fueraTotalSeg  = normalizarSegundos(tiempoFuera.totalSegundos || 0);
        var urlBloquear    = sesion.url_bloquear          || '';
        var bloqueado      = sesion.bloqueado            || false;
        var finalizo       = sesion.finalizo             || false;
        var notaValor   = typeof sesion.nota === 'number' ? sesion.nota : null;
        var notaDisplay = notaValor !== null ? notaValor.toFixed(2) : '—';
        /* Mostrar botón solo si la evaluación NO ha finalizado y no está bloqueada tras finalizar */
        var puedeBloquear  = urlBloquear && textoEstado !== 'FINALIZÓ' && textoEstado !== 'RESTRINGIDO VARIAS SESIONES' && !(bloqueado && finalizo);

        /* Detalle de violaciones */
        var contenidoViolaciones = '';
        if (sesion.violaciones) {
            $.each(sesion.violaciones, function (clave, valor) {
                if (valor === 0) return; /* omitir violaciones sin ocurrencias */
                /* Omitir violaciones no habilitadas por el profesor */
                if (controlesHabilitados && !controlesHabilitados[clave]) return;
                var nombreViol = ETIQUETAS_VIOLACION[clave] || clave;
                contenidoViolaciones +=
                    '<div class="item-violacion">' +
                        '<span class="nombre-violacion">' + nombreViol + '</span>' +
                        '<span class="contador-violacion">' + valor + '</span>' +
                    '</div>';
            });
        }
        if (!contenidoViolaciones) {
            contenidoViolaciones = '<div style="color:#aaa;font-style:italic">Sin restricción registradas</div>';
        }

        var labelBtn = bloqueado
            ? '<i class="fa fa-unlock"></i> Desbloquear evaluación'
            : '<i class="fa fa-lock"></i> Bloquear evaluación';
        var claseBtn = bloqueado ? 'desbloquear-eval' : 'bloquear-eval';

        return (
            '<div class="tarjeta-sesion-cabecera">' +
                '<span class="nombre-estudiante">' + nombreCompleto + '</span>' +
                '<span class="etiqueta-intento">' + numIntento + ' intento</span>' +
            '</div>' +
            '<div class="fila-estado">' +
                '<span class="' + claseEstado + '">' + textoEstado + '</span>' +
            '</div>' +
            '<div class="fila-tiempo fila-tiempo-transcurrido">' +
                '<span class="etiqueta-icono">⏱ </span>' + tiempoTrans +
            '</div>' +
            '<div class="fila-tiempo fila-tiempo-fuera" style="font-size:12px;color:#6d4c41">' +
                '<span class="etiqueta-icono">🚫 </span>Fuera de evaluación: ' + formatearDuracionSegundos(fueraTotalSeg) +
            '</div>' +
            '<div class="metadatos-sesion">' +
                '<span><span class="etiqueta-icono">IP:</span> ' + ipCliente + '</span>' +
                '<span><span class="etiqueta-icono">SO:</span> ' + sistemaOp + '</span>' +
            '</div>' +
            '<div class="ultimo-acceso">Último acceso: ' + ultimoAcceso + '</div>' +
            '<div class="fila-nota">' +
                '<span class="etiqueta-icono">📝 </span>Nota: ' +
                '<span class="valor-nota">' + notaDisplay + '</span>' +
            '</div>' +
            '<div class="total-violaciones ' + claseNivel + '">' +
                '⚠ Restricciones: ' + totalViol +
            '</div>' +
            '<div class="detalle-violaciones">' + contenidoViolaciones + '</div>' +
            (puedeBloquear
                ? '<button type="button" ' +
                      'class="btn-accion-eval ' + claseBtn + '" ' +
                      'data-url="' + urlBloquear + '" ' +
                      'data-bloqueado="' + (bloqueado ? '1' : '0') + '" ' +
                      'data-nombre="' + nombreCompleto.replace(/"/g, '&quot;') + '">' +
                      labelBtn +
                  '</button>'
                : '')
        );
    }

    /**
     * Construye el HTML interno de una tarjeta "Sin evaluar".
     * Más simple: solo nombre + estado, sin datos de sesión ni violaciones.
     */
    function construirTarjetaSinEvaluar(est) {
        return (
            '<div class="tarjeta-sesion-cabecera">' +
                '<span class="nombre-estudiante">' + (est.nombre_completo || '(sin nombre)') + '</span>' +
            '</div>' +
            '<div class="fila-estado">' +
                '<span class="label etiqueta-sin-evaluar">SIN EVALUAR</span>' +
            '</div>'
        );
    }

    /**
     * Actualiza solo el tiempo transcurrido en una tarjeta existente.
     */
    function actualizarTiempo($tarjeta, tiempoTrans) {
        var $filaTiempo = $tarjeta.find('.fila-tiempo-transcurrido');
        if ($filaTiempo.length === 0) {
            $filaTiempo = $tarjeta.find('.fila-tiempo').first();
        }
        $filaTiempo.html(
            '<span class="etiqueta-icono">⏱ </span>' + tiempoTrans
        );
    }

    /**
     * Aplica la animación de destello a una tarjeta.
     * @param {jQuery} $tarjeta
     * @param {string} tipo - 'nueva' | 'modificada'
     */
    function destellarTarjeta($tarjeta, tipo) {
        $tarjeta.removeClass('sesion-nueva sesion-modificada');
        /* forzar reflow para reiniciar la animación */
        void $tarjeta[0].offsetWidth;
        $tarjeta.addClass(tipo === 'nueva' ? 'sesion-nueva' : 'sesion-modificada');
    }

    /**
     * Actualiza el contador de resultados visibles (ambas grillas).
     */
    function actualizarContadorResultados() {
        var totalSesiones      = $('#grilla-sesiones .tarjeta-sesion').length;
        var visiblesSesiones   = $('#grilla-sesiones .tarjeta-sesion:visible').length;
        var totalSinEvaluar    = $('#grilla-sin-evaluar .tarjeta-sesion').length;
        var visiblesSinEvaluar = $('#grilla-sin-evaluar .tarjeta-sesion:visible').length;
        var totalVis = visiblesSesiones + visiblesSinEvaluar;
        var totalTot = totalSesiones + totalSinEvaluar;
        $('#contador-resultados').text('Mostrando ' + totalVis + ' de ' + totalTot + ' registros');
    }

    /**
     * Filtra ambas grillas según el texto del buscador y el estado seleccionado.
     * El filtro de estado solo aplica a #grilla-sesiones; sin-evaluar solo usa texto.
     */
    function filtrarFlujo() {
        var consulta = $('#entrada-busqueda').val().toLowerCase().trim();

        $('#grilla-sesiones .tarjeta-sesion').each(function () {
            var nombreNormalizado = $(this).attr('data-nombre-normalizado') || '';
            var estadoCnt         = $(this).attr('data-estado-cnt') || '';
            var coincideNombre    = !consulta || nombreNormalizado.indexOf(consulta) !== -1;
            var coincideEstado    = !filtroEstadoActivo || estadoCnt === filtroEstadoActivo;
            $(this).toggle(coincideNombre && coincideEstado);
        });

        $('#grilla-sin-evaluar .tarjeta-sesion').each(function () {
            var nombreNormalizado = $(this).attr('data-nombre-normalizado') || '';
            $(this).toggle(!consulta || nombreNormalizado.indexOf(consulta) !== -1);
        });

        /* Mensaje cuando la búsqueda oculta todos los sin-evaluar */
        var totalSinEval   = $('#grilla-sin-evaluar .tarjeta-sesion').length;
        var visibleSinEval = $('#grilla-sin-evaluar .tarjeta-sesion:visible').length;
        $('#mensaje-busqueda-sin-evaluar').toggle(totalSinEval > 0 && visibleSinEval === 0);

        /* Mostrar mensaje si hay tarjetas pero ninguna es visible tras el filtro */
        var totalSesiones   = $('#grilla-sesiones .tarjeta-sesion').length;
        var visibleSesiones = $('#grilla-sesiones .tarjeta-sesion:visible').length;
        $('#mensaje-filtro-vacio').toggle(totalSesiones > 0 && visibleSesiones === 0);

        actualizarContadorResultados();
    }

    /**
     * Reordena las tarjetas de #grilla-sesiones según ordenActivo.
     * Si ordenActivo es null no hace nada (se mantiene el orden por defecto).
     */
    function ordenarGrilla() {
        if (!ordenActivo) return;
        var $grilla  = $('#grilla-sesiones');
        var tarjetas = $grilla.find('.tarjeta-sesion').get();
        tarjetas.sort(function (a, b) {
            if (ordenActivo === 'nombre') {
                var na = $(a).attr('data-nombre-normalizado') || '';
                var nb = $(b).attr('data-nombre-normalizado') || '';
                return na.localeCompare(nb);
            }
            if (ordenActivo === 'restricciones') {
                return parseInt($(b).attr('data-total-violaciones') || '0', 10) -
                       parseInt($(a).attr('data-total-violaciones') || '0', 10);
            }
            if (ordenActivo === 'tiempo-fuera') {
                return parseInt($(b).attr('data-tiempo-fuera-seg') || '0', 10) -
                       parseInt($(a).attr('data-tiempo-fuera-seg') || '0', 10);
            }
            return 0;
        });
        $.each(tarjetas, function (_, el) { $grilla.append(el); });
    }

    /* ────────────────────────────────────────────────────────
       Mapa: texto de estado → id del contador en el DOM
       (estados exactos de SessionIntentoCuestionario.estado_conexion_evaluacion)
    ──────────────────────────────────────────────────────── */
    var MAPA_ESTADO_CONTADOR = {
        'EVALUANDO':                      'cnt-activo',
        'DESCONECTADO':                'cnt-desconectado',
        'FINALIZÓ':                    'cnt-finalizo',
        'RESTRINGIDO VARIAS SESIONES': 'cnt-restringido',
        'BLOQUEADO':                   'cnt-bloqueado'
    };

    /**
     * Recorre estadoPrevio (una entrada por SessionIntentoCuestionario),
     * cuenta por estado_texto y actualiza los divs del panel.
     * "No iniciaron" = total_matriculados − matrículas únicas con alguna sesión.
     */
    function actualizarContadoresEstado() {
        /* Contadores en cero */
        var conteos = {
            'cnt-activo':       0,
            'cnt-desconectado': 0,
            'cnt-finalizo':     0,
            'cnt-restringido':  0,
            'cnt-bloqueado':    0
        };

        /* Matrículas únicas que tienen al menos una SessionIntentoCuestionario */
        var matriculasConSesion = {};

        $.each(estadoPrevio, function (_, datos) {
            /* Contar por estado (una SessionIntentoCuestionario = un voto) */
            var idCnt = MAPA_ESTADO_CONTADOR[datos.estado_texto];
            if (idCnt) { conteos[idCnt]++; }

            /* Acumular matrícula para calcular "No iniciaron" */
            if (datos.persona_id) {
                matriculasConSesion[datos.persona_id] = true;
            }
        });

        /* "No iniciaron": matriculados − matrículas únicas con sesión */
        var totalMatriculados  = parseInt(
            $('#panel-contadores-estado').attr('data-total-matriculados') || '0', 10
        );
        var matriculasUnicas   = Object.keys(matriculasConSesion).length;
        conteos['cnt-no-inicio'] = Math.max(0, totalMatriculados - matriculasUnicas);

        /* Actualizar el DOM; animar si el número cambió */
        $.each(conteos, function (idCnt, nuevoValor) {
            var $num = $('#' + idCnt + ' .cnt-numero');
            var valorAnterior = parseInt($num.text(), 10);
            $num.text(nuevoValor);
            if (valorAnterior !== nuevoValor) {
                $num.removeClass('cambio');
                void $num[0].offsetWidth; /* reflow para reiniciar animación */
                $num.addClass('cambio');
            }
        });
    }

    /**
     * Escribe la hora actual en el span de última actualización.
     */
    function registrarUltimaActualizacion() {
        var ahora = new Date();
        var hora  = ahora.toLocaleTimeString('es-EC', {
            hour:   '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
        $('#ultima-actualizacion').text('Última actualización: ' + hora);
    }

    /* ────────────────────────────────────────────────────────
       Helper para obtener cookie CSRF de Django (para fetch)
    ──────────────────────────────────────────────────────── */
    function _getCookie(name) {
        var match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
        return match ? decodeURIComponent(match[1]) : '';
    }

    /* Evitar solapamiento de peticiones */
    var _cargaEnCurso = false;

    /**
     * Función principal: llama al servidor y procesa la respuesta.
     * @param {string} id - ID encriptado del cuestionario
     * @param {string} idtipo - Tipo de evaluación encriptado
     */
    async function cargarFlujoSesiones(id, idtipo) {
        if (_cargaEnCurso) return;
        _cargaEnCurso = true;

        try {
            var response = await fetch('/sesionesentiemporeal', {
                method: 'POST',
                headers: {
                    'X-CSRFToken': _getCookie('csrftoken'),
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({ id: id, idtipo: idtipo }),
            });

            var respuesta = await response.json();

            if (respuesta.result !== 'ok') {
                console.error('[flujo_sesiones] Error del servidor:', respuesta.mensaje);
                $('#contador-resultados').text('Error: ' + (respuesta.mensaje || 'respuesta inesperada'));
                return;
            }

            /* Actualizar controles habilitados (una sola vez o si cambian) */
            if (respuesta.controles_habilitados) {
                controlesHabilitados = respuesta.controles_habilitados;
            }

            var listaSesiones       = respuesta.sesiones    || [];
            var listaSinEvaluar     = respuesta.sin_evaluar || [];
            var $grilla             = $('#grilla-sesiones');
            var $mensajeSinSesiones = $('#mensaje-sin-sesiones');

            if (listaSesiones.length === 0) {
                $grilla.empty();
                $mensajeSinSesiones.show();
                actualizarContadorResultados();
                actualizarContadoresEstado();
                registrarUltimaActualizacion();
            } else {
                $mensajeSinSesiones.hide();

                var idsProcesados = {};

                $.each(listaSesiones, function (_, sesion) {
                    var idSesion           = sesion.id;
                    var idTarjeta          = 'ses-' + idSesion;
                    var $tarjeta           = $('#' + idTarjeta);
                    var estadoPrevioSesion = estadoPrevio[idSesion];
                    var nombreNormalizado  = (sesion.nombre_completo || '').toLowerCase();

                    idsProcesados[idSesion] = true;

                    if (!estadoPrevioSesion) {
                        var $tarjetaNueva = $('<div>', {
                            id:                        idTarjeta,
                            'class':                   'tarjeta-sesion',
                            'data-nombre-normalizado': nombreNormalizado,
                            'data-estado-cnt':         MAPA_ESTADO_CONTADOR[sesion.estado_texto] || '',
                            'data-total-violaciones':  sesion.total_violaciones || 0,
                            'data-tiempo-fuera-seg':   normalizarSegundos((sesion.tiempo_fuera || {}).totalSegundos || 0)
                        }).html(construirContenidoTarjeta(sesion));
                        $grilla.prepend($tarjetaNueva);
                        destellarTarjeta($tarjetaNueva, 'nueva');
                    } else {
                        var tuvoCambioImportante = (
                            estadoPrevioSesion.total_violaciones !== sesion.total_violaciones ||
                            estadoPrevioSesion.estado_texto      !== sesion.estado_texto ||
                            estadoPrevioSesion.bloqueado         !== sesion.bloqueado ||
                            estadoPrevioSesion.nota              !== sesion.nota ||
                            estadoPrevioSesion.tiempo_fuera_total !== normalizarSegundos((sesion.tiempo_fuera || {}).totalSegundos || 0) ||
                            estadoPrevioSesion.tiempo_fuera_foco !== normalizarSegundos((sesion.tiempo_fuera || {}).perdidaFocoSegundos || 0) ||
                            estadoPrevioSesion.tiempo_fuera_tab !== normalizarSegundos((sesion.tiempo_fuera || {}).cambioTabSegundos || 0)
                        );
                        if ($tarjeta.length === 0) {
                            var $tarjetaRecreada = $('<div>', {
                                id:                        idTarjeta,
                                'class':                   'tarjeta-sesion',
                                'data-nombre-normalizado': nombreNormalizado,
                                'data-estado-cnt':         MAPA_ESTADO_CONTADOR[sesion.estado_texto] || '',
                                'data-total-violaciones':  sesion.total_violaciones || 0,
                                'data-tiempo-fuera-seg':   normalizarSegundos((sesion.tiempo_fuera || {}).totalSegundos || 0)
                            }).html(construirContenidoTarjeta(sesion));
                            $grilla.prepend($tarjetaRecreada);
                            destellarTarjeta($tarjetaRecreada, 'nueva');
                        } else if (tuvoCambioImportante) {
                            $tarjeta.attr('data-estado-cnt', MAPA_ESTADO_CONTADOR[sesion.estado_texto] || '');
                            $tarjeta.attr('data-total-violaciones', sesion.total_violaciones || 0);
                            $tarjeta.attr('data-tiempo-fuera-seg', normalizarSegundos((sesion.tiempo_fuera || {}).totalSegundos || 0));
                            $tarjeta.html(construirContenidoTarjeta(sesion));
                            $grilla.prepend($tarjeta);
                            destellarTarjeta($tarjeta, 'modificada');
                        } else {
                            actualizarTiempo($tarjeta, sesion.tiempo_transcurrido || '—');
                        }
                    }

                    estadoPrevio[idSesion] = {
                        total_violaciones: sesion.total_violaciones,
                        estado_texto:      sesion.estado_texto,
                        bloqueado:         sesion.bloqueado || false,
                        nota:              sesion.nota || 0,
                        persona_id:        sesion.persona_id || null,
                        tiempo_fuera_total: normalizarSegundos((sesion.tiempo_fuera || {}).totalSegundos || 0),
                        tiempo_fuera_foco:  normalizarSegundos((sesion.tiempo_fuera || {}).perdidaFocoSegundos || 0),
                        tiempo_fuera_tab:   normalizarSegundos((sesion.tiempo_fuera || {}).cambioTabSegundos || 0)
                    };
                });

                /* Eliminar tarjetas de sesiones que ya no están en la respuesta */
                $grilla.find('.tarjeta-sesion').each(function () {
                    var idDOM = $(this).attr('id');
                    var idNum = idDOM ? idDOM.replace('ses-', '') : '';
                    if (idNum && !idsProcesados[idNum]) {
                        $(this).remove();
                        delete estadoPrevio[idNum];
                    }
                });
            }

            /* ── Grilla "Sin evaluar" ── */
            var $grillaSinEvaluar      = $('#grilla-sin-evaluar');
            var $mensajeTodoEvaluaron  = $('#mensaje-sin-sin-evaluar');

            /* IDs de sin-evaluar que llegan ahora */
            var idsSinEvalActuales = {};
            $.each(listaSinEvaluar, function (_, est) {
                idsSinEvalActuales[est.id] = true;
            });

            /* Eliminar tarjetas que ya iniciaron sesión */
            $grillaSinEvaluar.find('.tarjeta-sesion').each(function () {
                if (!idsSinEvalActuales[$(this).attr('id')]) {
                    $(this).remove();
                }
            });

            /* Agregar las que aún no están en el DOM */
            $.each(listaSinEvaluar, function (_, est) {
                if ($('#' + est.id).length === 0) {
                    var $t = $('<div>', {
                        id:                        est.id,
                        'class':                   'tarjeta-sesion tarjeta-sin-evaluar',
                        'data-nombre-normalizado': (est.nombre_completo || '').toLowerCase()
                    }).html(construirTarjetaSinEvaluar(est));
                    $grillaSinEvaluar.append($t);
                }
            });

            /* Actualizar contador del título "Sin evaluar" */
            var totalSinEval = $grillaSinEvaluar.find('.tarjeta-sesion').length;
            $('#cnt-sin-evaluar-titulo').text(totalSinEval);
            if (totalSinEval === 0) {
                $grillaSinEvaluar.hide();
                $mensajeTodoEvaluaron.show();
            } else {
                $grillaSinEvaluar.show();
                $mensajeTodoEvaluaron.hide();
            }

            ordenarGrilla();
            filtrarFlujo();
            actualizarContadoresEstado();
            registrarUltimaActualizacion();
        } catch (e) {
            console.warn('[flujo_sesiones] Error en segundo plano:', e.message);
        } finally {
            _cargaEnCurso = false;
        }
    }

    /* ────────────────────────────────────────────────────────
       Inicialización cuando el DOM está listo
    ──────────────────────────────────────────────────────── */
    $(function () {
        var $grilla = $('#grilla-sesiones');
        if ($grilla.length === 0) return;

        var id = $grilla.attr('data-id');
        var idTipo = $grilla.attr('data-tipo');
        if (!id || !idTipo) return;

        $('#entrada-busqueda').on('input keyup', function () { filtrarFlujo(); });
        $('#btn-limpiar-busqueda').on('click', function () {
            $('#entrada-busqueda').val('');
            filtrarFlujo();
        });

        /* Ordenar sesiones activas (toggle: clic activa, clic de nuevo desactiva) */
        $(document).on('click', '.btn-orden', function () {
            var nuevoOrden = $(this).attr('data-orden');
            if (ordenActivo === nuevoOrden) {
                ordenActivo = null;
                $('.btn-orden').removeClass('active');
            } else {
                ordenActivo = nuevoOrden;
                $('.btn-orden').removeClass('active');
                $(this).addClass('active');
            }
            ordenarGrilla();
            filtrarFlujo();
        });

        /* Filtro por estado al hacer clic en los contadores */
        $('#cnt-activo, #cnt-desconectado, #cnt-finalizo, #cnt-restringido, #cnt-bloqueado').on('click', function () {
            var idCnt  = $(this).attr('id');
            var $panel = $('#panel-contadores-estado');
            var $filtros = $('#cnt-activo, #cnt-desconectado, #cnt-finalizo, #cnt-restringido, #cnt-bloqueado');

            if (filtroEstadoActivo === idCnt) {
                filtroEstadoActivo = null;
                $filtros.removeClass('contador-filtro-activo');
                $panel.removeClass('tiene-filtro');
            } else {
                filtroEstadoActivo = idCnt;
                $filtros.removeClass('contador-filtro-activo');
                $(this).addClass('contador-filtro-activo');
                $panel.addClass('tiene-filtro');
            }
            filtrarFlujo();
        });

        /* ── Bloquear / Desbloquear evaluación desde la tarjeta ── */
        $(document).on('click', '.btn-accion-eval', function () {
            var $btn      = $(this);
            var href      = $btn.attr('data-url');   /* URL construida en el backend */
            var bloqueado = $btn.attr('data-bloqueado') === '1';
            var nombre    = $btn.attr('data-nombre');
            var accion    = bloqueado ? 'Desbloquear' : 'Bloquear';
            var iconoModal = bloqueado ? 'fa fa-unlock' : 'fa fa-lock';
            var colorIcono = bloqueado ? '#27ae60'      : '#c0392b';

            if (!href) return;

            /* Modal de confirmación usando la infraestructura del proyecto */
            abrirnotificacionmodal(
                '¿Seguro que desea <b>' + accion.toUpperCase() + '</b> la evaluación de:<br>' +
                '<span style="color:#555;font-size:13px">' + nombre + '</span>',
                accion + ' evaluación',
                true,           /* habilitarcerrar */
                true,           /* obligatoria – backdrop estático */
                iconoModal,
                colorIcono,
                '460',
                function () {   /* callbackAceptar */
                    $btn.prop('disabled', true)
                        .html('<i class="fa fa-spinner fa-spin"></i> Procesando...');

                    /* Parsear URL del backend → ruta + params como POST body */
                    var urlObj   = new URL(href, window.location.origin);
                    var postData = {};
                    urlObj.searchParams.forEach(function (v, k) { postData[k] = v; });

                    $.ajax({
                        type:    'POST',
                        url:     urlObj.pathname,
                        data:    postData,
                        headers: { 'X-CSRFToken': _getCookie('csrftoken') },
                        success: function (resp) {
                            if (resp.result === 'ok') {
                                /* Recarga inmediata sin esperar el siguiente ciclo */
                                if (_flujoTimer) { clearTimeout(_flujoTimer); _flujoTimer = null; }
                                cargarFlujoSesiones(id, idTipo).then(_programarFlujo);
                            } else {
                                $btn.prop('disabled', false);
                                abrirnotificacionmodal(
                                    resp.mensaje || 'No se pudo completar la acción.',
                                    'Error', true, false, 'fa fa-times-circle', '#c0392b'
                                );
                            }
                        },
                        error: function () {
                            $btn.prop('disabled', false);
                            abrirnotificacionmodal(
                                'Error de conexión al procesar la acción.',
                                'Error', true, false, 'fa fa-times-circle', '#c0392b'
                            );
                        }
                    });
                }
            );
        });

        /* Ciclo en segundo plano: setTimeout recursivo (sin solapamiento) */
        var _flujoTimer = null;
        function _programarFlujo() {
            if (_flujoTimer) clearTimeout(_flujoTimer);
            _flujoTimer = setTimeout(async function () {
                await cargarFlujoSesiones(id, idTipo);
                _programarFlujo();
            }, 10000);
        }

        // Primera carga inmediata + iniciar ciclo
        cargarFlujoSesiones(id, idTipo).then(_programarFlujo);
    });

})(jQuery);


