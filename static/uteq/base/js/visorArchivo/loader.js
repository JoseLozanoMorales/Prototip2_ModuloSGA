/**
 * VisorArchivo.Loader
 * Controla el spinner de carga, el panel de error y el ocultamiento del loader.
 * Soporta spinners con identidad visual por tipo de archivo.
 */
window.VisorArchivo = window.VisorArchivo || {};

// Configuración global — sobreescribir antes de usar los visores:
//   VisorArchivo.CONFIG.baseUrl = 'https://mi-dominio.com';
window.VisorArchivo.CONFIG = window.VisorArchivo.CONFIG || { baseUrl: '' };

// Convierte una URL relativa en absoluta usando CONFIG.baseUrl o el origen actual.
window.VisorArchivo.urlAbsoluta = function (url) {
    if (!url) return url;
    if (/^https?:\/\//i.test(url)) return url;
    var base = window.VisorArchivo.CONFIG.baseUrl
        ? window.VisorArchivo.CONFIG.baseUrl.replace(/\/$/, '')
        : window.location.origin;
    return base + (url.charAt(0) === '/' ? '' : '/') + url;
};

window.VisorArchivo.Loader = (function () {
    'use strict';

    var FADE_MS    = 450;
    var TIMEOUT_MS = 15000;

    // ── Configuración visual por tipo de archivo ─────────────────────────────
    var _TIPOS = {
        pdf: {
            icon:    'fa-file-pdf-o',
            color:   '#dc2626',
            spin2:   '#ef4444',
            spinBg:  'rgba(220,38,38,0.12)',
            barBg:   'rgba(220,38,38,0.10)',
            texto:   'Cargando PDF...'
        },
        word: {
            icon:    'fa-file-word-o',
            color:   '#2563eb',
            spin2:   '#3b82f6',
            spinBg:  'rgba(37,99,235,0.12)',
            barBg:   'rgba(37,99,235,0.10)',
            texto:   'Cargando documento Word...'
        },
        excel: {
            icon:    'fa-file-excel-o',
            color:   '#16a34a',
            spin2:   '#22c55e',
            spinBg:  'rgba(22,163,74,0.12)',
            barBg:   'rgba(22,163,74,0.10)',
            texto:   'Cargando hoja de cálculo...'
        },
        imagen: {
            icon:    'fa-file-image-o',
            color:   '#7c3aed',
            spin2:   '#8b5cf6',
            spinBg:  'rgba(124,58,237,0.12)',
            barBg:   'rgba(124,58,237,0.10)',
            texto:   'Cargando imagen...'
        },
        ppt: {
            icon:    'fa-file-powerpoint-o',
            color:   '#ea580c',
            spin2:   '#f97316',
            spinBg:  'rgba(234,88,12,0.12)',
            barBg:   'rgba(234,88,12,0.10)',
            texto:   'Cargando presentación...'
        }
    };

    // ── Helpers internos ─────────────────────────────────────────────────────
    function getWrapper(element) {
        if (!element) return null;
        return element.classList.contains('pdf-viewer-wrapper')
            ? element
            : element.closest('.pdf-viewer-wrapper');
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // ── API pública ──────────────────────────────────────────────────────────

    /**
     * Oculta el loader cuando el iframe termina de cargar.
     * Llamado desde: onload="PDFViewer.ocultarLoader(this)"
     */
    function ocultarLoader(iframe) {
        if (!iframe || !iframe.src || iframe.src === 'about:blank' || iframe.src === window.location.href) return;
        var wrapper = getWrapper(iframe);
        if (!wrapper) return;
        var loader = wrapper.querySelector('[data-loader]');
        if (!loader) return;
        iframe.style.display = 'block';
        loader.classList.add('pdf-loader-hide');
        setTimeout(function () { loader.style.display = 'none'; }, FADE_MS);
    }

    /**
     * Muestra el spinner dentro del wrapper.
     * @param {Element} wrapperOIframe  El .pdf-viewer-wrapper o el iframe contenido
     * @param {string}  tipo            "pdf" | "word" | "excel" | "imagen" | "ppt"
     */
    function mostrarLoader(wrapperOIframe, tipo) {
        var wrapper = getWrapper(wrapperOIframe);
        if (!wrapper) return;
        var loader = wrapper.querySelector('[data-loader]');
        if (!loader) return;

        var cfg = _TIPOS[tipo] || _TIPOS['pdf'];

        var spinnerStyle = [
            'border-color:' + cfg.spinBg,
            'border-top-color:' + cfg.color,
            'border-right-color:' + cfg.spin2
        ].join(';');

        var iconStyle = [
            'color:' + cfg.color,
            'text-shadow:0 4px 12px ' + cfg.spinBg
        ].join(';');

        var barFillStyle = 'background:linear-gradient(90deg,' + cfg.color + ',' + cfg.spin2 + ')';

        loader.innerHTML =
            '<div class="pdf-loader-content">' +
                '<div class="pdf-icon-wrapper">' +
                    '<div class="pdf-spinner" style="' + spinnerStyle + '"></div>' +
                    '<i class="fa ' + cfg.icon + ' pdf-icon" style="' + iconStyle + '"></i>' +
                '</div>' +
                '<div class="pdf-loader-text" style="color:' + cfg.color + '">' + cfg.texto + '</div>' +
                '<div class="pdf-loader-subtext">Esto puede tomar unos segundos...</div>' +
                '<div class="pdf-progress-bar" style="background:' + cfg.barBg + '">' +
                    '<div class="pdf-progress-fill" style="' + barFillStyle + '"></div>' +
                '</div>' +
            '</div>';

        loader.style.display = 'flex';
        loader.classList.remove('pdf-loader-hide');
    }

    /**
     * Muestra el panel de error dentro del visor.
     */
    function mostrarError(iframe, mensaje) {
        var wrapper = getWrapper(iframe);
        if (!wrapper) return;
        if (iframe) iframe.style.display = 'none';
        var loader = wrapper.querySelector('[data-loader]');
        if (!loader) return;
        var msgHtml = mensaje
            ? '<div class="pdf-error-badge"><i class="fa fa-info-circle"></i> ' + escapeHtml(mensaje) + '</div>'
            : '';
        loader.style.display = 'flex';
        loader.classList.remove('pdf-loader-hide');
        loader.innerHTML =
            '<div class="pdf-loader-content">' +
                '<div class="pdf-error-icon-wrapper">' +
                    '<i class="fa fa-exclamation-triangle pdf-error-icon"></i>' +
                '</div>' +
                '<div class="pdf-error-title">No se pudo cargar el documento</div>' +
                msgHtml +
                '<button type="button" class="pdf-error-retry-btn"' +
                    ' onclick="VisorArchivo.PDF.recargar(' +
                    'this.closest(\'.pdf-viewer-wrapper\').querySelector(\'iframe\'))">' +
                    '<i class="fa fa-refresh"></i> Reintentar' +
                '</button>' +
            '</div>';
    }

    return {
        FADE_MS:       FADE_MS,
        TIMEOUT_MS:    TIMEOUT_MS,
        TIPOS:         _TIPOS,
        getWrapper:    getWrapper,
        escapeHtml:    escapeHtml,
        ocultarLoader: ocultarLoader,
        mostrarLoader: mostrarLoader,
        mostrarError:  mostrarError
    };
})();
