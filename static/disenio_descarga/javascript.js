(function($) {
    'use strict';

    // ============================================
    // GENERAR PROGRESO REPORTE - SISTEMA OPTIMIZADO
    // ============================================

    var GenerarProgresoReporte = {
        // Estado
        idProgresoActual: null,
        intervaloSondeo: null,
        enGeneracion: false,
        tiempoInicio: null,
        csrftoken: null,
        _sondeoEnCurso: false,  // evita que dos peticiones de polling se solapen

        // Configuración
        configuracion: {
            intervaloSondeoMs: 3000
        },

        // Clave usada en localStorage para persistir el estado
        _STORAGE_KEY: 'uteq_reporte_progreso',

        // ============================================
        // PERSISTENCIA (localStorage)
        // ============================================

        /**
         * Guarda el estado actual del proceso en localStorage para
         * que pueda restaurarse si el usuario navega a otra página.
         */
        guardarEstado: function(porcentajereal=0) {
            try {
                var estado = {
                    idProgresoActual: this.idProgresoActual,
                    enGeneracion: this.enGeneracion,
                    tiempoInicio: this.tiempoInicio,
                    nombreReporte: $('#toastTitle').text(),
                    subtitulo: $('#toastSubtitle').text(),
                    porcentaje: parseInt($('#toastProgressFill').css('width')) || 0,
                    tiempo: $('#toastTime').text(),
                    estado: $('#toastStatus').text(),
                    timestamp: Date.now(),
                    porcentajereal: porcentajereal
                };
                localStorage.setItem(this._STORAGE_KEY, JSON.stringify(estado));
            } catch (e) {
                console.warn('GenerarProgresoReporte: no se pudo guardar estado en localStorage', e);
            }
        },

        /**
         * Elimina el estado persistido del localStorage.
         */
        limpiarEstadoGuardado: function() {
            try {
                localStorage.removeItem(this._STORAGE_KEY);
            } catch (e) {}
        },

        /**
         * Al inicializar, comprueba si había un proceso en curso y lo retoma.
         */
        restaurarEstado: function() {
            try {
                var raw = localStorage.getItem(this._STORAGE_KEY);
                if (!raw) return;

                var estado = JSON.parse(raw);

                // Descartar estados con más de 2 horas de antigüedad
                if (!estado.idProgresoActual || !estado.enGeneracion) {
                    this.limpiarEstadoGuardado();
                    return;
                }
                var edadMs = Date.now() - (estado.timestamp || 0);
                if (edadMs > 2 * 60 * 60 * 1000) {
                    this.limpiarEstadoGuardado();
                    return;
                }

                // Restaurar estado interno
                this.idProgresoActual = estado.idProgresoActual;
                this.enGeneracion = true;
                this.tiempoInicio = estado.tiempoInicio || Date.now();

                // Restaurar interfaz con los últimos datos conocidos
                this.resetearEstado();
                if (estado.nombreReporte) $('#toastTitle').text(estado.nombreReporte);
                if (estado.subtitulo)    $('#toastSubtitle').text(estado.subtitulo);
                if (estado.porcentaje)   $('#toastProgressFill').css('width', estado.porcentaje + '%');
                if (estado.tiempo)       $('#toastTime').text(estado.tiempo);
                if (estado.estado)       $('#toastStatus').text(estado.estado);

                // Mostrar el modal y reanudar sondeo
                $('#modalGenerarReporte').addClass('show');

                this.iniciarSondeo();
                var self = this
                setTimeout(function() {
                    self.iniciarSondeo();
                }, 500);

            } catch (e) {
                console.warn('GenerarProgresoReporte: error al restaurar estado', e);
                this.limpiarEstadoGuardado();
            }
        },

        // ============================================
        // INICIALIZACIÓN
        // ============================================

        inicializar: function() {
            this.obtenerCSRFToken();
            this.vincularEventos();
            this.configurarBeacon();
            this.restaurarEstado(); // retomar proceso si el usuario venía de otra página
        },

        obtenerCSRFToken: function() {
            var getcookie = getCookie('csrftoken');
            this.csrftoken = getcookie || '';
        },

        // ============================================
        // EVENTOS
        // ============================================

        vincularEventos: function() {
            var self = this;

            // Detectar clicks en elementos con clase generar_reporte
            $(document).on('click', '.generar_reporte', function(e) {
                e.preventDefault();

                var $el = $(this);

                // Verificar si está deshabilitado
                if ($el.hasClass('disabled') || $el.prop('disabled')) {
                    return false;
                }

                // Obtener la URL
                var url = $el.attr('nhref') || $el.data('report-url');
                var nombre = $el.data('nombre-reporte') || 'Reporte';
                var metodo = ($el.data('metodo-reporte') || 'POST').toUpperCase();

                if (!url) {
                    self.mostrarNotificacion('Error: URL del reporte no especificada', 'error');
                    return false;
                }

                // Generar reporte
                self.generar(url, nombre, metodo);
            });

            // Botones del modal
            $('#toastBtnCancel').on('click', function(e) {
                e.preventDefault();
                self.cancelar();
            });

            $('#toastClose').on('click', function(e) {
                e.preventDefault();
                self.cancelar();
            });

        },

        configurarBeacon: function() {
            var self = this;
            $(window).on('beforeunload', function() {
                // Solo guardar el estado; NO cancelar la tarea para que siga corriendo
                if (self.enGeneracion && self.idProgresoActual) {
                    self.guardarEstado();
                }
            });
        },

        // ============================================
        // METODO PUBLICO PRINCIPAL
        // ============================================

        /**
         * Genera un reporte desde cualquier URL
         * @param {string} url - URL completa del reporte (con parámetros si es necesario)
         * @param {string} nombrereporte - Nombre del reporte (opcional)
         * @param {string} metodo - Metodo de envio POST o GET
         */
        generar: function(url, nombrereporte, metodo) {
            if (this.enGeneracion) {
                this.mostrarNotificacion('Ya hay un reporte generándose. Por favor espere.', 'warning');
                // Mostrar el modal existente
                $('#modalGenerarReporte').addClass('show');
                return;
            }

            if (!url) {
                console.error('URL del reporte es requerida');
                return;
            }

            this.enGeneracion = true;
            this.tiempoInicio = Date.now();

            // Mostrar modal
            this.resetearEstado();
            $('#modalGenerarReporte').addClass('show');


            // Actualizar título si se proporcionó
            if (nombrereporte) {
                $('#toastTitle').text('Generando ' + nombrereporte.toLowerCase());
            }

            var self = this;

            // Preparar parámetros
            let urlBase = url.split('?')[0];
            let cadenaConsulta = url.split('?')[1];
            let parametros = {};

            if (cadenaConsulta) {
                cadenaConsulta.split('&').forEach(function(parte) {
                    let elemento = parte.split('=');
                    parametros[elemento[0]] = decodeURIComponent(elemento[1]);
                });
            }
            parametros['csrfmiddlewaretoken'] = this.csrftoken;
            if (nombrereporte) {
                parametros['nombre_reporte'] = nombrereporte;
            }

            // Realizar petición a la URL
            $.ajax({
                url: urlBase,
                type: metodo,
                data: parametros,
                dataType: 'json',
                success: function(response) {
                    if (response.progreso_id) {
                        self.idProgresoActual = response.progreso_id;
                        self.iniciarSondeo();
                        if (response.mensaje) {
                            $('#toastSubtitle').text(response.mensaje);
                        }
                    } else {
                        if (response.mensaje) {
                            self.cerrar();
                            self.mostrarNotificacion(response.mensaje, 'error');
                        } else {
                            self.mostrarError('No se recibió ID de progreso del servidor');
                        }
                    }
                },
                error: function(xhr, estado, error) {
                    var mensajeError = 'Error al iniciar el reporte';

                    try {
                        if (xhr.responseJSON) {
                            if (xhr.responseJSON.error) {
                                mensajeError = xhr.responseJSON.error;
                            } else if (xhr.responseJSON.message) {
                                mensajeError = xhr.responseJSON.message;
                            }
                        }
                    } catch (e) {
                        mensajeError = 'Error: ' + error;
                    }

                    self.mostrarError(mensajeError);
                }
            });
        },

        generar_con_id: function(nombrereporte, id_proceso, mensaje = null) {
            if (this.enGeneracion) {
                this.mostrarNotificacion('Ya hay un reporte generándose. Por favor espere.', 'warning');
                // Mostrar el modal existente
                $('#modalGenerarReporte').addClass('show');
                return;
            }

            if (!id_proceso) {
                console.error('Id del proceso del reporte es requerido');
                return;
            }

            this.enGeneracion = true;
            this.tiempoInicio = Date.now();

            // Mostrar modal
            this.resetearEstado();
            $('#modalGenerarReporte').addClass('show');


            // Actualizar título si se proporcionó
            if (nombrereporte) {
                $('#toastTitle').text('Generando ' + nombrereporte.toLowerCase());
            }

            var self = this;

            self.idProgresoActual = id_proceso;
            self.iniciarSondeo();
            if (mensaje) {
                $('#toastSubtitle').text(mensaje);
            }
        },

        // ============================================
        // SONDEO (POLLING)
        // ============================================

        iniciarSondeo: function() {
            var self = this;
            this.intervaloSondeo = setInterval(function() {
                self.verificarEstado();
            }, this.configuracion.intervaloSondeoMs);
        },

        completarProceso: function(mensaje) {
            if (!this.enGeneracion) return;
            this.enGeneracion = false;
            this.limpiarEstadoGuardado();
            this.detenerSondeo();

            $('#modalGenerarReporte').addClass('success');
            $('#toastIcon').addClass('success').html('<i class="fa fa-check"></i>');
            $('#toastTitle').text('¡Completado!');
            $('#toastSubtitle').text(mensaje || 'Proceso ejecutado exitosamente.');
            $('#toastProgressFill').css('width', '100%');
            $('#toastStatus').text('Finalizado');
            $('#toastTime').text('0s');

            var self = this;
            $('#toastBtnCancel')
                .html('<i class="fa fa-check"></i> Cerrar')
                .removeClass('boton-cancelar')
                .css({background: '#d1fae5', color: '#065f46'})
                .off('click')
                .on('click', function(e) {
                    e.preventDefault();
                    self.cerrar();
                });
            $('#toastClose').off('click').on('click', function(e) {
                e.preventDefault();
                self.cerrar();
            });
        },

        verificarEstado: function() {
            // Evita que dos peticiones se solapen si el servidor tarda más de intervaloSondeoMs
            if (this._sondeoEnCurso) return;
            if (!this.enGeneracion) return;
            this._sondeoEnCurso = true;

            var self = this;

            $.ajax({
                url: '/verificarprogreso/' + this.idProgresoActual + '/',
                method: 'GET',
                dataType: 'json',
                success: function(data) {
                    if (data.estado === 'enprogreso') {
                        self.actualizarProgreso(
                            parseInt(data.actual) || 0,
                            parseInt(data.total) || 0,
                            parseInt(data.porcentaje) || 0
                        );
                        self.guardarEstado(parseInt(data.porcentaje) || 0);
                    } else if (data.estado === 'completado') {
                        self.actualizarProgreso(
                            parseInt(data.actual) || 0,
                            parseInt(data.total) || 0,
                            parseInt(data.porcentaje) || 0
                        );
                        // self.completar(data.urlarchivo, data.nombrearchivo);
                        if (data.tipo === 'proceso') {
                            self.completarProceso(data.mensaje);  // nuevo método, sin descarga
                        } else {
                            self.completar(data.urlarchivo, data.nombrearchivo);
                        }
                    } else if (data.estado === 'cancelado') {
                        self.mostrarCancelado(data.mensaje);
                    } else if ((data.estado === 'error') || (data.estado === 'noencontrado')) {
                        self.mostrarError(data.mensaje);
                    }
                },
                error: function(xhr) {
                    if (xhr.status === 404) {
                        self.mostrarError('Proceso no encontrado');
                    } else if (xhr.status === 403) {
                        self.mostrarError('No tiene autorización para este proceso');
                    } else {
                        console.error('Error al verificar estado:', xhr);
                    }
                },
                complete: function() {
                    self._sondeoEnCurso = false;
                }
            });
        },

        detenerSondeo: function() {
            if (this.intervaloSondeo) {
                clearInterval(this.intervaloSondeo);
                this.intervaloSondeo = null;
            }
            this._sondeoEnCurso = false;
        },

        // ============================================
        // ACTUALIZACIÓN DE INTERFAZ
        // ============================================

        actualizarProgreso: function(actual, total, porcentaje) {
            $('#toastProgressFill').css('width', porcentaje + '%');

            if (total > 0) {
                $('#toastSubtitle').text('Procesando ' + this.formatearNumero(actual) + ' de ' + this.formatearNumero(total) + ' registros');
            } else {
                $('#toastSubtitle').text('Procesando datos...');
            }

            if (actual > 0 && total > 0) {
                var transcurrido = (Date.now() - this.tiempoInicio) / 1000;
                var restante = ((total - actual) / actual) * transcurrido;
                $('#toastTime').text(this.formatearTiempo(restante));
            } else {
                $('#toastTime').text('Calculando...');
            }

            $('#toastStatus').text('En proceso');
        },

        // completar: function(urlarchivo, nombrearchivo) {
        //     // Guardia: si ya se invocó (race condition del polling), ignorar la segunda llamada
        //     if (!this.enGeneracion) return;
        //     this.enGeneracion = false;
        //     this.limpiarEstadoGuardado();
        //     this.detenerSondeo();
        //
        //     $('#modalGenerarReporte').addClass('success');
        //     $('#toastIcon').addClass('success').html('<i class="fa fa-check"></i>');
        //     $('#toastTitle').text('¡Completado!');
        //     $('#toastSubtitle').text('Descargando archivo...');
        //     $('#toastProgressFill').css('width', '100%');
        //     $('#toastStatus').text('Finalizado');
        //     $('#toastTime').text('0s');
        //
        //     var self = this;
        //
        //     this.descargarDesdeURL(urlarchivo, nombrearchivo)
        //         .then(function() {
        //             $('#toastSubtitle').text('Archivo descargado: ' + nombrearchivo);
        //             $('#toastBtnCancel')
        //                 .html('<i class="fa fa-check"></i> Cerrar')
        //                 .removeClass('boton-cancelar')
        //                 .css({background: '#d1fae5', color: '#065f46'})
        //                 .off('click')
        //                 .on('click', function(e) {
        //                     e.preventDefault();
        //                     self.cerrar();
        //                 });
        //             $('#toastClose').off('click').on('click', function(e) {
        //                 e.preventDefault();
        //                 self.cerrar();
        //             });
        //         })
        //         .catch(function(e) {
        //             self.mostrarError('Error al descargar: ' + e.message);
        //         });
        // },

        completar: function(urlarchivo, nombrearchivo) {
            // Guardia: si ya se invocó (race condition del polling), ignorar la segunda llamada
            if (!this.enGeneracion) return;
            this.detenerSondeo();
            this.enGeneracion = false;
            this.limpiarEstadoGuardado();


            $('#modalGenerarReporte').addClass('success');
            $('#toastIcon').addClass('success').html('<i class="fa fa-check"></i>');
            $('#toastTitle').text('¡Completado!');
            $('#toastSubtitle').text('Descargando archivo...');
            $('#toastProgressFill').css('width', '100%');
            $('#toastStatus').text('Finalizado');
            $('#toastTime').text('0s');

            // ← CAMBIO CLAVE: botón pasa a "Cerrar" AHORA, de forma síncrona,
            //   sin esperar a que la descarga async termine.
            //   Así, si el usuario navega y vuelve, el modal siempre queda cerrable.
            var self = this;
            var fnCerrar = function(e) {
                e.preventDefault();
                self.cerrar();
            };
            $('#toastBtnCancel')
                .html('<i class="fa fa-check"></i> Cerrar')
                .removeClass('boton-cancelar')
                .css({background: '#d1fae5', color: '#065f46'})
                .off('click')
                .on('click', fnCerrar);
            $('#toastClose').off('click').on('click', fnCerrar);

            this.descargarDesdeURL(urlarchivo, nombrearchivo)
                .then(function() {
                    // Solo actualiza el subtítulo, el botón ya está correcto
                    $('#toastSubtitle').text('Archivo descargado: ' + nombrearchivo);
                })
                .catch(function() {
                    // No mostrar error fatal — la descarga pudo haber iniciado igual.
                    // Solo ofrecer enlace manual de respaldo.
                    $('#toastSubtitle').html(
                        'Si la descarga no inició, ' +
                        '<a href="' + urlarchivo + '" download="' + nombrearchivo + '" ' +
                        'style="color:#065f46;font-weight:bold;">haz clic aquí</a>.'
                    );
                });
        },

        mostrarError: function(mensaje) {
            this.enGeneracion = false;    // evita que beforeunload vuelva a guardar el estado
            this.detenerSondeo();
            this.limpiarEstadoGuardado();

            $('#modalGenerarReporte').addClass('error');
            $('#toastIcon').addClass('error').html('<i class="fa fa-exclamation-triangle"></i>');
            $('#toastTitle').text('Error');
            $('#toastSubtitle').text(mensaje);
            $('#toastStatus').text('Error');
            $('#toastProgressFill').css('width', '0%');

            // Cambiar botón de cancelar por cerrar
            var self = this;
            $('#toastBtnCancel')
                .html('<i class="fa fa-times"></i> Cerrar')
                .removeClass('boton-cancelar')
                .css({background: '#fee2e2', color: '#991b1b'})
                .off('click')
                .on('click', function(e) {
                    e.preventDefault();
                    self.cerrar();
                });

            $('#toastClose').off('click').on('click', function(e) {
                e.preventDefault();
                self.cerrar();
            });

        },

        mostrarCancelado: function(mensaje) {
            this.enGeneracion = false;
            this.detenerSondeo();
            this.limpiarEstadoGuardado();

            $('#modalGenerarReporte').addClass('cancelado');
            $('#toastIcon').addClass('cancelado').html('<i class="fa fa-ban"></i>');
            $('#toastTitle').text('Cancelado');
            $('#toastSubtitle').text(mensaje || 'La generación fue cancelada.');
            $('#toastStatus').text('Cancelado');
            $('#toastProgressFill').css('width', '0%');

            var self = this;
            $('#toastBtnCancel')
                .html('<i class="fa fa-times"></i> Cerrar')
                .removeClass('boton-cancelar')
                .css({background: '#fef3c7', color: '#92400e'})
                .off('click')
                .on('click', function(e) {
                    e.preventDefault();
                    self.cerrar();
                });

            $('#toastClose').off('click').on('click', function(e) {
                e.preventDefault();
                self.cerrar();
            });
        },

        // ============================================
        // ACCIONES
        // ============================================

        cancelar: function() {
            if (!this.enGeneracion || !this.idProgresoActual) return;

            var self = this;
            this._mostrarConfirmacion(function() {
                $.ajax({
                    url: '/cancelarprogreso/' + self.idProgresoActual + '/',
                    type: 'POST',
                    dataType: 'json',
                    success: function(response) {
                        if (response.success === true) {
                            self.detenerSondeo();
                            self.cerrar();
                        } else {
                            self.mostrarNotificacion(response.mensaje, 'error');
                        }
                    },
                    error: function() {
                        self.mostrarNotificacion('Error al cancelar el reporte', 'error');
                    }
                });
            });
        },

        _mostrarConfirmacion: function(onConfirmar) {
            var $modal = $('#modalConfirmarCancelar');
            $modal.modal({ 'width': '420' }).modal('show');

            $('#btnConfirmarCancelar').off('click').on('click', function() {
                $modal.modal('hide');
                onConfirmar();
            });

            $('#btnRechazarCancelar').off('click').on('click', function() {
                $modal.modal('hide');
            });
        },

        cerrar: function() {
            $('#modalGenerarReporte').removeClass('show compact success error cancelado');
            this.limpiarEstadoGuardado();

            var self = this;
            setTimeout(function() {
                self.resetearEstado();
            }, 300);

            this.enGeneracion = false;
            this.idProgresoActual = null;
            this.detenerSondeo();
        },

        resetearEstado: function() {
            $('#modalGenerarReporte').removeClass('success error cancelado');
            $('#toastIcon').removeClass('success error cancelado').html('<i class="fa fa-spinner girando"></i>');
            $('#toastTitle').text('Generando reporte');
            $('#toastSubtitle').text('Inicializando...');
            $('#toastProgressFill').css('width', '0%');
            $('#toastTime').text('Calculando...');
            $('#toastStatus').text('Iniciando');

            var self = this;
            $('#toastBtnCancel')
                .html('<i class="fa fa-times-circle"></i> Cancelar')
                .addClass('boton-cancelar')
                .css({background: '', color: ''})
                .off('click')
                .on('click', function(e) {
                    e.preventDefault();
                    self.cancelar();
                });

            $('#toastClose').off('click').on('click', function(e) {
                e.preventDefault();
                self.cancelar();
            });
        },

        // ============================================
        // UTILIDADES
        // ============================================

        descargarDesdeURL: async function(url, nombreArchivo) {
            if (!url) {
                throw new Error('No hay URL para descargar');
            }

            var extension = nombreArchivo.split('.').pop().toLowerCase();
            var tiposMime = {
                'xls': 'application/vnd.ms-excel',
                'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'pdf': 'application/pdf',
                'csv': 'text/csv',
                'doc': 'application/msword',
                'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'zip': 'application/zip'
            };

            var tipoMime = tiposMime[extension] || 'application/octet-stream';

            try {
                // Descargar el archivo desde la URL
                var respuesta = await fetch(url);

                if (!respuesta.ok) {
                    console.log('URL DEL ARCHIVO:', url);
                    throw new Error('Error al descargar el archivo');
                }

                var blob = await respuesta.blob();

                // Crear blob con el tipo MIME correcto
                var blobTipado = new Blob([blob], {type: tipoMime});

                // Crear enlace de descarga
                var blobUrl = window.URL.createObjectURL(blobTipado);
                var enlace = document.createElement('a');
                enlace.href = blobUrl;
                enlace.download = nombreArchivo;
                document.body.appendChild(enlace);
                enlace.click();
                document.body.removeChild(enlace);

                // Liberar memoria con retardo para que el browser inicie la descarga
                setTimeout(function() {
                    window.URL.revokeObjectURL(blobUrl);
                }, 10000);
            } catch (e) {
                console.error('Error en descarga:', e);
                throw new Error('No se pudo descargar el archivo');
            }
        },

        formatearNumero: function(numero) {
            return (parseInt(numero) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        },

        formatearTiempo: function(segundos) {
            segundos = parseInt(segundos) || 0;
            if (segundos < 60) return Math.floor(segundos) + 's';

            var minutos = Math.floor(segundos / 60);
            var segs = Math.floor(segundos % 60);
            if (minutos < 60) return minutos + 'm ' + segs + 's';

            var horas = Math.floor(minutos / 60);
            var mins = minutos % 60;
            return horas + 'h ' + mins + 'm';
        },

        /**
         * Muestra una notificación al usuario
         * @param {string} mensaje - Mensaje a mostrar
         * @param {string} tipo - Tipo de alerta: 'success', 'error', 'warning', 'info'
         * @param {number} duracion - Duración en milisegundos (opcional)
         */
        mostrarNotificacion: function(mensaje, tipo, duracion) {
            tipo = tipo || 'info';
            duracion = duracion || 3000;

            // Usar showAlert si existe
            if (typeof showAlert === 'function') {
                showAlert(tipo, '', mensaje, duracion, false);
            }
            // Alternativa: abrirnotificacionmodal
            else if (typeof abrirnotificacionmodal === 'function') {
                abrirnotificacionmodal(mensaje);
            }
            // Alternativa final: alert nativo
            else {
                alert(mensaje);
            }
        }
    };

    // ============================================
    // API PÚBLICA ADICIONAL
    // ============================================

    /**
     * Metodo alternativo para iniciar reporte programáticamente
     * Uso: GenerarProgresoReporte.iniciarReporte('/url/reporte/', 'Mi Reporte', 'POST')
     */
    GenerarProgresoReporte.iniciarReporte = function(url, nombre, metodo) {
        this.generar(url, nombre, metodo || 'POST');
    };

    /**
     * Verificar si hay un reporte en proceso
     */
    GenerarProgresoReporte.estaGenerando = function() {
        return this.enGeneracion;
    };

    /**
     * Obtener ID del proceso actual
     */
    GenerarProgresoReporte.obtenerProcesoActual = function() {
        return this.idProgresoActual;
    };

    // ============================================
    // INICIALIZACIÓN AUTOMÁTICA
    // ============================================

    $(document).ready(function() {
        GenerarProgresoReporte.inicializar();
    });

    // Exponer al ámbito global para uso desde JavaScript
    window.GenerarProgresoReporte = GenerarProgresoReporte;

})(jQuery);