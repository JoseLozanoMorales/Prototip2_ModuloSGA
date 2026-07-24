$(document).ready(function () {
    $("#id_email, #id_emailinst, #id_correoinstasoc, #id_correoinst").css({'text-transform': 'none'});

    $(".fotoperfil").fancybox();

    refineUrl();

    if (!('contains' in String.prototype)) {
        String.prototype.contains = function (str, startIndex) {
            return -1 !== String.prototype.indexOf.call(this, str, startIndex);
        };
    }

    $("*").focusin(function () {
        $('.datepicker').css({"display": "none"});
    })


    // revisar
    // window.oncontextmenu = function() {
    //             return false;
    //          };

    sinurlatrasbutton();

    $(".listaperiodos").click(function () {
        $("#periodospanel").modal("show");
    });

    $("#cerrarperiodospanel").click(function () {
        $("#periodospanel").modal("hide");
    });

    cerrar_viewhtml = function () {
        $("#viewhtml").modal("hide");
    };

    $("#seleccionarperiodospanel").click(function () {
        var pid = $("#periodoselectorall").val();
        obtenerDato('GET', '/', {'action': 'periodo', 'id': pid})
            .then(data => {
                location.href = location.pathname;
                // Aquí puedes seguir procesando los datos recibidos
            })
            .catch(error => {
                abrirnotificacionmodal("Error al cambiar de periodo");
                // Aquí puedes manejar el error, por ejemplo, mostrando un mensaje al usuario
            });
    });

    $('.dropdown-toggle').dropdown();

    if ('ontouchstart' in window) {
        // // Dropdown principal
        document.querySelectorAll('.dropdown-toggle').forEach(function (el) {
            el.addEventListener('touchstart', function (e) {
                el.parentNode.classList.toggle('open');
            }, {passive: true});
        });
        // Submenus
        document.querySelectorAll('.dropdown-submenu > a').forEach(function (el) {
            el.addEventListener('touchstart', function (e) {
                e.stopPropagation(); // evita que cierre el menu padre
                e.preventDefault();  // evita saltar al href
                el.parentNode.classList.toggle('open'); // abre/cierra submenu
            }, {passive: false}); // false porque usamos preventDefault
        });

    }

    $(".collapse").collapse();
    $('.tips').tooltip({});

    $(".periodoselector").click(function () {
        var pid = $(this).attr('pid');
        obtenerDato('GET', '/', {'action': 'periodo', 'id': pid})
            .then(data => {
                location.href = location.pathname;
            })
            .catch(error => {
                abrirnotificacionmodal("Error al cambiar de periodo");
            });
    });

//  efectos
    $("table tbody tr").hover(function () {
        $(this).addClass("info");
    }, function () {
        $(this).removeClass("info");
    });

    $(".btn-form").click(function () {
        bloqueointerface();
    });

    $(".bloqueo_pantalla").click(function () {
        bloqueointerface();
    });

    // $('.formdynamics').bind('click.conectar_modaldynamics', conectar_modaldynamics);
    $(document).on('click.conectar_modaldynamics', '.formdynamics', conectar_modaldynamics);

    $('.confirmacionmodal').bind('click.conectar_confirmacion', conectar_confirmacion);
    $('.viewhtml').bind('click.conectar_modaldynamics', conectar_modaldynamics);
    $('.eliminacionmodal').bind('click.conectar_modaldynamics', conectar_modaldynamics);
    $(".reportedirecto").bind("click.conectar_reporte", abrir_reporte);
    $("#formatoreporte_run").bind("click.ejecutar_reporte", ejecutar_reporte);
    $("#formatoreporte_close").bind("click.cerrar_reporte", cerrar_reporte);

    tooltips();

    history.pushState(null, null, location.href);
    window.addEventListener('popstate', function (event) {
        history.pushState(null, null, location.href);
    });

    actualizarnumerico();

    $('.imp-number, .imp-moneda, .imp-numbersmall, .imp-numbermed-right, .imp-numbermed-center, .nota').focus(function () {
        if (!parseFloat($(this).val())) {
            $(this).val("");
        }
    });

    $('.selectorfecha').keypress(function () {
        return false;
    });

    $(".ir_arriba").click(function () {
        $("#content-p, html").animate({
            scrollTop: '0px',
        }, 800);

    });

    $(window).scroll(function () {
        if ($(this).scrollTop() > 0) {
            $(".ir_arriba").slideDown(450);
        } else {
            $(".ir_arriba").slideUp(450);
        }
    });

    var ancho = $(window).width();
    if (ancho < 500) {
        $('.dropdown_periodo').removeClass('pull-right').addClass('pull-left');
    } else {
        $('.dropdown_periodo').removeClass('pull-left').addClass('pull-right');
    }

    $("#select_periodo").click(function () {
        $("#select-search").focus()
    });

    $("#select-search").keyup(function (e) {
        var texto = $(this).val().toUpperCase();
        $(".periodoselector").each(function () {
            var descripcion = $(this).html();
            if (!(descripcion.toString().toUpperCase().contains(texto))) {
                $(this).parent().hide();
            } else {
                $(this).parent().show();
            }
        });
    });

    $("#item_archivolocales").click(function () {
        $.ajax({
            type: "POST",
            url: "/",
            data: {'action': 'mis_arcivoslocales'},
            success: function (data) {
                if (data.result == 'ok') {
                    $(".archivolocales").html(data.html)
                    $.unblockUI();
                } else {
                    $("#errormensaje_r").html(data.mensaje).show();
                    $.unblockUI();
                }
                $("#registro_bt").removeAttr('disabled');
            },
            error: function () {
                $.unblockUI();
                $("#registro_bt").removeAttr('disabled');
                $("#errormensaje_r").html('Error de conexión. al servidor').show();
            },
            dataType: "json"
        });
    });

    $(".cerrarmodalpdf").click(function () {
        $("#mimodalpdf").modal('hide')
    });
});


