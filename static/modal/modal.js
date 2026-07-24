// function abrirnotificacionmodal(texto, titulo = '', habilitarcerrar = true, obligatoria = false, icono = "fa fa-warning", coloricono = "goldenrod", tamanomodal = '600') {
//     var controlmodal = $('.notificacionmodal')
//     if (titulo.length > 0) {
//         $(".titulonotificacionmodal").html(titulo);
//     }
//     if (habilitarcerrar) {
//         controlmodal.find(".modal-footer").show();
//     } else {
//         controlmodal.find(".modal-footer").hide();
//     }
//     $("#icononotificacion").addClass(icono);
//     document.getElementById('icononotificacion').style.color = coloricono;
//     $(".cuerponotificacionmodal").html(texto);
//     if (obligatoria) {
//         datamodal = {'backdrop': 'static', keyboard: false, 'width': tamanomodal};
//     } else {
//         datamodal = {'backdrop': 'static', 'width': tamanomodal};
//     }
//     controlmodal.modal(datamodal).modal('show');
//     $(".cerrarnotificacionmodal").on('click', cerrarnotificacionmodal);
// }

function abrirnotificacionmodal(texto,titulo = '',habilitarcerrar = true, obligatoria = false,icono = "fa fa-warning",coloricono = "goldenrod",tamanomodal = '600',callbackAceptar = null) {
    var controlmodal = $('.notificacionmodal');
    var footer = controlmodal.find(".modal-footer");

    if (titulo.length > 0) {
        $(".titulonotificacionmodal").html(titulo);
    }

    $("#icononotificacion")
        .attr('class', '')   // limpiar clases anteriores
        .addClass(icono);

    document.getElementById('icononotificacion').style.color = coloricono;

    $(".cuerponotificacionmodal").html(texto);

    // 🔥 Construcción dinámica del footer
    if (habilitarcerrar) {

        let botonesHTML = `
            <div style="display:flex; justify-content:flex-end; gap:8px; width:100%;">
        `;

        if (callbackAceptar !== null) {
            botonesHTML += `
                <button type="button" class="btn btn-success btn-aceptar-dinamico">
                    <i class="fa fa-check"></i> Aceptar
                </button>
            `;
        }

        botonesHTML += `
                <button type="button" class="btn btn-info cerrarnotificacionmodal">
                    Cerrar
                </button>
            </div>
        `;

        footer.html(botonesHTML).show();

    } else {
        footer.hide();
    }

    let datamodal = obligatoria
        ? {'backdrop': 'static', keyboard: false, 'width': tamanomodal}
        : {'backdrop': 'static', 'width': tamanomodal};

    controlmodal.modal(datamodal).modal('show');

    // Evento cerrar
    $(".cerrarnotificacionmodal").off("click").on('click', function () {
        controlmodal.modal('hide');
    });

    // Evento aceptar
    if (callbackAceptar !== null) {
        $(".btn-aceptar-dinamico").off("click").on("click", function () {
            callbackAceptar();
            controlmodal.modal('hide');
        });
    }
}

function cerrarnotificacionmodal() {
    $(".notificacionmodal").modal("hide");
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
};

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


function aceptarpoliticas(elemento) {
    bloqueointerface();
    $.ajax({
        type: "GET",
        url: "/aceptar_rechazar_politicas",
        data: { estado: 1 },
        success: function(data) {
            if (data.result === 'ok') {
                $(elemento).closest('.modal').modal('hide');
                location.reload(true)
            }
        },
        error: function() {
            $.unblockUI();
            abrirnotificacionmodal('Error de conexión.');

        },
        dataType: "json"
    });
}

function rechazarpoliticas(elemento) {
    bloqueointerface();
    $.ajax({
        type: "GET",
        url: "/aceptar_rechazar_politicas",
        data: { estado: 2 },
        success: function(data) {
            if (data.result === 'ok') {
                $(elemento).closest('.modal').modal('hide');  // Cierra el modal
                logout()
            }
        },
        error: function() {
            $.unblockUI();
            abrirnotificacionmodal('Error de conexión.');
        },
        dataType: "json"
    });
}


