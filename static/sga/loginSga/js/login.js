$(document).ready(function() {
    $(".noticiaimagen").attr('rel', 'gallery').fancybox({padding : 0});
    $(".fancybox").attr('rel', 'gallery').fancybox({padding : 0, autoScale: true, transitionIn: 'fade', transitionOut: 'fade'});
    $("#noticiagrafica").fancybox().trigger('click');
    $('.carousel').carousel();

    $("#username").focus();
    // getClientInfo()
    // var clientInfo = getClientInfo();
    // console.log(clientInfo);
    // console.log(clientInfo.cookieEnabled);

    $("#busqueda").click(function(){
        buscar();
    });

    $(".tl").tooltip({position:"center up"});

    $("#cambioclave").click(function(){
        var usuario = $("#datos").val();
        $(".ini").show();

        $("#errorb,#success").hide();
        if (usuario.trim().length > 0) {
            bloqueointerface();
            $.ajax({
                type: "POST",
                url: "/datos",
                data: {"action": "generarnuevaclave", "usuario": usuario},
                success: function (data) {
                    $.unblockUI();
                    if (data.result == "ok") {
                        $("#success").html('Revise su correo institucional <b> ('+data.data+') </b>, o personal para completar la solicitud.').show();
                        $("#tabla").hide();
                    } else {
                        $("#errorb").html('Error al enviar la solicitud.').show();
                    }
                },
                error: function(){
                    $.unblockUI();
                    abrirnotificacionmodal("Error de conexión.");
                },
                dataType:"json"
            });
        } else {
            $("#datos").focus();
        }
    });

    $("#logindeclaracion1").click(function(){
        bloqueointerface();
        var usuario = $("#userdeclaracion").val();
        if (usuario.length == 0){
            $("#userdeclaracion").focus();
            return false;
        }
        var clave = $("#passdeclaracion").val();
        if (clave.length == 0){
            $("#passdeclaracion").focus();
            return false;
        }
        if($("#acepto").prop('checked')) {
            login(usuario, clave);
        }
        else
        {
            $.unblockUI();
            abrirnotificacionmodal("Debe Aceptar para poder continuar.");
        }
    });

    $('#userdeclaracion, #passdeclaracion').keyup(function(e) {
        if(e.keyCode == 13) {
            logindeclaracion();
        }
    });

    $('#datos').keyup(function(e) {
        if(e.keyCode == 13) {
            buscar();
        }
    });

    $("#logindeclaracion").click(function(){
        logindeclaracion();
    });

    $(".infourl").click(function () {
        $(".noticiaimagen").click(function () {
            location.reload(true);
            return false;
        });
        var url = $(this).attr('infourl')
        window.open(url);
    });

    $("#user").blur(function(){
        $(this).val($(this).val().trim());
    });

    $("#pass, #user").keydown(function(){
        $("#errormensaje").hide();
    });

    $("#login").click(function(){
        var usuario = $("#user").val();
        if (usuario.length == 0){
            $("#user").focus();
            return false;
        }
        var clave = $("#pass").val();
        if (clave.length == 0){
            $("#pass").focus();
            return false;
        }
        login(usuario, clave);
    });

    $("#aceptar").click(function(){
        declaracion();
        // logindeclaracion();
    });

    $("#recuperar").click(function(){
        $("#loginform").hide();
        $(".descargas").hide();
        $("#success").hide();
        $("#recuperarform").show();
        $(".ini").show();
    });

    $(".ini,.fin").click(function(){
        $("#datos").val("");
        $("#recuperarform").hide();
        $("#tabla").hide();
        $("#errorb").hide();
        $("#success").hide();
        $("#loginform").show();
        $(".descargas").show();
    });

    $(".fancybox").eq(0).trigger('click');
});

async function getClientInfo() {
    let unknown = '-';
    let screenSize = getScreenSize(); //síncrona
    let browserInfo = getBrowserInfo(); //síncrona
    let osInfo = getOSInfo(); //síncrona
    let mobile = isMobile(); //síncrona
    let cookieEnabled = navigator.cookieEnabled ? true : false;
    const ip = await obtenerDireccionIP(); //Asíncrona
    return {
        screenSize: screenSize,
        browser: browserInfo.name,
        browserVersion: browserInfo.version,
        os: osInfo.name,
        osVersion: osInfo.version,
        mobile: mobile,
        cookieEnabled: cookieEnabled,
        ip: ip
    };
}

function getScreenSize() {
    let width = screen.width ? screen.width : unknown;
    let height = screen.height ? screen.height : unknown;
    return width + " x " + height;
}

function getBrowserInfo() {
    let userAgent = navigator.userAgent;
    let temp;
    let browser = navigator.appName;
    let version = '' + parseFloat(navigator.appVersion);
    let matchArray = [
        {pattern: /(opera|opr|opios)[\/\s](\d+)/i},                            // Opera
        {pattern: /(msie|trident) (\d+)/i},                                    // Internet Explorer
        {pattern: /(chrome|crios)[\/\s](\d+)/i},                               // Chrome
        {pattern: /(version\/)(\d+) (.*)safari/i},                             // Safari
        {pattern: /(firefox|fxios)[\/\s](\d+)/i},                              // Firefox
        {pattern: /rv:(\d+).*\bgecko\b/i},                                     // IE11
    ];

    for (var i = 0; i < matchArray.length; i++) {
        let match = userAgent.match(matchArray[i].pattern);
        if (match) {
            browser = match[1];
            version = match[2];
            break;
        }
    }
    return { name: browser, version: version };
}

