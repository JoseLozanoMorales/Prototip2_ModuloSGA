function obtenerDato(tipo, url, objeto) {
    return new Promise((resolve, reject) => {
        bloqueointerface();
        $.ajax({
            type: tipo,
            url: url,
            data: objeto,
            success: function (data) {
                $.unblockUI();
                if (data.result === "ok") {
                    resolve(data);
                } else {
                    reject(data.mensaje);
                }
            },
            error: function (jqXHR, textStatus, errorThrown) {
                reject('Error de conexión: ' + textStatus); // Rechazar la promesa con detalles del error
            },
            complete: function () {
                $.unblockUI(); // Desbloquear la UI independientemente del resultado
            }
        });
    });
}

function obtenerLista(tipo, url, objeto, elemento) {
    return new Promise((resolve, reject) => {
        if (objeto.length == 0){
            return false;
        }
        var lista;
        bloqueointerface();
        $.ajax({
            type: tipo,
            url: url,
            data: objeto,
            success: function (data) {
                $.unblockUI();
                if (data.result === "ok") {
                    // console.log(data.lista)
                    resolve(data.lista);
                } else {
                    abrirnotificacionmodal(data.mensaje);
                }
            },
            error: function () {
                $.unblockUI();
                abrirnotificacionmodal('Error de conexión.');
            },
        });
    });
}
function processRequest(tipo, url, objeto, with_bloqueo = false) {
    if(!objeto || objeto == undefined || objeto==null){
        const [path, queryString] = url.split('?');

        // Convertir query string a objeto
        const params = {};
        if (queryString) {
            const urlParams = new URLSearchParams(queryString);
            for (const [key, value] of urlParams) {
                params[key] = value;
            }
        }
        url=path;
        objeto=params;
    }

    return new Promise((resolve, reject) => {
        if (with_bloqueo) bloqueointerface();
        $.ajax({
            type: tipo,
            url: url,
            data: objeto,
            success: function (data) {
                if (data.result === "ok") {
                    resolve(data);
                } else {
                    const error = new Error(data.mensaje || 'Error en la solicitud');
                    error.data = data;
                    error.code = data.codigo || '';
                    reject(error);
                }
            },
            error: function (jqXHR, textStatus, errorThrown) {
                const error = new Error('Error de conexión: ' + textStatus);
                error.type = 'network';
                error.status = jqXHR.status;
                error.responseText = jqXHR.responseText;

                // Intentar parsear respuesta JSON si existe
                try {
                    error.data = JSON.parse(jqXHR.responseText);
                } catch (e) {
                    error.data = null;
                }

                reject(error);
            },
            complete: function () {
                if (with_bloqueo)  $.unblockUI();
            }
        });
    });
}