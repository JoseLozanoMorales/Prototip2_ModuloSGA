function init_option_group(id) {
    $(`#${id}-group .option-btn`).on('click', function(e) {
        e.preventDefault();
        $(`#${id}-group .option-btn`).removeClass('active');
        $(this).addClass('active');
        $(`#${id}`).val($(this).data('value'));
    });
}
function set_values_option_group(id_field, valor) {
    // Convertir valor a string y validar que no sea undefined/null
    const value = String(valor || '').trim();

    if (!value) {
        console.warn('set_values_group: valor vacío o inválido', valor);
        return;
    }

    // Usar el id_field para hacer la función más genérica
    const $field = $(`#${id_field}`);
    const $group = $(`#${id_field}-group`);

    if ($field.length === 0 || $group.length === 0) {
        console.error(`set_values_group: elementos no encontrados para id: ${id_field}`);
        return;
    }

    // Establecer valor en el campo oculto
    $field.val(value);

    // Actualizar estado visual de los botones
    $group.find('.option-btn').removeClass('active');
    $group.find(`.option-btn[data-value="${value}"]`).addClass('active');
}