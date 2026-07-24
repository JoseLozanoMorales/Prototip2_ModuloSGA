/**
 * VisorArchivo.Excel
 * Visualiza archivos .xls/.xlsx en el modal genérico usando Google Docs Viewer.
 * Depende de: VisorArchivo.PDF (visor_pdf.js)
 */
window.VisorArchivo = window.VisorArchivo || {};

window.VisorArchivo.Excel = (function () {
    'use strict';

    var OFFICE_VIEWER = 'https://view.officeapps.live.com/op/embed.aspx';

    function abrirModal(urlArchivo, opciones) {
        opciones = opciones || {};
        var urlAbsoluta = window.VisorArchivo.urlAbsoluta(urlArchivo);
        var visorUrl = OFFICE_VIEWER + '?src=' + encodeURIComponent(urlAbsoluta);
        window.VisorArchivo.PDF.abrirModalDirecto(visorUrl, {
            titulo: opciones.titulo,
            ancho:  opciones.ancho,
            tipo:   'excel',
            urlOriginal: urlAbsoluta
        });
    }

    return {
        abrirModal: abrirModal
    };
})();
