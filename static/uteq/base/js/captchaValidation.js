

function getCsrfToken() {
    // Primero intentar obtenerlo del campo oculto en el formulario (más confiable)
    const tokenInput = document.querySelector('input[name="csrfmiddlewaretoken"]');
    if (tokenInput) {
        return tokenInput.value;
    }

    // Si no está en el formulario, intentar obtenerlo de las cookies
    const name = 'csrftoken';
    let cookieValue = '';

    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }

    return cookieValue;
}

function validateCaptcha(inputId = 'cod_captcha_conf') {
    return new Promise((resolve, reject) => {
        const captchaInput = document.getElementById(inputId);

        if (!captchaInput) {
            console.error('No se encontró el elemento de input para el CAPTCHA');
            reject(new Error('Elemento CAPTCHA no encontrado'));
            return;
        }

        const captchaValue = captchaInput.value.trim();

        if (!captchaValue) {
            abrirnotificacionmodal('Por favor ingrese el código CAPTCHA');
            resolve(false);
            return;
        }

        // Obtener el token CSRF para enviarlo con la solicitud
        const csrftoken = getCsrfToken();

        // Enviar el código al servidor para validación
        fetch("/validate_captcha", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrftoken
            },
            body: JSON.stringify({
                captcha_code: captchaValue
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.valid) {
                // CAPTCHA válido
                removeCaptchaError();
                resolve(true);
            } else {
                // CAPTCHA inválido
                abrirnotificacionmodal(data.message || 'Código CAPTCHA incorrecto');
                // Recargar CAPTCHA automáticamente
                // reloadCaptcha('captchaImage');
                // Limpiar el input
                captchaInput.value = '';
                resolve(false);
            }
        })
        .catch(error => {
            console.error('Error al validar CAPTCHA:', error);
            abrirnotificacionmodal('Error al validar el código');
            reject(error);
        });
    });
}


/**
 * Recarga la imagen del CAPTCHA
 * @param {string} imageId - ID de la imagen del CAPTCHA
 */
function reloadCaptcha(imageId) {
    const image = document.getElementById(imageId);

    if (image) {
        // Añadir parámetro timestamp para evitar caché del navegador
        const timestamp = new Date().getTime();
        const captchaUrl = image.src.split('?')[0] + '?t=' + timestamp;
        image.src = captchaUrl;
    }
}


/**
 * Muestra un mensaje de error para el CAPTCHA
 * @param {string} message - Mensaje de error a mostrar
 */
// function showCaptchaError(message) {
//     // Buscar contenedor de error existente o crear uno nuevo
//     let errorElement = document.getElementById('captcha-error');
//
//     if (!errorElement) {
//         errorElement = document.createElement('div');
//         errorElement.id = 'captcha-error';
//         errorElement.className = 'text-danger captcha-error mt-1';
//
//         // Insertar después del input del CAPTCHA
//         const captchaInput = document.getElementById('cod_captcha_conf');
//         if (captchaInput && captchaInput.parentNode) {
//             captchaInput.parentNode.appendChild(errorElement);
//         }
//     }
//
//     errorElement.textContent = message;
//     errorElement.style.display = 'block';
//
//     // Agregar clase de error al input
//     const captchaInput = document.getElementById('cod_captcha_conf');
//     if (captchaInput) {
//         captchaInput.classList.add('is-invalid');
//     }
// }

/**
 * Remueve los mensajes de error del CAPTCHA
 */
function removeCaptchaError() {
    const errorElement = document.getElementById('captcha-error');

    if (errorElement) {
        errorElement.style.display = 'none';
    }

    // Remover clase de error del input
    const captchaInput = document.getElementById('cod_captcha_conf');
    if (captchaInput) {
        captchaInput.classList.remove('is-invalid');
    }
}

/**
 * Inicializa la validación del CAPTCHA cuando el documento está listo
 */
// document.addEventListener('DOMContentLoaded', function() {
//     // Configurar validación de CAPTCHA en el formulario de login
//     setupCaptchaValidation();
//
//     // También podemos establecer un evento para el botón de recargar CAPTCHA
//     const refreshButton = document.getElementById('refreshCaptchaBtn');
//     if (refreshButton) {
//         refreshButton.addEventListener('click', function() {
//             reloadCaptcha('captchaImage');
//         });
//     }
//
//     // Agregar comportamiento para limpiar error al escribir en el input del CAPTCHA
//     const captchaInput = document.getElementById('cod_captcha_conf');
//     if (captchaInput) {
//         captchaInput.addEventListener('input', function() {
//             removeCaptchaError();
//         });
//     }
// });