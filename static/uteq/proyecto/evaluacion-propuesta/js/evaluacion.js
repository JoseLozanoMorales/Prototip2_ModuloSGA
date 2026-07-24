// /static/uteq/proyecto/js/evaluacion.js
(function() {
    'use strict';

    const cfg = window.EVALUACION_CONFIG;

    $(function() {
        inicializarHandlers();
    });

    function inicializarHandlers() {
        // --- Criterios y observaciones de criterio ---
        $(document).on("blur",  'textarea[name^="observacion_"]',     manejarBlurObservacion);
        $(document).on("blur",  'input[name^="valor_criterio_"]',     manejarBlurValorCriterio);
        $(document).on("input", 'input[name^="valor_criterio_"]',     manejarInputValorCriterio);

        // --- Observación general: contador de caracteres ---
        $(document).on('input', '.observacion_general', actualizarContadorObservacion);

        // --- Archivo PDF: preview y validación ---
        $(document).on('change', '#id_archivo_pdf', manejarSeleccionArchivo);
        $(document).on('click',  '#quitarArchivo',  quitarArchivoSeleccionado);
        $(document).on('click',  '#guardar_evaluacion',  guardarEvaluacion);
    }

    /* ============================================================
       CRITERIOS DE EVALUACIÓN
       ============================================================ */

    function manejarBlurObservacion() {
        const textarea = $(this);
        const observacion = textarea.val().trim();

        const div_criterio = textarea.parent().parent();
        const valor = div_criterio.find('.valor-criterio').val();

        const parts = textarea.attr("name").split("_");
        const evaluador_id = parts[1];
        const criterio_id  = parts[2];

        guardarValorCriterio({
            elemento: textarea,
            data: {
                evaluador_id: evaluador_id,
                criterio_id:  criterio_id,
                observacion:  observacion,
                valor: valor
            }
        });
    }

    function manejarBlurValorCriterio() {
        const input = $(this);
        const valor = parseFloat(input.val());
        const max   = parseFloat(input.data("max"));

        if (isNaN(valor)) return;

        if (valor > max) {
            abrirnotificacionmodal(`El valor no puede superar el máximo permitido: ${max}%`);
            input.val(max);
            return;
        }

        const div_criterio = input.parent().parent();
        const observacion = div_criterio.find('.observacion-criterio').val();

        const parts = input.attr("name").split("_");
        const evaluador_id = parts[2];
        const criterio_id  = parts[3];

        guardarValorCriterio({
            elemento: input,
            data: {
                evaluador_id: evaluador_id,
                criterio_id:  criterio_id,
                observacion:  observacion,
                valor: valor
            }
        });
    }

    function manejarInputValorCriterio() {
        const input = $(this);
        const valor = parseFloat(input.val());
        const max   = parseFloat(input.data("max"));

        if (!isNaN(valor) && valor > max) {
            abrirnotificacionmodal(`El valor máximo permitido es ${max}%`);
        }
    }

    function guardarValorCriterio({ elemento, data }) {
        elemento.css({
            "background-color": "#dbeafe",
            "transition": "background-color 0.3s ease"
        });

        $.ajax({
            url: cfg.basePath,
            type: "POST",
            dataType: "json",
            data: Object.assign({
                action: "guardar_valor_criterio",
                csrfmiddlewaretoken: getCsrfToken()
            }, data),

            success: function(response) {
                elemento.css("background-color", "#d1fae5");

                const div_criterio = elemento.parent().parent();
                const input_observacion = div_criterio.find('.observacion-criterio');

                input_observacion
                    .prop("disabled", false)
                    .attr("placeholder", "Escriba una observación...")
                    .css("background-color", "#d1fae5");

                // 🔹 Actualizar el badge de estado del criterio
                if (response && response.data && response.data.criterio_estado) {
                    actualizarEstadoCriterio(div_criterio, response.data.criterio_estado);
                }

                if (response && response.data && response.data.resultado_global !== undefined) {
                    actualizarResultadoGlobal(response.data.resultado_global);
                }

                if (response && response.data && response.data.esta_evaluada_propuesta){
                    if (response.data.esta_evaluada_propuesta){
                        $(".bloque-evaluacion-general").show();
                    }else{
                        $(".bloque-evaluacion-general").hide();
                    }
                }
            },

            error: function() {
                elemento.css("background-color", "#fee2e2");
                abrirnotificacionmodal("Error al guardar el cambio. Intente nuevamente.");
            }
        });
    }

    function actualizarEstadoCriterio(divCriterio, estadoData) {
        // Buscar el span dentro del div .criterio-estado
        // Si divCriterio YA es el .criterio-estado, buscamos directo el span.estado
        // Si no lo es, lo buscamos dentro
        let badge = divCriterio.is('.criterio-estado')
            ? divCriterio.find('span.estado')
            : divCriterio.find('.criterio-estado span.estado');

        if (badge.length === 0) {
            console.warn('No se encontró el span.estado dentro de .criterio-estado');
            return;
        }

        // Mapeo de estado → clase CSS
        // Ajusta estos valores según los códigos de tu backend
        const CLASES_POR_ESTADO = {
            1: 'info-label',     // "EN EVALUACIÓN" u otro
            2: 'activo',         // "DEFINITIVO"
            // agrega más estados si tu sistema los tiene
        };

        const claseNueva = CLASES_POR_ESTADO[estadoData.valor] || 'activo';

        // Quitar todas las clases de estado anteriores (pero mantener 'estado')
        badge.removeClass('warning-label info-label activo inactivo');

        // Aplicar la nueva clase y el texto
        badge.addClass(claseNueva).text(estadoData.display);

        // Asegurar que la clase base 'estado' siempre esté presente
        if (!badge.hasClass('estado')) {
            badge.addClass('estado');
        }

        // Efecto visual: "pulso" que indica que se actualizó
        badge.css({
            "transform": "scale(1.15)",
            "transition": "transform 0.3s ease, box-shadow 0.3s ease",
            "box-shadow": "0 0 0 4px rgba(59, 130, 246, 0.25)",
            "display": "inline-block"  // necesario para que transform funcione en spans
        });

        setTimeout(() => {
            badge.css({
                "transform": "scale(1)",
                "box-shadow": ""
            });
        }, 400);
    }

    function actualizarResultadoGlobal(nuevoValor) {
        $(`.badge-resultado`).text(`${nuevoValor}%`);
    }

    /* ============================================================
       OBSERVACIÓN GENERAL
       ============================================================ */

    function actualizarContadorObservacion() {
        const len = $(this).val().length;
        $(this).closest('.og-textarea-wrapper').find('.og-contador-actual').text(len);
    }

    /* ============================================================
       ARCHIVO PDF
       ============================================================ */

    function manejarSeleccionArchivo(e) {
        const file = e.target.files[0];
        const preview = $('#archivoPreview');
        const drop = $(this).closest('.og-archivo-drop');

        if (!file) {
            preview.hide();
            drop.show();
            return;
        }

        if (file.type !== 'application/pdf') {
            abrirnotificacionmodal('Solo se permiten archivos PDF.');
            $(this).val('');
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            abrirnotificacionmodal('El archivo no debe superar los 10MB.');
            $(this).val('');
            return;
        }

        $('#archivoNombre').text(file.name);
        $('#archivoTamano').text(formatearTamano(file.size));
        preview.show();
        drop.hide();
    }

    function quitarArchivoSeleccionado() {
        $('#id_archivo_pdf').val('');
        $('#archivoPreview').hide();
        $('.og-archivo-drop').show();
    }

    function formatearTamano(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }

    /* ============================================================
       UTILIDADES
       ============================================================ */

    function getCsrfToken() {
        const match = document.cookie.match(/csrftoken=([^;]+)/);
        return match ? match[1] : $('input[name=csrfmiddlewaretoken]').val() || '';
    }

    /* ============================================================
       API PÚBLICA (para botones con onclick="...")
       ============================================================ */

    function guardarEvaluacion(){
        const observacion_general = $(".observacion_general").val().trim();
        const archivoInput = $("#id_archivo_pdf")[0];
        const evaluador_id = document.getElementById('evaluador_id').value;

        if (evaluador_id === '' || evaluador_id === undefined || evaluador_id === null){
            abrirnotificacionmodal('No se encontró el el evaluador');
            return;
        }

        // Validaciones
        if (observacion_general === '') {
            abrirnotificacionmodal('Debe ingresar una observación general');
            return;
        }
        if (cfg.requiereArchivo && (!archivoInput.files || archivoInput.files.length === 0)) {
            abrirnotificacionmodal('Debe adjuntar el archivo PDF de la evaluación');
            return;
        }

        // Preparar datos
        const formData = new FormData();
        formData.append('action', 'confirmacion_save_notas');
        formData.append('csrfmiddlewaretoken', getCsrfToken());
        formData.append('observacion', observacion_general);
        formData.append('idpro', evaluador_id);

        if (archivoInput.files.length > 0) {
            formData.append('archivo', archivoInput.files[0]);
        }

        // Bloquear botón para evitar doble envío
        const btn = $('#guardar_evaluacion');
        btn.prop('disabled', true).text('Guardando...');

        $.ajax({
            url: cfg.basePath,
            type: "POST",
            data: formData,
            processData: false,
            contentType: false,
            success: function(response) {
                if (response.result === 'ok') {
                    if (response.reload){
                        location.reload(); // O redirigir según sea necesario
                    }else{
                        return;
                    }

                } else {
                    abrirnotificacionmodal(response.mensaje || "Error al guardar la evaluación.");
                    btn.prop('disabled', false).text('Guardar Evaluación');
                }
            },
            error: function() {
                abrirnotificacionmodal("Error de conexión con el servidor.");
                btn.prop('disabled', false).text('Guardar Evaluación');
            }
        });
    }

})();