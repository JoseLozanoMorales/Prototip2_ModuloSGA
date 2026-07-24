$(document).ready(function() {
    $('.validarclave').keyup(function() {
        var pswd = $(this).val();
        var passOld = $("#passOld").val();
        updateItemLits(pswd.match(/[A-z]/), $('#letter'));
        updateItemLits(pswd.match(/[A-Z]/), $('#letterMayus'));
        updateItemLits(pswd.match(/[a-z]/), $('#letterMinus'));
        updateItemLits(pswd.match(/\d/), $('#number'));
        updateItemLits(pswd.length >= 8, $('#length'));
        updateItemLits($("#inputNewPassword").val() == $("#inputConfirmPassword").val()  && pswd.length > 0, $('#igualdad'));
        updateItemLits($("#inputNewPassword").val() == $("#inputConfirmPassword").val()  &&  $("#inputConfirmPassword").val() != passOld, $('#nuevarepetir'));

        if ($(".list-group li").length === $(".list-group .valid").length){
            $("#changePassword").show();
        }else{
            $("#changePassword").hide();
        }
    });

    $('#changePasswordFrom').submit(function(e) {
        e.preventDefault();
        if (this.checkValidity() === false) {
            e.stopPropagation();
        } else {
            getClientInfo().then(clientInfo => {
                var form = $(this)[0];
                var formData = new FormData(form);
                // Agregar información del cliente al FormData
                formData.append('cookies', clientInfo.cookieEnabled);
                formData.append('capippriva', '');
                formData.append('navegador', clientInfo.browser + ' ' + clientInfo.browserVersion);
                formData.append('os', clientInfo.os + ' ' + clientInfo.osVersion);
                formData.append('screensize', clientInfo.screenSize);
                formData.append('ip', clientInfo.ip);

                $.ajax({
                    url: '/datos?action=resetearPassword',
                    type: 'POST',
                    data: formData,
                    processData: false,  // Evita que jQuery convierta el FormData en una cadena de consulta
                    contentType: false,  // Evita que jQuery establezca el tipo de contenido
                    success: function(response) {
                        if (response.result === 'ok') {
                            abrirnotificacionmodal(response.mensaje, titulo = "Cambio de contraseña", habilitarBtnOk = 1, urlDestino = "https://sga.uteq.edu.ec/loginsga");
                        } else {
                            abrirnotificacionmodal(response.mensaje, titulo = "Error");
                        }
                    },
                    error: function() {
                        abrirnotificacionmodal('Error al enviar los datos.');
                    }
                });
            }).catch(error => {
                console.error('Error al obtener información del cliente:', error);
            });
        }
        this.classList.add('was-validated');
    });
});

function updateItemLits(valid, elementLi) {
    if (valid) {
        elementLi.removeClass('invalid').addClass('valid');
        elementLi.find('.icono').removeClass('text-danger').addClass('text-success');
        elementLi.find('.icono').removeClass('bi-x-square').addClass('bi-check2-square');
    } else {
        elementLi.removeClass('valid').addClass('invalid');
        elementLi.find('.icono').removeClass('text-success').addClass('text-danger');
        elementLi.find('.icono').removeClass('bi-check2-square').addClass('bi-x-square');
    }
}