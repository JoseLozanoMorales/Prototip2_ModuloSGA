(function (window) {
    'use strict';

    function stripHtml(value) {
        const container = document.createElement('div');
        container.innerHTML = value || '';
        return container.textContent || container.innerText || '';
    }

    function normalizeText(value, options) {
        const source = options && options.html ? stripHtml(value) : (value || '');
        return options && options.trim ? source.trim() : source;
    }

    function count(value, options) {
        return normalizeText(value, options).length;
    }

    function countFromElement(element, options) {
        if (!element) {
            return 0;
        }

        if (typeof CKEDITOR !== 'undefined' && element.id && CKEDITOR.instances[element.id]) {
            return count(CKEDITOR.instances[element.id].getData(), Object.assign({}, options, { html: true }));
        }

        return count(element.value || element.textContent || '', options);
    }

    window.CharacterCounter = {
        count: count,
        countFromElement: countFromElement,
        stripHtml: stripHtml
    };
})(window);
