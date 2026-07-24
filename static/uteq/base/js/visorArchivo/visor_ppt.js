/**
 * VisorArchivo.Ppt
 * Visualiza archivos .ppt/.pptx en el modal genérico usando Google Docs Viewer.
 * Depende de: VisorArchivo.PDF (visor_pdf.js)
 */
window.VisorArchivo = window.VisorArchivo || {};

window.VisorArchivo.Ppt = (function () {
    'use strict';

    var GDOCS_VIEWER = 'https://docs.google.com/viewer';

    function abrirModal(urlArchivo, opciones) {
        opciones = opciones || {};
        var urlAbsoluta = window.VisorArchivo.urlAbsoluta(urlArchivo);
        var visorUrl = GDOCS_VIEWER + '?url=' + encodeURIComponent(urlAbsoluta) + '&embedded=true';
        window.VisorArchivo.PDF.abrirModalDirecto(visorUrl, {
            titulo: opciones.titulo,
            ancho:  opciones.ancho,
            tipo:   'ppt',
            urlOriginal: urlAbsoluta
        });
    }

    return {
        abrirModal: abrirModal
    };
})();