function eliminarClaveDeLocalStorage(clave){
    Object.keys(localStorage)
        .filter(function(k) { return k.indexOf(clave) === 0; })
        .forEach(function(k) { localStorage.removeItem(k); });
}

function autoShowModal(modalId, contentHash, width) {
    var key_prefix = 'auto_modal:' + modalId;
    var key = key_prefix + ':' + contentHash;

    if (!localStorage.getItem(key)) {
        eliminarClaveDeLocalStorage(key_prefix);
        localStorage.setItem(key, '1');
        $('#' + modalId).modal({'width': width || '600'}).modal('show');
    }
}

function abrirModalDetalle(texto, titulo = '', ancho = '800px', alto = '500px', habilitarcerrar = true, obligatoria = false, icono = "fa fa-list-ul", coloricono = "goldenrod") {
    if (titulo.length > 0) {
        $(".tituloModalDetalle").html(titulo);
    }
    if (habilitarcerrar) {
        $('.modalDetalle').find(".modal-footer").show();
    } else {
        $('.modalDetalle').find(".modal-footer").hide();
    }
    $("#iconoModalDetalle").addClass(icono);
    document.getElementById('iconoModalDetalle').style.color = coloricono;
    $(".cuerpoModalDetalle").html(texto);
    document.getElementById('cuerpoModalDetalle').style.height = alto;
    document.getElementById('cuerpoModalDetalle').style.maxHeight = alto;
    $('.modalDetalle').css("width", "");
    $('.modalDetalle').css("width", ancho);
    $('.modalDetalle').modal({'backdrop': 'static', keyboard: obligatoria, 'width': ancho, 'height': 'auto'}).modal('show');
}

function cerrarModalDetalle(elemento) {
    // $(".modalDetalle").modal("hide");
    $(elemento).closest('.modal').modal('hide');
}

function showWaiting(titulo, mensaje, close) {
    var panel = $("#waitpanel");
    $("#waitpaneltitle").html(titulo);
    $("#waitpanelbody").html(mensaje);
    if (!close) {
        panel.modal({keyboard: false, backdrop: 'static'});
    }
    panel.modal("show");
}

function hideWaiting() {
    $("#waitpanel").modal("hide");
}

// Mpodal dinamimco para cargar datos

function conectar_modaldynamics() {
    bloqueointerface();
    var href = $(this).attr('nhref');
    var width = $(this).attr('data-modal-width') || '800';
    $.ajax({
        type: "GET",
        url: href,
        success: function (data) {
            $.unblockUI();
            if (data.search('"' + 'ajaxformdynamics' + '"') >= 0) {
                $(".ajaxformdynamics").html(data).modal({backdrop: 'static', 'width': width}).modal('show');
            } else {
                if (data.search('"' + 'ajaxconfirmaciondinamicbs' + '"') >= 0) {
                    $("#viewhtml").html(data);
                    $('#viewhtml').modal({'width': '650'}).modal('show');
                    $('.cerrarviewhtml').bind('click.cerrar_viewhtml', cerrar_viewhtml);
                } else {
                    if (data.search('"' + 'ajaxdeletedinamicbs' + '"') >= 0) {
                        $("#eliminacionmodal").html(data);
                        $('#eliminacionmodal').modal({'width': '650'}).modal('show');
                    } else {
                        if (data.result === 'bad'){
                            abrirnotificacionmodal(data.mensaje);
                        } else{
                            try {
                                const parsedData = JSON.parse(data);
                                if (parsedData.result !== undefined) {
                                    showAlert('error', '', parsedData.mensaje, 3000, true);
                                } else {
                                    abrirnotificacionmodal('Error de conexión.');
                                }
                            } catch (error) {
                                abrirnotificacionmodal('Error al procesar la respuesta del servidor.');
                            }
                        }
                    }
                }
            }
        },
        error: function () {
            $.unblockUI();
            abrirnotificacionmodal('Error de conexión.');
        },
        dataType: "html"
    });
}

