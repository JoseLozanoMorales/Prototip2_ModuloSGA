
function abrirNotificacionModalWarning(texto, titulo='', habilitarcerrar=true, obligatoria=false, icono="fa fa-warning", coloricono="goldenrod", tamanomodal='450'){
    $.fn.crearLinks = function () {
        var regexp = /((ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?)/gi
        this.each(function() {
            $(this).html(
                $(this).html().replace(regexp,'<a target="_blank" class="btn btn-mini btn-warning" href="$1">Clic aquí</a>')
            );
        });
        return $(this);
    }
    $('.notificacionModal').unbind()
    if (titulo.length > 0){
        $(".tituloNotificacionModal").html(titulo);
    }

    if (habilitarcerrar){
        $('.notificacionModal').find(".modal-footer").show();
    } else {
        $('.notificacionModal').find(".modal-footer").hide();
    }
    $(".detalleNotificacionModal").html(texto).crearLinks();
    if (obligatoria) {
        datamodal = {'backdrop': 'static', keyboard: false, 'width':tamanomodal}
    } else {
        datamodal = {'backdrop': 'static', 'width':tamanomodal}
    }
    $('.notificacionModal').modal(datamodal).modal('show');
};


