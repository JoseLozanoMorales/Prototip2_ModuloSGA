$(document).on('click', '.mod-footer div .bloqueo_calificacion', function() {
    let materia_id = $(this).data("id");
    let materia_name = $(this).closest('.modulo').find('.header-title').text().trim();
    let texto = `La materia <b>${materia_name}</b> se encuentra bloqueada por actividades sin calificar`;
    abrirnotificacionmodal(texto);
});


$(document).on('click', '.bloqueo_calificacion', function() {
    let materia_id = $(this).data("id");
    let materia_name = $(this).closest('.modulo').find('.header-title').text().trim();
    let texto = `La materia <b>${materia_name}</b> se encuentra bloqueada por actividades sin calificar`;
    abrirnotificacionmodal(texto);
});

$(document).on('click', '.planificacionclase', function() {
    location.href="/pro_planificacion?action=planificacionclase&id="+$(this).attr('id')
});