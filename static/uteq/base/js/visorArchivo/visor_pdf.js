/**
 * VisorArchivo.PDF
 * Carga archivos en el iframe del modal genérico.
 * Intercepta respuestas JSON de error del backend antes de asignar el src.
 * Depende de: VisorArchivo.Loader (loader.js)
 */
window.VisorArchivo = window.VisorArchivo || {};

window.VisorArchivo.PDF = (function () {
    'use strict';

    var Loader = window.VisorArchivo.Loader;

    function _filenameFromHeader(header) {
        if (!header) return null;
        var match = header.match(/filename\*?=(?:UTF-8'')?["']?([^"';\n]+)["']?/i);
        return match ? decodeURIComponent(match[1].trim()) : null;
    }

    // Tipos que se renderizan con Google Docs Viewer (iframe de otro origen).
    var TIPOS_GDOCS = ['word', 'excel', 'ppt'];

    /**
     * El botón "Ventana emergente" que dibuja Google Docs Viewer vive dentro
     * del iframe (docs.google.com, otro origen) y no se puede mover ni estilar
     * desde aquí por la política de mismo origen del navegador. En su lugar,
     * se agregan controles propios con el mismo estilo (botón circular tipo
     * Google): uno para abrir en ventana nueva (right: 50px) y otro para
     * descargar el archivo original.
     */
    function _gestionarHerramientasGdocs(wrapper, tipo, urlPopup, urlDescarga) {
        if (!wrapper) return;

        var existentes = wrapper.querySelectorAll('.gdocs-tool-btn');
        for (var i = 0; i < existentes.length; i++) existentes[i].remove();

        if (TIPOS_GDOCS.indexOf(tipo) === -1) return;

        var btnPopup = document.createElement('button');
        btnPopup.type = 'button';
        btnPopup.className = 'gdocs-tool-btn gdocs-popup-btn';
        btnPopup.title = 'Abrir en ventana nueva';
        btnPopup.innerHTML = '<i class="fa fa-external-link"></i>';
        btnPopup.addEventListener('click', function () {
            window.open(urlPopup, '_blank', 'noopener');
        });
        wrapper.appendChild(btnPopup);

        var btnDescarga = document.createElement('a');
        btnDescarga.className = 'gdocs-tool-btn gdocs-download-btn';
        btnDescarga.title = 'Descargar archivo';
        btnDescarga.href  = urlDescarga;
        btnDescarga.setAttribute('download', '');
        btnDescarga.innerHTML = '<i class="fa fa-download"></i>';
        wrapper.appendChild(btnDescarga);
    }

    /**
     * Cambia el ícono del título del modal según el tipo de archivo,
     * reutilizando el mismo mapeo ícono/color que usa el spinner de carga.
     */
    function _actualizarIconoModal(tipo) {
        var icono = document.getElementById('modalPdfIcono');
        if (!icono) return;
        var cfg = Loader.TIPOS[tipo] || Loader.TIPOS['pdf'];
        icono.className   = 'fa ' + cfg.icon;
        icono.style.color = cfg.color;
    }

    /**
     * @param {HTMLIFrameElement} iframe
     * @param {string}            url
     * @param {string}            tipo   "pdf" | "word" | "excel" | "imagen" | "ppt"
     */
    function cargarEnIframe(iframe, url, tipo) {
        if (!iframe || !url) return;

        iframe.dataset.pdfUrl  = url;
        iframe.dataset.visorTipo = tipo || 'pdf';

        var wrapper = Loader.getWrapper(iframe);
        if (wrapper) {
            iframe.style.display = 'none';
            Loader.mostrarLoader(wrapper, tipo);
        }

        fetch(url, { credentials: 'same-origin' })
            .then(function (response) {
                var ct = response.headers.get('Content-Type') || '';

                if (ct.indexOf('application/json') !== -1) {
                    return response.json().then(function (json) {
                        var err = new Error(json.mensaje || 'Error al generar el documento.');
                        err.isApiError = true;
                        throw err;
                    });
                }

                if (!response.ok) {
                    var err = new Error('Error del servidor (código ' + response.status + ').');
                    err.isApiError = true;
                    throw err;
                }

                var filename = response.headers.get('X-Filename')
                    || _filenameFromHeader(response.headers.get('Content-Disposition'))
                    || 'documento';

                return response.blob().then(function (blob) {
                    return { blob: blob, filename: filename };
                });
            })
            .then(function (result) {
                if (!result) return;
                if (iframe._blobUrl) {
                    URL.revokeObjectURL(iframe._blobUrl);
                    iframe._blobUrl = null;
                }
                iframe._pdfBlob   = result.blob;
                iframe._pdfNombre = result.filename;
                iframe.src = url;
            })
            .catch(function (err) {
                var msg = (err && err.message) ? err.message : 'No se pudo cargar el documento.';
                Loader.mostrarError(iframe, msg);
            });
    }

    /**
     * @param {string} url
     * @param {Object} opciones  { titulo, ancho, tipo }
     */
    function abrirModal(url, opciones) {
        opciones = opciones || {};

        var tipo    = opciones.tipo || 'pdf';
        var modal   = document.getElementById('modalPdfGenerico');
        if (!modal) return;

        var wrapper = document.getElementById('pdfViewerModal');
        var iframe  = wrapper ? wrapper.querySelector('iframe.pdf-frame') : null;
        var titulo  = document.getElementById('modalPdfTitulo');

        if (titulo) titulo.textContent = opciones.titulo || 'Vista previa del documento';
        _actualizarIconoModal(tipo);

        if (iframe) {
            iframe.src = 'about:blank';
            iframe.style.display = 'none';
        }

        _gestionarHerramientasGdocs(wrapper, null, null, null);

        var ancho = opciones.ancho || (window.innerWidth - 30) + 'px';
        $(modal).modal({ width: ancho, height: 'auto', show: true });

        var safetyTimer = setTimeout(function () {
            if (iframe) Loader.ocultarLoader(iframe);
        }, Loader.TIMEOUT_MS);

        if (iframe) cargarEnIframe(iframe, url, tipo);

        $(modal).off('hidden.bs.modal.pdfModalCleanup')
                .on('hidden.bs.modal.pdfModalCleanup', function () {
            clearTimeout(safetyTimer);
            if (iframe) {
                if (iframe._blobUrl) {
                    URL.revokeObjectURL(iframe._blobUrl);
                    iframe._blobUrl = null;
                }
                iframe._pdfBlob   = null;
                iframe._pdfNombre = null;
                iframe.src = 'about:blank';
                iframe.style.display = 'none';
            }
            _gestionarHerramientasGdocs(wrapper, null, null, null);
        });
    }

    /**
     * Abre el modal apuntando el iframe directamente a una URL externa
     * (p.ej. Office Online Viewer) sin pasar por el interceptor fetch.
     * @param {string} iframeUrl  URL ya construida para el src del iframe
     * @param {Object} opciones   { titulo, ancho, tipo }
     */
    function abrirModalDirecto(iframeUrl, opciones) {
        opciones = opciones || {};

        var tipo    = opciones.tipo || 'pdf';
        var modal   = document.getElementById('modalPdfGenerico');
        if (!modal) return;

        var wrapper = document.getElementById('pdfViewerModal');
        var iframe  = wrapper ? wrapper.querySelector('iframe.pdf-frame') : null;
        var titulo  = document.getElementById('modalPdfTitulo');

        if (titulo) titulo.textContent = opciones.titulo || 'Vista previa del documento';
        _actualizarIconoModal(tipo);

        if (iframe) {
            iframe.src = 'about:blank';
            iframe.style.display = 'none';
        }

        var ancho = opciones.ancho || (window.innerWidth - 30) + 'px';
        $(modal).modal({ width: ancho, height: 'auto', show: true });

        if (!iframe) return;

        Loader.mostrarLoader(wrapper, tipo);
        iframe.src = iframeUrl;
        _gestionarHerramientasGdocs(wrapper, tipo, iframeUrl, opciones.urlOriginal || iframeUrl);

        // Igual que abrirModal(): si el visor externo (Google Docs / Office
        // Online, otro origen) nunca dispara "load" — por ejemplo porque no
        // puede acceder a la URL sin la sesión del usuario, o la red bloquea
        // ese dominio — el loader se quedaba visible para siempre, ya que
        // el botón de descarga (gdocs-download-btn) es independiente del
        // iframe y sigue funcionando aunque el visor nunca cargue. El
        // usuario percibía eso como que la descarga "activa" un bloqueo que
        // ya estaba ahí desde que se abrió el modal.
        var safetyTimer = setTimeout(function () {
            if (iframe) Loader.ocultarLoader(iframe);
        }, Loader.TIMEOUT_MS);

        $(modal).off('hidden.bs.modal.pdfModalCleanup')
                .on('hidden.bs.modal.pdfModalCleanup', function () {
            clearTimeout(safetyTimer);
            if (iframe) {
                iframe.src = 'about:blank';
                iframe.style.display = 'none';
            }
            _gestionarHerramientasGdocs(wrapper, null, null, null);
        });
    }

    function cerrarModal() {
        var modal = document.getElementById('modalPdfGenerico');
        if (modal) $(modal).modal('hide');
    }

    function recargar(iframeOSelector) {
        var iframe = typeof iframeOSelector === 'string'
            ? document.querySelector(iframeOSelector)
            : iframeOSelector;
        if (!iframe) return;
        var url  = iframe.dataset.pdfUrl;
        var tipo = iframe.dataset.visorTipo || 'pdf';
        if (!url || url === 'about:blank') return;
        cargarEnIframe(iframe, url, tipo);
    }

    return {
        cargarEnIframe:   cargarEnIframe,
        abrirModal:       abrirModal,
        abrirModalDirecto: abrirModalDirecto,
        cerrarModal:      cerrarModal,
        recargar:         recargar
    };
})();
