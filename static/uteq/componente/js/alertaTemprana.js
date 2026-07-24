$(document).ready(function () {
    $(document).on('click', '.alertaTemprana', function () {
        var id = $(this).attr('id');
        if (!id) {
            abrirnotificacionmodal('No se encontró el acceso para abrir la alerta temprana.');
            return;
        }

        bloqueointerface();
        $.ajax({
            type: "GET",
            url: `/alerta_temprana`, // Enviamos el id como parámetro GET
            data: { id: id }, // Pasamos el id como parámetro GET
            dataType: "json"
        })
            .done(function(response) {
                $.unblockUI();
                if (response.result === "ok") {
                    abrirModalDetalle(response.html, response.title || "Detalles del producto");
                } else {
                    abrirnotificacionmodal(response.mensaje || 'Error al cargar el contenido del modal.');
                }
            })
            .fail(function() {
                $.unblockUI();
                abrirnotificacionmodal('Error al cargar el contenido del modal.');
            });
    });
    $(document).on('click', '.alertaRiesgo', function () {
        var id = $(this).attr('id');
        var idma = $(this).attr('idma');
        if (!id) {
            abrirnotificacionmodal('No se encontró el acceso para abrir la alerta temprana.');
            return;
        }

        bloqueointerface();
        $.ajax({
            type: "GET",
            url: `/alerta_temprana_riesgo`, // Enviamos el id como parámetro GET
            data: { id: id, idma: idma }, // Pasamos el id como parámetro GET
            dataType: "json"
        })
            .done(function(response) {
                $.unblockUI();
                if (response.result === "ok") {
                    abrirModalDetalle(response.html, response.title || "Detalles del producto");
                } else {
                    abrirnotificacionmodal(response.mensaje || 'Error al cargar el contenido del modal.');
                }
            })
            .fail(function() {
                $.unblockUI();
                abrirnotificacionmodal('Error al cargar el contenido del modal.');
            });
    });
});
