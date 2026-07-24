$(document).ready(function() {
    // Ejecutar automáticamente si hay algún elemento con la clase "item_cronograma" y "selected"
    obtenerHtml("GET", "/planificacionsemanal", {'id': $("#id_m").val(), 'idp': $("#id_p").val()}, $('#contenedor_planificacion'))
        .then(() => {
            // Ahora que el HTML ha sido cargado, podemos buscar los elementos item_cronograma
            $('.item_cronograma.selected').each(function() {
                const idcron = $(this).data('id');
                const idmat = $(this).data('idm');
                const idp = $(this).data('idp');

                // Ejecuta la función automáticamente para el elemento con clase "selected"
                obtenerDato('GET', 'planificacionsemanal', {
                    'action': 'get_semana',
                    'idc': idcron,
                    'idm': idmat,
                    'idp': idp
                })
                    .then(data => {
                        $('#contenedor_semana').html(data.html);
                    })
                    .catch(error => {
                        abrirnotificacionmodal(error);
                    });
            });
        })
        .catch(error => {
            abrirnotificacionmodal(error);
        });

});


$(document).on('click', 'ul.responsive-menu li', function () {
    // Remueve la clase 'selected' de todos los ítems
    $('ul.responsive-menu li').removeClass('selected');

    // Agrega la clase 'selected' al ítem clicado
    $(this).addClass('selected');

});

$(document).on('click', '.item_cronograma', function () {
    const idcron = $(this).data('id');
    const idmat = $(this).data('idm');
    const idp = $(this).data('idp');
    obtenerDato('GET', 'planificacionsemanal', {'action': 'get_semana', 'idc': idcron, 'idm': idmat, 'idp': idp})
        .then(data => {
            // Suponiendo que el HTML está en data.html, por ejemplo
            $('#contenedor_semana').html(data.html); // Inserta el HTML en un contenedor con id="resultado"
        })
        .catch(error => {
            abrirnotificacionmodal(error);
            // El error ya se maneja dentro de obtenerDato con notificaciones, pero también puedes agregar lógica adicional aquí si es necesario
        });
});

$(document).on('click', '.resumenactividad', function () {
    var id = $(this).data('id');
    if (!id) {
        abrirnotificacionmodal('No se encontró el acceso para acceder al resumen de la actividad.');
        return;
    }
    obtenerHtml("GET", "/resumenactividad", { id: id });
});

$(document).on('click', '.resumencuestionario', function () {
    var id = $(this).data('id');
    if (!id) {
        abrirnotificacionmodal('No se encontró el acceso para acceder al resumen de del cuestionario.');
        return;
    }
    obtenerHtml("GET", "/resumencuestionario", { id: id });
});

$(document).on('click', '.detalleentregaactividad', function () {
    var id = $(this).data('id');
    if (!id) {
        abrirnotificacionmodal('No se encontró el acceso para para el resumen del detalle.');
        return;
    }
    obtenerHtml("GET", "/planificacionsemanal", { action: 'detalleentregaactividad', id: id }, null, true);
});

$(document).on('click', '.detalleauditoria', function () {
    var id = $(this).data('id');
    if (!id) {
        abrirnotificacionmodal('No se encontró el acceso para acceder a la auditoria.');
        return;
    }
    obtenerHtml("GET", "/planificacionsemanal", { action: 'detalleauditoria', id: id }, null, true);
});

$(document).on('click', '.detalleentrega', function () {
    var id = $(this).data('id');
    var idm = $(this).data('idm');
    if (!id) {
        abrirnotificacionmodal('No se encontró el acceso para el detalle de entregas.');
        return;
    }
    obtenerHtml("GET", "/planificacionsemanal", { action: 'detalleentrega', id: id , idm: idm}, null, true);
});

$(document).on('click', '.calificacion', function () {
    let ida = $(this).data("id");
    if (!ida) {
        abrirnotificacionmodal('No se encontró el acceso para acceder a las calificaciones de la actividad.');
        return;
    }
    obtenerHtml("GET", "/planificacionsemanal", { action: 'calificacion', ida: ida }, null);
});

$(document).on('click', '.resultadocuestionario', function () {
    let id = $(this).data("id");
    if (!id) {
        abrirnotificacionmodal('No se encontró el acceso para acceder a las calificaciones de la actividad.');
        return;
    }
    obtenerHtml("GET", "/planificacionsemanal", { action: 'resultadocuestionario', id: id }, null);
});



async function obtenerHtml(type, url, objeto = {}, elementoContenedor= null, detalleexterno=false) {
    try {
        bloqueointerface();

        const response = await $.ajax({
            type: type,
            url: url,
            data: objeto, // Se envía el objeto (o vacío si no se proporciona)
            dataType: "json"
        });

        // Desbloquear la interfaz
        $.unblockUI();

        // Verificar el resultado de la respuesta
        if (response.result) {
            if (elementoContenedor) {
                elementoContenedor.html(response.html);
            }else{
                if (detalleexterno){
                    // abrirModalDetalle(response.html, response.title, ancho);
                    abrirnotificacionmodal(response.html, response.title);
                }else{
                    abrirModalDetalle(response.html, response.title);
                }

            }

            // Puedes definir otras acciones aquí
        } else {
            abrirnotificacionmodal(response.mensaje || 'Error al cargar el contenido del modal.');
        }
    } catch (error) {
        // Desbloquear la interfaz en caso de error
        $.unblockUI();
        console.error("Error:", error);
        abrirnotificacionmodal('Error al cargar el contenido del modal.');
    }
}