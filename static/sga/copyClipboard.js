

function copyClipboard(texto) {
    // Copy the link to the clipboard.
    var elementoTemporal = document.createElement('textarea');
    elementoTemporal.value = texto;
    document.body.appendChild(elementoTemporal);
    elementoTemporal.select();
    console.log(elementoTemporal)
    // var result = document.execCommand('copy');
    document.execCommand("copy");
    document.body.removeChild(elementoTemporal);
    abrirNotificacionModalWarning("Texto copiado al portapapeles. Pega manualmente con Ctrl + V.");
}
