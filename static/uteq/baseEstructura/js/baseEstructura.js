function logout() {
    localStorage.clear();
    $.ajax({
        type: "POST",
        url: "/api",
        data: {'a': 'logout'},
        success: function (data) {
            if (data.result === 'ok') {
                location.href = data.url;
            } else {
                logout();
            }
        },
        error: function () {
            logout();
        },
        dataType: "json"
    });
}

function obtenerDato(tipo, url, objeto) {
    return new Promise((resolve, reject) => {
        // bloqueointerface();
        $.ajax({
            type: tipo,
            url: url,
            data: objeto,
            success: function (data) {
                if (data.result === "ok") {
                    resolve(data);
                } else {
                    abrirnotificacionmodal(data.mensaje);
                    reject(new Error(data.mensaje));
                }
            },
            error: function (jqXHR, textStatus, errorThrown) {
                // $.unblockUI();
                abrirnotificacionmodal('Error de conexión.');
                reject(new Error('Error de conexión: ' + textStatus)); // Rechazar la promesa con detalles del error
            },
            complete: function () {
                $.unblockUI(); // Desbloquear la UI independientemente del resultado
            }
        });
    });
}

function checkSessionOnLoad() {
    var sessionid = localStorage.getItem('sessionid');
    if (sessionid) {
        if (window.name !== sessionid) {
            $.blockUI({ message: null });
            sysend.broadcast('sga', { message: 'check' });
            check_logout = setInterval(logout, 1000);
        }
    } else {
        logout();
    }
}

function tooltips() {
    $(".tl").tooltip({placement: "left"});
    $(".tr").tooltip({placement: "right"});
    $(".tu").tooltip({placement: "top"});
    $(".tb").tooltip({placement: "bottom"});
}

function refineUrl(){
    var url = window.location.href;
    if (url.search('info=') >= 0) {
        var link = url.substring(url.indexOf('/') + 1);
        var linkprincipal = url.substring(0, url.lastIndexOf('/') + 1);
        if (link.indexOf("?") >= 0) {
            link = url.substring(url.lastIndexOf('?') + 1);
            linkprincipal = url.substring(0, url.lastIndexOf('?'));
        }
        lista = link.split('&');
        var cadenalink = '';
        for (elemento in lista) {
            var item = lista[elemento];
            if (item.search('info=') < 0) {
                cadenalink += item + '&';
            }
        }
        if (cadenalink.length > 0) {
            cadenalink = '?' + cadenalink.substr(0, cadenalink.length - 1);
        }
        window.history.pushState("object or string", "Title", linkprincipal + cadenalink);
    }
}

// HASTA AQUI FUNCIONA PRUEBAS MISAEL:)
function obtenerListaSelect(tipo, url, objeto, elemento) {
    if (objeto.id.length === 0){
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
        if (objeto.id.length === 0){
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
};

function cargar_numero_notificaciones(idp) {
    var controlnotificacion = $(".numnotificacion")
    controlnotificacion.hide();
    $.post("/", {'action': 'num_notificacion', 'id': idp}, function(data){
        if (data.result === 'ok'){
            if (data.numero > 0) {
                controlnotificacion.html(data.numero).show();
            }
            $("#contenido_notificacion").attr('idp', idp)
        }
        return false;
    }, "json" );
}

function cargar_notificaciones(controlcontenido, idp, clase) {
    controlcontenido.html('');
    $.post("/", {'action': 'notificacion', 'id': idp, 'nuevo':'1'}, function (data) {
        if (data.result === 'ok') {
            for (elemento in data.lista) {
                var cadena = ''
                if (data.lista[elemento][6]) {
                    cadena = ' ' + data.lista[elemento][6]
                }
                controlcontenido.append(
                    '<a class="dropdown-item '+clase+'" href="' + data.lista[elemento][0] + '"> '+
                    '<div class="d-flex align-items-center">'+
                    '<div class="notification-box">'+data.lista[elemento][5]+'</div>'+
                    '<div class="ms-3 flex-grow-1">'+
                    '<h6 class="mb-0 dropdown-msg-user">' + data.lista[elemento][1] + cadena + '<span class="msg-time float-end text-secondary">' + data.lista[elemento][3] + '</span></h6>'+
                    '<small class="mb-0 dropdown-msg-text text-secondary d-flex align-items-center">' + data.lista[elemento][2] + '</small>'+
                    '</div>'+
                    '</div>'+
                    '</a>')
            }
        }
        return false;
    }, "json");
}
