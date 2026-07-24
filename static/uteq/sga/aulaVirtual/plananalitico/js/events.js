// Ejecutar la validación inicial al cargar el documento (jQuery ready)

$(function () { // $(function() { ... }) es un atajo para $(document).ready(function() { ... });
    window.actualizarBotonAdicionarUnidad = function ($elemento) {
        let botonUnidad = $elemento.closest('.resultado-card').find('.addunidadaprendizaje');
        botonUnidad.removeAttr('style');
        botonUnidad.css({
            'display': 'inline-block'
        }).show();

        // El MutationObserver detectará el cambio automáticamente
        // Pero forzamos una actualización adicional por seguridad
        setTimeout(actualizarContadores, 200);
    };

    window.actualizarContenido = function () {
        actualiza_contenido(PROGRAMA_ID);

        actualizarContadores();
    };

});

// Exponer función globalmente para llamadas después de AJAX
window.actualizarContadores = contarElementos;
// window.expandirAcordeones = expandirAcordeonesConContenido;

// =================================================================
// 1. Handlers de Adición
// =================================================================

$(document).on('click', '.addresultadoaprendizaje', function () {
    add(
        '',
        'addresultadoaprendizaje',
        'Resultado de Aprendizaje'
    );
});

$(document).on('click', '.addunidadaprendizaje', function () {
    add(
        $(this).data('id'),
        'addunidadaprendizaje',
        'Unidad de Aprendizaje'
    );
});

$(document).on('click', '.addtema', function () {
    add(
        $(this).data('id'),
        'addtemapro',
        'Tema'
    );
});

$(document).on('click', '.addsubtema', function () {
    add(
        $(this).data('id'),
        'addsubtemapro',
        'Sub Tema'
    );
});


// =================================================================
// 2. Handlers de Edición y Eliminación
// =================================================================

$(document).on('click', '.editresultadoaprendizaje', function () {
    edit(
        $(this).data('id'),
        $(this).data('descripcion'),
        'editresultadoaprendizaje',
        'Resultado de Aprendizaje',
        'ra'
    );
});

$(document).on('click', '.editunidadaprndizaje', function () {
    edit(
        $(this).data('id'),
        $(this).data('descripcion'),
        'editunidadaprndizaje',
        'Editar Unidad de Aprendizaje',
        'un'
    );
});

$(document).on('click', '.edittema', function () {
    edit(
        $(this).data('id'),
        $(this).data('descripcion'),
        'edittemapro',
        'Editar Tema',
        'te'
    );
});

$(document).on('click', '.editsubtema', function () {
    edit(
        $(this).data('id'),
        $(this).data('descripcion'),
        'editsubtemapro',
        'Editar Sub Tema',
        'su'
    );
});

$(document).on('click', '.subirresultadoaprendizaje', function () {
    movimiento_campo(
        $(this).data('id'),
        'subirresultadoaprendizaje'
    );
});

$(document).on('click', '.bajarresultadoaprendizaje', function () {
    movimiento_campo(
        $(this).data('id'),
        'bajarresultadoaprendizaje'
    );
});

$(document).on('click', '.subirunidadaprendizaje', function () {
    movimiento_campo(
        $(this).data('id'),
        'subirunidadaprendizaje'
    );
});

$(document).on('click', '.bajarunidadaprendizaje', function () {
    movimiento_campo(
        $(this).data('id'),
        'bajarunidadaprendizaje'
    );
});

$(document).on('click', '.subirtemapro', function () {
    movimiento_campo(
        $(this).data('id'),
        'subirtemapro'
    );
});

$(document).on('click', '.bajartemapro', function () {
    movimiento_campo(
        $(this).data('id'),
        'bajartemapro'
    );
});

$(document).on('click', '.subirsubtemapro', function () {
    movimiento_campo(
        $(this).data('id'),
        'subirsubtemapro'
    );
});

$(document).on('click', '.bajarsubtemapro', function () {
    movimiento_campo(
        $(this).data('id'),
        'bajarsubtemapro'
    );
});


// =================================================================
// 3. Handlers de Cierre de Modales
// =================================================================

$(document).on('click', '.itemspanel #cerrar', function () {
    $(".itemspanel").modal("hide");
    return false;
});
$(document).on('click', '#cerrar_del', function () {
    $(".itemspaneldel").modal("hide");
    return false;
});

$(document).on('click', '#guardar', function () {
    let descripcion = $("#descripcion").val();
    let action = $(this).attr('action');
    let id = $(this).attr('iditem');
    // let indice = $(this).attr('indice');
    if (!descripcion) {
        abrirnotificacionmodal('El campo de descripción no puede estar vacío.');
        return false;
    }

    const palabras = descripcion.split(/\s+/).filter(word => word.length > 0);

    if (palabras.length < 2) { // Cambié a 2 palabras para ser más útil que 1
        abrirnotificacionmodal('Debe escribir un texto de al menos 2 palabras.');
        return false;
    }

    const dataObject = {
        action: action,
        descripcion: descripcion,
        id: id,
        idam: typeof ASIGM !== 'undefined' ? ASIGM : null // Asumiendo que ASIGM es una variable global
    };

    if (PROGRAMA_ID.length > 0) {
        dataObject.idpro = PROGRAMA_ID;
    }
    crear_registro(dataObject);

});
