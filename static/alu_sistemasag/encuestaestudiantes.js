/* ═══════════════════════════════════════════════════
   ENCUESTA ESTUDIANTES — UTEQ
   Navegación paso a paso, validación,
   condicionales y progreso
   ═══════════════════════════════════════════════════ */

var ENC_COLORS = ['#1B7505','#2E7D32','#558B2F','#00695C','#388E3C','#1B5E20','#33691E','#004D40'];
var ENC_ICONS  = ['fa-list','fa-check-square-o','fa-star','fa-book','fa-briefcase','fa-users','fa-graduation-cap','fa-globe'];

var encuesta = (function () {

    var _preguntasData = [];
    var _allSteps      = [];   /* todos los .enc-step en orden DOM */
    var _activeEl      = null; /* step actualmente visible */
    var _grupos        = [];   /* [{id, colorIdx}] para colores por grupo */

    /* ─────────────────────────────────────────────────
       INICIALIZAR
       ───────────────────────────────────────────────── */
    function init(preguntasData) {
        _preguntasData = preguntasData || [];

        _collectSteps();
        _collectGrupos();

        /* ocultar todos los steps */
        _allSteps.forEach(function (el) { el.style.display = 'none'; });

        /* ocultar dependientes explícitos al inicio */
        _initHideCondicionales();

        /* mostrar primer step visible */
        var vis = _getVisible();
        if (vis.length > 0) {
            _showStep(0, 'none');
        }
        _updateUI();

        /* re-evaluar condicionales al cambiar radio/checkbox */
        $(document).on('change', '.enc-step input[type="radio"], .enc-step input[type="checkbox"]', function () {
            var visBefore = _getVisible();
            _applyCondicionales();
            _clearNowHiddenSteps(visBefore);
            var vis = _getVisible();
            var idx = vis.indexOf(_activeEl);
            if (idx < 0) {
                /* step activo quedó oculto: avanzar al siguiente disponible */
                var posAll = _allSteps.indexOf(_activeEl);
                idx = 0;
                for (var i = posAll + 1; i < _allSteps.length; i++) {
                    var j = vis.indexOf(_allSteps[i]);
                    if (j >= 0) { idx = j; break; }
                }
                _showStep(idx, 'next');
            }
            _updateUI();
        });

        /* envío del formulario */
        $('#formulariouno').off('submit').on('submit', function (e) {
            e.preventDefault();
            var errMsg = _validateStep(_activeEl);
            if (errMsg !== '') { _showValidation(errMsg); return false; }
            _hideValidation();
            _submitForm();
            return false;
        });
    }

    /* ─────────────────────────────────────────────────
       COLECTAR STEPS
       ───────────────────────────────────────────────── */
    function _collectSteps() {
        _allSteps = Array.prototype.slice.call(
            document.querySelectorAll('.enc-step')
        );
    }

    /* ─────────────────────────────────────────────────
       STEPS VISIBLES
       Un step está oculto si tiene:
         data-cond-hidden  → oculto explícito (es dependiente de una respuesta no seleccionada)
         data-skip-hidden  → oculto implícito (está en el rango de un salto condicional)
       ───────────────────────────────────────────────── */
    function _getVisible() {
        return _allSteps.filter(function (el) {
            return !el.hasAttribute('data-cond-hidden') && !el.hasAttribute('data-skip-hidden');
        });
    }

    function _stepOculto(el) {
        return el && (el.hasAttribute('data-cond-hidden') || el.hasAttribute('data-skip-hidden'));
    }

    /* Limpiar inputs de steps que pasaron de visible → oculto tras un cambio de respuesta.
       Evita que respuestas de una ruta abandonada se envíen con el formulario. */
    function _clearNowHiddenSteps(visBefore) {
        var visAfter = _getVisible();
        visBefore.forEach(function (el) {
            if (visAfter.indexOf(el) < 0) {
                _clearStepInputs(el);
            }
        });
    }

    function _clearStepInputs(stepEl) {
        $(stepEl).find('input[type="radio"], input[type="checkbox"]').prop('checked', false);
        $(stepEl).find('input[type="text"], input[type="number"], input[type="date"]').val('');
        $(stepEl).find('select').prop('selectedIndex', 0);
        $(stepEl).find('textarea').val('');
    }

    /* ─────────────────────────────────────────────────
       OCULTAR CONDICIONALES AL INICIO

       Dos mecanismos:
       1. data-cond-hidden: preguntas que son dependientes EXPLÍCITOS
          de alguna respuesta (aparecen en entry[2] de _preguntasData).
       2. data-skip-hidden: preguntas que quedan entre una pregunta
          fuente y su target más cercano — el "rango implícito" que se
          salta cuando se elige la respuesta con salto.
          Ejemplo: P1='No'→P16  →  P2-P15 quedan en el rango implícito.
       ───────────────────────────────────────────────── */
    function _initHideCondicionales() {
        var a = _preguntasData;
        if (!a || a.length === 0) return;

        /* Ocultar solo los dependientes explícitos.
           El rango implícito (preguntas entre la fuente y su target)
           se oculta dinámicamente en _applyCondicionales cuando el
           usuario selecciona la respuesta de salto, no al inicio. */
        var ocultos = {};
        $.each(a, function (i, entry) {
            $.each(entry[2], function (j, dep) {
                var sel = '#preguntacompleta_' + dep[0] + '_grupo_' + dep[1];
                if (!ocultos[sel]) {
                    ocultos[sel] = true;
                    _hideDep(sel);
                }
            });
        });
    }

    /* ─────────────────────────────────────────────────
       LÓGICA CONDICIONAL (se ejecuta al cambiar respuesta)

       Por cada pregunta que tiene configuración en _preguntasData:
         A. Si su step está oculto → cascada: ocultar sus dependientes
         B. Si no → detectar respuesta seleccionada y:
            - Respuesta CON salto (tiene dependientes explícitos):
                · Ocultar el rango implícito hasta el primer target
                · Ocultar dependientes de respuestas no seleccionadas
                · Mostrar dependientes de la respuesta seleccionada
            - Respuesta SIN salto (camino normal):
                · Des-ocultar el rango implícito de esta pregunta
                · Ocultar dependientes de respuestas no seleccionadas (ej: P16)
       ───────────────────────────────────────────────── */
    function _applyCondicionales() {
        var a = _preguntasData;
        if (!a || a.length === 0) return;

        var pregunta_aux = '';

        $.each(a, function (i, value) {
            var pregunta = value[0];
            if (pregunta_aux === pregunta) return;
            pregunta_aux = pregunta;

            var stepPregunta = document.querySelector('[id^="preguntacompleta_' + pregunta + '_grupo_"]');

            /* A. Cascada: si el step de esta pregunta está oculto,
               forzar ocultos todos sus dependientes */
            if (_stepOculto(stepPregunta)) {
                $.each(a, function (j, v3) {
                    if (v3[0] === pregunta) {
                        $.each(v3[2], function (k, dep) {
                            _hideDep('#preguntacompleta_' + dep[0] + '_grupo_' + dep[1]);
                        });
                    }
                });
                return;
            }

            /* B. Detectar qué respuesta está marcada */
            var respSeleccionada = '';
            var pregSeleccionada = '';
            $.each(a, function (j, v2) {
                if (v2[0] === pregunta) {
                    if ($('.preguntaoriginal_' + v2[0] + '_' + v2[1]).prop('checked')) {
                        pregSeleccionada = pregunta;
                        respSeleccionada = String($('.preguntaoriginal_' + v2[0] + '_' + v2[1]).val());
                    }
                }
            });

            /* Camino normal: el usuario marcó algo que NO está en _preguntasData
               (ej: 'Sí' cuando solo 'No' tiene tienepredecesora).
               pregSeleccionada='' pero hay un radio checked → tratar como camino normal:
               respSeleccionada queda '' → selectedDeps=[] → else branch (des-ocultar rango, ocultar deps) */
            if (pregSeleccionada === '' && stepPregunta) {
                if ($(stepPregunta).find('input[type="radio"]:checked, input[type="checkbox"]:checked').length > 0) {
                    pregSeleccionada = pregunta;
                    /* respSeleccionada queda '' → ningún dep coincide → camino normal */
                }
            }

            if (!stepPregunta || pregSeleccionada === '') return;

            var srcIdx = _allSteps.indexOf(stepPregunta);
            if (srcIdx < 0) return;

            /* Recolectar dependientes de la respuesta seleccionada */
            var selectedDeps = [];
            $.each(a, function (j, v3) {
                if (v3[0] === pregSeleccionada && String(v3[1]) === respSeleccionada) {
                    $.each(v3[2], function (k, dep) {
                        var el = document.querySelector('#preguntacompleta_' + dep[0] + '_grupo_' + dep[1]);
                        if (el) selectedDeps.push(el);
                    });
                }
            });

            /* Limpiar marcas skip-hidden que haya dejado una selección anterior
               de esta misma pregunta, antes de recalcular el rango implícito
               de la respuesta actualmente marcada. Sin esto, al cambiar entre
               dos respuestas que ambas tienen salto (ej: opción 3 → opción 1),
               el rango marcado por la selección previa podía quedar "pegado"
               y ocultar/ mostrar la precedente equivocada. */
            _allSteps.forEach(function (el) {
                if (el.getAttribute('data-skip-hidden') === String(pregunta)) {
                    el.removeAttribute('data-skip-hidden');
                }
            });

            if (selectedDeps.length > 0) {
                /* Respuesta CON salto: ocultar rango implícito hasta el primer target */
                var minSelIdx = _allSteps.length;
                selectedDeps.forEach(function (el) {
                    var idx = _allSteps.indexOf(el);
                    if (idx > srcIdx && idx < minSelIdx) minSelIdx = idx;
                });
                for (var k = srcIdx + 1; k < minSelIdx; k++) {
                    if (selectedDeps.indexOf(_allSteps[k]) < 0) {
                        _allSteps[k].setAttribute('data-skip-hidden', String(pregunta));
                    }
                }
            }
            /* Respuesta SIN salto (camino normal): el rango implícito ya quedó
               des-ocultado por la limpieza de arriba. */

            /* Ocultar dependientes de respuestas NO seleccionadas */
            $.each(a, function (j, v3) {
                if (v3[0] === pregSeleccionada && String(v3[1]) !== respSeleccionada) {
                    $.each(v3[2], function (k, dep) {
                        _hideDep('#preguntacompleta_' + dep[0] + '_grupo_' + dep[1]);
                    });
                }
            });

            /* Mostrar dependientes de la respuesta seleccionada */
            $.each(a, function (j, v3) {
                if (v3[0] === pregSeleccionada && String(v3[1]) === respSeleccionada) {
                    $.each(v3[2], function (k, dep) {
                        _showDep('#preguntacompleta_' + dep[0] + '_grupo_' + dep[1]);
                    });
                }
            });
        });
    }

    function _hideDep(sel) {
        var el = document.querySelector(sel);
        if (!el) return;
        el.style.display = 'none';
        if (el.classList.contains('enc-step')) {
            el.setAttribute('data-cond-hidden', '1');
        }
    }

    function _showDep(sel) {
        var el = document.querySelector(sel);
        if (!el) return;
        if (el.classList.contains('enc-step')) {
            el.removeAttribute('data-cond-hidden');
        } else {
            el.style.display = '';
        }
    }

    /* ─────────────────────────────────────────────────
       MOSTRAR UN STEP (por índice en la lista visible)
       ───────────────────────────────────────────────── */
    function _showStep(newIdx, direction) {
        var vis = _getVisible();
        if (vis.length === 0) return;
        newIdx = Math.max(0, Math.min(newIdx, vis.length - 1));

        var newEl      = vis[newIdx];
        var oldGrupoId = _activeEl ? _activeEl.dataset.grupoId : null;
        var newGrupoId = newEl.dataset.grupoId;
        var isGroupChange = (oldGrupoId !== newGrupoId);

        /* ocultar step anterior */
        if (_activeEl && _activeEl !== newEl) {
            _activeEl.style.display = 'none';
            _activeEl.classList.remove('is-active', 'anim-right', 'anim-left', 'anim-group');
        }

        /* aplicar color del nuevo grupo a la tarjeta */
        var colorIdx = _getGrupoColorIdx(newGrupoId);
        _applyGroupColor(colorIdx);

        /* mostrar nuevo step con animación */
        newEl.classList.remove('anim-right', 'anim-left', 'anim-group');
        newEl.style.display = 'block';
        void newEl.offsetWidth;

        if (direction === 'next') {
            newEl.classList.add(isGroupChange ? 'anim-group' : 'anim-right');
        } else if (direction === 'prev') {
            newEl.classList.add('anim-left');
        }
        newEl.classList.add('is-active');

        _activeEl = newEl;

        _updateGroupBanner(newEl, isGroupChange && direction !== 'none');

        var card = document.getElementById('enc-question-card');
        if (card) {
            var cardTop = card.getBoundingClientRect().top + window.pageYOffset - 10;
            if (window.pageYOffset > cardTop) {
                $('html, body').animate({ scrollTop: cardTop }, 200);
            }
        }
    }

    /* ─────────────────────────────────────────────────
       NAVEGACIÓN PÚBLICA
       ───────────────────────────────────────────────── */
    function goNext() {
        var errMsg = _validateStep(_activeEl);
        if (errMsg !== '') { _showValidation(errMsg); return; }
        _hideValidation();

        var vis    = _getVisible();
        var curIdx = vis.indexOf(_activeEl);
        if (curIdx < vis.length - 1) {
            _showStep(curIdx + 1, 'next');
            _updateUI();
        }
    }

    function goPrev() {
        _hideValidation();
        var vis    = _getVisible();
        var curIdx = vis.indexOf(_activeEl);
        if (curIdx > 0) {
            _showStep(curIdx - 1, 'prev');
            _updateUI();
        }
    }

    /* ─────────────────────────────────────────────────
       VALIDACIÓN DEL STEP ACTIVO
       ───────────────────────────────────────────────── */
    function _validateStep(stepEl) {
        if (!stepEl) return '';
        /* step de políticas: verificar checkbox */
        if ($(stepEl).hasClass('enc-step-politica')) {
            if (!$('#enc-politica-check').is(':checked')) {
                $('#enc-politica-error').show();
                return 'Debe aceptar las Políticas de Seguridad para continuar.';
            }
            $('#enc-politica-error').hide();
            return '';
        }
        /* step de intro: siempre válido */
        if ($(stepEl).hasClass('enc-step-intro')) return '';
        var mensaje = '';

        $(stepEl).find('.obligatorio').each(function () {
            var pid = parseInt($(this).attr('pid'));

            /* input libre: text, number, date */
            var $inp0 = $('#item_0_' + pid);
            if ($inp0.length > 0) {
                var tipo = $inp0.attr('type');
                if (tipo === 'number' || tipo === 'date' || tipo === 'text') {
                    if ($.trim($inp0.val()) === '') {
                        mensaje += '&bull; ' + _labelPregunta(pid) + '<br>';
                        return;
                    }
                }
                if (tipo === 'radio' || tipo === 'checkbox') {
                    if ($('#item_0_' + pid + ':checked').length === 0) {
                        mensaje += '&bull; ' + _labelPregunta(pid) + '<br>';
                        return;
                    }
                }
            }

            /* escala numérica: item_1_pid */
            var $esc = $('#item_1_' + pid);
            if ($esc.length > 0 && $esc.attr('type') === 'radio') {
                if ($('#item_1_' + pid + ':checked').length === 0) {
                    mensaje += '&bull; ' + _labelPregunta(pid) + '<br>';
                    return;
                }
            }

            /* matriz dos columnas: item_0_1_pid / item_0_2_pid */
            var $m1 = $('#item_0_1_' + pid);
            var $m2 = $('#item_0_2_' + pid);
            if ($m1.length > 0 && $m1.attr('type') === 'radio') {
                var men = '';
                if ($m2.length > 0 && $m2.attr('type') === 'radio') {
                    if ($('#item_0_1_' + pid + ':checked').length === 0) men += ' (Grupo 1)';
                    if ($('#item_0_2_' + pid + ':checked').length === 0) men += ' (Grupo 2)';
                } else {
                    if ($('#item_0_1_' + pid + ':checked').length === 0) men += ' (Grupo 1)';
                }
                if (men !== '') mensaje += '&bull; ' + _labelPregunta(pid) + men + '<br>';
            }
        });

        return mensaje;
    }

    function _labelPregunta(pid) {
        var el = document.getElementById('p' + pid);
        if (!el) return 'Pregunta ' + pid;
        return (el.textContent || el.innerText || '').replace(/\s+/g, ' ').trim().substring(0, 120);
    }

    /* ─────────────────────────────────────────────────
       ACTUALIZAR UI (barra, botones)
       ───────────────────────────────────────────────── */
    function _updateUI() {
        var vis    = _getVisible();
        var total  = vis.length;
        var curIdx = vis.indexOf(_activeEl);
        var curNum = curIdx + 1;

        $('#enc-step-text').html('Progreso');

        var pct = total > 1 ? ((curNum - 1) / (total - 1)) * 100 : 100;
        $('#enc-step-bar').css('width', pct + '%');

        $('#enc-btn-prev').toggle(curIdx > 0);
        var isLast = curIdx >= total - 1;
        $('#enc-btn-next').toggle(!isLast);
        $('#enc-btn-submit').toggle(isLast);
    }

    /* ─────────────────────────────────────────────────
       BANNER DE GRUPO
       ───────────────────────────────────────────────── */
    function _updateGroupBanner(stepEl, animate) {
        if (!stepEl) return;
        var gid      = stepEl.dataset.grupoId    || '';
        var gNombre  = stepEl.dataset.grupoNombre || '';
        var gDesc    = stepEl.dataset.grupoDesc   || '';
        var colorIdx = _getGrupoColorIdx(gid);
        var color    = ENC_COLORS[colorIdx % ENC_COLORS.length];
        var icon     = ENC_ICONS [colorIdx % ENC_ICONS.length];

        $('#enc-gb-name').text(gNombre);
        $('#enc-gb-desc').text(gDesc);
        $('#enc-gb-icon').attr('class', 'fa ' + icon);

        var banner = document.getElementById('enc-group-banner');
        if (banner) {
            banner.style.setProperty('--gc',    color);
            banner.style.setProperty('--gc-bg', _hexAlpha(color, 0.08));
            banner.style.borderColor = color;
        }

        if (animate) {
            var $b = $('#enc-group-banner');
            $b.removeClass('group-entering');
            void $b[0].offsetWidth;
            $b.addClass('group-entering');
        }
    }

    /* ─────────────────────────────────────────────────
       COLOR DE GRUPO EN LA TARJETA PRINCIPAL
       ───────────────────────────────────────────────── */
    function _applyGroupColor(colorIdx) {
        var color = ENC_COLORS[colorIdx % ENC_COLORS.length];
        var card  = document.getElementById('enc-question-card');
        if (card) {
            card.style.setProperty('--gc',    color);
            card.style.setProperty('--gc-bg', _hexAlpha(color, 0.08));
        }
    }

    /* ─────────────────────────────────────────────────
       COLECTAR GRUPOS
       ───────────────────────────────────────────────── */
    function _collectGrupos() {
        _grupos = [];
        var seen = {};
        _allSteps.forEach(function (el) {
            var gid = el.dataset.grupoId || '';
            if (!gid || seen[gid]) return;
            seen[gid] = true;
            _grupos.push({ id: gid, colorIdx: _grupos.length % ENC_COLORS.length });
        });
    }

    function _getGrupoColorIdx(gid) {
        for (var i = 0; i < _grupos.length; i++) {
            if (_grupos[i].id === String(gid)) return _grupos[i].colorIdx;
        }
        return 0;
    }

    /* ─────────────────────────────────────────────────
       VALIDACIÓN — mensaje inline
       ───────────────────────────────────────────────── */
    function _showValidation(html) {
        $('#enc-val-text').html(html);
        var $msg = $('#enc-validation-msg');
        $msg.addClass('is-visible');
        var top = $msg.offset();
        if (top) $('html, body').animate({ scrollTop: Math.max(0, top.top - 20) }, 200);
    }

    function _hideValidation() {
        $('#enc-validation-msg').removeClass('is-visible');
    }

    /* ─────────────────────────────────────────────────
       ENVÍO DEL FORMULARIO
       ───────────────────────────────────────────────── */
    function _submitForm() {
        /* modo vista previa (administrador): no persistir nada, solo mostrar la pantalla de éxito */
        if ($('#formulariouno').attr('data-preview') === 'true') {
            $('#enc-form-section').hide();
            $('#enc-exito').show();
            $('html, body').animate({ scrollTop: 0 }, 400);
            return;
        }

        var lista = [];
        $('#formulariouno').find('[name^="item_"]').each(function () {
            var $inp = $(this);
            /* omitir inputs en steps ocultos */
            if ($inp.closest('[data-cond-hidden], [data-skip-hidden]').length) return;
            /* omitir radio/checkbox no marcados */
            if ($inp.is(':radio, :checkbox') && !$inp.prop('checked')) return;
            /* omitir valores vacíos */
            if ($.trim($inp.val()) === '') return;
            lista.push({ nombre: $inp.attr('name'), valor: $inp.val() });
        });
        bloqueointerface();
        $.post('/encuestagraduado', {
            lista_items1: JSON.stringify(lista),
            idp: $('#periodoid').val(),
            idi: $('#inscripcionid').val(),
            politica_id: $('#politicaid').val() || ''
        }, function (data) {
            $.unblockUI();
            if (data.result === 'ok') {
                $('#enc-form-section').hide();
                $('#enc-exito').show();
                $('html, body').animate({ scrollTop: 0 }, 400);
            } else {
                abrirnotificacionmodal(data.mensaje);
            }
        }, 'json');
    }

    /* ─────────────────────────────────────────────────
       HELPERS
       ───────────────────────────────────────────────── */
    function _hexAlpha(hex, a) {
        var r = parseInt(hex.slice(1, 3), 16),
            g = parseInt(hex.slice(3, 5), 16),
            b = parseInt(hex.slice(5, 7), 16);
        return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
    }

    /* API pública */
    return { init: init, next: goNext, prev: goPrev };

})();

/* Funciones globales invocadas por los botones HTML */
function encNext() { encuesta.next(); }
function encPrev() { encuesta.prev(); }
