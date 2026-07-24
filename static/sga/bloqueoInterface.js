/* jshint esversion:6, jquery:true */
/**
 * Loader global del SGA.
 * El overlay HTML/CSS vive en templates/plantillas/loading_overlay.html
 * e incluido en basebs.html — este script solo lo muestra/oculta.
 *
 * API pública:
 *   avShowLoader()      — muestra el overlay
 *   avHideLoader()      — oculta el overlay
 *   bloqueointerface()  — alias de avShowLoader
 *   $.blockUI()         — alias de avShowLoader
 *   $.unblockUI()       — alias de avHideLoader
 */
(function ($) {
    'use strict';

    window.avShowLoader = function () {
        var el = document.getElementById('av-loader');
        if (el) { el.classList.add('av-visible'); }
    };

    window.avHideLoader = function () {
        var el = document.getElementById('av-loader');
        if (el) { el.classList.remove('av-visible'); }
    };

    /* Compatibilidad con llamadas existentes */
    window.bloqueointerface = window.avShowLoader;
    $.blockUI   = function () { window.avShowLoader(); };
    $.unblockUI  = function () { window.avHideLoader(); };

    /* Ocultar si el navegador recupera la página del caché (botón Atrás) */
    window.addEventListener('pageshow', function (e) {
        if (e.persisted) { window.avHideLoader(); }
    });

}(jQuery));
