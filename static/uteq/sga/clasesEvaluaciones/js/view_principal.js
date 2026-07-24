$(document).ready(function () {
    AsignarValorCell('cell_hrsReg', 'numlecciones');
    AsignarValorCell('cell_thM', 'nummateriahoraprofesor');
    AsignarValorCell('cell_nM', 'nummateriaprofesor');
    calculateTotalHours();
});

// Funciones
async function AsignarValorCell(class_celda, action) {
    try {
        const lista = crearListaProfesor(class_celda);
        const actionObject = {'action': action, 'lista': JSON.stringify(lista)};

        const listaClaveValor = await obtenerListaClaveValor(actionObject);

        listaClaveValor.forEach(elemento => {
            $(`.${class_celda}_${elemento.id}`).html(elemento.valor);
        });
    } catch (error) {
        // Manejo de errores
        abrirnotificacionmodal(error);
    }
}

function crearListaProfesor(class_celda) {
    return $(`.${class_celda}`).map(function() {
        return $(this).data('id');
    }).get();
}

async function obtenerListaClaveValor(actionObject) {
    const requestPath = window.location.pathname;
    return new Promise((resolve, reject) => {
        $.ajax({
            type: "GET",
            url: requestPath,
            data: actionObject,
            dataType: "json",
            beforeSend: function() {
                // Opcionalmente puedes mostrar un spinner si es necesario
                // $.blockUI();
            },
            success: function(data) {
                // Desbloquear la UI si la bloqueaste antes
                $.unblockUI();
                if (data.result) {
                    resolve(data.lista);
                } else {
                    reject(data.mensaje);
                }
            },
            error: function() {
                $.unblockUI();
                reject('Error de conexión.');
            }
        });
    });
}

function calculateTotalHours() {
    // Get all rows in the table
    const rows = document.querySelectorAll('table tr');

    // Iterate over each row
    rows.forEach(row => {
        const hoursDocenciaCell = row.querySelector('.hora_doce');
        const hoursGestionCell = row.querySelector('.hora_gest');
        const hoursInvestigacionCell = row.querySelector('.hora_invest');
        const hoursVinculacionCell = row.querySelector('.hora_vincul');
        const totalHoursCell = row.querySelector('.total_hora');

        if (hoursDocenciaCell && hoursGestionCell && hoursInvestigacionCell && totalHoursCell && hoursVinculacionCell) {
            // Get the numerical values from the cells
            const hoursDocencia = parseFloat(hoursDocenciaCell.textContent);
            const hoursGestion = parseFloat(hoursGestionCell.textContent);
            const hoursVinculacion = parseFloat(hoursVinculacionCell.textContent);
            const hoursInvestigacion = parseFloat(hoursInvestigacionCell.textContent);

            const totalHours = hoursDocencia + hoursGestion + hoursVinculacion + hoursInvestigacion;

            totalHoursCell.textContent = totalHours.toFixed(0);
        }
    });
}