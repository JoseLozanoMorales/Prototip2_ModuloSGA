// Variable global para almacenar los timeouts activos
let alertTimeouts = {
    hide: null,
    progress: null,
    displayNone: null
};

let isAlertVisible = false;

function showAlert(type = 'success', title, message, duration = 4000, is_html=true) {
    const alert = document.getElementById('alert-progress');


    if (isAlertVisible) {

        if (alertTimeouts.hide) clearTimeout(alertTimeouts.hide);
        if (alertTimeouts.progress) clearTimeout(alertTimeouts.progress);
        if (alertTimeouts.displayNone) clearTimeout(alertTimeouts.displayNone);


        alert.classList.remove('show', 'animate-progress');

        setTimeout(() => {
            displayAlert(alert, type, title, message, duration, is_html);
        }, 600);
    } else {
        displayAlert(alert, type, title, message, duration, is_html);
    }
}

function displayAlert(alert, type, title, message, duration, is_html=false) {
    const iconWrapper = alert.querySelector('.icon-wrapper');
    const titleEl = alert.querySelector('.title');
    const messageEl = alert.querySelector('.message');


    alert.classList.remove('success', 'error', 'warning', 'info', 'show', 'animate-progress');
    alert.style.setProperty('--duration', `${duration}ms`);

    if (type === 'success') {
        alert.classList.add('success');
        iconWrapper.textContent = '✓';
        titleEl.textContent = title || '¡Proceso completado!';
        if(is_html){
            messageEl.innerHTML = message || 'La operación se ha realizado correctamente';
        }else {
            messageEl.textContent = message || 'La operación se ha realizado correctamente';
        }
    } else if (type === 'error') {
        alert.classList.add('error');
        iconWrapper.textContent = '✕';
        titleEl.textContent = title || '¡Error!';
        if(is_html){
            messageEl.innerHTML = message || 'Ha ocurrido un problema, intenta nuevamente';
        }else {
            messageEl.textContent = message || 'Ha ocurrido un problema, intenta nuevamente';
        }
    } else if (type === 'warning') {
        alert.classList.add('warning');
        iconWrapper.textContent = '⚠';
        titleEl.textContent = title || '¡Advertencia!';
        if(is_html){
            messageEl.innerHTML = message || 'Por favor, revisa la información antes de continuar';
        }else {
            messageEl.textContent = message || 'Por favor, revisa la información antes de continuar';
        }
    } else if (type === 'info') {
        alert.classList.add('info');
        iconWrapper.textContent = 'ℹ';
        titleEl.textContent = title || 'Información';
        if(is_html){
            messageEl.innerHTML = message || 'Aquí tienes algunos datos importantes';
        }else {
            messageEl.textContent = message || 'Aquí tienes algunos datos importantes';
        }
    }

    alert.style.display = 'flex';


    void alert.offsetHeight;
    isAlertVisible = true;

    setTimeout(() => {
        alert.classList.add('show');
        alertTimeouts.progress = setTimeout(() => {
            alert.classList.add('animate-progress');
        }, 100);
    }, 10);

    alertTimeouts.hide = setTimeout(() => {
        alert.classList.remove('show', 'animate-progress');


        alertTimeouts.displayNone = setTimeout(() => {
            alert.style.display = 'none';
            isAlertVisible = false;
        }, 600);
    }, duration);
}

function showSuccessAlert(title, message, duration) {
    showAlert('success', title, message, duration);
}

function showErrorAlert(title, message, duration) {
    showAlert('error', title, message, duration);
}

function showWarningAlert(title, message, duration) {
    showAlert('warning', title, message, duration);
}

function showInfoAlert(title, message, duration) {
    showAlert('info', title, message, duration);
}