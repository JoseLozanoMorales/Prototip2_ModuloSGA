$(document).on('click', '.get_report', function (e) {
    const $btn = $(this);
    const rawUrl = $btn.attr('nhref');
    const tipo = $btn.data('method');
    const page_blank = $btn.data('page-blank');
    const datosUrl = procesarUrl(rawUrl);

    if (!page_blank) {
        page_blank = '';
        bloqueointerface();
    }
    openwindow(tipo ,datosUrl.ruta, datosUrl.params, page_blank);
})

// $(document).on('click', '.get_report', function (e) {
//     e.preventDefault();
//     const $btn = $(this);
//     const rawUrl = $btn.attr('nhref');
//     const datosUrl = procesarUrl(rawUrl);
//
//     // Mostramos bloqueo de interfaz mientras procesa
//     bloqueointerface();
//
//     $.ajax({
//         type: "GET",
//         url: datosUrl.ruta,
//         data: datosUrl.params,
//         xhrFields: {
//             responseType: 'blob' // Importante para manejar datos binarios (PDF)
//         },
//         success: function (data, status, xhr) {
//             $.unblockUI(); // Quitamos el bloqueo
//
//             const contentType = xhr.getResponseHeader('content-type');
//
//             if (contentType && contentType.indexOf('application/json') !== -1) {
//                 // Si el servidor respondió con JSON a pesar del blob (error controlado)
//                 const reader = new FileReader();
//                 reader.onload = function () {
//                     const response = JSON.parse(reader.result);
//                     abrirnotificacionmodal(response.mensaje);
//                 };
//                 reader.readAsText(data);
//             } else {
//                 // Es un PDF: Creamos un link temporal y lo "clickeamos"
//                 const blob = new Blob([data], { type: 'application/pdf' });
//                 const url = window.URL.createObjectURL(blob);
//                 window.open(url, '_blank');
//                 window.URL.revokeObjectURL(url);
//             }
//         },
//         error: function (jqXHR) {
//             $.unblockUI();
//             // Intentamos extraer el mensaje de error del JSON de respuesta
//             const reader = new FileReader();
//             reader.onload = function () {
//                 try {
//                     const response = JSON.parse(reader.result);
//                     abrirnotificacionmodal(response.mensaje || "Error al generar el reporte");
//                 } catch (e) {
//                     abrirnotificacionmodal("Error crítico en el servidor");
//                 }
//             };
//             reader.readAsText(jqXHR.responseJSON || jqXHR.responseText);
//         }
//     });
// });