let currentYear = new Date().getFullYear();
footerElement = document.querySelector('#footercentro');
if (footerElement) {
    footerElement.textContent = `Ⓒ ${currentYear} - Todos los derechos reservados`;
}
