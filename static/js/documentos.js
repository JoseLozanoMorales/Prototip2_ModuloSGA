document.addEventListener('DOMContentLoaded', function () {
    function refreshPlaceholder(box) {
        const hasChips = box.querySelector('.selection-chip');
        box.classList.toggle('is-empty', !hasChips);
    }

    function addChip(box, value, label) {
        const field = box.dataset.field;
        const normalizedValue = value || '';

        if (normalizedValue === '') {
            box.querySelectorAll('.selection-chip').forEach(function (chip) {
                chip.remove();
            });
        } else {
            const allChip = box.querySelector('.selection-chip[data-value=""]');
            if (allChip) {
                allChip.remove();
            }
        }

        const exists = box.querySelector('.selection-chip[data-value="' + normalizedValue + '"]');
        if (exists) {
            refreshPlaceholder(box);
            return;
        }

        const chip = document.createElement('span');
        chip.className = 'selection-chip';
        chip.dataset.value = normalizedValue;
        chip.append(document.createTextNode(label));

        const button = document.createElement('button');
        button.type = 'button';
        button.setAttribute('aria-label', 'Quitar ' + label);
        button.innerHTML = '&times;';
        chip.append(button);

        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = field;
        input.value = normalizedValue;
        chip.append(input);

        box.append(chip);
        refreshPlaceholder(box);
    }

    function refreshVersionStatus(select) {
        const option = select.selectedOptions[0];
        const form = select.closest('form');
        const statusSelect = form ? form.querySelector('[data-version-status-select]') : null;
        if (!option || !statusSelect) {
            return;
        }

        const estado = option.dataset.estado || 'INACTIVO';
        const statusOption = Array.from(statusSelect.options).find(function (item) {
            return item.value === estado;
        });
        if (statusOption) {
            statusSelect.value = estado;
        }
    }

    function refreshPdfViewer(select) {
        const option = select.selectedOptions[0];
        const form = select.closest('form');
        const pdfViewer = form ? form.querySelector('[data-pdf-viewer]') : null;
        const pdfUrl = option ? option.dataset.pdfUrl : '';

        if (!pdfViewer || !pdfUrl) {
            return;
        }

        const separator = pdfUrl.indexOf('?') === -1 ? '?' : '&';
        const nextUrl = pdfUrl + separator + 'preview_version=' + encodeURIComponent(option.value);

        if (pdfViewer.dataset.currentPdfUrl !== nextUrl) {
            pdfViewer.dataset.currentPdfUrl = nextUrl;
            pdfViewer.src = nextUrl;
        }
    }

    function refreshVersionDetails(select) {
        refreshVersionStatus(select);
        refreshPdfViewer(select);
    }

    function refreshActiveModalPdf() {
        if (!window.location.hash || window.location.hash === '#') {
            return;
        }

        const activeModal = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
        const versionSelect = activeModal ? activeModal.querySelector('[data-version-select]') : null;
        if (versionSelect) {
            refreshVersionDetails(versionSelect);
        }
    }

    function positionActionMenu(menu) {
        if (!menu || (!menu.open && !menu.classList.contains('is-open'))) {
            return;
        }

        const summary = menu.querySelector('.menu-trigger, summary');
        const menuBox = menu.querySelector('.menu-box');
        if (!summary || !menuBox) {
            return;
        }

        menuBox.style.left = '0px';
        menuBox.style.top = '0px';

        const spacing = 6;
        const margin = 8;
        const summaryRect = summary.getBoundingClientRect();
        const boxRect = menuBox.getBoundingClientRect();
        const maxLeft = window.innerWidth - boxRect.width - margin;
        const left = Math.max(margin, Math.min(summaryRect.right - boxRect.width, maxLeft));
        let top = summaryRect.bottom + spacing;

        if (top + boxRect.height > window.innerHeight - margin) {
            top = summaryRect.top - boxRect.height - spacing;
        }

        menuBox.style.left = left + 'px';
        menuBox.style.top = Math.max(margin, top) + 'px';
    }

    function positionOpenActionMenus() {
        document.querySelectorAll('.menu-actions[open], .menu-actions.is-open').forEach(positionActionMenu);
    }

    function closeActionMenu(menu) {
        const trigger = menu.querySelector('.menu-trigger');
        menu.classList.remove('is-open');
        menu.removeAttribute('open');
        const menuBox = menu.querySelector('.menu-box');
        if (menuBox) {
            menuBox.hidden = true;
        }
        if (trigger) {
            trigger.setAttribute('aria-expanded', 'false');
        }
    }

    function openActionMenu(menu) {
        const trigger = menu.querySelector('.menu-trigger');
        const menuBox = menu.querySelector('.menu-box');
        if (menuBox) {
            menuBox.hidden = false;
        }
        menu.classList.add('is-open');
        if (trigger) {
            trigger.setAttribute('aria-expanded', 'true');
        }
        positionActionMenu(menu);
    }

    function toggleActionMenu(menu) {
        if (menu.classList.contains('is-open')) {
            closeActionMenu(menu);
        } else {
            openActionMenu(menu);
        }
    }

    function closeOpenActionMenus() {
        document.querySelectorAll('.menu-actions[open], .menu-actions.is-open').forEach(closeActionMenu);
    }

    document.querySelectorAll('[data-selected-box]').forEach(refreshPlaceholder);
    document.querySelectorAll('[data-version-select]').forEach(refreshVersionStatus);
    document.querySelectorAll('[data-version-select]').forEach(function (select) {
        select.addEventListener('change', function () {
            refreshVersionDetails(select);
        });
        select.addEventListener('input', function () {
            refreshVersionDetails(select);
        });
    });
    refreshActiveModalPdf();
    window.addEventListener('hashchange', function () {
        closeOpenActionMenus();
        refreshActiveModalPdf();
    });

    document.addEventListener('change', function (event) {
        const autoSubmitSelect = event.target.closest('.auto-submit-select');
        if (autoSubmitSelect && autoSubmitSelect.form) {
            autoSubmitSelect.form.submit();
            return;
        }

        const fileInput = event.target.closest('input[type="file"]');
        if (fileInput) {
            const uploadRow = fileInput.closest('.upload-row');
            const status = uploadRow ? uploadRow.querySelector('[data-file-status]') : null;
            if (!status) {
                return;
            }

            if (fileInput.files && fileInput.files.length > 0) {
                status.textContent = 'Archivo seleccionado para subir';
                status.classList.add('has-file');
            } else {
                status.textContent = 'Ningun archivo seleccionado';
                status.classList.remove('has-file');
            }
            return;
        }

        const select = event.target.closest('.access-picker');
        if (!select) {
            return;
        }

        const option = select.selectedOptions[0];
        const box = document.querySelector('[data-selected-box="' + select.dataset.target + '"]');
        if (!option || !box) {
            return;
        }
        if (option.value === '__placeholder__') {
            return;
        }

        addChip(box, option.value, option.textContent.trim());
        select.selectedIndex = 0;
    });

    document.addEventListener('click', function (event) {
        const activeMenu = event.target.closest('.menu-actions');
        const menuTrigger = event.target.closest('.menu-trigger');
        const menuLink = event.target.closest('.menu-box a');

        document.querySelectorAll('.menu-actions[open], .menu-actions.is-open').forEach(function (menu) {
            if (menu !== activeMenu) {
                closeActionMenu(menu);
            }
        });

        if (menuTrigger && activeMenu) {
            event.preventDefault();
            toggleActionMenu(activeMenu);
            return;
        }

        if (menuLink && activeMenu) {
            closeActionMenu(activeMenu);
            return;
        }

        if (activeMenu && activeMenu.open) {
            window.requestAnimationFrame(function () {
                positionActionMenu(activeMenu);
            });
        }

        const button = event.target.closest('.selection-chip button');
        if (!button) {
            return;
        }

        const box = button.closest('[data-selected-box]');
        button.closest('.selection-chip').remove();
        refreshPlaceholder(box);
    });

    document.querySelectorAll('.menu-actions').forEach(function (menu) {
        menu.addEventListener('toggle', function () {
            if (menu.open) {
                positionActionMenu(menu);
            }
        });
    });
    window.addEventListener('resize', positionOpenActionMenus);
    window.addEventListener('scroll', positionOpenActionMenus, true);

    document.querySelectorAll('input[name="alcance_eliminacion"]').forEach(function (radio) {
        radio.addEventListener('change', function () {
            const form = radio.closest('form');
            const versionSelect = form ? form.querySelector('select[name="id_version_eliminacion"]') : null;
            if (!versionSelect) {
                return;
            }

            const versionSelected = form.querySelector('input[name="alcance_eliminacion"][value="version"]:checked');
            versionSelect.disabled = !versionSelected;
            if (!versionSelected) {
                versionSelect.value = '';
            }
        });
    });
});
