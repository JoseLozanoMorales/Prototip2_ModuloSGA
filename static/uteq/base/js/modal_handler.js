/**
 * Modal Handler - Gestión de modales con AJAX
 * @description Maneja la apertura de modales con contenido dinámico vía AJAX
 * @requires jQuery, blockUI
 */

(function($) {
    'use strict';

    // Configuración por defecto
    const CONFIG = {
        defaultWidth: '1200px',
        defaultMethod: 'GET',
        timeout: 30000 // 30 segundos
    };

    /**
     * Realiza una petición AJAX y maneja la respuesta
     * @param {string} url - URL del endpoint
     * @param {string} method - Método HTTP (GET o POST)
     * @param {string} title - Título del modal
     * @returns {Promise}
     */
    function fetchModalContent(url, method, title) {
        const ajaxConfig = {
            url: url,
            method: method,
            dataType: 'json',
            timeout: CONFIG.timeout
        };

        return $.ajax(ajaxConfig)
            .done(function(data) {
                if (data.result === 'ok') {
                    const modalTitle = data.title || title || 'Detalle';
                    abrirModalDetalle(data.html, modalTitle, CONFIG.defaultWidth);
                } else {
                    mostrarError('No se pudo cargar el contenido solicitado.');
                }
            })
            .fail(function(jqXHR, textStatus, errorThrown) {
                let errorMessage = 'Error al cargar el contenido.';
                if (textStatus === 'timeout') {
                    errorMessage = 'La solicitud tardó demasiado. Intenta nuevamente.';
                } else if (jqXHR.status === 404) {
                    errorMessage = 'Recurso no encontrado.';
                } else if (jqXHR.status === 500) {
                    errorMessage = 'Error en el servidor. Contacta al administrador.';
                }

                mostrarError(errorMessage);
            })
            .always(function() {
                $.unblockUI();
            });
    }

    /**
     * Muestra un mensaje de error al usuario
     * @param {string} mensaje - Mensaje a mostrar
     */
    function mostrarError(mensaje) {
        // Ajusta esto según tu sistema de notificaciones
        if (typeof showAlert !== 'undefined') {
            showAlert('error', '', mensaje, 3000);
        } else {
            console.error(mensaje);
        }
    }

    /**
     * Inicializa los event listeners cuando el DOM está listo
     */
    function initModalHandlers() {
        $(document).on('click', '.btn_modal_handler', function(e) {
            e.preventDefault();

            const $btn = $(this);
            const url = $btn.attr('nhref');
            const title = $btn.data('title') || '';
            const method = ($btn.data('method') || CONFIG.defaultMethod).toUpperCase();

            // Validaciones
            if (!url) {
                mostrarError('Configuración inválida del botón.');
                return;
            }

            if (!['GET', 'POST'].includes(method)) {
                mostrarError('Método de solicitud no válido.');
                return;
            }
            // Bloquear interfaz y hacer petición
            bloqueointerface();
            fetchModalContent(url, method, title);
        });
    }

    // Inicializar cuando el DOM esté listo
    $(function() {
        initModalHandlers();
    });

})(jQuery);