// Global state
let map;
let markers = [];
let geoJsonData = [];
let allIncendios = [];
let evolutionChart, regionChart;

// Data endpoint. Absolute so /incendios (sin barra) y /incendios/ funcionan igual.
const DATA_URL = '/incendios/data/incendios.json';

// NASA FIRMS entrega acq_time como "HHMM" (p.ej. "0645"), formato que
// new Date() no puede parsear de forma consistente. Devolvemos un Date
// válido a partir de acq_date + acq_time.
function parseAcq(props) {
    const dateStr = props.acq_date || '';
    const rawTime = String(props.acq_time || '0000').padStart(4, '0');
    const hh = rawTime.slice(0, 2);
    const mm = rawTime.slice(2, 4);
    // ISO local, sin zona: el navegador lo interpreta como hora local, que
    // es suficientemente bueno para el filtrado "últimos N días".
    return new Date(`${dateStr}T${hh}:${mm}:00`);
}

// Map init
function initMap() {
    map = L.map('map', {
        center: [40.46, -3.75],
        zoom: 6,
        minZoom: 4,
        maxZoom: 16
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);

    addSpainBoundary();
}

// Fetch and load data
async function loadIncendios() {
    try {
        // Cache-bust so the browser (y el CDN si lo hay) no sirvan un JSON viejo tras el cron.
        const response = await fetch(DATA_URL + '?t=' + Date.now(), { cache: 'no-store' });
        if (!response.ok) throw new Error('HTTP ' + response.status + ' cargando ' + DATA_URL);

        const data = await response.json();
        allIncendios = data.features || [];

        clearAlerts();
        updateTimestamp(data.timestamp);

        // Si el backend devolvió count:0 con errores, avisar en pantalla.
        if (allIncendios.length === 0 && Array.isArray(data.errors) && data.errors.length > 0) {
            showAlert('Sin datos NASA FIRMS en este momento (' + data.errors.join(', ') + '). Reintentando…', 'warning');
        }

        filterAndRender();
        updateStats();
        updateCharts();

    } catch (error) {
        console.error('Error loading data:', error);
        showAlert('No se pudo cargar ' + DATA_URL + ' — ' + error.message + '. Reintentando en 30s…', 'error');
        setTimeout(loadIncendios, 30000);
    }
}

// Filter data based on controls
function filterIncendios() {
    const region = document.getElementById('regionFilter').value.toLowerCase();
    const days = parseInt(document.getElementById('daysFilter').value);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return allIncendios.filter(feature => {
        const props = feature.properties;
        const date = parseAcq(props);
        if (isNaN(date)) return false;

        let match = date >= cutoffDate;

        if (region && props.region) {
            match = match && props.region.toLowerCase().includes(region);
        }

        return match;
    });
}

// Render filtered data
function filterAndRender() {
    const filtered = filterIncendios();

    markers.forEach(m => map.removeLayer(m));
    markers = [];

    filtered.forEach(feature => {
        const props = feature.properties;
        const coords = feature.geometry.coordinates;

        const color = getConfidenceColor(props.confidence);
        const size = Math.min(props.frp || 100, 500) / 100;

        const marker = L.circleMarker([coords[1], coords[0]], {
            radius: 4 + size,
            fillColor: color,
            color: color,
            weight: 1,
            opacity: 0.8,
            fillOpacity: 0.6
        }).addTo(map);

        marker.bindPopup(`
            <div style="font-size: 0.9rem;">
                <strong>${props.acq_date} ${props.acq_time}</strong><br>
                Potencia: <strong>${(props.frp || 0).toFixed(1)} MW</strong><br>
                Confianza: <strong>${props.confidence}</strong><br>
                Sensor: ${props.instrument}<br>
                <a href="https://maps.google.com/?q=${coords[1]},${coords[0]}" target="_blank">Ver en Maps</a>
            </div>
        `);

        markers.push(marker);
    });

    updateTable(filtered);
}

function getConfidenceColor(confidence) {
    const conf = confidence?.toLowerCase();
    if (conf === 'high') return '#f38ba8';
    if (conf === 'medium') return '#f9e2af';
    return '#bac2de';
}

function updateStats() {
    const filtered = filterIncendios();

    document.getElementById('activeCount').textContent = filtered.length;

    const totalFRP = filtered.reduce((sum, f) => sum + (f.properties.frp || 0), 0);
    const hectares = Math.round(totalFRP * 0.3);
    document.getElementById('hectaresCount').textContent = hectares.toLocaleString();

    const avgIntensity = filtered.length > 0
        ? (totalFRP / filtered.length).toFixed(1)
        : 0;
    document.getElementById('intensityAvg').textContent = avgIntensity + ' MW';

    const cutoff24 = new Date();
    cutoff24.setDate(cutoff24.getDate() - 1);
    const last24 = allIncendios.filter(f => {
        const date = parseAcq(f.properties);
        return !isNaN(date) && date >= cutoff24;
    }).length;
    document.getElementById('lastDay').textContent = last24;
}

function updateTable(data) {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    data.slice(0, 100).forEach(feature => {
        const props = feature.properties;

        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${props.acq_date} ${props.acq_time}</td>
            <td>${props.region || 'Desconocida'}</td>
            <td>${(props.frp || 0).toFixed(1)}</td>
            <td>${props.confidence}</td>
            <td>${props.instrument}</td>
        `;
    });

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #999999;">Sin incendios en este rango</td></tr>';
    }
}

function updateCharts() {
    const filtered = filterIncendios();

    const days = 7;
    const evolutionData = {};
    for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const key = date.toISOString().split('T')[0];
        evolutionData[key] = 0;
    }

    allIncendios.forEach(f => {
        const date = f.properties.acq_date;
        if (evolutionData[date] !== undefined) {
            evolutionData[date]++;
        }
    });

    const labels = Object.keys(evolutionData).reverse();
    const values = labels.map(l => evolutionData[l]);

    if (evolutionChart) {
        evolutionChart.data.labels = labels;
        evolutionChart.data.datasets[0].data = values;
        evolutionChart.update();
    } else {
        const ctx = document.getElementById('evolutionChart').getContext('2d');
        evolutionChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Incendios detectados',
                    data: values,
                    borderColor: '#cba6f7',
                    backgroundColor: 'rgba(203, 166, 247, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#f38ba8'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: {
                        ticks: { color: '#cdd6f4' },
                        grid: { color: '#313244' }
                    },
                    x: {
                        ticks: { color: '#cdd6f4' },
                        grid: { display: false }
                    }
                }
            }
        });
    }

    const regionData = {};
    filtered.forEach(f => {
        const region = f.properties.region || 'Desconocido';
        regionData[region] = (regionData[region] || 0) + 1;
    });

    const regions = Object.keys(regionData).sort((a, b) => regionData[b] - regionData[a]).slice(0, 5);
    const regionValues = regions.map(r => regionData[r]);

    if (regionChart) {
        regionChart.data.labels = regions;
        regionChart.data.datasets[0].data = regionValues;
        regionChart.update();
    } else {
        const ctx = document.getElementById('regionChart').getContext('2d');
        regionChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: regions,
                datasets: [{
                    label: 'Incendios',
                    data: regionValues,
                    backgroundColor: '#74c7ec',
                    borderColor: '#74c7ec',
                    borderWidth: 0
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: {
                        ticks: { color: '#cdd6f4' },
                        grid: { color: '#313244' }
                    },
                    y: {
                        ticks: { color: '#cdd6f4' },
                        grid: { display: false }
                    }
                }
            }
        });
    }
}

function updateTimestamp(timestamp) {
    if (timestamp) {
        const date = new Date(timestamp);
        const timeStr = date.toLocaleTimeString('es-ES');
        document.getElementById('timestamp-hero').textContent = timeStr;
    }
}

document.getElementById('regionFilter').addEventListener('change', filterAndRender);
document.getElementById('daysFilter').addEventListener('change', () => {
    filterAndRender();
    updateStats();
});

function addSpainBoundary() {}

function showAlert(msg, type = 'info') {
    const alert = document.createElement('div');
    alert.className = `alert ${type}`;
    alert.dataset.role = 'incendios-alert';
    alert.textContent = msg;
    const container = document.querySelector('.container');
    const header = document.querySelector('header');
    container.insertBefore(alert, header.nextSibling);
}

function clearAlerts() {
    document.querySelectorAll('[data-role="incendios-alert"]').forEach(el => el.remove());
}

window.addEventListener('load', () => {
    initMap();
    loadIncendios();
    setInterval(loadIncendios, 30 * 60 * 1000);
});
