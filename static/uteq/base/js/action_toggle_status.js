/**
 * Unified Modal System for confirmations (delete, status changes, etc.)
 */

// CSS Styles for the confirmation modal - add this to your stylesheet
const confirmationStyles = `
    .confirmation-modal {
        // max-width: 450px;
        border-radius: 8px;
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
        border: none;
    }
    
    .confirmation-icon {
        width: 70px;
        height: 70px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 20px;
    }
    
    .confirmation-icon-delete {
        background-color: #ffeded;
    }
    
    .confirmation-icon-activate {
        background-color: #e8f5e9;
    }
    
    .confirmation-icon-deactivate {
        background-color: #fff8e1;
    }
    
    .confirmation-icon-confirm {
        background-color: #e3f2fd;
    }
    
    .confirmation-icon i {
        font-size: 30px;
        font-weight: bold;
        display: flex;
        width: 100%;
        height: 100%;
        justify-content: center;
        align-items: center;
    }
    
    .icon-delete {
        color: #dc3545;
    }
    
    .icon-activate {
        color: #4caf50;
    }
    
    .icon-deactivate {
        color: #ff9800;
    }
    
    .icon-confirm {
        color: #2196f3;
    }
    
    .modal-body {
        text-align: center;
        padding: 30px 20px;
    }
    
    .modal-title {
        font-size: 24px;
        font-weight: bold;
        margin-bottom: 15px;
        text-align: center;
    }
    
    .modal-description {
        color: #666;
        margin-bottom: 15px;
    }
    
    .modal-question {
        margin-top: 10px;
        margin-bottom: 25px;
    }
    
    .btn-container {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        margin-top: 10px;
    }
    
    .btn-cancel {
        background-color: #f2f2f2;
        color: #333;
        border: none;
        padding: 8px 20px;
        flex: 1;
    }
    
    .btn-confirm {
        border: none;
        padding: 8px 20px;
        flex: 1;
        color: white;
    }
    
    .btn-delete {
        background-color: #dc3545;
    }
    
    .btn-activate {
        background-color: #4caf50;
    }
    
    .btn-deactivate {
        background-color: #ff9800;
    }
    
    .btn-confirm-action {
        background-color: #2196f3;
    }
`;

// Add styles to the page
function addModalStyles() {
    if (!document.getElementById('confirmation-modal-styles')) {
        const styleElement = document.createElement('style');
        styleElement.id = 'confirmation-modal-styles';
        styleElement.textContent = confirmationStyles;
        document.head.appendChild(styleElement);
    }
}

// Create modal HTML if it doesn't exist
function createModalIfNotExists() {
    if ($('#unifiedConfirmationModal').length === 0) {
        $('body').append(`
            <div class="modal fade" id="unifiedConfirmationModal" tabindex="-1" aria-labelledby="unifiedConfirmationModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content confirmation-modal">
                        <div class="modal-body">
                            <div class="confirmation-icon">
                                <i></i>
                            </div>
                            <h5 class="modal-title" id="unifiedConfirmationModalLabel"></h5>
                            <p class="modal-description"></p>
                            <p class="modal-question"></p>
                            
                            <div class="btn-container">
                                <button type="button" class="btn btn-cancel" id="btnCancelAction">
                                    <i class="fa fa-times"></i> Cancelar
                                </button>
                                <button type="button" class="btn btn-confirm" id="btnConfirmAction">
                                    <i></i> <span id="confirmButtonText"></span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `);
    }
}

/**
 * Universal function to show the confirmation modal
 * @param {Object} options - Configuration options
 * @param {string} options.type - Type of confirmation: 'delete', 'activate', 'deactivate'
 * @param {string} options.name - Name of the item
 * @param {string} options.message - Optional custom message
 * @param {function} options.onConfirm - Callback function when confirmed
 */
