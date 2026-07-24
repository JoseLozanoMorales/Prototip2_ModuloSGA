$(document).on('click', '.action_delete', function (e) {
    const $elemento = $(this);
    const rawUrl = $elemento.attr('nhref');
    let params;
    let idaux = null;
    if (rawUrl){
        const datosUrl = procesarUrl(rawUrl);
        params = datosUrl.params;
    }else{
        const action = $(this).data('action');
        const id = $(this).data('id');
        params = {action: action, id: id};

        if (id === undefined || id === '') {
            $elemento.parent().parent().remove();
            return false;
        }
        idaux = $(this).data('idaux') !== undefined ? $(this).data('idaux') : '';
    }

    const name =  $(this).attr('data-name')!== undefined ? $(this).attr('data-name') : 'Seleccionado';
    const is_toast = $(this).data('toast') !== undefined ? $(this).data('toast') : '';
    const msj_question = $(this).data('question') !== undefined ? $(this).data('question') : '';
    const requestPath = window.location.pathname;
    const callbackName = $(this).data('callback'); // Obtener el callback
    const functionName = $(this).attr('data-functionName'); // Obtener el functionName
    // Guardar referencia al elemento

    let parentItem = getParentItem($(this));
    const elemento_bloque = $(this).data('elemento_bloque') !== undefined ? $(this).data('elemento_bloque') : null;
    const elemento_eliminar = $(this).data('elemento_eliminar') !== undefined ? $(this).data('elemento_eliminar') : null;


    if (elemento_bloque){
        parentItem = $(`${elemento_bloque}`).parent();
    }else if (elemento_eliminar){
        parentItem = $(`${elemento_eliminar}`);
    }

    showConfirmationModal(name, msj_question);

    $('#confirmDelete').off('click').on('click', function () {
        $('#confirmationModal').modal('hide');
        sendDeleteRequest(params, parentItem, requestPath, idaux, callbackName, $elemento, is_toast, functionName);
    });

    $('#closeDelete').off('click').on('click', function () {
        $('#confirmationModal').modal('hide');
    });
});

function getParentItem(element) {
    if (element.closest('.div-item').length > 0) {
        return element.closest('.div-item');
    }

    if (element.closest('tr').length > 0) {
        return element.closest('tr');
    } else if (element.closest('li').length > 0) {
        return element.closest('li');
    }

    return element.parent();
}

function showConfirmationModal(name, msj_question='') {
    let question = `Al eliminar el registro no podrá volver a recuperar los datos. <br>¿Está seguro de eliminar el registro, <b>${name}</b>?`;
    if (msj_question){
        question = `${msj_question}. <br>¿Está seguro de eliminar el registro <b>${name}</b>?`;
    }
    $('#confirmationMessage').html(question);
    $('#confirmationModal').modal({ 'width': '450' }).modal('show');
}

function sendDeleteRequest(data, parentItem, requestPath, idaux=null, callbackName=null, $elemento=null, is_toast=false, functionName=null) { // MODIFICADO: nuevos parámetros
    bloqueointerface();

    // let data = { 'action': action, 'id': id };

    if (idaux !== null) { // Si idaux existe y no es null, lo agregamos
        data.idaux = idaux;
    }

    $.ajax({
        type: "POST",
        url: requestPath,
        data: data,
        dataType: "json",
        beforeSend: function(xhr, settings) {
            // Método alternativo: establecer CSRF token en headers
            xhr.setRequestHeader("X-CSRFToken", getCSRFToken());
        },
        success: function (data) {
            handleSuccessResponse(data, parentItem, callbackName, $elemento, is_toast, functionName);
        },
        error: handleError
    });
}

function handleSuccessResponse(data, parentItem, callbackName=null, $elemento=null, is_toast=false, functionName=null) {
    $.unblockUI();
    if (data.result === 'ok') {
        if (data.reload){
            location.reload(true);
        }else if (data.idElemento){
            let elemento = document.getElementById(data.idElemento);
            const parentItem = getParentItem(elemento);
            parentItem.remove();
        }else if (data.elemento) {
            $elemento = $(data.elemento);
        }
        // NUEVO: Ejecutar callback después de eliminar exitosamente
        if (callbackName && typeof window[callbackName] === 'function') {
            console.log('Ejecutando callback:', callbackName);
            window[callbackName]($elemento);
        }
        if (functionName && typeof window[functionName] === 'function') {
            console.log('Ejecutando function:', functionName);
            window[functionName]($elemento, data);
        } else {
            parentItem.remove();
            if (is_toast && data.mensaje){
                showAlert(type = 'success', '', message=data.mensaje, duration = 3000, is_html=true);
            }
        }
    } else {
        if (is_toast && data.mensaje){
            showAlert(type = 'warning', '', message=data.mensaje, duration = 4000, is_html=true);
        } else{
            abrirnotificacionmodal(data.mensaje);
        }
    }
}

function handleError(jqXHR, textStatus, errorThrown) {
    $.unblockUI();
    const errorMessage = `Error de conexión: ${textStatus} - ${errorThrown}`;
    abrirnotificacionmodal(errorMessage);
}

function getCSRFToken() {
    // Método 1: Desde una meta tag (recomendado)
    let token = $('meta[name=csrf-token]').attr('content');

    if (!token) {
        // Método 2: Desde input hidden
        token = $('input[name=csrfmiddlewaretoken]').val();
    }

    if (!token) {
        // Método 3: Desde cookies (si está configurado)
        token = getCookie('csrftoken');
    }

    return token;
}

// Función auxiliar para obtener cookies
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

