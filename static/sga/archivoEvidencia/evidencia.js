function inicializarCKEditorConBlur(ckeditorInstance, actionUrl, actionType, claveValor) {
    ckeditorInstance.on('blur', function() {
        // Obtén el elemento de textarea asociado a esta instancia de CKEditor
        let textareaElement = ckeditorInstance.element.$;
        let ide = textareaElement.getAttribute('ide');
        let idc = textareaElement.getAttribute('idc');

        let contenido = ckeditorInstance.getData();

        // Verifica que los identificadores existan antes de enviar la solicitud
        if ((ide && ide.length > 0) && (idc && idc.length > 0)) {
            let dicionario = {
                action: actionType,
                id: ide,
                idc: idc,
            }
            dicionario[claveValor] = contenido
            actualizarCampoChange("POST", actionUrl, dicionario);
        } else {
            console.error("Faltan datos del identificador (IDE o IDC).");
            return false;
        }
    });
}

document.addEventListener('DOMContentLoaded', function() {
    // Verifica si CKEDITOR está definido antes de intentar usarlo
    if (typeof CKEDITOR !== 'undefined') {
        // Reemplaza el textarea con id 'descripcionasig' por una instancia de CKEditor
        const resumenejecutivo = campoEditorCK('resumenejecutivo');
        const fortaleza = campoEditorCK('fortaleza');
        const debilidad = campoEditorCK('debilidad');
        const propuestamejoramiento = campoEditorCK('propuestamejoramiento');
        const conclucion = campoEditorCK('conclucion');

        inicializarCKEditorConBlur(resumenejecutivo, "/misolicitudarchivo", 'addevalucionevidencia', 'resumen')
        inicializarCKEditorConBlur(fortaleza, "/misolicitudarchivo", 'addevalucionevidencia', 'fortaleza')
        inicializarCKEditorConBlur(debilidad, "/misolicitudarchivo", 'addevalucionevidencia', 'debilidad')
        inicializarCKEditorConBlur(propuestamejoramiento, "/misolicitudarchivo", 'addevalucionevidencia', 'propuesta')
        inicializarCKEditorConBlur(conclucion, "/misolicitudarchivo", 'addevalucionevidencia', 'conclucion')
    } else {
        console.error('CKEDITOR no está definido.');
    }
});

$(document).ready(function () {
    // Inicializar #carrera_select como un select2
    $("#carrera_select").select2();
    // Manejar el evento change de #carrera_select
    $("#carrera_select").change(function () {
        let idc = $(this).val(); // Obtener el valor seleccionado
        let idarch = $(this).attr('idarch');// Obtener el valor seleccionado
        bloqueointerface(); // Llamar a una función para bloquear la interfaz (suponiendo que esta función ya está definida)
        // Redireccionar a una nueva URL incluyendo el id cifrado del archivo de evaluación y el id de la carrera seleccionada
        location.href = "/misolicitudarchivo?action=criterios&id="+idarch+"&idc=" + idc;
    });

    $(".verevidencia").click(function () {
        var idev = $(this).attr('id');
        var idautev = $(this).attr('idautev');
        bloqueointerface();
        var dataaction = {"action": "verevidencia", "id": idev, "idautev": idautev};
        $.ajax({
            type: "GET",
            url: "/misolicitudarchivo",
            data: dataaction,
            success: function (data) {
                $.unblockUI();
                abrirModalDetalle(data.html, 'Evidencia', ancho='1000px', alto='600px');
            },
            error: function () {
                $.unblockUI();
                abrirnotificacionmodal("Error de conexión.");
            },
            dataType: "json"
        });
    });

    $("#enviarautoevaluacion").click(function () {
        let id = $(this).attr('ide');
        var dataaction = {"action": "enviarautoevaluacion", "id": id};
        $.ajax({
            type: "GET",
            url: "/misolicitudarchivo",
            data: dataaction,
            success: function (data) {
                $.unblockUI();
                $(".paneltitleEvi").html(data.title);
                $(".panelbodyEvi").html(data.html);
                $(".guardarAutoEvaluacion").attr('id', id);
                $("#itemspanelEvi").modal({"backdrop":"static", "width": "800px"}).modal("show");
            },
            error: function () {
                $.unblockUI();
                abrirnotificacionmodal("Error de conexión.");
            },
            dataType: "json"
        });
    });

    $(".guardarAutoEvaluacion").click(function () {
        let id = $(this).attr('id');
        let obs = $("#id_observacion").val();
        if (obs.length == 0){
            abrirnotificacionmodal('La observaciones obligatoria')
            return false;
        }
        bloqueointerface();
        $.ajax({
            type: "POST",
            url: "/misolicitudarchivo",
            data: {"action": "enviarautoevaluacion", "id": id, "obs": obs},
            success: function (data) {
                $.unblockUI();
                if (data.result === "ok") {
                    location.reload(true);
                } else {
                    abrirnotificacionmodal(data.mensaje);
                }
            },
            error: function () {
                $.unblockUI();
                abrirnotificacionmodal("Error de conexión.");
            },
            dataType: "json"
        });
    });

    $(".cerrarModal").click(function () {
        $("#itemspanelEvi").modal("hide");
    });

    $("#id_informeEvaluacionEvidencia").click(function () {
        let idEvaArch = $(this).attr('idEvaArch');
        openwindow('GET' ,'/misolicitudarchivo', {action:'informeevaluacionevidencia', id: idEvaArch}, '_blank');
    });
});


