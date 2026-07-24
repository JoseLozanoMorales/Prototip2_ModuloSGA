$(document).ready(function() {
    $("#search").keyup(function () {
        var texto = removeAccents($(this).val() || "").toUpperCase();

        $(".iconname").each(function () {
            var titulo = ($(this).find('.tituloicon').html() || "");
            var descripcion = ($(this).find('.icondesc').html() || "");

            // Normalizamos texto
            var tituloNorm = removeAccents(titulo).toUpperCase();
            var descNorm   = removeAccents(descripcion).toUpperCase();

            // Si coincide en título o descripción → mostrar
            if (tituloNorm.includes(texto) || descNorm.includes(texto)) {
                $(this).parent().show();
            } else {
                $(this).parent().hide();
            }
        });
    });
});

function removeAccents(str) {
    return str
        ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        : "";
}