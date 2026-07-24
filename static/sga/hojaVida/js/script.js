
$(document).ready(function () {
    $(".fancybox").fancybox();
    $("select").select2({minimumResultsForSearch: 2 });

    function getURLParameter(name) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name);
    }

    function tabExistsInDOM(tabId) {
        return $('.tabs[href="' + tabId + '"]').length > 0;
    }

    function changeURLParameter(tabNumber) {
        const newURL = updateURLParameter(window.location.href, 'tab', tabNumber);
        window.history.pushState({path: newURL}, '', newURL);
    }

    // Obtener tab desde URL o localStorage
    let tabperfil;

    // 1. Primero verificar si hay tab en URL
    const tabFromURL = getURLParameter('tab');

    if (tabFromURL) {
        if(tabExistsInDOM('#' + tabFromURL)){
            tabperfil = `#${tabFromURL}`;
        } else {
            tabperfil = '#1';
        }
    } else if (document.querySelectorAll('.dispositivoactivo').length > 0) {
        // Si hay dispositivo activo
        tabperfil = "#15";
    } else {
        // Si no, usar localStorage o default
        tabperfil = localStorage.getItem('tabperfil') || "#1";
    }
    localStorage.setItem("tabperfil", tabperfil);


    $('.tabs').each(function(){
        if ($(this).attr('href') == tabperfil){
            $(this).trigger('click');
        }
    }).click(function(){
        localStorage.setItem("tabperfil", $(this).attr('href'));

        // Desplaza la página hacia el inicio
        if ($(window).width() > 766) {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        }
        const tabNumber = $(this).attr('href').replace('#', '');
    });

    function updateURLParameter(url, param, value) {
        const urlObj = new URL(url);
        urlObj.searchParams.set(param, value);
        return urlObj.toString();
    }

    var tab1hojavida = localStorage.getItem('tab1hojavida');
    if (!tab1hojavida){
        tab1hojavida = "#20";
        localStorage.setItem("tab1hojavida", tab1hojavida);
    }

    $('.tabs1').each(function(){
        if ($(this).attr('href') == tab1hojavida){
            var iid = $(this).attr("iid");
            $("#adicionsolicitud").attr({"iid":iid});
            $(this).trigger('click');
        }
    }).click(function(){
        localStorage.setItem("tab1hojavida", $(this).attr('href'));
        var iid = $(this).attr("iid");
        $("#adicionsolicitud").attr({"iid":iid});
    });

    $("#adicionsolicitud").click(function(){
        openwindow('GET' ,'/th_hojavida', {action:'addpublicacionacademica', iid: $(this).attr("iid")});
    });

    $("#aniotrabajado").change(function(){
        $("#mestrabajado").html('').append('<option selected="selected" value="">---------</option>');
        var anio = $(this).val();
        var id = $(this).attr("idt");
        $("#itemsbody").empty();
        if (id){
            bloqueointerface();
            $.ajax({
                type: "POST",
                url: "/th_hojavida",
                data: {"action": "meses_anio_log", "id": id, "anio": anio},
                success: function(data) {
                    $.unblockUI();
                    if (data.result=='ok'){

                        for (x=0; x < data.lista.length; x++){
                            elemento = data.lista[x];
                            $("#mestrabajado").append('<option value="'+elemento[0]+'">'+elemento[1]+'</option>');
                        }
                        if (data.lista.length == 1){
                            $("#mestrabajado").prop("selectedIndex", 1).trigger("change");
                        }
                    } else {
                        $("#mestrabajado").val(0).trigger("change");
                    }
                },
                error: function() {
                    $.unblockUI();
                    $("#mestrabajado").val(0).trigger("change");
                    abrirnotificacionmodal('Error de conexión.');
                },
                dataType: "json"
            });
        }
    });

    $("#mestrabajado").change(function(){
        $("#itemsbody").empty();
        var id = $(this).attr("idt");
        var anio = $("#aniotrabajado").val();
        var mes = $(this).val();
        if (id){
            bloqueointerface();
            $.ajax({
                type: "POST",
                url: "/th_marcadas",
                data: {"action": "detalle_jornda_trab", "id": id, "anio": anio, "mes": mes, "h":1},
                success: function(data) {
                    if (data.result=='ok'){

                        $("#itemsbody").html(data.data);
                        tooltips();
                    } else {
                        $("#mestrabajado").val(0);
                    }
                    $.unblockUI();
                },
                error: function() {
                    $.unblockUI();
                    $("#mestrabajado").val(0);
                    abrirnotificacionmodal('Error de conexión.');
                },
                dataType: "json"
            });
        }
    });


    $(".informacionidioma").click(async function(){
        var id = $(this).attr('idt');
        if (id.length === 0){
            abrirnotificacionmodal('Error de al obtener el código.');
            return false;
        }
        // Llama a la función obtenerModal
        await obtenerModal("POST", "/th_hojavida", {'action':'detalleidioma', 'id': id}, $("#modalDetalle"), titulo='Detalle capacitación');
    });

    $(".informacionfotopersona").click(async function(){
        var id = $(this).attr('idt');
        if (id.length === 0){
            abrirnotificacionmodal('Error de al obtener el código.');
            return false;
        }
        // Llama a la función obtenerModal
        await obtenerModal("POST", "/th_hojavida", {'action':'detallefotopersona', 'id': id}, $("#modalDetalle"), 'Detalle de foto de perfil');
    });

    $(".informaciontitulo").click(async function(){
        var id = $(this).attr('idt');
        if (id.length === 0){
            abrirnotificacionmodal('Error de al obtener el código.');
            return false;
        }
        // Llama a la función obtenerModal
        await obtenerModal("POST", "/th_hojavida", {'action':'detalletitulo', 'id': id}, $("#modalDetalle"), titulo='Detalle capacitación');
    });

    $(".informacioncapacitacion").click(async function(){
        var id = $(this).attr('idt');
        if (id.length === 0){
            abrirnotificacionmodal('Error de al obtener el código.');
            return false;
        }
        // Llama a la función obtenerModal
        await obtenerModal("POST", "/th_hojavida", {'action':'detallecapacitacion', 'id': id}, $("#modalDetalle"), titulo='Detalle capacitación');
    });

    $(".informacioncertificaciones").click(async function(){
        var id = $(this).attr('idt');
        if (id.length === 0){
            abrirnotificacionmodal('Error de al obtener el código.');
            return false;
        }
        // Llama a la función obtenerModal
        await obtenerModal("POST", "/th_hojavida", {'action':'detallecertificacion', 'id': id}, $("#modalDetalle"), titulo='Detalle capacitación');
    });

    $(".informacionexperiencia").click(async function(){
        var id = $(this).attr('idt');
        if (id.length === 0){
            abrirnotificacionmodal('Error de al obtener el código.');
            return false;
        }
        // Llama a la función obtenerModal
        await obtenerModal("POST", "/th_hojavida", {'action':'detalleexperiencialaboral', 'id': id}, $("#modalDetalle"), titulo='Detalle capacitación');
    });

    $(".informacionidioma").click(async function(){
        var id = $(this).attr('idt');
        if (id.length === 0){
            abrirnotificacionmodal('Error de al obtener el código.');
            return false;
        }
        // Llama a la función obtenerModal
        await obtenerModal("POST", "/th_hojavida", {'action':'detalleidioma', 'id': id}, $("#modalDetalle"), titulo='Detalle capacitación');
    });

    $(".informacionpublicacion").click(async function(){
        var idt = $(this).attr('idt');
        var idp = $(this).attr('idp');
        if (idt.length === 0 && idp.length === 0){
            abrirnotificacionmodal('Error de al obtener el código.');
            return false;
        }
        // Llama a la función obtenerModal
        await obtenerModal("POST", "/th_hojavida", {'action':'detallepublicacionacademica', 'id': idp, 'idt':idt}, $("#modalDetalle"), titulo='Detalles de publicación');
    });

    $("#clickcredencial").click(function () {
        openwindow('POST' ,'/th_hojavida', {action: 'credencialadministrativo'},'_blank');
    });

    $(".seleccioncuenta").click(function(){
        var elmento = $(this);
        var id = elmento.attr('idt');
        var valor = 'n';
        if (elmento.is(":checked")){
            valor = 'y';
        }
        bloqueointerface();
        $.ajax({
            type: "POST",
            url: "/th_hojavida",
            data: {'action':'cuentaprincipal', 'id': id, 'valor': valor},
            success: function(data) {
                if (data.result=='ok') {
                    if (valor=='y'){
                        $(".seleccioncuenta").each(function(){
                            $(this).prop('checked', false);
                        });
                        elmento.prop('checked', true);
                    }
                    $.unblockUI();
                } else {
                    if (valor=='y'){
                        elmento.prop('checked', false);
                    } else {
                        elmento.prop('checked', true);
                    }
                    $.unblockUI();
                    abrirnotificacionmodal(data.mensaje);
                }
            },
            error: function() {
                $.unblockUI();
                if (valor=='y'){
                    elmento.prop('checked', false);
                } else {
                    elmento.prop('checked', true);
                }
                abrirnotificacionmodal('Error de conexión.');
            },
            dataType: "json"
        });
    });
    $(".btn-generate-download").click(function() {
        console.log('btn-download');
        var elemento = $(this);
        const url = elemento.attr('nhref') || '';
        console.log(url);
        window.open(url, "_blank");
        //openwindow('GET' ,url, undefined, '_blank');
        //descargar_file(url, filename);
    });

    $(".selecciontitulo").click(function(){
        var elmento = $(this);
        var id = elmento.attr('idt');
        var valor = 'n';
        if (elmento.is(":checked")){
            valor = 'y';
        }
        bloqueointerface();
        $.ajax({
            type: "POST",
            url: "/th_hojavida",
            data: {'action':'tituloprincipal', 'id': id, 'valor': valor},
            success: function(data) {
                if (data.result=='ok') {
                    if (valor=='y'){
                        $(".selecciontitulo").each(function(){
                            if (!data.listaactivos.includes(parseInt($(this).attr('idt')))) {
                                $(this).prop('checked', false);
                                console.log(data.listaactivos.includes(parseInt($(this).attr('idt'))), $(this).attr('idt'), data.listaactivos);
                            }
                        });
                        elmento.prop('checked', true);
                    }
                    $.unblockUI();
                } else {
                    if (valor=='y'){
                        elmento.prop('checked', false);
                    } else {
                        elmento.prop('checked', true);
                    }
                    $.unblockUI();
                    abrirnotificacionmodal(data.mensaje);
                }
            },
            error: function() {
                $.unblockUI();
                if (valor=='y'){
                    elmento.prop('checked', false);
                } else {
                    elmento.prop('checked', true);
                }
                abrirnotificacionmodal('Error de conexión.');
            },
            dataType: "json"
        });
    });
});



function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth' // Este valor permite que el desplazamiento sea animado (suave)
    });
}