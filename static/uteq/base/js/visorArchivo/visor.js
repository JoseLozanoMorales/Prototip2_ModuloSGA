/**
 * VisorArchivo — manejador general
 *
 * Responsabilidades:
 *   1. Click handler delegado para elementos con clase .get_pdf
 *   2. Alias window.PDFViewer para compatibilidad con código heredado
 *      (plantillas que usan onload="PDFViewer.ocultarLoader(this)")
 *
 * Orden de carga requerido:
 *   loader.js → visor_pdf.js → visor_word.js → visor_excel.js → visor_ppt.js → visor.js (este archivo)
 */

// ── Alias de compatibilidad hacia atrás ──────────────────────────────────────
window.PDFViewer = {
    ocultarLoader:     function (e)    { VisorArchivo.Loader.ocultarLoader(e); },
    mostrarLoader:     function (e)    { VisorArchivo.Loader.mostrarLoader(e); },
    mostrarError:      function (e, m) { VisorArchivo.Loader.mostrarError(e, m); },
    abrirModal:        function (u, o) { VisorArchivo.PDF.abrirModal(u, o); },
    abrirModalWord:    function (u, o) { VisorArchivo.Word.abrirModal(u, o); },
    abrirModalExcel:   function (u, o) { VisorArchivo.Excel.abrirModal(u, o); },
    abrirModalPpt:     function (u, o) { VisorArchivo.Ppt.abrirModal(u, o); },
    cerrarModal:       function ()     { VisorArchivo.PDF.cerrarModal(); },
    recargar:          function (e)    { VisorArchivo.PDF.recargar(e); },
    cargarPdfEnIframe: function (i, u) { VisorArchivo.PDF.cargarEnIframe(i, u); }
};

// Compat con onload="ocultarLoaderPDF(this)" en código heredado
function ocultarLoaderPDF(iframe) {
    VisorArchivo.Loader.ocultarLoader(iframe || document.getElementById('pdfFrame'));
}

// ── Click handler delegado ───────────────────────────────────────────────────
// Uso en HTML:
//   <div class="get_pdf" nhref="/media/archivo.pdf" title="Título" data-tipo="pdf">
//   <div class="get_pdf" nhref="/media/archivo.docx" title="Título" data-tipo="word">
$(document).on('click', '.get_file_viewer', function () {
    var $btn = $(this);

    if ($btn.data('loading')) return;

    var url = $btn.data('url') || $btn.attr('nhref');
    if (!url) return;

    var titulo = $btn.attr('title') || $btn.data('title') || 'Vista previa del documento';
    var ancho  = $btn.data('width') || null;
    var tipo   = $btn.data('tipo')  || 'pdf';

    // Tipos que ningún visor sabe previsualizar (zip, rar, formatos no
    // reconocidos por tipo_archivo(), etc.): el navegador los descarga
    // directo en vez de mostrarlos embebidos. Si se abriera el modal para
    // estos, cargarEnIframe() terminaría reasignando iframe.src a una URL
    // que dispara una descarga — el iframe nunca dispara "load", el loader
    // depende de ese evento (onload="PDFViewer.ocultarLoader(this)") y se
    // queda visible hasta el timeout de seguridad. Se evita todo eso
    // descargando directo, sin pasar por el visor.
    var TIPOS_PREVISUALIZABLES = ['pdf', 'word', 'excel', 'ppt', 'imagen', 'video'];
    if (TIPOS_PREVISUALIZABLES.indexOf(tipo) === -1) {
        window.open(url, '_blank');
        return;
    }

    $btn.data('loading', true);

    if (tipo === 'word') {
        VisorArchivo.Word.abrirModal(url, { titulo: titulo, ancho: ancho });
    } else if (tipo === 'excel') {
        VisorArchivo.Excel.abrirModal(url, { titulo: titulo, ancho: ancho });
    } else if (tipo === 'ppt') {
        VisorArchivo.Ppt.abrirModal(url, { titulo: titulo, ancho: ancho });
    } else {
        VisorArchivo.PDF.abrirModal(url, { titulo: titulo, ancho: ancho, tipo: tipo });
    }

    $('#modalPdfGenerico')
        .off('hidden.bs.modal.pdfBtnReset')
        .on('hidden.bs.modal.pdfBtnReset', function () {
            $btn.data('loading', false);
        });
});
