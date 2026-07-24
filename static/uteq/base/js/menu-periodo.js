document.addEventListener('DOMContentLoaded', function() {

    const periodBtn = document.getElementById('periodBtn');
    const periodDropdown = document.getElementById('periodDropdown');
    const periodOverlay = document.getElementById('periodOverlay');
    const periodCloseBtn = document.getElementById('periodCloseBtn');
    const periodSearchInput = document.getElementById('periodSearchInput');
    const periodList = document.getElementById('periodList');

    // Verificar que todos los elementos existen
    if (!periodBtn || !periodDropdown || !periodOverlay) {
        return;
    }

    function openDropdown() {
        periodDropdown.classList.add('show');
        periodOverlay.classList.add('show');
        periodBtn.classList.add('active');
        if (periodSearchInput) {
            setTimeout(() => periodSearchInput.focus(), 100);
        }
    }

    function closeDropdown() {
        periodDropdown.classList.remove('show');
        periodOverlay.classList.remove('show');
        periodBtn.classList.remove('active');
        if (periodSearchInput) {
            periodSearchInput.value = '';
            filterPeriods('');
        }
    }

    // Event listener para el botón principal
    periodBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();

        if (periodDropdown.classList.contains('show')) {
            closeDropdown();
        } else {
            openDropdown();
        }
    });

    // Event listener para el botón de cerrar
    if (periodCloseBtn) {
        periodCloseBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            closeDropdown();
        });
    }

    // Event listener para el overlay
    periodOverlay.addEventListener('click', function() {
        closeDropdown();
    });

    // Prevenir que clics dentro del dropdown lo cierren
    periodDropdown.addEventListener('click', function(e) {
        e.stopPropagation();
    });

    // Cerrar con tecla Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && periodDropdown.classList.contains('show')) {
            closeDropdown();
        }
    });

    // Función de filtrado
    function filterPeriods(searchTerm) {
        if (!periodSearchInput) return;

        const items = periodList.querySelectorAll('.period-item');
        const groups = periodList.querySelectorAll('.period-group');
        let visibleCount = 0;

        items.forEach(function(item) {
            const periodName = item.dataset.periodName.toLowerCase();
            const matches = periodName.includes(searchTerm.toLowerCase());
            item.style.display = matches ? 'flex' : 'none';
            if (matches) visibleCount++;
        });

        groups.forEach(function(group) {
            const visibleItems = Array.from(group.querySelectorAll('.period-item'))
                .filter(function(item) { return item.style.display !== 'none'; }).length;
            group.style.display = visibleItems > 0 ? 'block' : 'none';
        });

        const existingNoResults = periodList.querySelector('.period-no-results');
        if (existingNoResults) existingNoResults.remove();

        if (visibleCount === 0 && searchTerm) {
            const noResults = document.createElement('div');
            noResults.className = 'period-no-results';
            noResults.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg><div>No se encontraron períodos para "' + searchTerm + '"</div>';
            periodList.appendChild(noResults);
        }
    }

    // Event listener para el buscador
    if (periodSearchInput) {
        periodSearchInput.addEventListener('input', function() {
            filterPeriods(this.value);
        });
    }

    // Manejador de clics para seleccionar períodos
    periodList.addEventListener('click', function(e) {
        const csrftoken = getCookie('csrftoken');
        const item = e.target.closest('.period-item');
        if (item && !item.classList.contains('active')) {
            const periodId = item.dataset.periodId;
            const periodName = item.dataset.periodName;

            // Actualizar UI inmediatamente
            periodList.querySelectorAll('.period-item').forEach(function (i) {
                i.classList.remove('active');
            });
            item.classList.add('active');

            periodBtn.querySelector('.period-btn-text').textContent = periodName;
            closeDropdown();

            fetch(`/cambiarperiodo?id=${periodId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrftoken // Necesario para la función @csrf_protect
                },
                // Como request.GET se usa en Django, el body puede ser vacío o simple
                body: JSON.stringify({})
            })
                .then(response => response.json())
                .then(data => {
                    if (data.result === 'ok') {
                        location.href = location.pathname;
                    } else {
                        abrirnotificacionmodal('Hubo un error al cambiar el período: ' + data.mensaje);
                        // Opcional: Revertir la UI si la operación falló
                        // window.location.reload();
                    }
                })
                .catch(error => {
                    abrirnotificacionmodal('Error de conexión al intentar cambiar el período.');
                });
        }
    });
});