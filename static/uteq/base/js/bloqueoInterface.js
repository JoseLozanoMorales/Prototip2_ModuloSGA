/* jshint esversion:6 */
/* global avShowLoader, avHideLoader */
'use strict';

window.avShowLoader = function () {
    var el = document.getElementById('av-loader');
    if (el) { el.classList.add('av-visible'); }
};

window.avHideLoader = function () {
    var el = document.getElementById('av-loader');
    if (el) { el.classList.remove('av-visible'); }
};

window.bloqueointerface = window.avShowLoader;
