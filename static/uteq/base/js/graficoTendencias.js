/**
 * ========================================================================
 * 📊 GRÁFICO DE TENDENCIAS MULTI-AÑO - COMPONENTE REUTILIZABLE
 * ========================================================================
 *
 * @version 2.0
 * @author Equipo de Desarrollo UTEQ
 *
 * ========================================================================
 * ¿QUÉ HACE ESTE COMPONENTE?
 * ========================================================================
 * Crea gráficos de líneas que comparan datos del mismo mes entre diferentes
 * años. Cada año tiene su propia línea con un color diferente.
 *
 * CARACTERÍSTICAS:
 * ✅ Carga Chart.js automáticamente (no necesitas incluirlo manualmente)
 * ✅ Genera colores automáticamente para cualquier cantidad de años
 * ✅ Fácil de usar: solo envía tus datos y listo
 * ✅ Personalizable con opciones
 *
 * ========================================================================
 * 💡 CÓMO USAR (3 PASOS)
 * ========================================================================
 *
 * PASO 1: Incluir este archivo en tu template
 * ------------------------------------------
 * En el {% block heading %}:
 *
 *   <script src="/static/uteq/base/js/graficoTendencias.js"></script>
 *
 * ⚠️ IMPORTANTE: NO incluyas Chart.js manualmente, este componente lo hace.
 *
 *
 * PASO 2: Crear un canvas en tu HTML
 * -----------------------------------
 *
 *   <canvas id="miGrafico"></canvas>
 *
 *
 * PASO 3: Preparar datos en el backend (Python/Django)
 * -----------------------------------------------------
 * En tu views.py:
 *
 *   import json
 *
 *   datos_grafico = {
 *       'labels': ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'],
 *       'datasets': [
 *           {'year': 2024, 'data': [10, 20, 15, 25, 30, 28]},
 *           {'year': 2025, 'data': [12, 22, 18, 28, 35, 32]}
 *       ]
 *   }
 *
 *   context['datos_grafico_json'] = json.dumps(datos_grafico)
 *
 *
 * PASO 4: Renderizar el gráfico en tu template
 * ---------------------------------------------
 * En el {% block moreblock %} o al final:
 *
 *   <script>
 *       document.addEventListener('DOMContentLoaded', async function() {
 *           const datos = {{ datos_grafico_json|safe }};
 *           await createMultiYearChart('miGrafico', datos);
 *       });
 *   </script>
 *
 * ¡Y LISTO! 🎉
 *
 * ========================================================================
 * 📚 EJEMPLO COMPLETO
 * ========================================================================
 *
 * Backend (views.py):
 * -------------------
 * def dashboard(request):
 *     datos = {
 *         'labels': ['Ene', 'Feb', 'Mar'],
 *         'datasets': [
 *             {'year': 2024, 'data': [100, 150, 120]},
 *             {'year': 2025, 'data': [110, 160, 130]}
 *         ]
 *     }
 *     context = {'datos_json': json.dumps(datos)}
 *     return render(request, 'template.html', context)
 *
 *
 * Template (template.html):
 * -------------------------
 * {% block heading %}
 *     <script src="/static/uteq/base/js/graficoTendencias.js"></script>
 * {% endblock %}
 *
 * {% block canvas %}
 *     <h2>Mi Dashboard</h2>
 *     <canvas id="ventasChart"></canvas>
 * {% endblock %}
 *
 * {% block moreblock %}
 *     <script>
 *         document.addEventListener('DOMContentLoaded', async function() {
 *             const datos = {{ datos_json|safe }};
 *             await createMultiYearChart('ventasChart', datos);
 *         });
 *     </script>
 * {% endblock %}
 *
 * ========================================================================
 * 🎨 PERSONALIZACIÓN (OPCIONAL)
 * ========================================================================
 *
 * Puedes personalizar el gráfico con opciones:
 *
 *   await createMultiYearChart('miGrafico', datos, {
 *       colorOffset: 200,        // Color inicial (0-360)
 *       fillArea: true,          // Rellenar área (true/false)
 *       tension: 0.4,            // Curvatura de líneas (0-1)
 *       tooltipLabel: 'ventas'   // Texto en tooltip
 *   });
 *
 * VALORES DE colorOffset:
 *   0   = Rojo
 *   120 = Verde
 *   200 = Azul (recomendado por defecto)
 *   280 = Morado
 *
 * ========================================================================
 * 🔧 FUNCIONES DISPONIBLES
 * ========================================================================
 *
 * 1. createMultiYearChart(canvasId, data, options)
 *    - Crea un gráfico con datos ya organizados por año
 *    - Parámetros:
 *      • canvasId: ID del elemento canvas (string)
 *      • data: Objeto con labels y datasets (object)
 *      • options: Configuración opcional (object)
 *
 * 2. createMultiYearChartFromRaw(canvasId, rawData, options)
 *    - Crea un gráfico desde datos crudos (procesa automáticamente)
 *    - Parámetros:
 *      • canvasId: ID del elemento canvas (string)
 *      • rawData: Array de {fecha: 'YYYY-MM-DD', valor: number}
 *      • options: Configuración opcional (object)
 *
 * ========================================================================
 * ❓ PREGUNTAS FRECUENTES
 * ========================================================================
 *
 * Q: ¿Puedo tener más de 2 años?
 * A: Sí, puedes tener todos los años que necesites. Los colores se
 *    generan automáticamente.
 *
 * Q: ¿Los meses deben ser siempre 12?
 * A: No, puedes mostrar solo los meses con datos. Ejemplo: ['May','Jun','Jul']
 *
 * Q: ¿Qué pasa si un año no tiene datos para un mes?
 * A: Coloca 0 en ese mes: [10, 0, 15, 20]
 *
 * Q: ¿Necesito incluir Chart.js?
 * A: NO. Este componente lo carga automáticamente. Si lo incluyes
 *    manualmente causará conflictos.
 *
 * Q: El gráfico no aparece, ¿qué hago?
 * A: Verifica:
 *    1. Que el ID del canvas coincida con el usado en createMultiYearChart
 *    2. Que estés usando await antes de createMultiYearChart
 *    3. Que los datos estén en formato correcto
 *    4. Que estés usando {{ datos|safe }} en el template
 *
 */

