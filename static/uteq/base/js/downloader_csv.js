// Función para escapar valores CSV
function escaparCSV(valor) {
    if (valor === null || valor === undefined) {
        return '""';
    }
    var strValor = String(valor);
    strValor = strValor.replace(/"/g, '""');
    return '"' + strValor + '"';
}

// Función para descargar CSV
function descargarCSV(datos, nombreArchivo, header= [], con_escape=true) {
    if (datos.length === 0) {
        showAlert(type = 'error', '', message='No hay datos para descargar', duration = 3000);
        return;
    }
    // Obtener encabezados
    var headers = [];
    var headers_names = [];
    if(header.length > 0 ){
        headers_names = header;
    }else {
        for (var key in datos[0]) {
            if (datos[0].hasOwnProperty(key)) {
                headers_names.push(key);
            }
    }
    }
    for (var key in datos[0]) {
        if (datos[0].hasOwnProperty(key)) {
            headers.push(key);
        }
    }

    // Crear contenido CSV
    var csv = headers_names.join(';') + '\n';

    $.each(datos, function(index, row) {
        var values = [];
        $.each(headers, function(i, header) {
            if(con_escape) {
                values.push(escaparCSV(row[header]));
            } else {
                values.push(row[header]);
            }
        });
        csv += values.join(';') + '\n';
    });

    // Crear blob y descargar (compatible con IE y navegadores antiguos)
    if (window.navigator.msSaveOrOpenBlob) {
        // Para IE
        var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        navigator.msSaveBlob(blob, nombreArchivo);
    } else {
        // Para otros navegadores
        var link = document.createElement('a');
        var csvData = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);

        link.setAttribute('href', csvData);
        link.setAttribute('download', nombreArchivo);
        link.setAttribute('target', '_blank');
        link.style.visibility = 'hidden';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    showAlert(type = 'success', '', message='Archivo CSV descargado exitosamente', duration = 3000);
}