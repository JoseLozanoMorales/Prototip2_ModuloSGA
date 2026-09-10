document.addEventListener('DOMContentLoaded', function () {
    const IA_FINAL_STATES = ['LEIDO', 'OMITIDO', 'OBSERVADO', 'ERROR'];
    const IA_POLL_INTERVAL = 5000;
    let iaPollTimer = null;

    function cookieValue(name) {
        const prefix = name + '=';
        const item = document.cookie.split(';').map(function (value) {
            return value.trim();
        }).find(function (value) {
            return value.startsWith(prefix);
        });
        return item ? decodeURIComponent(item.slice(prefix.length)) : '';
    }

    function syncCsrfToken(form) {
        if (!form || (form.method || '').toLowerCase() !== 'post') {
            return;
        }
        const cookieToken = cookieValue('csrftoken');
        const formToken = form.querySelector('input[name="csrfmiddlewaretoken"]');
        if (cookieToken && formToken) {
            formToken.value = cookieToken;
        }
    }

    // Django rota el token al iniciar sesión. Una pestaña abierta o restaurada
    // puede conservar formularios con el valor anterior aunque la cookie ya sea
    // nueva, por lo que se sincroniza inmediatamente antes de cada POST.
    document.addEventListener('submit', function (event) {
        syncCsrfToken(event.target);
    }, true);

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

    function keywordValues(component) {
        return Array.from(component.querySelectorAll('.keyword-chip')).map(function (chip) {
            return chip.dataset.value;
        });
    }

    function syncKeywords(component) {
        const hidden = component.querySelector('input[type="hidden"][name="palabras_clave"]');
        if (hidden) {
            hidden.value = keywordValues(component).join(', ');
        }
    }

    function addKeyword(component, rawValue) {
        const value = (rawValue || '').replace(/\s+/g, ' ').trim();
        const entry = component.querySelector('[data-keyword-entry]');
        if (!value) {
            return false;
        }

        const exists = keywordValues(component).some(function (item) {
            return item.toLocaleLowerCase() === value.toLocaleLowerCase();
        });
        if (exists) {
            if (entry) {
                entry.value = '';
            }
            return false;
        }

        const chip = document.createElement('span');
        chip.className = 'keyword-chip';
        chip.dataset.value = value;
        chip.append(document.createTextNode(value));

        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.keywordRemove = '';
        button.dataset.editLockedControl = '';
        button.setAttribute('aria-label', 'Quitar ' + value);
        button.innerHTML = '&times;';
        chip.append(button);

        component.querySelector('[data-keyword-chips]').append(chip);
        if (entry) {
            entry.value = '';
        }
        syncKeywords(component);
        return true;
    }

    document.querySelectorAll('[data-keyword-input]').forEach(function (component) {
        const hidden = component.querySelector('input[type="hidden"][name="palabras_clave"]');
        const entry = component.querySelector('[data-keyword-entry]');

        (hidden && hidden.value ? hidden.value.split(/[,;\n]+/) : []).forEach(function (value) {
            addKeyword(component, value);
        });

        entry.addEventListener('keydown', function (event) {
            if (event.key === 'Enter' || event.key === ',') {
                event.preventDefault();
                addKeyword(component, entry.value);
                return;
            }
            if (event.key === 'Backspace' && !entry.value) {
                const chips = component.querySelectorAll('.keyword-chip');
                const lastChip = chips[chips.length - 1];
                if (lastChip && !entry.readOnly) {
                    lastChip.remove();
                    syncKeywords(component);
                }
            }
        });

        entry.addEventListener('blur', function () {
            if (!entry.readOnly) {
                addKeyword(component, entry.value);
            }
        });
    });

    document.querySelectorAll('.document-form').forEach(function (form) {
        form.addEventListener('submit', function () {
            form.querySelectorAll('[data-keyword-input]').forEach(function (component) {
                const entry = component.querySelector('[data-keyword-entry]');
                if (entry && !entry.readOnly) {
                    addKeyword(component, entry.value);
                }
                syncKeywords(component);
            });
        });
    });

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

        const locked = (option.dataset.estado || 'BORRADOR') === 'VIGENTE';
        form.classList.toggle('is-version-edit-locked', locked);

        form.querySelectorAll('[data-edit-locked-field]').forEach(function (field) {
            field.readOnly = locked;
            field.title = locked ? 'Primero cambie la version a No vigente o borrador y guarde.' : '';
        });

        form.querySelectorAll('[data-edit-locked-control]').forEach(function (control) {
            control.disabled = locked || control.dataset.initialDisabled === 'true';
            control.title = locked ? 'Primero cambie la version a No vigente o borrador y guarde.' : '';
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

        const estado = option.dataset.estado || 'BORRADOR';
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

    function refreshApprovalDate(select) {
        const option = select.selectedOptions[0];
        const form = select.closest('form');
        const approvalDateInput = form ? form.querySelector('[data-version-approval-date]') : null;

        if (option && approvalDateInput) {
            approvalDateInput.value = option.dataset.fechaAprobacion || '';
        }
    }

    function markPreviewedVersionForSave(control) {
        const form = control.closest('form');
        const versionSelect = form ? form.querySelector('[data-version-select]') : null;
        const statusSelect = form ? form.querySelector('[data-version-status-select]') : null;
        const approvalDateInput = form ? form.querySelector('[data-version-approval-date]') : null;
        const savedVersionId = form ? form.querySelector('[data-saved-version-id]') : null;
        const savedStatus = form ? form.querySelector('[data-saved-version-status]') : null;
        const savedApprovalDate = form ? form.querySelector('[data-saved-approval-date]') : null;

        if (!form || !versionSelect || !savedVersionId || !savedStatus || !savedApprovalDate) {
            return;
        }

        savedVersionId.value = versionSelect.value;
        savedStatus.value = statusSelect ? statusSelect.value : 'BORRADOR';
        savedApprovalDate.value = approvalDateInput ? approvalDateInput.value : '';
    }

    function refreshVersionDetails(select) {
        rememberInitialDisabledState(select.closest('form'));
        refreshApprovalDate(select);
        refreshVersionStatus(select);
        refreshPdfViewer(select);
        refreshEditLock(select);
        markPreviewedVersionForSave(select);
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
        const message = documento.estado_ia === 'LEIDO'
            ? ('El documento ' + (documento.titulo || 'seleccionado') + ' fue analizado por la IA exitosamente.')
            : ((documento.titulo ? documento.titulo + ': ' : '') + details);

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
        document.addEventListener('DOMContentLoaded', function () {
                const container = document.getElementById('bety-iframe-container');
                const origenPermitido = 'https://bettyaiuteq.duckdns.org';

                if (!container) {
                    return;
                }

                window.addEventListener('message', function (event) {
                    if (event.origin !== origenPermitido) {
                        return;
                    }

                    if (!event.data || !event.data.tipo) {
                        return;
                    }

                    if (event.data.tipo === 'BETY_CHAT_ABIERTO') {
                        container.classList.add('abierto');
                    }

                    if (event.data.tipo === 'BETY_CHAT_CERRADO') {
                        container.classList.remove('abierto');
                    }
                });
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
    document.querySelectorAll('[data-version-status-select]').forEach(function (select) {
        select.addEventListener('change', function () {
            markPreviewedVersionForSave(select);
        });
    });
    document.querySelectorAll('[data-version-approval-date]').forEach(function (input) {
        input.addEventListener('change', function () {
            markPreviewedVersionForSave(input);
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

        const keywordButton = event.target.closest('[data-keyword-remove]');
        if (keywordButton) {
            if (!keywordButton.disabled) {
                const component = keywordButton.closest('[data-keyword-input]');
                keywordButton.closest('.keyword-chip').remove();
                syncKeywords(component);
            }
            return;
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

    function normalizeSearchText(value) {
        return (value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLocaleLowerCase();
    }

    document.querySelectorAll('[data-live-search-input]').forEach(function (input) {
        const table = document.getElementById(input.dataset.liveSearchTarget);
        if (!table) {
            return;
        }

        const rows = Array.from(table.querySelectorAll('[data-live-search-row]'));
        const emptyRow = table.querySelector('[data-live-search-empty]');

        input.addEventListener('input', function () {
            const terms = normalizeSearchText(input.value).trim().split(/\s+/).filter(Boolean);
            let matches = 0;

            rows.forEach(function (row) {
                const searchableText = normalizeSearchText(row.dataset.searchText);
                const matchesQuery = terms.every(function (term) {
                    return searchableText.includes(term);
                });
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
