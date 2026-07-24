

function progress_semicirculo(anchobarra, colorfondo, colorrelleno) {
    actualizar_colres(anchobarra, colorfondo, colorrelleno);
    $(".progress-bar").each(function(){
        var bar = $(this).find(".bar");
        var val = $(this).find(".porcentaje");
        var per = parseInt( val.text(), 10);
        $({p:0}).animate({p:per}, {
            duration: 3000,
            easing: "swing",
            step: function(p) {
                bar.css({
                    transform: "rotate("+ (45+(p*1.8)) +"deg)"
                });
                val.text(p|0);
            }
        });
    });
}
actualizar_colres = function(colorfondo, colorrelleno, tamano_progress_pinceles) {
    $('.bar').css({'border': (Math.round(tamano_progress_pinceles / 7, 0)).toString() + 'px solid ' + colorfondo});
    $('.bar').css({'border-bottom-color': colorrelleno});
    $('.bar').css({'border-right-color': colorrelleno});
    if (tamano_progress_pinceles > 0) {
        $('.barOverflow').css({
            'width': tamano_progress_pinceles.toString() + 'px',
            'height': Math.round(tamano_progress_pinceles / 2, 0).toString() + 'px'
        });
        $('.bar').css({
            'width': tamano_progress_pinceles.toString() + 'px',
            'height': (tamano_progress_pinceles).toString() + 'px'
        });
    }
}