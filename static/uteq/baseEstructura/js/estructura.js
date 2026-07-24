// PROBADO LO HABILITADO MISAEL:)
$(document).ready(function() {
    if (!('contains' in String.prototype)) {
        String.prototype.contains = function (str, startIndex) {
            return -1 !== String.prototype.indexOf.call(this, str, startIndex);
        };
    }

    window.onload = checkSessionOnLoad;
});

$('.logoutuser').click(function () {
    logout();
});

// $("#select_periodo").click(function () {
//     $("#select-search").focus();
// });

// $("#select-search").keyup(function (e) {
//     var texto = $(this).val().toUpperCase();
//     $(".periodoselector").each(function () {
//         var descripcion = $(this).html();
//         if (!(descripcion.toString().toUpperCase().contains(texto))) {
//             $(this).hide();
//         } else {
//             $(this).show();
//         }
//     });
// });

// $(".periodoselector").click(function () {
//     var pid = $(this).attr('pid');
//     obtenerDato('GET', '/', {'action': 'periodo', 'id': pid})
//         .then(data => {
//             location.href = location.pathname;
//         })
//         .catch(error => {
//             abrirnotificacionmodal("Error al cambiar de periodo");
//         });
// });

$("#select-search-notifi").keyup(function (e) {
    var texto = $(this).val().toUpperCase();
    $(".notificacionselector").each(function () {
        var descripcion = $(this).html();
        if (!(descripcion.toString().toUpperCase().contains(texto))) {
            $(this).hide();
        } else {
            $(this).show();
        }
    });
});

$(function() {
    $(".reportedirecto").bind("click.conectar_reporte", abrir_reporte);

    $("#formatoreporte_run").bind("click.ejecutar_reporte", ejecutar_reporte);

    $("#formatoreporte_close").bind("click.cerrar_reporte", cerrar_reporte);

    refineUrl();

    tooltips();

    $(".select-notifi").click(function () {
        if($(this).attr('aria-expanded') === 'true'){
            var controlcontenido = $("#contenido_notificacion")
            cargar_notificaciones(controlcontenido, controlcontenido.attr("idp"), "notificacionselector");
            $("#select-search-notifi").focus();
        }
    });

});