
// --- FUNCIÓN HELPER: Cierra todos los popovers ---
function cerrarOtrosPopovers($exceptoEsteBtn) {
    // Seleccionamos ambos tipos de botones
    $('.alert_popover, .alert_popover_post').not($exceptoEsteBtn).each(function () {
        // Solo intentamos ocultar si ya fue inicializado para evitar errores
        if ($(this).data('bs.popover')) {
            $(this).popover('hide');
        }
    });
}

// =========================================================
// 1. LÓGICA PARA EL POPOVER ESTÁTICO (.alert_popover)
// =========================================================
$(document).on('click', '.alert_popover', function (e) {
    e.preventDefault();
    e.stopPropagation(); // Evita que el evento suba y se cierre inmediatamente

    let $btn = $(this);

    cerrarOtrosPopovers($btn);

    if (!$btn.data('bs.popover')) {
        $btn.popover({
            container: 'body',
            // trigger: 'manual',
            trigger: 'focus',
            html: true,
        });

        $btn.popover('show');
    } else {
        // --- B. Si ya existía: ALTERNAR (Toggle) ---
        $btn.popover('toggle');
    }
});



$(document).on('click', '.alert_popover_server', function(e) {
    e.preventDefault();
    e.stopPropagation();

    let $btn = $(this);

    let rawUrl = $btn.attr('nhref');
    let tipo = $btn.data('method');
    let datosUrl = procesarUrl(rawUrl);

    // Cerrar TODOS los popovers (incluyendo este)
    $('.alert_popover, .alert_popover_server').each(function() {
        let $el = $(this);
        if ($el.data('bs.popover')) {
            $el.popover('hide');
            $el.popover('dispose');
        }
    });

    // Si era este mismo botón el que estaba abierto, salir (toggle)
    if ($btn.hasClass('popover-active')) {
        $btn.removeClass('popover-active');
        return;
    }

    // Marcar este botón como activo
    $('.alert_popover, .alert_popover_server').removeClass('popover-active');
    $btn.addClass('popover-active');


    // Petición AJAX
    obtenerDato(tipo, datosUrl.ruta, datosUrl.params)
        .then(response => {
            if (response.result === 'ok') {
                let contenidoHtml = (response && response.html) ? response.html : response;

                // Crear el popover FRESCO con el contenido
                $btn.popover({
                    container: 'body',
                    // trigger: 'manual',
                    trigger: 'focus',
                    html: true,
                    sanitize: false,
                    content: contenidoHtml
                });

                // Mostrar
                $btn.popover('show');

            } else {
                $btn.removeClass('popover-active');
                abrirnotificacionmodal(response.mensaje);
            }
        })
        .catch(error => {
            $btn.removeClass('popover-active');
            if (typeof abrirnotificacionmodal === 'function') {
                abrirnotificacionmodal(error);
            } else {
                console.error(error);
            }
        });
});

// Cerrar popovers al hacer click fuera
$(document).on('click', function(e) {
    if (!$(e.target).closest('.alert_popover_server, .popover').length) {
        $('.alert_popover, .alert_popover_server').each(function() {
            let $btn = $(this);
            if ($btn.data('bs.popover')) {
                $btn.popover('hide');
                $btn.popover('dispose');
                $btn.removeClass('popover-active');
            }
        });
    }
});