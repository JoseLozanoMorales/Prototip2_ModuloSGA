/**
 * charts.js — Utilidades compartidas para el sistema de gráficas Chart.js
 * Requiere: Chart.js 4.x, chartjs-plugin-datalabels 2.x, jQuery
 */

// Registrar el plugin globalmente — sin esto Chart.js ignora toda config de datalabels
if (typeof ChartDataLabels !== 'undefined') {
    Chart.register(ChartDataLabels);
}

/* ── Paletas de colores ───────────────────────────────────────── */
window.CHART_PALETTES = {
    // Default: colores institucionales UTEQ extraídos de mantenimientos.css y th_formularios.css
    uteq: {
        label: 'UTEQ',
        colors: [
            '#5bb75b',  // verde principal institucional
            '#17a2b8',  // cyan (botón ver)
            '#dc3545',  // rojo peligro
            '#f0ad4e',  // naranja advertencia
            '#5a32a3',  // morado estados especiales
            '#0066cc',  // azul info
            '#2c3e50',  // azul muy oscuro
            '#2ecc71',  // verde éxito alternativo
            '#cc5200',  // naranja urgencia
            '#198754',  // verde header
        ]
    },
    // Paleta clásica de negocios
    clasica: {
        label: 'Clásica',
        colors: [
            '#2563EB',  // azul
            '#16A34A',  // verde
            '#DC2626',  // rojo
            '#D97706',  // ámbar
            '#7C3AED',  // violeta
            '#0891B2',  // celeste
            '#BE185D',  // rosa
            '#65A30D',  // lima
            '#B45309',  // marrón
            '#6B7280',  // gris
        ]
    },
    // Paleta cálida
    calida: {
        label: 'Cálida',
        colors: [
            '#e72e2e',  // rojo vivo
            '#ff6632',  // naranja
            '#f0ad4e',  // ámbar
            '#ffc107',  // amarillo
            '#cc5200',  // naranja oscuro
            '#d3094e',  // magenta
            '#8932ff',  // morado
            '#795548',  // marrón
            '#e91e63',  // rosa
            '#ff5722',  // naranja profundo
        ]
    },
    // Paleta oceánica
    oceanica: {
        label: 'Oceánica',
        colors: [
            '#182F44',  // azul marino institucional
            '#0066cc',  // azul
            '#17a2b8',  // cyan
            '#0ae489',  // verde brillante
            '#3361ff',  // azul eléctrico
            '#0c5460',  // azul oscuro
            '#198754',  // verde
            '#0891B2',  // celeste
            '#2c3e50',  // azul noche
            '#1a2232',  // azul muy oscuro
        ]
    }
};

// Paleta activa — se puede cambiar con window.setChartPalette('nombre')
window.CHART_ACTIVE_PALETTE = 'uteq';

window.CHART_COLORS = {
    get palette() { return window.CHART_PALETTES[window.CHART_ACTIVE_PALETTE].colors; }
};

window.setChartPalette = function(name) {
    if (!window.CHART_PALETTES[name]) return;
    window.CHART_ACTIVE_PALETTE = name;
    if (!window.CHART_COORDINATOR) return;
    var coord = window.CHART_COORDINATOR;
    // Liberar _pending y disparar un fetch por endpoint
    var fetched = {};
    Object.keys(coord._registry).forEach(function(endpoint) {
        coord._pending[endpoint] = false;
        if (fetched[endpoint]) return;
        fetched[endpoint] = true;
        var widgets = coord._registry[endpoint] || [];
        if (widgets.length && typeof window['fetchChart_' + widgets[0]] === 'function') {
            window['fetchChart_' + widgets[0]]();
        }
    });
};

