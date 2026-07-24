/**
 * Lógica del panel/dashboard principal (extraída de templates/panel.html
 * para no depender de script inline: más fácil de mantener/testear y
 * permite eventualmente endurecer la Content-Security-Policy del sitio).
 *
 * Depende de: jQuery, Bootstrap modal, fancybox, y de los helpers globales
 * bloqueointerface(), abrirnotificacionmodal(), openwindow() (base.js) y
 * anuncios()/encuestamatricula()/entregadocumentoinscripcion()/miencuesta()
 * (sga/panel/script.js).
 *
 * Requiere que window.PanelConfig esté definido ANTES de cargar este
 * archivo (ver el bloque {% block heading %} de templates/panel.html).
 */
(function ($, cfg) {
    'use strict';

    cfg = cfg || {};

    // Escapa texto antes de insertarlo como HTML (previene XSS con contenido
    // que viene del servidor, ej. descripciones o mensajes de error).
    function escapeHtml(valor) {
        return $('<div>').text(valor === null || valor === undefined ? '' : String(valor)).html();
    }

    function ayuda_economica_vigente() {
        $.ajax({
            url: cfg.urlAyudaEconomicaVigente,
            type: "GET",
            dataType: "json",
            success: function (response) {
                if (response.length > 0) {
                    let alertsHtml = "";
                    response.forEach(function (item) {
                        let alertHtml = `
                    <div class="alert alert-success">
                        <a href="javascript:;" class="close" data-dismiss="alert">×</a>
                        <h3 class="alert-heading">AVISO IMPORTANTE</h3>
                        <p>${escapeHtml(item[1])}, <b><a href="/alu_solicitudmatricula" style="font-size: 12px; font-weight: bold">Ayudas Económicas.</a></b>
                        ${item[2] ? '[<a class="btn btn-link formulariosolicitud" idg="' + escapeHtml(item[0]) + '" style="font-size: 13px; font-weight: bold"><i class="fa fa-download"></i> Formulario de Solicitud</a>]' : ''}
                        </p>
                    </div>`;
                        alertsHtml += alertHtml;
                    });
                    if ($("#notificacionesAlert .alert").length == 0) {
                        $("#notificacionesAlert").html(alertsHtml);
                    } else {
                        $("#notificacionesAlert").append(alertsHtml);
                    }

                    $(".formulariosolicitud").off('click').on('click', function () {
                        openwindow('POST', '/alu_solicitudmatricula', {action: 'formulariosolicitud', idg: $(this).attr('idg')}, '_blank');
                    });
                }
            },
            error: function (xhr, status, error) {
                console.error("Error: " + error);
                abrirnotificacionmodal("<p>Hubo un error al cargar las notificaciones.</p>");
            }
        });
    }

    function falta_archivo_becas() {
        $.ajax({
            url: cfg.urlFaltaArchivoBecas,
            type: "GET",
            dataType: "json",
            success: function (response) {
                if (response) {
                    let alertHtml = `
                        <div class="alert alert-danger">
                            <a  href="javascript:;" class="close" data-dismiss="alert">×</a>
                            <h4 class="alert-heading">ALERTA</h4>
                            <b>Estimado(a) estudiante, puede acceder al módulo <a href="/alu_solicitudmatricula">“Ayuda económica”</a> y descargar el Acta de otorgamiento que deberá ser firmada, escaneada y subida como requisito para el desembolso de la ayuda económica que entregará la UTEQ. Si subió anteriormente la cédula y certificado bancario, no los cargue nuevamente, caso contrario deberá subir los tres documentos.</b>
                        </div>`;
                    if ($("#notificacionesAlert .alert").length == 0) {
                        $("#notificacionesAlert").html(alertHtml);
                    } else {
                        $("#notificacionesAlert").append(alertHtml);
                    }
                }
            },
            error: function (xhr, status, error) {
                console.error("Error: " + error);
                abrirnotificacionmodal("<p>Hubo un error al cargar las notificaciones.</p>");
            }
        });
    }

    function aceptacion_politicas_privacidad() {
        $.ajax({
            url: cfg.urlAceptacionPoliticasPrivacidad,
            type: "GET",
            dataType: "json",
            success: function (response) {
                if (response.error) {
                    console.error("Error: " + response.error);
                    abrirnotificacionmodal("<p>" + escapeHtml(response.error) + "</p>");
                    return;
                }
                if (!response.politica_aceptada) {
                    $("#cuerpoModalDetallepolitica").html(response.descripcion);
                    $("#modalDetallepolitica").modal({
                        backdrop: "static",
                        keyboard: false,
                        height: "100%",
                        width: "92%"
                    }).modal("show");
                }
            },
            error: function () {
                $.unblockUI();
                abrirnotificacionmodal("Error de conexión.");
            }
        });
    }

    function confirmacioncorreocelular() {
        $("#confirmaciondato").modal({backdrop: 'static', keyboard: false, width: '800px'}).modal('show');
        $("#id_emailconfirmar, #id_celularconfirmar").css({'text-transform': 'none'});
        var controldatoerror = $('#errordatoconfirmar');
        controldatoerror.hide();
        $('#confirmaciondato_close').click(function () {
            $('#confirmaciondato').modal('hide');
        });
        $('#confirmaciondato_save').click(function () {
            const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            var email = $("#id_emailconfirmar").val();
            const celularregex = /^[0-9]{10}$/;
            var celular = $("#id_celularconfirmar").val();
            if (!emailRegex.test(email)) {
                controldatoerror.html('Por favor, ingrese un correo válido.').show();
                return false;
            }
            if (!celularregex.test(celular)) {
                controldatoerror.html('Por favor, ingrese un número de celular válido.').show();
                return false;
            } else {
                var formdata = new FormData($("#formconfirmaciondato")[0]);
                bloqueointerface();
                $.ajax({
                    type: "POST",
                    url: "/",
                    data: formdata,
                    success: function (data) {
                        $.unblockUI();
                        if (data.result === 'ok') {
                            $('#confirmaciondato').modal('hide');
                        } else {
                            abrirnotificacionmodal(escapeHtml(data.mensaje));
                        }
                    },
                    error: function () {
                        $.unblockUI();
                        abrirnotificacionmodal('Error de conexión.');
                    },
                    dataType: "json",
                    cache: false,
                    contentType: false,
                    processData: false
                });
            }
        });
    }

    $(function () {
        if (cfg.mostrarPopupAnuncios) {
            anuncios();
        }
        if (cfg.mostrarEncuestaMatricula) {
            encuestamatricula(cfg.encuestaMatriculaObligatoria);
        }
        if (cfg.mostrarEntregaDocumento) {
            entregadocumentoinscripcion();
        }
        if (cfg.encuestaObligatoriaId) {
            miencuesta(cfg.encuestaObligatoriaId);
        }
        if (cfg.mostrarConfirmarCorreoCelular) {
            confirmacioncorreocelular();
        }
    });

    $(document).ready(function () {
        $(".noticiaimagen").attr('rel', 'gallery').fancybox({padding: 0});
        if (cfg.imagenInicioSesionUrl) {
            $.fancybox({'href': cfg.imagenInicioSesionUrl});
        }
        if (cfg.esEstudiante) {
            ayuda_economica_vigente();
            falta_archivo_becas();
        }
    });

    aceptacion_politicas_privacidad();
})(jQuery, window.PanelConfig);
