function formatos_fechas(fecha_date) {
    let date;
    if (fecha_date instanceof Date) {
        date = fecha_date;
    } else {
        date = new Date(fecha_date);
    }

    return {
        // Formato corto: 08/07/2025
        corto: date.toLocaleDateString('es-ES'),

        // Formato largo: martes, 8 de julio de 2025
        largo: date.toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }),

        // Formato medio: 8 jul 2025
        medio: date.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        }),

        // Solo día y mes: 8 de julio
        diaMes: date.toLocaleDateString('es-ES', {
            month: 'long',
            day: 'numeric'
        }),

        // Formato americano: 07/08/2025
        americano: date.toLocaleDateString('en-US')
    };
}