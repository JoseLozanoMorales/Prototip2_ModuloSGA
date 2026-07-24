$(document).ready(function () {

    $(".action-menu-entry, .icon").click(function() {
        var url = $(this).attr('url');
        if (url[0] === '/') {
            abrir_modulo($(this), url);
        } else {
            abrir_modulo($(this), "/"+url);
        }
    });

    setTimeout(function() {
        $("#contenidocentral").find(".alert").fadeOut("slow");
    }, 34000);

    $(".favorito").click(function () {
        var id = $(this).attr('id');
        bloqueointerface();
        $.post("/", {'action': 'agregar_quitar_favorito', "id": id}, function(data){
            $.unblockUI();
            if (data.result=='ok'){
                location.reload(true);
            }
        }, "json" );
        return false;
    });

    $('.encuestanoobligatoria').click(function(){
        miencuesta($(this).attr('ide'));
    });

    $('#cerrarencuesta').click(function(){
        $("#encuestapanel").modal('hide');
    });

    localStorage.removeItem('tabhojavida');
    $(".formulariosolicitud").click(function () {
        openwindow('POST', '/alu_solicitudmatricula', {action: 'formulariosolicitud', idg: $(this).attr('idg')}, '_blank');
    });
});

const abrir_modulo = (elemento, url) => {
    if ($(elemento).attr('target')){
        openwindow('GET' ,url, {});
    } else {
        bloqueointerface();
        setTimeout(function() {
            // No se llama a $.unblockUI() aquí: el bloqueo debe seguir visible
            // hasta que el módulo termine de abrir. Al navegar, el propio
            // cambio de página se lleva el overlay junto con el resto del DOM.
            window.location.href = url;
        }, 500); // Retraso de 500ms, ajusta según la necesidad
    }
}

const miencuesta = (id) => {
    $.get("/", {'action': 'responder', 'id': id}, function(data) {
        ancho = $(window).height();
        if (ancho>50){ancho = ancho - 35}
        $("#encuestapanel").html(data);
        $("#encuestapanel").find(".selector").addClass("input-large");
        $("#encuestapanel").find(".observaciones").addClass("input-block-level");
        $("#encuestapanel").modal({backdrop: 'static', keyboard: false, width: "1024px", maxHeight: (ancho*5)/7 });
        $("#encuestapanel").modal("show");
        $("#encuestapanel").find("button").click(function() {
            encuestaok = true;
            preguntaadicionalobligatoria=true;
            $(".selector").each(function(k,v) { encuestaok = encuestaok && ($(v).val())?true:false; });
            $(".preguntaadicionalobligatorio").each(function(k,v) {preguntaadicionalobligatoria = preguntaadicionalobligatoria && ($(v).val())?true:false;});
            if (encuestaok && preguntaadicionalobligatoria) {
                bloqueointerface();
                var form = $("#encuestapanel").modal("hide").find("form").get(0);
                var formData = new FormData(form);

                $.ajax({
                    url: '/',
                    type: 'POST',
                    data: formData,
                    processData: false,  // Evita que jQuery convierta el FormData en una cadena de consulta
                    contentType: false,  // Evita que jQuery establezca el tipo de contenido
                    dataType: "json",
                    success: function(data) {
                        $.unblockUI();
                        if (data.result === 'ok') {
                            $("#encuestapanel").modal('hide');
                        } else {
                            abrirnotificacionmodal(data.mensaje, titulo = "Error");
                        }
                    },
                    error: function() {
                        $.unblockUI();
                        abrirnotificacionmodal('Error al enviar los datos.');
                    }
                });
            } else {
                $("#encuestapanel").find(".encuestaincompleta").show();
            }
        });
        $('#cerrarencuesta').click(function(){
            $("#encuestapanel").modal('hide');
        });
    }, "html");
}

const mistareas = () => {
    $.get("/", {'action': 'tareas_pendientes'}, function(data) {
        $("#tareas_pendientes").html(data);
        $("#tareas_pendientes").modal({backdrop: 'modal', keyboard: true, width: "1024px", maxHeight: ($(window).height()*5)/7 });
        $("#tareas_pendientes").modal("show");
        $('#cerrartarea').click(function(){
            $("#tareas_pendientes").modal('hide');
        });
    }, "html");
}

const anuncios = () =>{
    $.get("/", {'action': 'anuncios'}, function(data) {
        $(".panelbody_anuncios").html(data);
        $("#modalanuncios").modal({backdrop:'static', width: '950px'}).modal('show');
    }, "html");
};

const encuestamatricula = (tieneencuestamatriculaobligatorio) =>{
    $.get("/", {'action': 'encuestamatricula'}, function(data) {
        ancho = $(window).height();
        if (ancho>50){ancho = ancho - 35};
        $("#encuestamatriculapanel").html(data);
        if (tieneencuestamatriculaobligatorio){
            $("#encuestamatriculapanel").modal({backdrop: 'static', keyboard: false, width: "1024px", maxHeight: (ancho*5)/7 });
        }else{
            $("#encuestamatriculapanel").modal({backdrop: 'static', width: "1024px", maxHeight: (ancho*5)/7 });
        }
        $("select").select2({minimumResultsForSearch: 5});
        $("#encuestamatriculapanel").modal("show");
    }, "html");
};

const entregadocumentoinscripcion = () =>{
    $.get("/", {'action': 'entregadocumentoinscripcion'}, function(data) {
        ancho = $(window).height();
        if (ancho>50) {ancho = ancho - 35}
        $("#entregadocumentopanel").html(data).modal({backdrop: 'static', width: "1024px" }).modal("show");
    }, "html");
};

