

$(document).ready(function () {
    var tabingresocalif = localStorage.getItem('tabingresocalif');
    if (!tabingresocalif){
        tabingresocalif = "#1";
        localStorage.setItem("tabingresocalif", tabingresocalif);
    }

    $("#personalTecnicoDiv").hide();


    $('.tabs').each(function(){
        if ($(this).attr('href') == tabingresocalif){
            $(this).trigger('click');
        }
    }).click(function(){
        localStorage.setItem("tabingresocalif", $(this).attr('href'));
    });

    $("#id_resumen").each(function () {
        contarCaracteres($(this))
    });

    $("#id_resumen").keyup(function () {
        contarCaracteres($(this))
    });

    setupSelect2('#id_investigadorprincipal', 'POST', '/pro_investigacion', 'busquedaprofesor', 'Busqueda de profesores')
    setupSelect2('#id_estudiante', 'POST', '/pro_investigacion', 'busquedaestudiante', 'Busqueda de estudiante')
    setupSelect2('#id_personaltecnico', 'POST', '/pro_investigacion', 'busquedapersonaltecnico', 'Busqueda de personal técnico')

    $("#id_investigadorprincipal").change(function () {
        extraer_datos_integrantes('datoprofesor', $(this), $("#personalInvPrincipalDiv"), $("#personalInvPrincipalDiv table tbody"), $("#personalInvPrincipalDiv table tbody tr"), "invsetigador")
    });

    $("#id_estudiante").change(function () {
        extraer_datos_integrantes('datoestudiante', $(this), $("#personalAlumnoDiv"), $("#personalAlumnoDiv table tbody"), $("#personalAlumnoDiv table tbody tr"), "técnico")
    });

    $("#id_personaltecnico").change(function () {
        extraer_datos_integrantes('datotecnico', $(this), $("#personalTecnicoDiv"), $("#personalTecnicoDiv table tbody"), $("#personalTecnicoDiv table tbody tr"), "técnico")
    });

    $("#btn-agregarobj").click(function () {
        if ($("#id_objetivoespecifico").val().length == 0){
            return false;
        }
        if (validarDescripcion($('#cont_objespecifico tr .cellobjetivodescrip'), $("#id_objetivoespecifico").val()) == 1){
            abrirnotificacionmodal('¿El objetivo ya se encuentra registrado?');
            return false;
        }
        $("#cont_objespecifico").prepend('<tr>' +
            '<td><textarea rows="2" class="form-control text cellobjetivodescrip">'+$("#id_objetivoespecifico").val()+'</textarea></td>' +
            '<td style="width: 10px; text-align: center; vertical-align: inherit"><a class="btn btn-danger btn-mini" onclick="eliminarFilaTr(this)"><i class="fa fa-trash"></i></a></td>' +
            '</tr>');
        $("#id_objetivoespecifico").val('');
    });

    $("#btn-agregarbibliografia").click(function () {
        if ($("#id_bibliografia").val().length == 0){
            return false;
        }
        if (validarDescripcion($("#cont_bibliografia tr .cellbibliografiadescrip"), $("#id_bibliografia").val()) == 1){
            abrirnotificacionmodal('¿La bibliografía ya se encuentra registrado?');
            return false;
        }
        $("#cont_bibliografia").prepend('<tr>' +
            '<td><textarea rows="1" class="form-control text cellbibliografiadescrip">'+$("#id_bibliografia").val()+'</textarea></td>' +
            '<td style="width: 10px; text-align: center; vertical-align: inherit"><a class="btn btn-danger btn-mini" onclick="eliminarFilaTr(this)"><i class="fa fa-trash"></i></a></td>' +
            '</tr>');
        $("#id_bibliografia").val('');
    });

    $('[data-toggle="popover"]').popover();
})

function contarCaracteres(elemento) {
    let textLength = elemento.val().length;
    let maxCaracteres = elemento.attr('maxLength');
    let nearLimit = maxCaracteres - 50;
    let resta = maxCaracteres-textLength;
    let elementoNumCaracter = elemento.parent().find('.charCount');
    let CharAlert = elemento.parent().find('.CharAlert');
    elementoNumCaracter.html(resta);
    if (textLength >= nearLimit) {
        CharAlert.addClass('nearLimit'); // Cambia el estilo a rojo
    } else {
        CharAlert.removeClass('nearLimit'); // Vuelve al estilo normal
    }
}

const eliminarTotasOpciones = (elemento) => {
    document.getElementById(elemento.attr('id')).innerHTML = '';
}

const validar_listaid = (elemento, id) => {
    ban = 0;
    elemento.each(function () {
        if ($(this).attr('id') == id){
            ban = 1;
        }
    });
    return ban;
}

const extraer_datos_integrantes = (action, elementoSelect, elementoTable, elementoBody,  elementoFilas, mensajeAlert) =>{
    let id = elementoSelect.val();
    let cant = elementoSelect.attr('cant');
    let cantidadFilas = elementoFilas.length;
    if (cantidadFilas >= 0){
        elementoTable.show();
    }
    if (id > 0) {
        if (cantidadFilas > parseInt(cant)) {
            abrirnotificacionmodal('Exedido la cantidad de personal '+ mensajeAlert);
            return false;
        }
        if (validar_listaid(elementoFilas, id)){
            abrirnotificacionmodal('El '+ mensajeAlert +' ya se encuentra registrado');
            return false;
        }
        $.ajax({
            type: "GET",
            url: "/pro_investigacion",
            data: {'action': action, 'id': id},
            success: function (data) {
                $.unblockUI();
                if (data.result == 'ok') {
                    elementoBody.append('<tr id="' + data.id + '">' +
                        '<td>' + data.nombres + '<br><i style="font-style: italic; font-style: 10px; font-weight: bold">' + data.cargo + '</i></td>' +
                        '<td class="text-center">' +
                        '<a class="btn btn-info btn-mini" style="margin: 2px"><i class="fa fa-external-link-square"></i></a>' +
                        '<a class="btn btn-danger btn-mini delPersonalTecnico" onclick="eliminarIntegrante(this)" style="margin: 2px"><i class="fa fa-trash-o"></i></a>' +
                        '</td>' +
                        '</tr>')
                } else {
                    abrirnotificacionmodal(data.mensaje);
                }
            },
            error: function () {
                $.unblockUI();
                abrirnotificacionmodal('Error de conexión.');
            },
            dataType: "json"
        });
        eliminarTotasOpciones(elementoSelect);
    }
};

const eliminarIntegrante = (elemento) =>{
    let integranteEliminar = elemento.parentNode.parentNode;
    integranteEliminar.parentNode.removeChild(integranteEliminar);
}

const validarDescripcion = (elemento, contenido) => {
    ban = 0;
    elemento.each(function () {
        if ($(this).val().toUpperCase().trim() == contenido.toUpperCase().trim()){
            ban = 1;
        }
    });
    return ban;
};

const eliminarFilaTr = (elemento) => {
    let elementoTr = elemento.parentNode.parentNode
    console.log(elementoTr)
    elementoTr.parentNode.removeChild(elementoTr)
}