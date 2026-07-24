function inicializarCKEditorConBlur(ckeditorInstance, actionUrl, actionType, claveValor) {
    ckeditorInstance.on('blur', function() {
        // Obtén el elemento de textarea asociado a esta instancia de CKEditor
        let textareaElement = ckeditorInstance.element.$;
        let idam = textareaElement.getAttribute('idam');
        let idpa = textareaElement.getAttribute('idpa');

        let contenido = ckeditorInstance.getData();
        // Verifica que los identificadores existan antes de enviar la solicitud
        if (idam) {
            let dicionario = {
                action: actionType,
                idam: idam,
            };
            if (idpa){
                dicionario['idpa'] = idpa;
            }
            dicionario[claveValor] = contenido;
            dicionario['seccion'] = 'c_chekditor';
            // actualizarCampoChange("POST", actionUrl, dicionario);
            bloqueointerface();
            $.ajax({
                type: "POST",
                url: actionUrl,
                data: dicionario,
                success: function (data) {
                    $.unblockUI();
                    if (data.result === "ok") {
                        PROGRAMA_ID=data.idpro;
                        return false;
                    } else {
                        abrirnotificacionmodal(data.mensaje);
                    }
                },
                error: function () {
                    $.unblockUI();
                    abrirnotificacionmodal('Error de conexión.');
                },
            });
        } else {
            console.error("Faltan datos del identificador (IDE o IDC).");
            return false;
        }
    });
}

