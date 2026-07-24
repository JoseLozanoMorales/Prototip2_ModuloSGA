function obtener_semana(idcron, ids) {

    // Limpiar completamente el contenedor antes de cargar nuevo contenido
    const contenedorSemanal = $('.contenidoSemanal');

    // Desvincular todos los eventos del contenedor y sus hijos
    contenedorSemanal.find('*').off();
    contenedorSemanal.removeData();

    // Vaciar el contenido
    contenedorSemanal.empty();

    obtenerDato('GET', 'pro_planificacion', {
        'action': 'get_semana',
        'idc': idcron,
        'ids': ids
    })
        .then(data => {
            // Limpiar nuevamente antes de insertar el nuevo contenido
            contenedorSemanal.empty();
            contenedorSemanal.html(data.html);
        })
        .catch(error => {
            contenedorSemanal.empty();
            abrirnotificacionmodal(error);
        });
}

function openModal(params, saveClass, visible_boton_guardar, customWidth) {

    // Reset content completamente
    $('.paneltitle').empty();
    $('.panelbody').empty();

    // Reset button attributes de forma más exhaustiva
    const $saveButton = $("#add_save");
    $saveButton.removeAttr('ids idps idss idt');

    // Remover todas las clases y agregar las básicas
    $saveButton.attr("class", "").addClass('btn btn-success');

    // Load fresh content
    obtenerDato('GET', 'pro_planificacion', params)
        .then(data => {
            $.unblockUI();

            if (data.result === 'ok') {
                // Set modal content
                $('.paneltitle').html(data.title);
                $('.panelbody').empty().html(data.html);

                // Configure save button
                for (const [key, value] of Object.entries(params)) {
                    if (key !== 'action') {
                        $saveButton.attr(key, value);
                    }
                }
                $saveButton.addClass(saveClass);

                // Show modal
                $('.itemspanel').modal({
                    backdrop: 'static',
                    width: customWidth || '700px',
                    show: true
                });

            } else {
                abrirnotificacionmodal(data.mensaje);
            }
        })
        .catch(error => {
            $.unblockUI();
            abrirnotificacionmodal(error);
        });
}

async function actualizarCumpleTotalidad(ids, idps) {
    obtenerDato('GET', 'pro_planificacion', {
        'action': 'cumpletodo',
        'ids': ids,
        'idps': idps
    }).then(data => {
        const targetIcon = $('.cumpletotalidad_' + idps);
        console.log(targetIcon);
        targetIcon.removeAttr('data-original-title') // Remueve data-original-title
            .removeAttr('title') // Remueve el title previo
            .removeAttr('style'); // Remueve todos los estilos en línea
        if (data.cumple_totalidad) {
            targetIcon.attr('data-original-title', 'Campos completos')
                .css({
                    'color': '#0b6a14',
                    'font-size': '17px'
                });
        } else {
            targetIcon.attr('data-original-title', 'Faltan campos de llenar')
                .css({
                    'color': '#ac2c2c',
                    'font-size': '17px',
                    'padding-top': '-15px'
                });
        }
        $('#id_datoscumplimiento').html(data.html);
    }).catch(error => {
        mostrarNotificacion("Error al actualizar el estado de la semana.");
    });
}