/* global $ */
$(document).ready(function () {
    // Ejecutar automáticamente si hay algún elemento con la clase "item_cronograma" y "selected"
    $('.item_cronograma.selected').each(function () {
        const idcron = $(this).attr('id');
        const ids = $(this).attr('ids');
        obtener_semana(idcron, ids);
    });

    $("#itemspanelduplicar_silabo .btn-cerrar").click(function () {
        $("#itemspanelduplicar_silabo").modal("hide");
    });

    $("#duplicar_silabo").click(function () {
        var idsilaboencrypt = $(this).attr("idsilaboencrypt");
        $.get("/pro_planificacion", {'action': 'duplicar_silabo', 'ids': idsilaboencrypt}, function (data) {
            if (data.result == 'ok') {
                $.unblockUI();
                $(".panelbody").html(data.data);
                $("#itemspanelduplicar_silabo").modal({backdrop: 'static', width: '610px'}).modal('show');
            }
        }, 'json');
    });

    $("#duplicar_silabo_otro_docente").click(function () {
        var idsilabodocencrypt = $(this).attr("idsilabodocencrypt");
        bloqueointerface();
        $.get("/pro_planificacion", {
            'action': 'duplicar_silabo_otro_docente',
            'ids': idsilabodocencrypt
        }, function (data) {
            if (data.result === 'ok') {
                $.unblockUI();
                $(".panelbody").html(data.data);
                $("#itemspanelduplicar_silabo").modal({backdrop: 'static', width: '700px'}).modal('show');
            }
        }, 'json');

    });

    window.actualizarComponentes = async function ($elemento) {
        let ids = $elemento.attr('ids');
        let idps = $elemento.attr('idps');
        await actualizarCumpleTotalidad(ids, idps);
    };

    window.obtenerSemana = async function ($elemento) {
        let ids = $elemento.attr('ids');
        let idc = $elemento.attr('idc');
        obtener_semana(idc, ids);
        let ids2 = $elemento.data('id');
        let idc2 = $elemento.data('idaux');
        await actualizarCumpleTotalidad(ids2, idc2);
    };

});

$(document).on('click', '.expandir-minimizar-todo', function () {
    let bloques = $('.toggle-visibility');
    let boton = $(this); // Referencia al botón

    if (boton.text().trim() === 'Minimizar todo') {
        boton.text('Expandir todo');
    } else {
        boton.text('Minimizar todo');
    }
    bloques.each(function () {
        $(this).trigger('click'); // Dispara el evento click en cada elemento
    });
});

$(document).on('click', 'div.menu-group li', function () {
    // Remueve la clase 'selected' de todos los ítems
    $('div.menu-group li').removeClass('selected');

    // Agrega la clase 'selected' al ítem clicado
    $(this).addClass('selected');
});

$(document).on('click', '.item_cronograma', function () {
    obtener_semana($(this).attr('id'), $(this).attr('ids'))
});

$(document).on('click', '.additemtematico', function () {
    conectar_modaldynamics_parametro("/pro_planificacion?action=additemtematico&ids=" + $(this).attr('ids') + "&idps=" + $(this).attr('idps') + "&idss=" + $(this).attr('idss'));
});

$(document).on('click', '.addcategoria', function () {
    conectar_modaldynamics_parametro("/pro_planificacion?action=listacategorias&ids=" + $(this).attr('ids') + "&idps=" + $(this).attr('idps') + "&tipo=" + $(this).attr('tipo'));
});

$(document).on('click', '.addbibliografiabasica', function () {
    conectar_modaldynamics_parametro("/pro_planificacion?action=listabibliografiabasica&ids=" + $(this).attr('ids') + "&idps=" + $(this).attr('idps'));
});

$(document).on('click', '.addbibliografiacompl', function () {
    conectar_modaldynamics_parametro(`/pro_planificacion?action=listabibliografiacompl&ids=${$(this).attr('ids')}&idps=${$(this).attr('idps')}`);
});

$(document).on('click', '.addbibliografiaapa', function () {
    conectar_modaldynamics_parametro("/pro_planificacion?action=addbibliografiaapa&ids=" + $(this).attr('ids') + "&idps=" + $(this).attr('idps'));
});

$(document).on('click', '.addrecursosemanal', function () {
    $('.panelbody_actividad, .ajaxformdynamics').empty();
    conectar_modaldynamics_parametro("/pro_planificacion?action=addrecursosemanal&ids=" + $(this).attr('ids') + "&idps=" + $(this).attr('idps'));
});


$(document).on('change', '.checkbox_encuadre', function () {
    let idss = $(this).attr('idss');
    let idr = $(this).attr('idr');
    obtenerDato('POST', 'pro_planificacion', {'action': 'aplica_encuadre', 'idss': idss, 'idr': idr})
        .then(data => {
            if (data.result === 'ok') {

            } else {
                if ($(this).is(':checked')) {
                    $(this).prop('checked', false)
                } else {
                    $(this).prop('checked', true)
                }
                abrirnotificacionmodal(data.mensaje);
            }
        })
        .catch(error => {
            if ($(this).is(':checked')) {
                $(this).prop('checked', false)
            } else {
                $(this).prop('checked', true)
            }
            abrirnotificacionmodal(error);
        });
});


