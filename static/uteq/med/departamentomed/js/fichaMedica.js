$(document).ready(function () {

    var activeTabIndex = localStorage.getItem('activeTabIndex');

    // If there's a stored active tab index, set it as the active tab
    // Si no hay un índice almacenado (es la primera vez), activa la primera pestaña
    if (!activeTabIndex) {
        activeTabIndex = $('.nav-tabs li:first-child a').attr('href').substring(1);
    }

    // Muestra la pestaña activa
    $('.nav-tabs a[href="#' + activeTabIndex + '"]').tab('show');

    // Update the stored active tab index when a tab is clicked
    $('.nav-tabs a').on('click', function(e) {
        localStorage.setItem('activeTabIndex', $(this).attr('href').substring(1));
    });

    $("#addapp").click(function () {
        var id = $(this).data('id');
        var idenf = $("#selectenfermedad").val();
        if (idenf === '' || !id){
            $("#help_enfermedad").show();
            return false;
        }
        addRegistroSubmit({'action': 'addapp', 'idenf': idenf, 'id': id}, true);
    });

    $("#addalergia").click(function () {
        var id = $(this).data('id');
        var ida = $("#selectalergia").val();
        if (ida === '' || !id){
            abrirnotificacionmodal('Datos inválidos o incompletos.');
            return false;
        }
        addRegistroSubmit({'action': 'addalergia', 'ida': ida, 'id': id}, true);
    });

    $("#addhabito").click(function () {
        var id = $(this).data('id');
        var idh = $("#selecthabito").val();
        if (idh === '' || !id){
            abrirnotificacionmodal('Datos inválidos o incompletos.');
            return false;
        }
        addRegistroSubmit({'action': 'addhabitoselect', 'idh': idh, 'id': id}, true);
    });

    $(".valorSV").keyup(function () {
        if (!/^([0-9])*$/.test($(this).val())){
            $(this).val('');
        }
    });

    $(".addSV").change(function () {
        var id = $(this).data('id');
        var idsv = $(this).data('idsv');
        $(this).blur(function () {
            numerico($(this), 0, 500, 0);
        });
        var valor = $(this).val();
        addRegistroSubmit({'action': 'addsv', 'idsv': idsv, 'valor': valor, 'id': id});
    });
});

function addRegistroSubmit(objetoDiccionario, usaReload = false) {
    if (!objetoDiccionario || Object.keys(objetoDiccionario).length === 0) {
        abrirnotificacionmodal('Datos inválidos o incompletos.');
        return;
    }
    bloqueointerface();
    $.ajax({
        type: "POST",
        url: "/adm_depmedico",
        data: objetoDiccionario,
        dataType: "json",
        success: function (data) {
            if (data.result) {
                manejarRespuestaExitosa(usaReload);
            } else {
                $.unblockUI();
                abrirnotificacionmodal(data.mensaje || 'Ocurrió un error inesperado.');
            }
        },
        error: function (jqXHR, textStatus, errorThrown) {
            $.unblockUI();
            abrirnotificacionmodal(`Error de conexión (${textStatus}): ${errorThrown}`);
        }
    });
}

function manejarRespuestaExitosa(usaReload) {
    if (usaReload) {
        // Guardar la posición actual de desplazamiento
        const scrollPosition = {
            x: window.scrollX,
            y: window.scrollY
        };

        // Recargar la página
        location.reload(true);

        // Restaurar la posición de desplazamiento después de recargar
        window.addEventListener('load', function () {
            window.scrollTo(scrollPosition.x, scrollPosition.y);
        });
    } else {
        $.unblockUI();
    }
}