function refineUrl() {
    var url = window.location.href;
    if (url.search('info=') >= 0) {
        var link = url.substring(url.indexOf('/') + 1);
        var linkprincipal = url.substring(0, url.lastIndexOf('/') + 1);
        if (link.indexOf("?") >= 0) {
            link = url.substring(url.lastIndexOf('?') + 1);
            linkprincipal = url.substring(0, url.lastIndexOf('?'));
        }
        var lista = link.split('&');
        var cadenalink = '';
        for (var elemento in lista) {
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

function openwindow_reporte(url, width, height) {
    newwindow = window.open(url, 'name', 'height=' + height + ' ,width=' + width);
}

function openwindow(verb, url, data, target) {
    var form = document.createElement("form");
    form.action = url;
    form.method = verb;
    form.target = target || "_self";
    if (data) {
        data = data || {}
        data['csrfmiddlewaretoken'] = csrftoken;
        for (var key in data) {
            var input = document.createElement("textarea");
            input.name = key;
            input.value = typeof data[key] === "object" ? JSON.stringify(data[key]) : data[key];
            form.appendChild(input);
        }
    }
    form.style.display = 'none';
    document.body.appendChild(form);
    form.submit();
}

function chequearemial() {
    obtenerDato('POST', '/api', {'a': 'checkmail'})
        .then(data => {
            if (data.mensajes) {
                $("#checkmailicon").removeClass("hidden").show();
            } else {
                $("#checkmailicon").addClass("hidden").hide();
            }
            // Aquí puedes seguir procesando los datos recibidos
        })
        .catch(error => {
            console.error('Error al obtener datos:', error.message);
            // Aquí puedes manejar el error, por ejemplo, mostrando un mensaje al usuario
        });
}

function chequearsesion() {
    obtenerDato('POST', '/api', {'a': 'checksession'})
        .then(data => {
            if (data.nuevasesion) {
                bloqueointerface();
                location.href = '/logout';
            }
            // Aquí puedes seguir procesando los datos recibidos
        })
        .catch(error => {
            console.error('Error al obtener datos:', error.message);
            // Aquí puedes manejar el error, por ejemplo, mostrando un mensaje al usuario
        });
}

function sleep(milliseconds) {
    var start = new Date().getTime();
    for (var i = 0; i < 1e7; i++) {
        if ((new Date().getTime() - start) > milliseconds) {
            break;
        }
    }
}

function sinurlatrasbutton() {
    if (location.pathname == '/') {
        $("#urlatrasbutton").remove();
    }
}

function deshabilitar(nombre) {
    $(nombre).attr({"disabled": "disabled"});
}

function habilitar(nombre) {
    $(nombre).removeAttr("disabled").removeAttr("readonly");
}

function redondeo(numero, precision) {
    if (isNaN(numero) || isNaN(precision)) {
        // Asegurarse de que ambos argumentos son números
        abrirnotificacionmodal('El valor registrado no coresponde al formato numérico..')
        return NaN;
    }
    var factor = Math.pow(10, precision);
    var numRedondeado = Math.round(numero * factor) / factor;
    return numRedondeado;
}

function numerico(elemento, min, max, decimales) {
    var nvalor;
    var valor = elemento.val();

    if (valor === "") {
        valor = parseFloat(0).toFixed(decimales);
        elemento.val(valor);
        return;
    }

    valor = parseFloat(valor);
    min = parseFloat(min);
    max = parseFloat(max);
    decimales = parseInt(decimales);

    if (isNaN(valor)) {
        nvalor = min.toFixed(decimales);
        elemento.val(nvalor);
        return;
    }

    if (valor < min) {
        nvalor = min.toFixed(decimales);
        elemento.val(nvalor);
        return;
    }

    if (max > 0 && valor > max) {
        nvalor = max.toFixed(decimales);
        elemento.val(nvalor);
        return;
    } else {
        if (max === 0 && !(valor > 0)) {
            nvalor = max.toFixed(decimales);
            elemento.val(nvalor);
            return;
        }
    }

    nvalor = valor.toFixed(decimales);
    elemento.val(nvalor);
}


function logout() {
    bloqueointerface();
    localStorage.clear();
    $.ajax({
        type: "POST",
        url: "/api",
        data: {'a': 'logout'},
        success: function (data) {
            if (data.result == 'ok') {
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

function tooltips() {
    $(".tl").tooltip({placement: "left"});
    $(".tr").tooltip({placement: "right"});
    $(".tu").tooltip({placement: "top"});
    $(".tb").tooltip({placement: "bottom"});
}

function actualizarnumerico() {
    $('.imp-number[decimal], .imp-moneda[decimal], .imp-numbersmall[decimal], .imp-numbermed-right[decimal], .imp-numbermed-center[decimal], .nota[decimal]').each(function () {
        numerico($(this), 0, 0, $(this).attr('decimal'));
    })
}

function escapeHTMLEncode(str) {
    var div = document.createElement('div');
    var text = document.createTextNode(str);
    div.appendChild(text);
    return div.innerHTML;
}

function tipo_formulario(elemento) {
    if (elemento.attr('formtype') == 'form-vertical') {
        elemento.find(".control-label").css({'float': 'none'});
        elemento.find(".label-text").css({'text-align': 'left'});
        elemento.find(".control-label").each(function () {
            var contenedor = parseFloat($(this).parent().css('width')) - 5;
            $(this).css({'width': contenedor.toString() + 'px'});
        });
        elemento.find(".control").each(function () {
            var contenedor = parseFloat($(this).parent().css('width')) - 5;
            $(this).css({'width': contenedor.toString() + 'px'});
        });
    } else {
        elemento.find(".control-label").css({'float': 'left'});
        elemento.find(".label-text").css({'text-align': 'right'});
        if (elemento.hasClass('form-modal')) {
            elemento.find(".control-group").each(function () {
                var contenedor = parseFloat($(this).parent().width());
                var porciento = (parseFloat($(this).width()) / 100);
                var tam = parseInt(contenedor * porciento);
                $(this).css({'width': tam});
            });
        }
        elemento.find(".control-label").each(function () {
            if ($(this).attr('labelwidth')) {
                $(this).css({'width': $(this).attr('labelwidth')});
            } else {
                $(this).css({'width': '150px'});
            }
        });
        elemento.find(".control").each(function () {
            var contenedor = $(this).parent().width();
            var label = parseFloat($(this).parent().find('.control-label').width());
            $(this).css({'width': ((contenedor - label) - 20).toString() + 'px'});
        });
    }
    elemento.find(".select2").css({'width': '100%'});
}

function pop_lista(arr, item) {
    for (var i = arr.length; i--;) {
        if (arr[i] === item) {
            arr.splice(i, 1);
        }
    }
}

function mover_posicion_arriba_pantalla() {
    $(".ir_arriba").trigger('click');
}

function newPageWindow(myURL, title, myWidth, myHeight) {
    var left = (screen.width - myWidth) / 2;
    var top = (screen.height - myHeight) / 4;
    window.open(myURL, title, 'directories=no, location=no, menubar=no, scrollbars=yes, status=no, toolbar=no, channelmode=no, titlebar=no, width=' + myWidth + ', height=' + myHeight + ', top=' + top + ', left=' + left);
}

let notificacionesController = null;

async function cargar_numero_notificaciones(idp) {
    // Cancelar petición anterior
    if (notificacionesController) {
        notificacionesController.abort();
    }

    notificacionesController = new AbortController();
    // $(".notify-alert").hide();

    try {
        const formData = new FormData();
        formData.append('id', idp);

        const csrftoken = document.querySelector('[name=csrfmiddlewaretoken]')?.value || getCookie('csrftoken');
        if (csrftoken) {
            formData.append('csrfmiddlewaretoken', csrftoken);
        }

        const response = await fetch("/api/notificaciones/numero/", {
            method: "POST",
            body: formData,
            signal: notificacionesController.signal,
            headers: {
                'X-CSRFToken': csrftoken
            },
            credentials: 'same-origin'
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.result === 'ok') {
            if (data.numero > 0) {
                $(".notify-alert").html(data.numero).show();
                $("#numero_notificacion").show();
            } else {
                $(".notify-alert").hide();
                $("#numero_notificacion").hide();
            }
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('Petición de notificaciones cancelada:', error.name);
        } else {
            console.error('Error al cargar notificaciones:', error);
        }
    } finally {
        $.unblockUI();
        notificacionesController = null;
    }
}

// 🎯 Mapeo de iconos por tipo
const NOTIFICATION_ICONS = {
    tarea: '<i class="fa fa-tasks"></i>',
    cuestionario: '<i class="fa fa-clipboard"></i>',
    chat: '<i class="fa fa-comment"></i>',
    nuevo: '<i class="fa fa-exclamation-circle"></i>'
};

// 🔧 Función auxiliar para determinar el tipo de icono
function obtenerTipoNotificacion(titulo) {
    const tituloLower = titulo.toLowerCase();
    if (tituloLower.includes("tarea")) return 'tarea';
    if (tituloLower.includes("cuestionario")) return 'cuestionario';
    if (tituloLower.includes("chat")) return 'chat';
    if (tituloLower.includes("nuevo")) return 'nuevo';
    return null;
}

// 🔧 Función auxiliar para generar HTML de notificación (tipo 1)
// Mismo formato de tarjeta que el panel de notificaciones de Aula Virtual
// (templates/baseaulavirtual.html, clases .av-np-item*).
function generarNotificacionTipo1(notif) {
    const tipo = obtenerTipoNotificacion(notif[1]);
    const iconoHtml = tipo
        ? `<div class="av-np-item-icon av-np-icon--${tipo}">${NOTIFICATION_ICONS[tipo]}</div>`
        : `<div class="av-np-item-icon av-np-icon--default"><i class="fa fa-bell"></i></div>`;

    // notif[2] = materia - paralelo (línea "warn", igual que item.6 en baseaulavirtual.html)
    const warnHtml = notif[2]
        ? `<div class="av-np-item-warn"><i class="fa fa-exclamation-circle"></i> ${notif[2]}</div>`
        : '';

    // notif[5] = extra opcional: contador de no leídos (chats) o nota de extensión (tareas)
    const extra = notif[5];
    const tieneExtra = extra !== undefined && extra !== null && extra !== '' && extra !== 0;
    const badgeHtml = tieneExtra
        ? `<span class="av-np-item-badge"><i class="fa fa-comment"></i> ${extra}</span>`
        : '';

    return `
        <a class="av-np-item" href="${notif[0]}">
            ${iconoHtml}
            <div class="av-np-item-body">
                <div class="av-np-item-title">${notif[1]}</div>
                ${warnHtml}
                <div class="av-np-item-meta">
                    ${notif[3]}
                </div>
            </div>
            ${badgeHtml}
        </a>
    `;
}

// / 🔧 Función auxiliar para generar HTML de notificación (tipo 2)
// Mismo formato de tarjeta que el panel de notificaciones de Aula Virtual
// (templates/baseaulavirtual.html, clases .av-np-item*).
function generarNotificacionTipo2(notif) {
    const visual = notif[5]
        ? '<i class="fa fa-eye tu" title="leído" style="color: rgba(103,102,102,0.94);"></i>'
        : '';

    const icono = (typeof iconos !== 'undefined' && iconos[notif[6]]) || '';

    return `
        <a class="av-np-item" href="${notif[0]}">
            <div class="av-np-item-icon av-np-icon--dinamico">
                <div style="color: var(--${notif[6]}-icono)">
                    ${icono}
                </div>
            </div>
            <div class="av-np-item-body">
                <div class="av-np-item-title">
                    <span style="color: var(--${notif[6]}-color)">${notif[1]}</span>
                </div>
                <div class="av-np-item-meta">
                    ${notif[2] ? notif[2] + ' — ' : ''}
                    ${notif[3] ? `<i class="fa fa-clock-o"></i> ${notif[3]}` : ''}
                    ${visual}
                </div>
            </div>
        </a>
    `;
}

async function cargar_notificaciones() {
    const $contenedor = $("#contenido_notificacion");

    try {
        // 🛑 Cancelar petición anterior si existe
        if (notificacionesController) {
            notificacionesController.abort();
            console.log('⚠️ Petición anterior cancelada');
        }

        notificacionesController = new AbortController();

        // 📋 Validar ID del período
        const idp = $contenedor.attr("idp");
        if (!idp) {
            $contenedor.html(`
                <div class="alert alert-info">
                    <i class="fa fa-info-circle"></i> No hay período seleccionado
                </div>
            `);
            return;
        }

        // ⏳ Mostrar loading
        $contenedor.html(getDotsLoading());

        // 📦 Preparar datos para el POST
        const formData = new FormData();
        formData.append('id', idp);

        const csrftoken = document.querySelector('[name=csrfmiddlewaretoken]')?.value || getCookie('csrftoken');
        if (csrftoken) {
            formData.append('csrfmiddlewaretoken', csrftoken);
        }

        // 🚀 Hacer petición con timeout (aborta el fetch real, no solo la espera)
        let seVencioTiempo = false;
        const timeoutId = setTimeout(function () {
            seVencioTiempo = true;
            notificacionesController.abort();
        }, 15000);

        let response;
        try {
            response = await fetch("/api/notificaciones/lista/", {
                method: "POST",
                body: formData,
                signal: notificacionesController.signal,
                headers: {'X-CSRFToken': csrftoken},
                credentials: 'same-origin'
            });
        } catch (fetchError) {
            if (seVencioTiempo) {
                throw new Error('Timeout');
            }
            throw fetchError;
        } finally {
            clearTimeout(timeoutId);
        }

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // ⏱️ Esperar mínimo para mostrar loading (ejecutar en paralelo)
        const tiempoMinimo = new Promise(resolve => setTimeout(resolve, 800));
        await tiempoMinimo;

        // 🧹 Limpiar contenedor
        $contenedor.empty();

        // ✅ Procesar respuesta exitosa
        if (data.result === 'ok') {
            if (!data.lista || (Array.isArray(data.lista) && data.lista.length === 0)) {
                $contenedor.html(`
                    <div class="alert alert-info text-center">
                        <i class="fa fa-bell-slash-o" style="font-size: 48px; opacity: 0.3;"></i>
                        <p style="margin-top: 10px;">No hay notificaciones</p>
                    </div>
                `);
                return;
            }

            // 📝 Renderizar notificaciones según tipo
            if (data.tipo) {
                // Tipo 1: Notificaciones con detección de iconos
                const notificacionesHtml = Object.values(data.lista)
                    .map(notif => generarNotificacionTipo1(notif))
                    .join('');

                $contenedor.append(notificacionesHtml);
                $(".ver_totas_notificaciones").hide();
            } else {
                // Tipo 2: Notificaciones con iconos predefinidos
                const notificacionesHtml = Object.values(data.lista)
                    .map(notif => generarNotificacionTipo2(notif))
                    .join('');

                $contenedor.append(notificacionesHtml);
            }

            // 🎉 Animación de entrada suave (opcional)
            $contenedor.find('.av-np-item').hide().fadeIn(300);

        } else {
            // ⚠️ Error en respuesta
            $contenedor.html(`
                <div class="alert alert-warning">
                    <i class="fa fa-exclamation-triangle"></i>
                    ${data.mensaje || 'Error al cargar notificaciones'}
                </div>
            `);
        }

    } catch (error) {
        // 🚫 Manejo de errores
        if (error.name === 'AbortError') {
            console.log('ℹ️ Petición de notificaciones cancelada');
            return; // No mostrar error si fue cancelada intencionalmente
        }

        console.error('❌ Error al cargar notificaciones:', error);

        let mensajeError = 'Problema de conexión. No se pudieron recuperar las notificaciones.';

        if (error.message === 'Timeout') {
            mensajeError = 'La petición tardó demasiado. Por favor, intenta nuevamente.';
        } else if (error.message.includes('HTTP error')) {
            mensajeError = 'Error del servidor. Intenta recargar la página.';
        }

        $contenedor.html(`
            <div class="alert alert-danger">
                <i class="fa fa-exclamation-triangle"></i> 
                ${mensajeError}
                <button class="btn btn-sm btn-default" onclick="cargar_notificaciones()" style="margin-left: 10px;">
                    <i class="fa fa-refresh"></i> Reintentar
                </button>
            </div>
        `);

    } finally {
        // 🧼 Limpieza
        $.unblockUI();
        $contenedor.unblock();
        notificacionesController = null;
    }
}

// .av-np-item ya es un <a href="..."> real: la navegación ocurre sola.
// Solo se muestra el bloqueo de interfaz mientras carga el destino (no se
// usa preventDefault, así que el enlace sigue funcionando aunque este
// script falle).
$(document).on('click', '.av-np-item', function () {
    bloqueointerface();
});

/**
 * Obtiene una cookie por nombre
 */
function getCookie(name) {
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

function getDotsLoading() {
    return `<div class="loading-container">
                    <div class="dots-spinner">
                        <div class="dot"></div>
                        <div class="dot"></div>
                        <div class="dot"></div>
                    </div>
                    <div class="loading-text">Cargando notificaciones...</div>
                </div>
            `;
}

function convertirAFormatoISO(fechaString, hora = "23:59") {
    if (!fechaString) return '';

    // Si ya está en formato ISO, devolverlo
    if (fechaString.includes('T')) return fechaString;

    // Convertir dd-mm-yyyy a YYYY-MM-DD
    const partes = fechaString.split('-');

    if (partes.length === 3) {
        const dia = partes[0].padStart(2, '0');
        const mes = partes[1].padStart(2, '0');
        const anio = partes[2];

        return `${anio}-${mes}-${dia}T${hora}`;
    }

    return '';
}

function normalizarFormatoDatetimeLocal(fechaISO) {
    if (!fechaISO) return '';

    try {
        let year, month, day, hours, minutes;

        // Detectar el formato y extraer componentes
        if (fechaISO.includes('T')) {
            // Formato: YYYY-MM-DDTHH:MM o YYYY-MM-DDT9:00
            const partes = fechaISO.split('T');
            const fechaParte = partes[0].split('-');
            const horaParte = partes[1].split(':');

            year = fechaParte[0];
            month = fechaParte[1];
            day = fechaParte[2];
            hours = horaParte[0];
            minutes = horaParte[1] || '00';

        } else if (fechaISO.includes(' ')) {
            // Formato: YYYY-MM-DD HH:MM o YYYY-MM-DD 9:00
            const partes = fechaISO.split(' ');
            const fechaParte = partes[0].split('-');
            const horaParte = partes[1].split(':');

            year = fechaParte[0];
            month = fechaParte[1];
            day = fechaParte[2];
            hours = horaParte[0];
            minutes = horaParte[1] || '00';

        } else {
            console.error('Formato de fecha no reconocido:', fechaISO);
            return '';
        }

        // Normalizar cada componente con padStart
        year = String(year).padStart(4, '0');
        month = String(month).padStart(2, '0');
        day = String(day).padStart(2, '0');
        hours = String(hours).padStart(2, '0');
        minutes = String(minutes).padStart(2, '0');

        // Validar que los valores sean números válidos
        if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hours) || isNaN(minutes)) {
            console.error('Componentes de fecha inválidos:', {year, month, day, hours, minutes});
            return '';
        }

        const resultado = `${year}-${month}-${day}T${hours}:${minutes}`;
        console.log('Normalización exitosa:', fechaISO, '→', resultado);

        return resultado;

    } catch (error) {
        console.error('Error al normalizar fecha:', error, fechaISO);
        return '';
    }
}