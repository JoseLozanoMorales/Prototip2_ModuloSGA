document.addEventListener('DOMContentLoaded', function () {
    const IA_FINAL_STATES = ['LEIDO', 'OBSERVADO', 'ERROR'];
    const IA_POLL_INTERVAL = 5000;
    let iaPollTimer = null;

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
        button.dataset.editLockedControl = '';
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

    function rememberInitialDisabledState(form) {
        if (!form) {
            return;
        }
        form.querySelectorAll('[data-edit-locked-control]').forEach(function (control) {
            if (!control.dataset.initialDisabled) {
                control.dataset.initialDisabled = control.disabled ? 'true' : 'false';
            }
        });
    }

    function refreshEditLock(select) {
        const option = select.selectedOptions[0];
        const form = select.closest('form');
        if (!option || !form) {
            return;
        }

        const locked = (option.dataset.estado || 'INACTIVO') === 'VIGENTE';
        form.classList.toggle('is-version-edit-locked', locked);

        form.querySelectorAll('[data-edit-locked-field]').forEach(function (field) {
            field.readOnly = locked;
            field.title = locked ? 'Primero cambie la version a No vigente y guarde.' : '';
        });

        form.querySelectorAll('[data-edit-locked-control]').forEach(function (control) {
            control.disabled = locked || control.dataset.initialDisabled === 'true';
            control.title = locked ? 'Primero cambie la version a No vigente y guarde.' : '';
        });

        form.querySelectorAll('.file-button').forEach(function (label) {
            const input = label.querySelector('input[type="file"]');
            if (input) {
                label.classList.toggle('is-disabled', input.disabled);
            }
        });
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

        const nextUrl = pdfUrl + '#toolbar=1&view=FitH';

        if (pdfViewer.dataset.currentPdfUrl !== nextUrl) {
            pdfViewer.dataset.currentPdfUrl = nextUrl;
            pdfViewer.src = nextUrl;
        }
    }

    function refreshVersionDetails(select) {
        rememberInitialDisabledState(select.closest('form'));
        refreshVersionStatus(select);
        refreshPdfViewer(select);
        refreshEditLock(select);
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

    function showIaNotification(documento) {
        const title = documento.estado_ia === 'LEIDO'
            ? 'Analisis de IA completado'
            : 'Resultado del analisis de IA';
        const details = documento.mensaje_ia || documento.label_ia || 'El documento ya tiene resultado de IA.';
        const message = (documento.titulo ? documento.titulo + ': ' : '') + details;

        let stack = document.querySelector('[data-ia-toast-stack]');
        if (!stack) {
            stack = document.createElement('div');
            stack.className = 'ia-analysis-toast-stack';
            stack.dataset.iaToastStack = '';
            document.body.append(stack);
        }
        const toast = document.createElement('div');
        toast.className = 'ia-analysis-toast ' + (documento.estado_ia === 'LEIDO' ? 'is-success' : 'is-warning');
        toast.setAttribute('role', 'status');
        toast.innerHTML = '<strong></strong><span></span><button type="button" aria-label="Cerrar">&times;</button>';
        toast.querySelector('strong').textContent = title;
        toast.querySelector('span').textContent = message;
        const removeToast = function () {
            toast.remove();
            if (stack && !stack.children.length) {
                stack.remove();
            }
        };
        toast.querySelector('button').addEventListener('click', function () {
            removeToast();
        });
        stack.append(toast);
        window.setTimeout(function () {
            removeToast();
        }, 5000);
    }

    function updateIaRow(documento) {
        const row = document.querySelector('[data-documento-id="' + documento.id_documento + '"]');
        if (!row) {
            return false;
        }

        const previousState = row.dataset.iaEstado || 'PENDIENTE';
        row.dataset.iaEstado = documento.estado_ia || 'PENDIENTE';

        const badge = row.querySelector('[data-ia-badge]');
        const percent = row.querySelector('[data-ia-percent]');

        if (badge) {
            badge.className = 'ia-status-badge ' + (documento.clase_ia || 'status-pending');
            badge.textContent = documento.label_ia || 'Pendiente';
            badge.title = documento.mensaje_ia || '';
        }
        if (percent) {
            percent.remove();
        }

        return previousState === 'PENDIENTE' && IA_FINAL_STATES.indexOf(documento.estado_ia) !== -1;
    }

    function pendingIaIds() {
        return Array.from(document.querySelectorAll('[data-documento-id][data-ia-estado="PENDIENTE"]'))
            .map(function (row) {
                return row.dataset.documentoId;
            })
            .filter(Boolean);
    }

    function pollIaStatus() {
        const root = document.querySelector('.documentos-legales');
        const statusUrl = root ? root.dataset.iaStatusUrl : '';
        const ids = pendingIaIds();

        if (!statusUrl || ids.length === 0) {
            if (iaPollTimer) {
                window.clearInterval(iaPollTimer);
                iaPollTimer = null;
            }
            return;
        }

        fetch(statusUrl + '?ids=' + encodeURIComponent(ids.join(',')), {
            credentials: 'same-origin',
            headers: { 'Accept': 'application/json' }
        })
            .then(function (response) {
                if (!response.ok) {
                    throw new Error('No se pudo consultar el estado IA.');
                }
                return response.json();
            })
            .then(function (data) {
                (data.documentos || []).forEach(function (documento) {
                    if (updateIaRow(documento)) {
                        showIaNotification(documento);
                    }
                });
                if (pendingIaIds().length === 0 && iaPollTimer) {
                    window.clearInterval(iaPollTimer);
                    iaPollTimer = null;
                }
            })
            .catch(function () {
                if (iaPollTimer) {
                    window.clearInterval(iaPollTimer);
                    iaPollTimer = null;
                }
            });
    }

    function startIaPolling() {
        if (pendingIaIds().length === 0) {
            return;
        }
        pollIaStatus();
        iaPollTimer = window.setInterval(pollIaStatus, IA_POLL_INTERVAL);
    }

    function parseBetyMessageData(data) {
        if (!data) {
            return null;
        }
        if (typeof data === 'string') {
            try {
                return JSON.parse(data);
            } catch (error) {
                return null;
            }
        }
        return data;
    }

    function initBetyIframe() {
        const container = document.getElementById('bety-iframe-container');
        const iframe = document.getElementById('bety-chat-iframe');
        const origenPermitido = 'http://16.58.71.138:8000';

        if (!container) {
            return;
        }

        const abrirChat = function () {
            container.classList.add('abierto');
        };

        if (iframe) {
            iframe.addEventListener('focus', abrirChat);
        }

        container.addEventListener('click', function () {
            if (!container.classList.contains('abierto')) {
                abrirChat();
            }
        });

        window.addEventListener('blur', function () {
            if (document.activeElement === iframe && !container.classList.contains('abierto')) {
                abrirChat();
            }
        });

        window.addEventListener('message', function (event) {
            const data = parseBetyMessageData(event.data);

            if (event.origin !== origenPermitido || !data || !data.tipo) {
                return;
            }

            if (data.tipo === 'BETY_CHAT_ABIERTO') {
                container.classList.add('abierto');
            }

            if (data.tipo === 'BETY_CHAT_CERRADO') {
                container.classList.remove('abierto');
            }
        });
    }

    document.querySelectorAll('[data-selected-box]').forEach(refreshPlaceholder);
    document.querySelectorAll('[data-version-select]').forEach(refreshVersionDetails);
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
        if (select.disabled) {
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
        const menuLink = event.target.closest('.menu-box a, .menu-box form button');

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
        if (button.disabled) {
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

    document.querySelectorAll('[data-live-search-input]').forEach(function (input) {
        const table = document.getElementById(input.dataset.liveSearchTarget);
        if (!table) {
            return;
        }

        const rows = Array.from(table.querySelectorAll('[data-live-search-row]'));
        const emptyRow = table.querySelector('[data-live-search-empty]');

        input.addEventListener('input', function () {
            const query = input.value.trim().toLocaleLowerCase();
            let matches = 0;

            rows.forEach(function (row) {
                const matchesQuery = !query || (row.dataset.searchText || '').toLocaleLowerCase().includes(query);
                row.hidden = !matchesQuery;
                if (matchesQuery) {
                    matches += 1;
                }
            });

            if (emptyRow) {
                emptyRow.hidden = matches > 0;
            }
        });
    });

    startIaPolling();
    initBetyIframe();
});