$(document).on('click', '.listaactividad', function () {
    openModal(
        {
            'action': 'listaactividad',
            'ids': $(this).attr('ids'),
            'idps': $(this).attr('idps'),
        },
        'addactividadsemanal',
        true
    );
});

$(document).on('click', '.addactividadsemanal', function () {
    $('.panelbody_actividad, .ajaxformdynamics').empty();
    let ids = $(this).attr('ids');
    let idps = $(this).attr('idps');
    let idrec = $('.seleccionada').attr("idrec");
    let idr = $('.seleccionada').attr("idr");
    if (!idrec) {
        abrirnotificacionmodal('Es obligatorio seleccionar el tipo de actividad');
        return false;
    }
    $('.itemspanel').modal('hide');

    if (parseInt(idr) === 9) {
        conectar_modaldynamics_parametro(`/pro_planificacion?action=addchatsemanal&ids=${ids}&idps=${idps}&idrec=${idrec}`);
    } else {
        if (parseInt(idr) === 10) {
            conectar_modaldynamics_parametro(`/pro_planificacion?action=addcuestionariosemanal&ids=${ids}&idps=${idps}&idrec=${idrec}`);
        } else {
            $.ajax({
                type: "GET",
                url: "/pro_planificacion",
                data: {
                    'action': 'addactividadsemanal',
                    'ids': ids,
                    'idps': idps,
                    'idrec': idrec
                },
                success: function (data) {
                    $.unblockUI();
                    if (data.result === "ok") {
                        // CKEditorManager.destroyAll();
                        // 8. Llenar el modal con el nuevo contenido
                        $('.paneltitle_actividad').html(data.title);
                        $('.panelbody_actividad').html(data.html);
                        $('.menos_actividad').hide();
                        $(".itemspanel_actividad").modal({
                            backdrop: 'static',
                            keyboard: false,
                            width: '1000px'
                        }).modal('show');

                        CKEditorManager.reinitialize(300);
                    } else {
                        abrirnotificacionmodal(data.mensaje);
                    }
                },
                error: function () {
                    $.unblockUI();
                    abrirnotificacionmodal('Error de conexión.');
                }
            });
        }
    }
});

$(document).on('click', '.editactividadsemanal', function () {
    $('.panelbody_actividad, .ajaxformdynamics').empty();
    let ida = $(this).attr('ida');
    obtenerDato('GET', 'pro_planificacion', {'action': 'editactividadsemanal', 'ida': ida})
        .then(data => {
            if (data.result === 'ok') {
                // CKEditorManager.destroyAll();
                $('.paneltitle_actividad').html(`${data.title}`);
                $('.panelbody_actividad').html(data.html);
                CKEditorManager.reinitialize();
                $('.menos_actividad').hide();
                $(".itemspanel_actividad").modal({backdrop: 'static', keyboard: false, width: '1000px'}).modal('show');


            } else {
                abrirnotificacionmodal(data.mensaje);
            }
        })
        .catch(error => {
            abrirnotificacionmodal(error);
        });
});

$(document).on('click', '.editchatsemanal', function () {
    $('.panelbody_actividad, .ajaxformdynamics').empty();
    let ida = $(this).attr('idcht');
    conectar_modaldynamics_parametro(`/pro_planificacion?action=editchatsemanal&id=${ida}`);
});

$(document).on('click', '.editcuestionariosemanal', function () {
    $('.panelbody_actividad, .ajaxformdynamics').empty();
    let idc = $(this).attr('idc');
    let idps = $(this).attr('idps');
    conectar_modaldynamics_parametro(`/pro_planificacion?action=editcuestionariosemanal&id=${idc}&idps=${idps}`);
});

$(document).on('click', '#cerrar', function () {
    $('.itemspanel').modal('hide');
});

$(document).on('click', '.close-button', function () {
    $('.itemspanel_actividad').modal('hide');
});

$(document).on('click', '#cerrar', function () {
    $('.itemspanel_actividad').modal('hide');
});

function vistaprevia(idproprag) {
    openwindow('POST', '/pro_planificacion', {action: 'silabopdf', id: idproprag}, '_blank');
}

$(document).on('click', '.toggle-visibility', function () {
    const body = $(this).closest('.header-detalle-silabo').next('.body-detalle-silabo');
    const icon = $(this).find('i');

    if (body.is(':visible')) {
        body.slideUp(300); // Oculta con animación
        icon.removeClass('fa-minus-circle danger').addClass('fa-plus-circle warning'); // Cambia el ícono
    } else {
        body.slideDown(300); // Muestra con animación
        icon.removeClass('fa-plus-circle warning').addClass('fa-minus-circle danger'); // Cambia el ícono
    }
});