function showUnifiedConfirmModal(options) {
    // Ensure styles and modal exist
    addModalStyles();
    createModalIfNotExists();

    const modal = $('#unifiedConfirmationModal');
    const type = options.type || 'delete';
    const name = options.name || '';
    const message = options.message || '';
    const estado = options.estado || '';

    // Configure based on type
    let config = {
        icon: 'bi-trash',
        iconClass: 'icon-delete',
        iconBgClass: 'confirmation-icon-delete',
        buttonClass: 'btn-delete',
        title: 'Confirmar eliminación',
        description: 'Al eliminar el registro no podrá volver a recuperar los datos.',
        question: `¿Está seguro de eliminar el registro <b>${name}</b>?`,
        buttonText: 'Eliminar'
    };

    if (type === 'activate') {
        config = {
            icon: 'fa fa-check',
            iconClass: 'icon-activate',
            iconBgClass: 'confirmation-icon-activate',
            buttonClass: 'btn-activate',
            title: 'Confirmar activación',
            description: 'El registro estará disponible para su uso en el sistema.',
            question: `¿Está seguro de activar el registro <b>${name}</b>?`,
            buttonText: 'Confirmar'
        };
    } else if (type === 'deactivate') {
        config = {
            icon: 'fa fa-times',
            iconClass: 'icon-deactivate',
            iconBgClass: 'confirmation-icon-deactivate',
            buttonClass: 'btn-deactivate',
            title: 'Confirmar desactivación',
            description: 'El registro no estará disponible para su uso en el sistema.',
            question: `¿Está seguro de desactivar el registro <b>${name}</b>?`,
            buttonText: 'Confirmar'
        };
    }else if (type === 'confirm') {
        config = {
            icon: 'fa fa-check',
            iconClass: 'icon-confirm',
            iconBgClass: 'confirmation-icon-confirm',
            buttonClass: 'btn-confirm-action',
            title: 'Confirmar acción',
            description: 'Esta acción se aplicará al registro seleccionado.',
            question: estado ? `¿Está seguro de ${estado} el registro <b>${name}</b>?` : `¿Está seguro de confirmar el registro <b>${name}</b>?`,
            buttonText: 'Confirmar'
        };
    }

    // Use custom message if provided
    if (message) {
        config.question = `${message} <br>¿Está seguro de ${type === 'delete' ? 'eliminar' :
            (type === 'activate' ? 'activar' : (type === 'deactivate' ? 'desactivar' : 'confirmar'))} el registro <b>${name}</b>?`;
    }

    // Set modal content
    modal.find('.modal-title').text(config.title);
    modal.find('.modal-description').text(config.description);
    modal.find('.modal-question').html(config.question);
    modal.find('#confirmButtonText').text(config.buttonText);

    // Set button and icon classes
    modal.find('.btn-confirm')
        .removeClass('btn-delete btn-activate btn-deactivate')
        .addClass(config.buttonClass);

    modal.find('.confirmation-icon')
        .removeClass('confirmation-icon-delete confirmation-icon-activate confirmation-icon-deactivate')
        .addClass(config.iconBgClass);

    modal.find('.confirmation-icon i')
        .removeClass()
        .addClass(config.icon)
        .addClass(config.iconClass);

    modal.find('.btn-confirm i')
        .removeClass()
        .addClass(config.icon);

    // Set event handlers
    $('#btnCancelAction').off('click').on('click', function() {
        modal.modal('hide');
    });

    $('#btnConfirmAction').off('click').on('click', function() {
        modal.modal('hide');
        if (typeof options.onConfirm === 'function') {
            options.onConfirm();
        }
    });

    // Show the modal
    modal.modal('show');
}

// STATUS TOGGLE ACTION HANDLER
$(document).on('click', '.action_toggle_status', function () {
    const action = $(this).data('action');
    const id = $(this).data('id');
    const name = $(this).data('name');
    const current_status = $(this).data('status');
    const msj_question = $(this).data('question');
    const requestPath = window.location.pathname;
    let parentItem = getParentItem($(this));
    const idaux = $(this).data('idaux');
    const elemento_bloque = $(this).data('elemento_bloque');
    const estado = $(this).data('estado') || '';

    if (elemento_bloque) {
        parentItem = $(`${elemento_bloque}`).parent();
    }

    // Determine action type based on current status
    let type;
    if (current_status === 1) {
        type = 'deactivate';
    } else if (current_status === 0) {
        type = 'activate';
    } else if (current_status === 2) { // o el valor que uses para "confirmar"
        type = 'confirm';
    }

    showUnifiedConfirmModal({
        type: type,
        name: name,
        message: msj_question,
        estado: estado,
        onConfirm: function() {
            sendStatusChangeRequest(action, id, current_status, parentItem, requestPath, idaux);
        }
    });
});

// Helper functions (keep your existing implementations)
function getParentItem(element) {
    if (element.closest('.div-item').length > 0) {
        return element.closest('.div-item');
    }

    if (element.closest('tr').length > 0) {
        return element.closest('tr');
    } else if (element.closest('li').length > 0) {
        return element.closest('li');
    }

    return element.parent();
}

function sendStatusChangeRequest(action, id, current_status, parentItem, requestPath, idaux=null) {
    bloqueointerface();

    let data = {
        'action': action,
        'id': id,
        'status': current_status === 1 ? 0 : 1  // Invertimos el estado actual
    };

    if (idaux !== null && idaux !== undefined && idaux !== '') {
        data.idaux = idaux;
    }

    $.ajax({
        type: "POST",
        url: requestPath,
        data: data,
        dataType: "json",
        success: function (data) {
            handleStatusChangeSuccess(data, parentItem);
        },
        error: function(jqXHR, textStatus, errorThrown) {
            $.unblockUI();
            const errorMessage = `Error de conexión: ${textStatus} - ${errorThrown}`;
            abrirnotificacionmodal(errorMessage);
        }
    });
}

function handleStatusChangeSuccess(data, parentItem) {
    $.unblockUI();
    if (data.result === 'ok') {
        location.reload(true);
    } else {
        abrirnotificacionmodal(data.mensaje || 'Error al cambiar el estado');
    }
}

function handleError(jqXHR, textStatus, errorThrown) {
    $.unblockUI();
    const errorMessage = `Error de conexión: ${textStatus} - ${errorThrown}`;
    abrirnotificacionmodal(errorMessage);
}