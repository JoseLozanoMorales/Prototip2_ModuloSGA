/**
 * RecursoSeguimiento — rastrea la revisión de recursos tipo ARCHIVO
 * (DocumentosMateria con tiporecurso__tiporecurso = 3) por parte del
 * estudiante: tiempo de lectura acumulado, descargas y marcado manual.
 *
 * Se usa desde:
 *   - alu_documentos/recursos_materia.html (visor modal .get_file_viewer)
 *   - alu_documentos/componente/semana_planificacion.html (botón marcar visto)
 *   - alu_documentos/recurso.html (visor embebido de página completa)
 */
window.RecursoSeguimiento = (function ($) {
    'use strict';

    var UMBRAL_SEGUNDOS = 60;
    var INTERVALO_TICK = 5;      // segundos entre cada verificación de visibilidad
    var INTERVALO_ENVIO = 15;    // segundos entre cada envío al servidor

    var estado = null; // {idDoc, idMa, deltaPendiente, intervalId, segundosDesdeEnvio}

    function _visiblePestana() {
        return document.visibilityState === 'visible';
    }

    // Busca el/los .rec-check de este recurso comparando los data-* en vez de
    // armar un selector con los ids encriptados (pueden traer caracteres que
    // rompan un selector CSS armado a mano).
    function _buscarCheck(idDoc, idMa) {
        return $('.rec-check').filter(function () {
            var $el = $(this);
            return $el.data('recurso-id') === idDoc && $el.data('materiaasignada-id') === idMa;
        });
    }

    // Callback compartido: refleja en el check "visto" de la tabla lo que
    // haya respondido el servidor, sin importar si vino de un clic manual,
    // de que se cumplió el umbral de lectura, o de una descarga. Así el
    // check se actualiza solo, sin recargar la página.
    function _actualizarCheckUI(idDoc, idMa, visto) {
        var $chk = _buscarCheck(idDoc, idMa);
        if (!$chk.length) return;
        var vistoAnterior = $chk.data('visto') === 1;
        var vistoNuevo = !!visto;
        if (vistoAnterior === vistoNuevo) return;
        $chk.data('visto', vistoNuevo ? 1 : 0);
        $chk.toggleClass('rec-check--activo', vistoNuevo);
        $chk.attr('title', vistoNuevo ? 'Visto — clic para quitar' : 'Marcar como visto');
        $chk.html(vistoNuevo ? '<i class="fa fa-check"></i>' : '');
        var $fila = $chk.closest('[data-recurso-fila]');
        $fila.toggleClass('rec-visto', vistoNuevo).toggleClass('rec-no-visto', !vistoNuevo);
        // Aviso genérico para que la página (ej. la gráfica de cumplimiento
        // de recursos_materia.html) se actualice sola, sin recargar nada.
        $(document).trigger('recursoSeguimiento:vistoCambiado', [{
            visto: vistoNuevo,
            anterior: vistoAnterior
        }]);
    }

    function _enviar(idDoc, idMa, segundos, sync) {
        if (!segundos) return;
        var datos = 'action=recurso_registrar_tiempo&id=' + encodeURIComponent(idDoc) +
            '&idm=' + encodeURIComponent(idMa) + '&segundos=' + encodeURIComponent(segundos);

        if (sync && navigator.sendBeacon) {
            // sendBeacon no permite fijar headers (no hay forma de mandar
            // X-CSRFToken como sí hace el $.ajaxSetup global para $.post/$.ajax),
            // así que el token CSRF tiene que viajar dentro del propio cuerpo
            // del POST. Sin esto Django devuelve 403 (CSRF verification failed)
            // y el ping se pierde en silencio, ya que sendBeacon no informa
            // errores del servidor de vuelta al JS.
            var csrftoken = (typeof getCookie === 'function') ? getCookie('csrftoken') : '';
            datos += '&csrfmiddlewaretoken=' + encodeURIComponent(csrftoken);
            var blob = new Blob([datos], {type: 'application/x-www-form-urlencoded'});
            navigator.sendBeacon('/alu_documentos', blob);
            // sendBeacon no tiene callback: nunca sabremos si el servidor
            // respondió "ok" o "bad" (o si respondió algo). Como esto solo se
            // usa al ocultar/cerrar la pestaña, se libera el bloqueo de una
            // vez en vez de dejarlo a la espera de una respuesta que no va a
            // poder leerse.
            if (typeof $.unblockUI === 'function') { $.unblockUI(); }
            return;
        }
        $.post('/alu_documentos', {action: 'recurso_registrar_tiempo', id: idDoc, idm: idMa, segundos: segundos})
            .done(function (data) {
                // Callback automático: si este ping fue el que hizo que
                // segundos_lectura llegara al umbral, el check se activa
                // solo, sin que el estudiante tenga que tocar nada.
                if (data && data.result === 'ok') {
                    _actualizarCheckUI(idDoc, idMa, data.visto);
                }
            })
            .always(function () {
                // Se ejecuta tanto si el servidor respondió "ok" como "bad"
                // (o si la petición falló del todo): así, si bloqueointerface()
                // quedó activo por lo que sea, se cierra al terminar este ping
                // en vez de quedarse esperando algo que nadie estaba leyendo.
                if (typeof $.unblockUI === 'function') { $.unblockUI(); }
            });
    }

    function iniciarLectura(idDoc, idMa) {
        detenerLectura();
        estado = {idDoc: idDoc, idMa: idMa, deltaPendiente: 0, segundosDesdeEnvio: 0};
        estado.intervalId = setInterval(function () {
            if (!_visiblePestana()) return;
            estado.deltaPendiente += INTERVALO_TICK;
            estado.segundosDesdeEnvio += INTERVALO_TICK;
            if (estado.segundosDesdeEnvio >= INTERVALO_ENVIO) {
                _enviar(estado.idDoc, estado.idMa, estado.deltaPendiente, false);
                estado.deltaPendiente = 0;
                estado.segundosDesdeEnvio = 0;
            }
        }, INTERVALO_TICK * 1000);
    }

    function detenerLectura(sync) {
        if (!estado) return;
        clearInterval(estado.intervalId);
        if (estado.deltaPendiente) {
            _enviar(estado.idDoc, estado.idMa, estado.deltaPendiente, !!sync);
        }
        estado = null;
    }

    // Ping silencioso: no navega ni abre nada, el botón de descarga que ya
    // existía (nativo del PDF, o el .gdocs-download-btn de Word/Excel/Ppt)
    // sigue su propio comportamiento normal; esto solo registra el evento.
    function registrarDescarga(idDoc, idMa) {
        if (!idDoc || !idMa) return;
        $.post('/alu_documentos', {action: 'recurso_registrar_descarga', id: idDoc, idm: idMa})
            .done(function (data) {
                // Callback automático: la descarga marca "visto" en el
                // servidor; se refleja solo en el check, sin recargar nada.
                if (data && data.result === 'ok') {
                    _actualizarCheckUI(idDoc, idMa, data.visto);
                }
            })
            .always(function () {
                // Igual que en _enviar(): sea "ok" o "bad" (o falle del todo),
                // se libera cualquier bloqueo pendiente en vez de dejarlo a la
                // espera de una respuesta que nadie leía.
                if (typeof $.unblockUI === 'function') { $.unblockUI(); }
            });
    }

    function marcarVisto(idDoc, idMa, visto, callback) {
        $.post('/alu_documentos', {action: 'recurso_marcar_visto', id: idDoc, idm: idMa, visto: visto ? 1 : 0}, function (data) {
            if (typeof callback === 'function') callback(data);
        });
    }

    // Flush al salir/ocultar la pestaña, para no perder los últimos segundos.
    $(document).on('visibilitychange', function () {
        if (document.visibilityState === 'hidden' && estado) {
            _enviar(estado.idDoc, estado.idMa, estado.deltaPendiente, true);
            estado.deltaPendiente = 0;
            estado.segundosDesdeEnvio = 0;
        }
    });
    window.addEventListener('pagehide', function () { detenerLectura(true); });
    window.addEventListener('beforeunload', function () { detenerLectura(true); });

    // ── Wiring automático dentro del visor modal (#modalPdfGenerico) ──
    // recursos_materia.html marca el link con data-recurso-id + data-materiaasignada-id.
    $(document).on('click', '.get_file_viewer[data-recurso-id]', function () {
        var $btn = $(this);
        $('#modalPdfGenerico').data('recursoTrackIdDoc', $btn.data('recurso-id'));
        $('#modalPdfGenerico').data('recursoTrackIdMa', $btn.data('materiaasignada-id'));
    });
    $(document).on('shown.bs.modal', '#modalPdfGenerico', function () {
        var idDoc = $(this).data('recursoTrackIdDoc');
        var idMa = $(this).data('recursoTrackIdMa');
        if (idDoc && idMa) iniciarLectura(idDoc, idMa);
    });
    $(document).on('hidden.bs.modal', '#modalPdfGenerico', function () {
        detenerLectura();
        $(this).removeData('recursoTrackIdDoc').removeData('recursoTrackIdMa');
    });

    // ── Descarga: se engancha a los botones que YA existían ──
    //   - .gdocs-download-btn generado por visor_pdf.js dentro de #modalPdfGenerico
    //     (Word/Excel/Ppt en el visor modal de recursos_materia.html)
    //   - .gdocs-download-btn ya renderizado en plantillas/pdf_viewer.html
    //     (Word/Excel/Ppt en el visor embebido de recurso.html)
    // El PDF puro no tiene botón propio (usa el del visor nativo del navegador),
    // así que esa descarga no se puede interceptar y no se registra aquí.
    $(document).on('click', '.gdocs-download-btn', function (e) {
        // No se llama a preventDefault(): la descarga nativa (atributo
        // download) debe seguir su curso normal. Sí se corta la propagación,
        // para que ningún handler delegado en un ancestro (p.ej. uno que
        // reaccione a cualquier <a> o .btn dentro de la card/modal) llegue a
        // aplicar bloqueointerface() por este click — este botón solo
        // descarga y registra el evento, nunca debe bloquear la interfaz.
        e.stopPropagation();
        var $ctx = $(this).closest('#modalPdfGenerico, .pdf-viewer-wrapper');
        var idDoc = $ctx.data('recursoTrackIdDoc') || $ctx.attr('data-recurso-id');
        var idMa  = $ctx.data('recursoTrackIdMa')  || $ctx.attr('data-materiaasignada-id');
        registrarDescarga(idDoc, idMa);
    });

    // ── Check "visto" ──
    // <span class="rec-check {% if visto %}rec-check--activo{% endif %}"
    //       data-recurso-id="..." data-materiaasignada-id="..." data-visto="0|1">
    $(document).on('click', '.rec-check', function (e) {
        e.preventDefault();
        var $chk = $(this);
        if ($chk.hasClass('disabled') || $chk.hasClass('rec-check--solo')) { return; }
        var nuevoVisto = $chk.data('visto') !== 1;
        var idDoc = $chk.data('recurso-id');
        var idMa = $chk.data('materiaasignada-id');
        $chk.addClass('disabled');
        marcarVisto(idDoc, idMa, nuevoVisto, function (data) {
            $chk.removeClass('disabled');
            if (!data || data.result !== 'ok') { return; }
            _actualizarCheckUI(idDoc, idMa, data.visto);
        });
    });

    return {
        UMBRAL_SEGUNDOS: UMBRAL_SEGUNDOS,
        iniciarLectura: iniciarLectura,
        detenerLectura: detenerLectura,
        registrarDescarga: registrarDescarga,
        marcarVisto: marcarVisto
    };
})(jQuery);
