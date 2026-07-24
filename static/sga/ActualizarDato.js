
//Actualizar los datos de de un campo determinado mediante el evento change

const actualizarCampoChange = (typeMethod, url, diccionario) => {
    bloqueointerface();
    $.ajax({
        type: typeMethod,
        url: url,
        data: diccionario,
        success: function (data) {
            $.unblockUI();
            if (data.result === "ok") {
                return false;
            } else {
                abrirnotificacionmodal(data.mensaje);
            }
        },
        error: function () {
            $.unblockUI();
            abrirnotificacionmodal('Error de conexión.');
        },
    });
}