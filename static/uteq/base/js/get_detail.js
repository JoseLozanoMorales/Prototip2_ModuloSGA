$(document).on('click', '.get_detail', function () {
    const $btn = $(this);

    if ($btn.data('loading')) return;

    const rawUrl = $btn.data('url') || $btn.attr('nhref');
    if (!rawUrl) return;

    const title = $btn.data('title') || 'Información';
    const width = $btn.data('width') || '900px';
    const datosUrl = procesarUrl(rawUrl);

    $btn.data('loading', true);
    bloqueointerface();

    $.get(datosUrl.ruta, datosUrl.params, function (data) {
        if (data.result === 'ok') {
            abrirModalDetalle(data.html, title, width);
        } else {
            abrirnotificacionmodal(data.mensaje || 'Error al obtener la información', 'Error');
        }
    }, 'json')
    .fail(function () {
        abrirnotificacionmodal('Error de comunicación con el servidor', 'Error');
    })
    .always(function () {
        $.unblockUI();
        $btn.data('loading', false);
    });
});