document.addEventListener('DOMContentLoaded', function() {
    // Verifica si CKEDITOR está definido antes de intentar usarlo
    if (typeof CKEDITOR !== 'undefined') {
        // Reemplaza el textarea con id 'descripcionasig' por una instancia de CKEditor
        const descripcionAsig = campoEditorCK('iddescripcionasig');
        const objetivoGeneral = campoEditorCK('idobjetivogeneral');
        const resultadoAsignatura = campoEditorCK('idresultadoasignatura');
        const aporteRA = campoEditorCK('idAporteRA');
        const objetivoDS = campoEditorCK('idObjetivoDS');
        const demandaSocial = campoEditorCK('idDemanadaSocial');
        const habilidadBlanda = campoEditorCK('idHabilidadBlanda');
        const estrategiaDidactica = campoEditorCK('idEstrategiaDidactica');

        agregarLimitacionPalabras(descripcionAsig, document.getElementById('iddescripcionasig'));
        agregarLimitacionPalabras(objetivoGeneral, document.getElementById('idobjetivogeneral'));
        agregarLimitacionPalabras(resultadoAsignatura, document.getElementById('resultadoAsignatura'));
        agregarLimitacionPalabras(objetivoDS, document.getElementById('idAporteRA'));
        agregarLimitacionPalabras(demandaSocial, document.getElementById('idHabilidadBlanda'));
        agregarLimitacionPalabras(habilidadBlanda, document.getElementById('idHabilidadBlanda'));
        agregarLimitacionPalabras(estrategiaDidactica, document.getElementById('idEstrategiaDidactica'));

        contarPalabrasCKEDITOR(descripcionAsig.getData(), $("#iddescripcionasig"));
        contarPalabrasCKEDITOR(objetivoGeneral.getData(), $("#idobjetivogeneral"));
        contarPalabrasCKEDITOR(resultadoAsignatura.getData(), $("#idresultadoasignatura"));
        contarCaracteresCKEDITOR(aporteRA.getData(), $("#idAporteRA"));
        contarPalabrasCKEDITOR(objetivoDS.getData(), $("#idObjetivoDS"));
        contarPalabrasCKEDITOR(demandaSocial.getData(), $("#idHabilidadBlanda"));
        contarPalabrasCKEDITOR(habilidadBlanda.getData(), $("#idHabilidadBlanda"));
        contarPalabrasCKEDITOR(estrategiaDidactica.getData(), $("#idEstrategiaDidactica"));

        // contarCaracteresCKEDITOR(descripcionAsig.getData(), $("#iddescripcionasig"));
        // contarCaracteresCKEDITOR(objetivoGeneral.getData(), $("#idobjetivogeneral"));
        // contarCaracteresCKEDITOR(resultadoAsignatura.getData(), $("#idresultadoasignatura"));
        // contarCaracteresCKEDITOR(aporteRA.getData(), $("#idAporteRA"));
        // contarCaracteresCKEDITOR(objetivoDS.getData(), $("#idObjetivoDS"));
        // contarCaracteresCKEDITOR(demandaSocial.getData(), $("#idHabilidadBlanda"));
        // contarCaracteresCKEDITOR(habilidadBlanda.getData(), $("#idHabilidadBlanda"));
        // contarCaracteresCKEDITOR(estrategiaDidactica.getData(), $("#idEstrategiaDidactica"));

        descripcionAsig.on('change', function( evt ) {contarPalabrasCKEDITOR(evt.editor.getData(), $("#iddescripcionasig"))});
        objetivoGeneral.on('change', function( evt ) {contarPalabrasCKEDITOR(evt.editor.getData(), $("#idobjetivogeneral"))});
        resultadoAsignatura.on('change', function( evt ) {contarPalabrasCKEDITOR(evt.editor.getData(), $("#idresultadoasignatura"))});
        aporteRA.on('change', function( evt ) {contarPalabrasCKEDITOR(evt.editor.getData(), $("#idAporteRA"))});
        objetivoDS.on('change', function( evt ) {contarPalabrasCKEDITOR(evt.editor.getData(), $("#idObjetivoDS"))});
        demandaSocial.on('change', function( evt ) {contarPalabrasCKEDITOR(evt.editor.getData(), $("#idDemanadaSocial"))});
        habilidadBlanda.on('change', function( evt ) {contarPalabrasCKEDITOR(evt.editor.getData(), $("#idHabilidadBlanda"))});
        estrategiaDidactica.on('change', function( evt ) {contarPalabrasCKEDITOR(evt.editor.getData(), $("#idEstrategiaDidactica"))});

        // descripcionAsig.on('change', function( evt ) {contarPalabrasCKEDITOR(evt.editor.getData(), $("#iddescripcionasig"))});
        // objetivoGeneral.on('change', function( evt ) {contarCaracteresCKEDITOR(evt.editor.getData(), $("#idobjetivogeneral"))});
        // resultadoAsignatura.on('change', function( evt ) {contarCaracteresCKEDITOR(evt.editor.getData(), $("#idresultadoasignatura"))});
        // aporteRA.on('change', function( evt ) {contarCaracteresCKEDITOR(evt.editor.getData(), $("#idAporteRA"))});
        // objetivoDS.on('change', function( evt ) {contarCaracteresCKEDITOR(evt.editor.getData(), $("#idObjetivoDS"))});
        // demandaSocial.on('change', function( evt ) {contarCaracteresCKEDITOR(evt.editor.getData(), $("#idDemanadaSocial"))});
        // habilidadBlanda.on('change', function( evt ) {contarCaracteresCKEDITOR(evt.editor.getData(), $("#idHabilidadBlanda"))});
        // estrategiaDidactica.on('change', function( evt ) {contarCaracteresCKEDITOR(evt.editor.getData(), $("#idEstrategiaDidactica"))});


        inicializarCKEditorConBlur(descripcionAsig, "/pro_planificacion", 'addprogramaanalitico', 'descripcionasig');
        inicializarCKEditorConBlur(objetivoGeneral, "/pro_planificacion", 'addprogramaanalitico', 'objetivogeneral');
        inicializarCKEditorConBlur(resultadoAsignatura, "/pro_planificacion", 'addprogramaanalitico', 'resultadoasignatura');
        inicializarCKEditorConBlur(aporteRA, "/pro_planificacion", 'addprogramaanalitico', 'resultadoaprendizaje');
        inicializarCKEditorConBlur(objetivoDS, "/pro_planificacion", 'addprogramaanalitico', 'objetivodesarrollo');
        inicializarCKEditorConBlur(demandaSocial, "/pro_planificacion", 'addprogramaanalitico', 'demandasocial');
        inicializarCKEditorConBlur(habilidadBlanda, "/pro_planificacion", 'addprogramaanalitico', 'habilidadblanda');
        inicializarCKEditorConBlur(estrategiaDidactica, "/pro_planificacion", 'addprogramaanalitico', 'estrategiadidactica');
    } else {
        console.error('CKEDITOR no está definido.');
    }
});
