function ayuda_economica_vigente() {
    $.ajax({
        url: "{% url 'ayuda_economica_vigente' %}",  // Cambia esto por la URL correspondiente a tu vista
        type: "GET",
        dataType: "json",
        success: function(response) {
            if (response.length > 0) {
                let alertsHtml = "";
                response.forEach(function(item) {
                    let alertHtml = `
                        <div class="alert alert-success">
                            <a href="javascript:;" class="close" data-dismiss="alert">×</a>
                            <h3 class="alert-heading">AVISO IMPORTANTE</h3>
                            <p>${item[1]}, <b><a href="/alu_solicitudmatricula" style="font-size: 12px; font-weight: bold">Ayudas Económicas.</a></b>
                            ${item[2] ? '[<a class="btn btn-link formulariosolicitud" idg="' + item[0] + '" style="font-size: 13px; font-weight: bold"><i class="fa fa-download"></i> Formulario de Solicitud</a>]' : ''}
                            </p>
                        </div>`;
                    alertsHtml += alertHtml;
                });
                if ($("#notificacionesAlert .alert").length == 0){
                    $("#notificacionesAlert").html(alertsHtml);
                }else {
                    $("#notificacionesAlert").append(alertsHtml);
                }

                $(".formulariosolicitud").off('click').on('click', function() {
                    openwindow('POST', '/alu_solicitudmatricula', {action: 'formulariosolicitud', idg: $(this).attr('idg')}, '_blank');
                });
            } else {
                if ($("#notificacionesAlert .alert").length == 0) {
                    $("#notificacionesAlert .alert").html("");
                }
            }
        },
        error: function(xhr, status, error) {
            console.error("Error: " + error);
            abrirnotificacionmodal("<p>Hubo un error al cargar las notificaciones.</p>");
        }
    });
}

function falta_archivo_becas() {
    $.ajax({
        url: "{% url 'falta_archivo_becas' %}",  // Cambia esto por la URL correspondiente a tu vista
        type: "GET",
        dataType: "json",
        success: function(response) {
            if (response) {
                let alertsHtml = "";
                let alertHtml = `
                        <div class="alert alert-danger">
                            <a  href="javascript:;" class="close" data-dismiss="alert">×</a>
                            <h4 class="alert-heading">ALERTA</h4>
                            <b>Estimado(a) estudiante, puede acceder al módulo <a href="/alu_solicitudmatricula">“Ayuda económica”</a> y descargar el Acta de otorgamiento que deberá ser firmada, escaneada y subida como requisito para el desembolso de la ayuda económica que entregará la UTEQ. Si subió anteriormente la cédula y certificado bancario, no los cargue nuevamente, caso contrario deberá subir los tres documentos.</b>
                        </div>`;
                if ($("#notificacionesAlert .alert").length === 0){
                    $("#notificacionesAlert").html(alertsHtml);
                }else {
                    $("#notificacionesAlert").append(alertsHtml);
                }
            } else {
                if ($("#notificacionesAlert .alert").length === 0) {
                    $("#notificacionesAlert .alert").html("");
                }
            }
        },
        error: function(xhr, status, error) {
            console.error("Error: " + error);
            abrirnotificacionmodal("<p>Hubo un error al cargar las notificaciones.</p>");
        }
    });
}