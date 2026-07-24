// static/js/async-components.js
class ComponentManager {
    reloadComponent(componentId) {
        const container = document.getElementById(componentId);
        if (!container) return;

        const originalUrl = container.dataset.componentUrl;
        container.innerHTML = '<div class="async-component-loading"><i class="fa fa-spinner fa-spin"></i> Recargando...</div>';

        fetch(originalUrl)
            .then(response => response.text())
            .then(html => {
                container.innerHTML = html;

                // Disparar evento de componente cargado
                const componentLoadedEvent = new CustomEvent('ComponenteCargado', {
                    detail: {
                        containerId: componentId,
                        componentUrl: originalUrl
                    }
                });
                document.dispatchEvent(componentLoadedEvent);

                // Ejecutar scripts
                const scripts = container.querySelectorAll('script');
                scripts.forEach(script => {
                    const newScript = document.createElement('script');
                    Array.from(script.attributes).forEach(attr => {
                        newScript.setAttribute(attr.name, attr.value);
                    });
                    newScript.textContent = script.textContent;
                    script.parentNode.replaceChild(newScript, script);
                });
            })
            .catch(error => {
                console.error('Error reloading component:', error);
                container.innerHTML = '<div class="async-component-error">Error al recargar el componente</div>';
            });
    }
}

window.componentManager = new ComponentManager();