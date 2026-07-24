// $(document).ready(function() {
//     $("#id_email, #id_emailinst, #id_correoinstasoc, #id_correoinst").css({'text-transform': 'none'});
//
//     $(".btn-form, .bloqueo_pantalla").click(function () {
//         bloqueointerface();
//     });
// });

function getCookie(name) {
    var cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        var cookies = document.cookie.split(';');
        for (var i = 0; i < cookies.length; i++) {
            var cookie = jQuery.trim(cookies[i]);
            // Does this cookie string begin with the name we want?
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

function csrfSafeMethod(method) {
    return (/^(GET|HEAD|OPTIONS|TRACE)$/.test(method));
}

function abrirnotificacionmodal(texto, titulo = '', habilitarcerrar = true, obligatoria = false, icono = "fa fa-warning", coloricono = "goldenrod", tamanioModal = '600', habilitarBtnOk = 0, urlDestino='', errores=[]) {
    var controlmodal = $('.notificacionmodal');
    if (titulo.length > 0) {
        $(".titulonotificacionmodal").html(titulo);
    }

    if (habilitarBtnOk === 1){
        controlmodal.find("#btnRecargarPagina").show();
    }else{
        controlmodal.find("#btnRecargarPagina").hide();
    }

    if (habilitarcerrar) {
        controlmodal.find(".modal-footer").show();
    } else {
        controlmodal.find(".modal-footer").hide();
    }
    $("#icononotificacion").addClass(icono);
    document.getElementById('icononotificacion').style.color = coloricono;
    $(".cuerponotificacionmodal").html(texto);

    var opcionesModal = {
        'backdrop': 'static',
        'width': tamanioModal
    };

    if (obligatoria) {
        opcionesModal.keyboard = false;
    }


    controlmodal.modal(opcionesModal).modal('show');

    $(".cerrarnotificacionmodal").off('click').on('click', function() {
        controlmodal.hide();
    });

    $("#btnRecargarPagina").off('click').on('click', function(){
        controlmodal.hide();
        if (urlDestino.length > 0){
            window.location.href = urlDestino;
        }
        window.location.reload(true);
    });
}