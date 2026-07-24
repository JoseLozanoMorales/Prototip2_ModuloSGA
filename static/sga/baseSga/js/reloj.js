function checkTime(i) {
    return (i < 10 ? "0" : "") + i;
}

function updateClock(serverDate, clientDate, elementoHtml) {
    var now = new Date();
    var timeDiff = now - clientDate;  // Diferencia de tiempo desde que se cargó la página
    var renderDate = new Date(serverDate.getTime() + timeDiff);

    // Obtener horas y minutos
    var hours = renderDate.getHours();
    var minutes = renderDate.getMinutes();

    // Formato de AM/PM
    var amPm = hours >= 12 ? " PM" : " AM";
    hours = hours % 12;
    hours = hours ? hours : 12;  // Ajuste para '0' horas, que debería ser '12'

    minutes = checkTime(minutes);  // Añadir cero si es necesario

    // Actualizar el texto del elemento HTML con el nuevo tiempo
    elementoHtml.text(hours + ":" + minutes + amPm);
}