function conectar_confirmacion() {
    var href = $(this).attr('nhref');
    bloqueointerface();
    $.ajax({
        type: "GET",
        url: href,
        success: function (data) {
            $.unblockUI();
            if (data.search('"' + 'ajaxconfirmaciondinamicbs' + '"') >= 0) {
                $("#confirmacionmodal").html(data);
                $('#confirmacionmodal').modal({'width': '650'}).modal('show');
            } else {
                abrirnotificacionmodal('Error de conexión.');
            }
        },
        error: function () {
            $.unblockUI();
            abrirnotificacionmodal('Error de conexión.');
        },
        dataType: "html"
    });
}

function conectar_modaldynamics_parametro(href = null) {
    if (!href) {
        href = $(this).attr('nhref');
    }
    bloqueointerface();
    $.ajax({
        type: "GET",
        url: href,
        success: function (data) {
            $.unblockUI();
            if (data.search('"' + 'ajaxformdynamics' + '"') >= 0) {
                $(".ajaxformdynamics").html(data);
                $('.ajaxformdynamics').modal({backdrop: 'static', 'width': '800'}).modal('show');
            } else {
                if (data.search('"' + 'ajaxconfirmaciondinamicbs' + '"') >= 0) {
                    $("#viewhtml").html(data);
                    $('#viewhtml').modal({'width': '650'}).modal('show');
                    $('.cerrarviewhtml').bind('click.cerrar_viewhtml', cerrar_viewhtml);
                } else {
                    if (data.search('"' + 'ajaxdeletedinamicbs' + '"') >= 0) {
                        $("#eliminacionmodal").html(data);
                        $('#eliminacionmodal').modal({'width': '650'}).modal('show');
                    } else {
                        abrirnotificacionmodal('Error de conexión.');
                    }
                }
            }
        },
        error: function () {
            $.unblockUI();
            abrirnotificacionmodal('Error de conexión.');
        },
        dataType: "html"
    });
}

function ejecutar_reporte_directo(ruta) {
    var href = ruta;
    $('#formatoreporte').modal('hide');
    var formato = $('#formatoreporte_formato').val();
    var formato_final = '';
    if (formato == 0) {
        formato_final = '&rt=pdf';
    } else if (formato == 1) {
        formato_final = '&rt=docx';
    } else if (formato == 2) {
        formato_final = '&rt=xlsx';
    } else if (formato == 3) {
        formato_final = '&rt=csv';
    }
    bloqueointerface();
    var report_url = href + formato_final;
    $.ajax({
        type: "POST",
        url: report_url,
        success: function (data) {
            $.unblockUI();
            if (data.result == 'ok') {
                if (formato == 0) {
                    openwindow_reporte(location.origin + data.reportfile, 800, 500);
                } else {
                    location.href = location.origin + data.reportfile;
                }
            } else {
                abrirnotificacionmodal("Error al generar el reporte");
            }
        },
        error: function () {
            $.unblockUI();
            abrirnotificacionmodal("Error de conexión.");
        },
        dataType: "json"
    });
}

function abrir_reporte() {
    var href = $(this).attr('nhref');
    var tipos = $(this).attr('tipos');
    if (!tipos) {
        tipos = "pdf, xls, csv, doc";
    }
    if (tipos.contains("pdf")) {
        $("#formatopdf").removeAttr("hidden");
    } else {
        $("#formatopdf").attr({"hidden": "hidden"});
    }
    if (tipos.contains("doc")) {
        $("#formatodoc").removeAttr("hidden");
    } else {
        $("#formatodoc").attr({"hidden": "hidden"});
    }
    if (tipos.contains("xls")) {
        $("#formatoxls").removeAttr("hidden");
    } else {
        $("#formatoxls").attr({"hidden": "hidden"});
    }
    if (tipos.contains("csv")) {
        $("#formatocsv").removeAttr("hidden");
    } else {
        $("#formatocsv").attr({"hidden": "hidden"});
    }
    if (tipos.length > 4) {
        primero = $("#formatoreporte_formato").find("option:first").val();
        $("#formatoreporte_formato").val(primero);
        $('#formatoreporte').modal({'width': '400'}).modal('show');
        $('#formatoreporte_run').attr('nhref', href);
    } else {
        primero = $("#formatoreporte_formato").find("option:first").val();
        $("#formatoreporte_formato").val(primero);
        ejecutar_reporte_directo(href);

    }
}

function cerrar_reporte() {
    $('#formatoreporte').modal('hide');
}