/* ── Formatos de valores ──────────────────────────────────────── */
window.fmtMoney = function(v) {
    return '$ ' + parseFloat(v || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

window.fmtNumber = function(v) {
    return parseFloat(v || 0).toLocaleString('es-EC');
};

window.fmtPercent = function(v) {
    return parseFloat(v || 0).toFixed(1) + '%';
};

/* ── KPI: renderiza tarjetas en un contenedor ─────────────────── */
// tendencia: 'up' (verde/bueno) | 'down' (rojo/malo) | 'neutral' o ausente (azul)
window.renderKpis = function(containerId, kpis) {
    var $c = $('#' + containerId).empty();
    (kpis || []).forEach(function(k) {
        var trendClass = '';
        var trendIcon  = '';
        if (k.tendencia === 'up') {
            trendClass = 'kpi-trend-up';
            trendIcon  = '<i class="fa fa-arrow-up kpi-trend-icon"></i>';
        } else if (k.tendencia === 'down') {
            trendClass = 'kpi-trend-down';
            trendIcon  = '<i class="fa fa-arrow-down kpi-trend-icon"></i>';
        }
        $c.append(
            '<div class="kpi-card kpi-card-accent ' + trendClass + '">' +
                '<div class="kpi-label">' +
                    (k.icono ? '<i class="fa ' + k.icono + '"></i>' : '') +
                    (k.label || '') +
                '</div>' +
                '<div class="kpi-value">' +
                    (k.valor || '—') +
                    trendIcon +
                '</div>' +
                (k.sub ? '<div class="kpi-sub">' + k.sub + '</div>' : '') +
            '</div>'
        );
    });
};

/* ── Semáforo: renderiza indicadores de 3 estados en un contenedor ── */
// estado: 'verde' (aprobado) | 'amarillo' (pendiente) | 'rojo' (rechazado / sin registrar)
window.renderSemaforos = function(containerId, semaforos) {
    var $c = $('#' + containerId).empty();
    (semaforos || []).forEach(function(s) {
        $c.append(
            '<div class="semaforo-item">' +
                '<div class="semaforo" data-estado="' + (s.estado || 'rojo') + '">' +
                    '<span class="semaforo-luz semaforo-luz-rojo"></span>' +
                    '<span class="semaforo-luz semaforo-luz-amarillo"></span>' +
                    '<span class="semaforo-luz semaforo-luz-verde"></span>' +
                '</div>' +
                '<div>' +
                    '<div class="semaforo-item-label">' + (s.label || '') + '</div>' +
                    '<div class="semaforo-item-valor">' + (s.valor || '') + '</div>' +
                '</div>' +
            '</div>'
        );
    });
};

/* ── Helper datalabels por tipo de gráfica ───────────────────── */
window._dlabels = function(type, fmtFn) {
    // display: true si CHART_SHOW_VALUES, false si no (se activan solo al exportar)
    var show = window.CHART_SHOW_VALUES !== false;
    var fmt  = fmtFn || null;

    if (type === 'barH') {
        return {
            display: show,
            // 'start' + 'end' = dentro de la barra alineado a la derecha — nunca se corta
            anchor: 'end',
            align: 'start',
            clamp: true,
            clip: false,
            color: '#fff',
            font: { size: 10, weight: '700' },
            formatter: fmt || function(v) { return window.fmtNumber(v); },
            padding: { right: 6 }
        };
    }
    if (type === 'bar' || type === 'barStacked') {
        return {
            display: show,
            anchor: 'end',
            align: 'end',
            clamp: true,
            clip: false,
            color: '#374151',
            font: { size: 10, weight: '600' },
            formatter: fmt || function(v) { return window.fmtNumber(v); },
            padding: { bottom: 2 }
        };
    }
    if (type === 'line' || type === 'area') {
        return {
            display: show,
            align: 'top',
            offset: 6,
            color: '#374151',
            font: { size: 10, weight: '600' },
            formatter: fmt || function(v) { return window.fmtNumber(v); }
        };
    }
    if (type === 'pie' || type === 'doughnut') {
        return {
            display: show,
            color: '#fff',
            font: { size: 11, weight: '700' },
            textShadowBlur: 3,
            textShadowColor: 'rgba(0,0,0,0.4)',
            formatter: fmt || function(v, ctx) {
                var total = ctx.dataset.data.reduce(function(a, b) { return a + b; }, 0);
                return total > 0 ? (v * 100 / total).toFixed(1) + '%' : '';
            }
        };
    }
    return { display: false };
};

/* ── Activar/desactivar datalabels en todos los charts (para exportar) ── */
window._setAllDatalabelsDisplay = function(display) {
    if (!window.CHART_COORDINATOR) return;
    Object.keys(window.CHART_COORDINATOR._registry).forEach(function(endpoint) {
        (window.CHART_COORDINATOR._registry[endpoint] || []).forEach(function(wName) {
            var canvas = document.getElementById('canvas_' + wName);
            if (!canvas) return;
            var chart = typeof Chart !== 'undefined' && Chart.getChart(canvas);
            if (!chart) return;
            chart.data.datasets.forEach(function(ds) {
                if (ds.datalabels) ds.datalabels.display = display;
            });
            if (chart.options.plugins && chart.options.plugins.datalabels) {
                chart.options.plugins.datalabels.display = display;
            }
            chart.update('none');  // 'none' = sin animación
        });
    });
};

/* ── Presets de formato por tipo de dato ──────────────────────── */
// Uso: chartDefaults.bar(labels, datasets, { _fmt: 'money' })
// Configura automáticamente datalabel, tooltip y axis tick con el mismo formatter.
window.CHART_FMT = {
    money: {
        datalabel: function(v) { return window.fmtMoney(v); },
        tooltip:   function(v, label) { return ' ' + (label ? label + ': ' : '') + window.fmtMoney(v); },
        axisTick:  function(v) { return window.fmtMoney(v); }
    },
    number: {
        datalabel: function(v) { return window.fmtNumber(v); },
        tooltip:   function(v, label) { return ' ' + (label ? label + ': ' : '') + window.fmtNumber(v); },
        axisTick:  function(v) { return window.fmtNumber(v); }
    },
    percent: {
        datalabel: function(v) { return window.fmtPercent(v); },
        tooltip:   function(v, label) { return ' ' + (label ? label + ': ' : '') + window.fmtPercent(v); },
        axisTick:  function(v) { return window.fmtPercent(v); }
    },
    integer: {
        datalabel: function(v) { return v > 0 ? String(v) : ''; },
        tooltip:   function(v, label) { return ' ' + (label ? label + ': ' : '') + v; },
        axisTick:  function(v) { return Number.isInteger(v) ? v : ''; },
        axisOpts:  { stepSize: 1, beginAtZero: false }
    }
};

// Helper interno: extrae _fmt y _fmtDatalabel de opts y construye presetOpts.
// Merge order en chartDefaults: defaults < presetOpts < opts  (opts siempre gana).
function _applyFmt(opts, type) {
    var preset = (opts && opts._fmt) ? window.CHART_FMT[opts._fmt] : null;
    if (opts) delete opts._fmt;

    // En doughnut/pie el datalabel por defecto es porcentaje — el preset no lo sobreescribe
    var presetDl = (type !== 'doughnut' && type !== 'pie') ? (preset && preset.datalabel) : null;
    var fmtDl = (opts && opts._fmtDatalabel) || presetDl || null;
    if (opts) delete opts._fmtDatalabel;

    var presetOpts = {};
    if (preset) {
        presetOpts.plugins = { tooltip: { callbacks: {
            label: function(ctx) { return preset.tooltip(ctx.raw, ctx.dataset.label); }
        }}};
        if (type !== 'doughnut' && type !== 'pie') {
            var axisKey = (type === 'barH') ? 'x' : 'y';
            var tickCfg = { font: { size: 10 }, callback: preset.axisTick };
            if (preset.axisOpts) Object.assign(tickCfg, preset.axisOpts);
            var axisCfg = { ticks: tickCfg };
            if (preset.axisOpts && preset.axisOpts.beginAtZero === false) {
                axisCfg.beginAtZero = false;
            }
            presetOpts.scales = {};
            presetOpts.scales[axisKey] = axisCfg;
        }
    }
    return { fmtDl: fmtDl, presetOpts: presetOpts };
}

/* ── Escala logarítmica opcional ──────────────────────────────── */
// Se activa solo cuando el backend envía logScale:true en al menos un dataset.
function _applyLogScale(cfg, datasets) {
    var needsLog = datasets.some(function(ds) { return ds.logScale === true; });
    if (!needsLog) return cfg;
    var axisKey = (cfg.options.indexAxis === 'y') ? 'x' : 'y';
    cfg.options.scales = cfg.options.scales || {};
    cfg.options.scales[axisKey] = Object.assign(cfg.options.scales[axisKey] || {}, {
        type: 'logarithmic',
        ticks: {
            callback: function(v) {
                return Number.isInteger(Math.log10(v)) ? window.fmtMoney(v) : '';
            }
        }
    });
    return cfg;
}

/* ── Opciones Chart.js reutilizables ──────────────────────────── */
window.chartDefaults = {

    /* Barras verticales agrupadas */
    bar: function(labels, datasets, opts) {
        var pal = window.CHART_COLORS.palette;
        var res = _applyFmt(opts, 'bar');
        var dl  = window._dlabels('bar', res.fmtDl);
        var cfg = {
            type: 'bar',
            data: {
                labels: labels,
                datasets: datasets.map(function(ds, i) {
                    return {
                        label: ds.label,
                        data: ds.data,
                        backgroundColor: ds.color || pal[i % pal.length],
                        borderRadius: 4,
                        borderSkipped: false,
                        datalabels: dl
                    };
                })
            },
            options: Object.assign({
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', labels: { font: { size: 11 } } },
                    datalabels: { display: false }  // el control va en dataset.datalabels
                },
                scales: {
                    x: { grid: { display: false }, ticks: { font: { size: 11 } } },
                    y: { beginAtZero: true, ticks: { font: { size: 11 } } }
                }
            }, res.presetOpts, opts || {})
        };
        return _applyLogScale(cfg, datasets);
    },

    /* Barras horizontales — un color por barra cuando hay un solo dataset */
    barH: function(labels, datasets, opts) {
        var pal    = window.CHART_COLORS.palette;
        var single = datasets.length === 1;
        var res    = _applyFmt(opts, 'barH');
        var dl     = window._dlabels('barH', res.fmtDl);
        var cfg = {
            type: 'bar',
            data: {
                labels: labels,
                datasets: datasets.map(function(ds, i) {
                    var bgColor = single
                        ? (ds.colors || labels.map(function(_, j) { return pal[j % pal.length]; }))
                        : (ds.color || pal[i % pal.length]);
                    return {
                        label: ds.label,
                        data: ds.data,
                        backgroundColor: bgColor,
                        borderRadius: 4,
                        borderSkipped: false,
                        datalabels: dl
                    };
                })
            },
            options: Object.assign({
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    datalabels: { display: false }
                },
                scales: {
                    x: { beginAtZero: true, ticks: { font: { size: 11 } } },
                    y: { grid: { display: false }, ticks: { font: { size: 11 } } }
                }
            }, res.presetOpts, opts || {})
        };
        return _applyLogScale(cfg, datasets);
    },

    /* Barras apiladas */
    barStacked: function(labels, datasets, opts) {
        var cfg = window.chartDefaults.bar(labels, datasets, opts);
        cfg.options.scales.x = Object.assign(cfg.options.scales.x || {}, { stacked: true });
        cfg.options.scales.y = Object.assign(cfg.options.scales.y || {}, { stacked: true });
        return cfg;
    },

    /* Líneas */
    line: function(labels, datasets, opts) {
        var pal = window.CHART_COLORS.palette;
        var res = _applyFmt(opts, 'line');
        var dl  = window._dlabels('line', res.fmtDl);
        var cfg = {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets.map(function(ds, i) {
                    var color = ds.color || pal[i % pal.length];
                    return {
                        label: ds.label,
                        data: ds.data,
                        borderColor: color,
                        backgroundColor: color + '22',
                        tension: ds.tension !== undefined ? ds.tension : 0,
                        fill: ds.fill || false,
                        pointRadius: ds.pointRadius !== undefined ? ds.pointRadius : 3,
                        borderWidth: 2,
                        datalabels: dl
                    };
                })
            },
            options: Object.assign({
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', labels: { font: { size: 11 } } },
                    datalabels: { display: false }
                },
                scales: {
                    x: { grid: { display: false }, ticks: { font: { size: 11 } } },
                    y: { beginAtZero: true, ticks: { font: { size: 11 } } }
                }
            }, res.presetOpts, opts || {})
        };
        return _applyLogScale(cfg, datasets);
    },

    /* Doughnut */
    doughnut: function(labels, data, colors, opts) {
        var res = _applyFmt(opts, 'doughnut');
        var dl  = window._dlabels('doughnut', res.fmtDl);
        return {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{ data: data, backgroundColor: colors || window.CHART_COLORS.palette.slice(), datalabels: dl }]
            },
            options: Object.assign({
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right', labels: { font: { size: 11 }, boxWidth: 12 } },
                    datalabels: { display: false }
                }
            }, res.presetOpts, opts || {})
        };
    },

    /* Pie */
    pie: function(labels, data, colors, opts) {
        var cfg = window.chartDefaults.doughnut(labels, data, colors, opts);
        cfg.type = 'pie';
        return cfg;
    },

    /* Área (líneas con fill) */
    area: function(labels, datasets, opts) {
        var ds = datasets.map(function(d) {
            return Object.assign({}, d, { fill: true });
        });
        return window.chartDefaults.line(labels, ds, opts);
    }
};

