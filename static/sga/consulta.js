
// Funcion para llenar lista de un select
function obtenerListaSelect(tipo, url, objeto, elemento) {
    if (!objeto){
        return false;
    }
    bloqueointerface();
    $.ajax({
        type: tipo,
        url: url,
        data: objeto,
        success: function (data) {
            $.unblockUI();
            if (data.result === "ok") {
                for (item in data.lista) {
                    elemento.append('<option value="' + data.lista[item][0] + '">' + data.lista[item][1] + '</option>');
                }
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

function obtenerLista(tipo, url, objeto, elemento) {
    return new Promise((resolve, reject) => {
        if (objeto.id.length == 0){
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
// Consultas select2
const setupSelect2 = (selector, type, url, action, placeholder='Busqueda de registro', otrosParametros={}) => {
    $(selector).select2({
        ajax: {
            type: type,
            url: url,
            dataType: 'json',
            quietMillis: 250,
            data: function (params) {
                let paramDict = {
                    action: action,
                    q: params.term,
                    s: 20
                }
                if (otrosParametros){
                    paramDict = {...paramDict, ...otrosParametros}
                }
                return paramDict;
            },
            processResults: function (data) {
                return {
                    results: $.map(data.results, function(obj) {
                        return { id: obj.id, text: obj.name };
                    })
                };
            }
        },
        cache: true,
        placeholder: placeholder,
        minimumInputLength: 3,
        language: 'es'
    });
};