function ejecutar_reporte() {
    var href = $(this).attr('nhref');
    $('#formatoreporte').modal('hide');
    var formato = $('#formatoreporte_formato').val();
    var formato_final = '';
    if (formato == 0) {
        formato_final = '&rt=pdf';
    } else if (formato == 1) {
        formato_final = '&rt=docx';
    } else if (formato == 2) {
        formato_final = '&rt=xlsx';
    } else if (formato == 3) {
        formato_final = '&rt=csv';
    }
    bloqueointerface();
    var report_url = href + formato_final;
    $.ajax({
        type: "POST",
        url: report_url,
        success: function (data) {
            $.unblockUI();
            if (data.result == 'ok') {
                if (formato == 0) {
                    openwindow_reporte(location.origin + data.reportfile, 800, 500);
                } else {
                    location.href = location.origin + data.reportfile;
                }
            } else {
                abrirnotificacionmodal("Error al generar el reporte");
            }
        },
        error: function () {
            $.unblockUI();
            abrirnotificacionmodal("Error de conexión.");
        },
        dataType: "json"
    });
}

function conectar_reporte() {
    $(".reportedirecto").unbind("click.conectar_reporte");
    $(".reportedirecto").bind("click.conectar_reporte", abrir_reporte);
}

function generarPDFyMostrarModal(id, vistadjango, actionname) {
    bloqueointerface();
    $.post(vistadjango, { action: actionname, id: id }, function (pdfData) {
        const pdfUrl = URL.createObjectURL(new Blob([pdfData], { type: "application/pdf" }));
        const modal = $("#mimodalpdf");
        const pdfIframe = modal.find("iframe");
        // Ajustar el tamaño del modal según la altura disponible
        const alturaventana = $(window).height();
        const alturaencabezadomodal = modal.find(".modal-header").outerHeight() || 0;
        const alturapiemodal = modal.find(".modal-footer").outerHeight() || 0;
        const modalmargen = 30;
        const alturamedida = alturaventana - alturaencabezadomodal - alturapiemodal - modalmargen;
        modal.find(".modal-body").css("max-height", alturamedida + "px");
        modal.modal({
            backdrop: "static",
            show: true
        });
        // Ajustar el tamaño del iframe según la altura disponible en el modal
        const pdfIframeHeight = alturamedida - 20;
        pdfIframe.css("height", pdfIframeHeight + "px");
        pdfIframe.css("width", "100%");
        pdfIframe.attr("src", pdfUrl);
        $.unblockUI();
    }).fail(function (jqXHR, textStatus, errorThrown) {
        console.error("Error al obtener el PDF:", errorThrown);
    });
}
async function obtenerModal(type, url, dataAction, elemtoModal, titulo) {
    try {
        bloqueointerface();
        let response = await $.ajax({
            type: type,
            url: url,
            data: dataAction,
            dataType: "json"
        });
        $.unblockUI(); // Desbloqueo de UI después de recibir respuesta
        if (response.result === 'ok') {
            elemtoModal.find('.paneltitle').html(titulo);
            elemtoModal.find('.modal-body').html(response.html);
            elemtoModal.modal({ backdrop: "static",  width: "1000px", keyboard: false });
            elemtoModal.modal('show');
        } else {
            abrirnotificacionmodal(response.mensaje);
        }
    } catch (error) {
        $.unblockUI();
        abrirnotificacionmodal('Error de conexión: ' + error.message);
    }
    return false;
}

function cerrarModal(elemento) {
    $(elemento).closest('.modal').modal('hide');
}

$(document).on('click', '.mostar_detalle_generico', function (e) {

    const $btn = $(this);
    const title = $btn.data('title');
    const rawUrl = $btn.attr('nhref');
    const tipo = $btn.data('method');
    const datosUrl = procesarUrl(rawUrl);
    bloqueointerface();
    obtenerDato(tipo, datosUrl.ruta, datosUrl.params)
        .then(response => {
            $.unblockUI();
            if (response.result === 'ok') {
                const contenidoHtml = (response && response.html) ? response.html : response;

                abrirModalDetalle(contenidoHtml, title);

            } else {
                abrirnotificacionmodal(response.mensaje);
            }
        })
        .catch(error => {
            if (typeof abrirnotificacionmodal === 'function') {
                abrirnotificacionmodal(error);
            } else {
                console.error(error);
            }
        });
})