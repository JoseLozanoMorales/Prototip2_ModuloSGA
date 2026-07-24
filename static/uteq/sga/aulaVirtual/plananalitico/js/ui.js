/**
 * Muestra u oculta el botón de adicionar unidad si ya existen unidades en el contenedor.
 * Responsabilidad: Control de visibilidad de elementos.
 */
function validar_botones_adicionar_unidad(class_name) {
    $('.' + class_name).each(function() {
        let $elemento = $(this);
        let $botonAdicionar = $elemento.find('.addunidadaprendizaje');

        if ($botonAdicionar.length) {
            let $contenedorUnidades = $elemento.find('.unidades-container');
            let tieneUnidades = $contenedorUnidades.find('.unidad-card').length > 0;

            if (tieneUnidades) {
                $botonAdicionar.hide(); // Usar .hide() de jQuery
            } else {
                console.log('sin unidades');
                $botonAdicionar.css('display', 'inline-block').show();
            }
        }
    });
}


/**
 * Prepara y muestra el modal para operaciones de 'Añadir'.
 * Responsabilidad: Inicialización del formulario de adición.
 * @param {string} id - ID del elemento padre.
 * @param {string} action - Acción a realizar (e.g., 'addresultadoaprendizaje').
 * @param {string} title - Nombre del elemento a añadir (e.g., 'Resultado de Aprendizaje').
 */
function add(id, action, title) {
    let titulo = `Añadir ${title}`;
    let placeholder = `Escriba ${title}`;
    $("#descripcion").val('').attr('placeholder', placeholder);
    $(".paneltitle").html(titulo);
    $("#guardar").attr('iditem', id).attr('action', action);
    $("#itemspanel").modal({backdrop: 'static', width: '700px'}).modal('show');
}

/**
 * Prepara y muestra el modal para operaciones de 'Editar'.
 * Responsabilidad: Inicialización del formulario de edición.
 * @param {string} id - ID del elemento a editar.
 * @param {string} name - Contenido actual del elemento.
 * @param {string} action - Acción a realizar (e.g., 'editresultadoaprendizaje').
 * @param {string} title - Título para el modal.
 * @param {string} indice - Indicador para la acción (e.g., 'ra', 'un').
 */
function edit(id, name, action, title, indice) {
    $("#descripcion").val(name);
    $(".paneltitle").html(title);
    $("#guardar").attr('iditem', id).attr('action', action).attr('indice', indice);
    $("#itemspanel").modal({backdrop: 'static', width: '700px'}).modal('show');
}


function crear_registro(dataObject) {
    bloqueointerface();
    $.ajax({
        type: "POST",
        url: window.location.pathname,
        data: dataObject,
        dataType: "json",
        success: function (data) {
            $.unblockUI();
            if (data.result === 'ok') {
                // const descripcion = dataObject.descripcion || '';
                $(".itemspanel").modal("hide");
                $.unblockUI();
                actualiza_contenido(data.idpro);
                // expandirAcordeonesConContenido();
            } else {
                $.unblockUI();
                abrirnotificacionmodal(data.mensaje);
            }
        },
        error: function () {
            $.unblockUI();
            abrirnotificacionmodal('Error de conexión.');
        }
    });
}

function toggleAccordion(contentId, header) {
    const content = document.getElementById(contentId);
    const isOpen = content.classList.contains('open');

    if (isOpen) {
        content.classList.remove('open');
        header.classList.remove('active');
    } else {
        content.classList.add('open');
        header.classList.add('active');
    }
}

function contarElementos() {
    console.log('Iniciando conteo de elementos...');

    // Obtener todos los resultados de aprendizaje
    const resultados = document.querySelectorAll('.resultado-card');
    console.log('Resultados encontrados:', resultados.length);

    resultados.forEach((resultado, index) => {
        console.log('Procesando resultado', index + 1);

        // Buscar el contador dentro de este resultado
        const counter = resultado.querySelector('.content-counter');

        if (counter) {
            // Contar unidades dentro de este resultado específico
            const unidadesContainer = resultado.querySelector('.unidades-container');
            const unidades = unidadesContainer ? unidadesContainer.querySelectorAll('.unidad-card') : [];
            const totalUnidades = unidades.length;

            // Contar temas (dentro de este resultado)
            const temas = resultado.querySelectorAll('.tema-card');
            const totalTemas = temas.length;

            // Contar subtemas (dentro de este resultado)
            const subtemas = resultado.querySelectorAll('.subtema-card');
            const totalSubtemas = subtemas.length;

            console.log(`Resultado ${index + 1}: ${totalUnidades} unidades, ${totalTemas} temas, ${totalSubtemas} subtemas`);

            // Actualizar los contadores
            const countUnidades = counter.querySelector('.count-unidades');
            const countTemas = counter.querySelector('.count-temas');
            const countSubtemas = counter.querySelector('.count-subtemas');

            if (countUnidades) countUnidades.textContent = totalUnidades;
            if (countTemas) countTemas.textContent = totalTemas;
            if (countSubtemas) countSubtemas.textContent = totalSubtemas;

            // Actualizar etiquetas en singular/plural
            const labels = counter.querySelectorAll('.count-label');

            if (labels[0]) labels[0].textContent = totalUnidades === 1 ? 'Unidad' : 'Unidades';
            if (labels[1]) labels[1].textContent = totalTemas === 1 ? 'Tema' : 'Temas';
            if (labels[2]) labels[2].textContent = totalSubtemas === 1 ? 'Subtema' : 'Subtemas';
        } else {
            console.log('No se encontró counter para resultado', index + 1);
        }
    });

    console.log('Conteo completado');
}

function expandirAcordeonesConContenido() {
    console.log('Expandiendo acordeones con contenido...');

    const resultados = document.querySelectorAll('.resultado-card');

    resultados.forEach((resultado, index) => {
        const unidades = resultado.querySelectorAll('.unidad-card');

        // Si tiene unidades, expandir automáticamente
        if (unidades.length > 0) {
            const header = resultado.querySelector('.accordion-header');
            const contentId = resultado.querySelector('.accordion-content').id;
            const content = document.getElementById(contentId);

            if (content && header && !content.classList.contains('open')) {
                content.classList.add('open');
                header.classList.add('active');
                console.log(`Expandido resultado ${index + 1}`);
            }
        }
    });
}