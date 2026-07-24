
function login(tipoMetodo, url, objetoAction){
    var captcha='';
    // bloqueointerface();
    getClientInfo().then(clientInfo => {
        objetoAction.cookies = clientInfo.cookieEnabled;
        objetoAction.capippriva = '';
        objetoAction.navegador = clientInfo.browser + ' ' + clientInfo.browserVersion;
        objetoAction.os = clientInfo.os + ' ' + clientInfo.osVersion;
        objetoAction.cookies = clientInfo.cookieEnabled;
        objetoAction.screensize = clientInfo.screenSize;
        objetoAction.ip = clientInfo.ip;
        $.ajax({
            type: "POST",
            url: url,
            data: objetoAction,
            success: function (data) {
                if (data.result == 'ok') {
                    localStorage.clear();
                    localStorage.setItem('sessionid', data.sessionid);
                    window.name = data.sessionid;
                    location.href = "/loginsga";
                } else {
                    abrirnotificacionmodal(data.mensaje, titulo="!Error¡");
                    return false;
                    // $("#loginform").show();
                    // $(".descargas").show();
                    // $("#declaracionform").hide();
                    // $("#login").removeAttr('disabled');
                    // $("#errormensaje").html(data.mensaje).show();
                }
            },
            error: function () {
                $("#login").removeAttr('disabled');
                $("#errormensaje").html('Error de conexión.').show();
                grecaptcha.reset();
            },
            dataType: "json"
        });
    }).catch(error => {
        console.error('Error al obtener información del cliente:', error);
    });
}

async function login(tipoMetodo, url, formData){
    try {
        const captcha='';
        const clientInfo = await getClientInfo();

        formData.append('cookies', clientInfo.cookieEnabled);
        formData.append('capippriva', '');
        formData.append('navegador', `${clientInfo.browser} ${clientInfo.browserVersion}`);
        formData.append('os', `${clientInfo.os} ${clientInfo.osVersion}`);
        formData.append('screensize', clientInfo.screenSize);
        formData.append('ip', clientInfo.ip);

        $.ajax({
            type: "POST",
            url: url,
            data: formData,
            processData: false,  // Prevenir que jQuery procese los datos
            contentType: false, // Prevenir que jQuery establezca el tipo de contenido
            dataType: "json",
            success: function (data) {
                if (data.result == 'ok') {
                    localStorage.clear();
                    localStorage.setItem('sessionid', data.sessionid);
                    window.name = data.sessionid;
                    location.href = "/loginsga";
                } else {
                    $("#loginform").show();
                    $(".descargas").show();
                    $("#declaracionform").hide();
                    $("#login").removeAttr('disabled');
                    $("#errormensaje").html(data.mensaje).show();
                }
            },
            error: function () {
                $("#login").removeAttr('disabled');
                $("#errormensaje").html('Error de conexión.').show();
                grecaptcha.reset();
                console.error('Error en la solicitud AJAX:', status, error);
            }
        });
    }catch (error){
        console.error('Error al obtener información del cliente:', error);
    }
}

function preventCopyCutPaste(event) {
    event.preventDefault();
}

function reloadCaptcha(imageId) {
    const image = document.getElementById(imageId);
    var currentSrc = image.src;
    // Añade un parámetro único para evitar caché
    const newSrc = currentSrc.split('?')[0] + '?t=' + new Date().getTime();
    image.src = newSrc;
}

function preventCopyCutPasteInput(elemtoInput) {
    const inputElemet = document.getElementById(elemtoInput);
    inputElemet.addEventListener('copy', preventCopyCutPaste);
    inputElemet.addEventListener('cut', preventCopyCutPaste);
    inputElemet.addEventListener('paste', preventCopyCutPaste);
}

function getCookie() {
    const name = 'csrftoken';
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

function storeCsrfToken() {
    $.ajax({
        url: '/store_csrftoken_code',
        type: 'POST',
        data: {
            csrftoken: getCookie('csrftoken')
        },
        success: function(response) {
            if (response.status === 'success') {
                console.log('Code stored successfully');
            } else {
                console.error('Error storing code');
            }
        },
        error: function(xhr, status, error) {
            console.error('AJAX error:', error);
        }
    });
}