function getOSInfo() {
    let userAgent = navigator.userAgent;
    let platform = navigator.platform;
    let macosPlatforms = ['Macintosh', 'MacIntel', 'MacPPC', 'Mac68K'];
    let windowsPlatforms = ['Win32', 'Win64', 'Windows', 'WinCE'];
    let iosPlatforms = ['iPhone', 'iPad', 'iPod'];
    let os = 'unknown';
    let version = 'unknown';

    if (macosPlatforms.indexOf(platform) !== -1) {
        os = 'Mac OS';
        version = /Mac OS X (\d+[\._\d]+)/.exec(userAgent)[1].replace(/_/g, '.');
    } else if (iosPlatforms.indexOf(platform) !== -1) {
        os = 'iOS';
        version = /OS (\d+)_(\d+)_?(\d+)?/.exec(navigator.appVersion)[1] + '.' + RegExp.$2 + '.' + (RegExp.$3 | 0);
    } else if (windowsPlatforms.indexOf(platform) !== -1) {
        os = 'Windows';
        version = /Windows NT (\d+.\d+)/.exec(userAgent)[1];
    } else if (/Android/.test(userAgent)) {
        os = 'Android';
        version = /Android (\d+(\.\d+)?)/.exec(userAgent)[1];
    } else if (/Linux/.test(platform)) {
        os = 'Linux';
    }

    return { name: os, version: version };
}

function isMobile() {
    return /Mobile|mini|Fennec|Android|iP(ad|od|hone)/.test(navigator.userAgent);
}

async function obtenerDireccionIP() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch (error) {
        console.error('Error al obtener la dirección IP:', error);
        return '-';
    }
}

function login(usuario, clave){
    var captcha='';
    // {% if validar_con_captcha %}
    //     captcha= $("#g-recaptcha-response").val();
    // {% endif %}
    $("#login").attr({"disabled": "disabled"});
    getClientInfo().then(clientInfo => {
        $.ajax({
            type: "POST",
            url: "/loginsga",
            data: {
                'action': 'login',
                'capippriva': capippriva,
                'navegador': clientInfo.browser + ' ' + clientInfo.browserVersion,
                'os': clientInfo.os + ' ' + clientInfo.osVersion,
                'cookies': clientInfo.cookieEnabled,
                'screensize': clientInfo.screenSize,
                'ip': clientInfo.ip,
                'user': usuario,
                'pass': clave,
                'g-recaptcha-response': captcha
            },

            success: function (data) {
                if (data.result == 'ok') {
                    localStorage.clear();
                    localStorage.setItem('sessionid', data.sessionid);
                    window.name = data.sessionid;
                    location.href = "/loginsga";
                } else {
                    $.unblockUI();
                    $("#loginform").show();
                    $(".descargas").show();
                    $("#declaracionform").hide();
                    $("#login").removeAttr('disabled');
                    $("#errormensaje").html(data.mensaje).show();
                    grecaptcha.reset();
                }
            },
            error: function () {
                $.unblockUI();
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
function buscar(){
    var busqueda = $("#datos").val();
    $("#errorb").hide();
    $("#success").hide();
    if (busqueda.trim().length > 0) {
        bloqueointerface();
        $.ajax({
            type: "POST",
            url: "/datos",
            data: {"action": "busqueda", "busqueda": busqueda},
            success: function (data) {
                $.unblockUI();
                if (data.result == "ok") {
                    $("#tabla").show();
                    $(".ini").hide();
                    $("#tablacontenido").html("¡¡Usuario registrado!!");
                    if (data.permisoboton == "0") {
                        $("#generar").hide();
                    }
                    else {
                        $("#generar").show();
                    }

                } else {
                    $("#tabla").hide();
                    $(".ini").show();
                    $("#errorb").html(data.mensaje).show();
                }
            },
            error: function(){
                $.unblockUI();
                $("#tabla").hide();
                $("#errorb").html('No se pudo realizar la consulta').show();
            },
            dataType:"json"
        });
    } else {
        $("#datos").focus();
    }
}

function logindeclaracion() {
    $("#acepto").attr("checked", false);
    var usuario = $("#userdeclaracion").val();
    if (usuario.length == 0){
        $("#userdeclaracion").focus();
        return false;
    }
    var clave = $("#passdeclaracion").val();
    if (clave.length == 0){
        $("#passdeclaracion").focus();
        return false;
    }
    $("#loginform").hide();
    $("#declaracionform").show();
    $(".descargas").hide();
}

function mostrar_pass(control) {
    var tipo = document.getElementById(control);
    if(tipo.type == "password"){
        tipo.type = "text";
        $('.mostrar').removeClass('fa fa-eye-slash').addClass('fa fa-eye')

    }else{
        tipo.type = "password";
        $('.mostrar').removeClass('fa fa-eye').addClass('fa fa-eye-slash')

    }
}