(function(window) {
    'use strict';

    // URLs de las librerías
    const CHART_JS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js';
    const DATALABELS_URL = 'https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2';

    /**
     * Carga un script de forma dinámica
     */
    function loadScript(url) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Error al cargar: ${url}`));
            document.head.appendChild(script);
        });
    }

    /**
     * Inicializa las dependencias necesarias
     */
    async function initDependencies() {
        // Verificar si Chart.js ya está cargado
        if (typeof Chart === 'undefined') {
            // console.log('📦 Cargando Chart.js...');
            await loadScript(CHART_JS_URL);
            // console.log('✅ Chart.js cargado');
        }

        // Cargar plugin de datalabels (opcional, no detiene si falla)
        if (typeof ChartDataLabels === 'undefined') {
            try {
                await loadScript(DATALABELS_URL);
                if (typeof ChartDataLabels !== 'undefined') {
                    Chart.register(ChartDataLabels);
                }
            } catch (e) {
                // No es crítico, continuar sin datalabels
            }
        }
    }

    /**
     * Genera colores HSL dinámicamente
     */
    function generateColor(index, total, offset = 200) {
        const hue = (offset + (index * 360 / Math.max(total, 1))) % 360;
        const saturation = 65 + (index % 3) * 10;
        const lightness = 50 + (index % 2) * 5;

        return {
            border: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
            bg: `hsla(${hue}, ${saturation}%, ${lightness}%, 0.1)`
        };
    }

    /**
     * Crea el gráfico (función interna)
     */
    function createChart(canvasId, data, options) {
        const canvas = document.getElementById(canvasId);

        if (!canvas) {
            console.error(`❌ Canvas con ID "${canvasId}" no encontrado`);
            return null;
        }

        const ctx = canvas.getContext('2d');

        // Configuración por defecto
        const config = {
            colorOffset: 200,
            fillArea: true,
            tension: 0.4,
            pointRadius: 5,
            showLegend: true,
            legendPosition: 'bottom',
            tooltipLabel: 'notificaciones',
            ...options
        };

        const totalYears = data.datasets.length;

        // Crear datasets para Chart.js
        const chartDatasets = data.datasets.map((yearData, index) => {
            const colors = generateColor(index, totalYears, config.colorOffset);

            return {
                label: `Año ${yearData.year}`,
                data: yearData.data,
                borderColor: colors.border,
                backgroundColor: config.fillArea ? colors.bg : 'transparent',
                tension: config.tension,
                fill: config.fillArea,
                pointRadius: config.pointRadius,
                pointHoverRadius: config.pointRadius + 3,
                pointBackgroundColor: colors.border,
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                borderWidth: 2.5,
                spanGaps: false
            };
        });

        // Crear el gráfico
        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: chartDatasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        display: config.showLegend,
                        position: config.legendPosition,
                        labels: {
                            padding: 12,
                            font: { size: 12 },
                            usePointStyle: true,
                            pointStyle: 'circle',
                            color: '#64748b'
                        },
                        maxHeight: totalYears > 8 ? 80 : undefined
                    },
                    datalabels: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: 12,
                        borderRadius: 6,
                        titleFont: { size: 13, weight: 'bold' },
                        bodyFont: { size: 12 },
                        callbacks: {
                            title: (context) => context[0].label,
                            label: (context) => {
                                const value = context.parsed.y;
                                if (value === 0) return null;
                                return `${context.dataset.label}: ${value} ${config.tooltipLabel}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: '#64748b',
                            font: { size: 11 },
                            precision: 0
                        },
                        grid: {
                            color: '#e2e8f0',
                            drawBorder: false
                        }
                    },
                    x: {
                        ticks: {
                            color: '#64748b',
                            font: { size: 11 }
                        },
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });

        // console.log(`✅ Gráfico multi-año creado en #${canvasId} con ${totalYears} año(s)`);
        return chart;
    }

    /**
     * Función pública: Crear gráfico multi-año
     *
     * @param {string} canvasId - ID del elemento canvas
     * @param {Object} data - Datos en formato: {labels: [], datasets: [{year, data}]}
     * @param {Object} options - Opciones personalizadas (opcional)
     * @returns {Promise<Chart>} Promesa que resuelve con la instancia del gráfico
     */
    window.createMultiYearChart = async function(canvasId, data, options = {}) {
        try {
            await initDependencies();
            return createChart(canvasId, data, options);
        } catch (error) {
            console.error('❌ Error al crear el gráfico:', error);
            return null;
        }
    };

    /**
     * Función pública: Crear desde datos crudos
     *
     * @param {string} canvasId - ID del elemento canvas
     * @param {Array} rawData - Array de objetos: [{fecha: 'YYYY-MM-DD', valor: number}]
     * @param {Object} options - Opciones personalizadas (opcional)
     * @returns {Promise<Chart>} Promesa que resuelve con la instancia del gráfico
     */
    window.createMultiYearChartFromRaw = async function(canvasId, rawData, options = {}) {
        const monthNames = {
            1: 'Ene', 2: 'Feb', 3: 'Mar', 4: 'Abr',
            5: 'May', 6: 'Jun', 7: 'Jul', 8: 'Ago',
            9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dic'
        };

        const dataByYear = {};
        const uniqueMonths = new Set();

        // Procesar datos crudos
        rawData.forEach(item => {
            const date = new Date(item.fecha);
            const year = date.getFullYear();
            const month = date.getMonth() + 1;

            if (!dataByYear[year]) {
                dataByYear[year] = {};
            }

            dataByYear[year][month] = (dataByYear[year][month] || 0) + (item.valor || 1);
            uniqueMonths.add(month);
        });

        // Crear estructura de datos
        const sortedMonths = Array.from(uniqueMonths).sort((a, b) => a - b);
        const labels = sortedMonths.map(m => monthNames[m]);

        const years = Object.keys(dataByYear).sort();
        const datasets = years.map(year => ({
            year: parseInt(year),
            data: sortedMonths.map(month => dataByYear[year][month] || 0)
        }));

        // Crear el gráfico
        return await window.createMultiYearChart(canvasId, { labels, datasets }, options);
    };

    // Auto-inicializar cuando el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            // console.log('📊 Multi-Year Chart listo');
        });
    } else {
        // console.log('📊 Multi-Year Chart listo');
    }

})(window);