/* ── Helper: colores con opacidad ────────────────────────────── */
window.chartColor = function(hex, alpha) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + (alpha || 1) + ')';
};

/* ── Exportar gráfica individual ─────────────────────────────── */
// widgetName  : id del widget
// fileName    : nombre del archivo descargado (sin extensión)
// exportTitle : título que aparece sobre la imagen (vacío = sin título)
window._chartExportWidget = function(widgetName, fileName, exportTitle) {
    var canvas = document.getElementById('canvas_' + widgetName);
    if (!canvas) return;
    var chart = typeof Chart !== 'undefined' && Chart.getChart(canvas);
    if (!chart) return;

    var needsLabelToggle = (window.CHART_SHOW_VALUES === false);

    function doCapture() {
        // Forzar redibujado síncrono completo
        chart.stop();
        chart.draw();

        // canvas.width/height son píxeles físicos reales (ya incluyen devicePixelRatio)
        var cW = canvas.width;
        var cH = canvas.height;

        // Padding y título en píxeles físicos (mismo espacio visual que ~20px en pantalla)
        var dpr     = window.devicePixelRatio || 1;
        var PADDING = Math.round(20 * dpr);
        var TITLE_H = exportTitle ? Math.round(38 * dpr) : 0;
        var FONT_SZ = Math.round(14 * dpr);

        var tmp    = document.createElement('canvas');
        tmp.width  = cW + PADDING * 2;
        tmp.height = cH + PADDING * 2 + TITLE_H;
        var ctx    = tmp.getContext('2d');

        // Sin interpolación — copia pixel-perfect
        ctx.imageSmoothingEnabled = false;

        // Fondo blanco
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, tmp.width, tmp.height);

        // Título (proporcional a dpr para que se vea igual que el resto)
        if (exportTitle) {
            ctx.fillStyle    = '#1f2937';
            ctx.font         = 'bold ' + FONT_SZ + 'px system-ui, Arial, sans-serif';
            ctx.textAlign    = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(exportTitle, PADDING, PADDING + TITLE_H / 2);
        }

        // Copiar el canvas del chart 1:1 sin reescalar — calidad máxima
        ctx.drawImage(canvas, PADDING, PADDING + TITLE_H);

        var dataUrl = tmp.toDataURL('image/png', 1.0);

        // Restaurar estado original de labels y redibujar
        if (needsLabelToggle) {
            chart.data.datasets.forEach(function(ds) {
                if (ds.datalabels) ds.datalabels.display = false;
            });
            chart.draw();
        }

        var safeName = (fileName || widgetName)
            .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s\-_]/g, '')
            .trim().replace(/\s+/g, '_');
        var link = document.createElement('a');
        link.download = safeName + '.png';
        link.href     = dataUrl;
        link.click();
    }

    if (needsLabelToggle) {
        // Activar labels, esperar al siguiente frame pintado, luego capturar
        chart.data.datasets.forEach(function(ds) {
            if (ds.datalabels) ds.datalabels.display = true;
        });
        chart.draw();
        requestAnimationFrame(function() {
            requestAnimationFrame(doCapture);  // dos frames: draw + composite
        });
    } else {
        requestAnimationFrame(doCapture);
    }
};

/* ── Exportar todas las gráficas de la página ────────────────── */
window._chartExportAll = function() {
    if (!window.CHART_COORDINATOR) return;
    var allWidgets = [];
    Object.values(window.CHART_COORDINATOR._registry).forEach(function(widgets) {
        widgets.forEach(function(w) {
            if (allWidgets.indexOf(w) === -1) allWidgets.push(w);
        });
    });
    if (!allWidgets.length) return;

    // Exportar una por una — _chartExportWidget ya maneja el toggle de labels
    allWidgets.forEach(function(wName, idx) {
        setTimeout(function() {
            var canvas = document.getElementById('canvas_' + wName);
            if (!canvas || canvas.style.display === 'none') return;
            var title = $('#widget_' + wName + ' .chart-card-title').text().trim() || wName;
            window._chartExportWidget(wName, title, title);
        }, idx * 350);
    });
};
