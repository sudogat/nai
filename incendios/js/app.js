// Global state
let map;
let markers = [];
let allIncendios = [];
let evolutionChart, regionChart;

const DATA_URL = '/incendios/data/incendios.json';
const NEWS_URL = '/incendios/data/noticias.json';

// Paleta tema claro
const COLORS = {
    accent: '#dc2626',
    accent2: '#f59e0b',
    accent3: '#b45309',
    text: '#111827',
    textMut: '#4b5563',
    textSoft: '#6b7280',
    border: '#e5e7eb',
    bgSoft: '#f7f7f8'
};

// NASA FIRMS entrega acq_time como "HHMM" (p.ej. "0645"), formato que
// new Date() no puede parsear de forma consistente. Devolvemos un Date
// válido a partir de acq_date + acq_time.
function parseAcq(props) {
    const dateStr = props.acq_date || '';
    const rawTime = String(props.acq_time || '0000').padStart(4, '0');
    const hh = rawTime.slice(0, 2);
    const mm = rawTime.slice(2, 4);
    return new Date(`${dateStr}T${hh}:${mm}:00`);
}

function formatTime(rawTime) {
    const t = String(rawTime || '0000').padStart(4, '0');
    return t.slice(0, 2) + ':' + t.slice(2, 4);
}

// Map init
function initMap() {
    map = L.map('map', {
        center: [40.0, -3.75],
        zoom: 6,
        minZoom: 4,
        maxZoom: 16,
        scrollWheelZoom: false
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);
}

async function loadIncendios() {
    try {
        const response = await fetch(DATA_URL + '?t=' + Date.now(), { cache: 'no-store' });
        if (!response.ok) throw new Error('HTTP ' + response.status);

        const data = await response.json();
        allIncendios = data.features || [];

        clearAlerts();
        updateTimestamp(data.timestamp);

        if (allIncendios.length === 0 && Array.isArray(data.errors) && data.errors.length > 0) {
            showAlert('Sin datos NASA FIRMS ahora mismo (' + data.errors.join(', ') + '). Reintentando…', 'warning');
        }

        refreshAll();

    } catch (error) {
        console.error('Error loading fires:', error);
        showAlert('No se pudo cargar ' + DATA_URL + ' — ' + error.message + '. Reintentando en 30s…', 'error');
        setTimeout(loadIncendios, 30000);
    }
}

async function loadNoticias() {
    const list = document.getElementById('newsList');
    try {
        const response = await fetch(NEWS_URL + '?t=' + Date.now(), { cache: 'no-store' });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const data = await response.json();
        const items = data.items || [];

        list.innerHTML = '';
        if (items.length === 0) {
            list.innerHTML = '<li class="news-empty">No hay noticias disponibles ahora mismo.</li>';
            return;
        }
        items.slice(0, 10).forEach(n => {
            const li = document.createElement('li');
            const fecha = n.timestamp ? new Date(n.timestamp).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
            li.innerHTML = `
                <div class="news-title"><a href="${n.link}" target="_blank" rel="noopener">${escapeHtml(n.title)}</a></div>
                <div class="news-meta">
                    <span class="news-source">${escapeHtml(n.source || '')}</span>
                    ${fecha ? '<span>·</span><span>' + fecha + '</span>' : ''}
                </div>
            `;
            list.appendChild(li);
        });
    } catch (err) {
        console.warn('News load failed:', err);
        list.innerHTML = '<li class="news-empty">Noticias no disponibles.</li>';
    }
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

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
            color: '#fff',
            weight: 1,
            opacity: 1,
            fillOpacity: 0.85
        }).addTo(map);

        marker.bindPopup(`
            <strong>${props.acq_date} ${formatTime(props.acq_time)}</strong><br>
            ${props.region || 'Región desconocida'}<br>
            Potencia: <strong>${(props.frp || 0).toFixed(1)} MW</strong><br>
            Confianza: <strong>${props.confidence}</strong><br>
            Sensor: ${props.instrument}<br>
            <a href="https://maps.google.com/?q=${coords[1]},${coords[0]}" target="_blank" rel="noopener">Ver en mapa</a>
        `);

        markers.push(marker);
    });

    updateTable(filtered);
}

function getConfidenceColor(confidence) {
    const conf = (confidence || '').toLowerCase();
    if (conf === 'high') return COLORS.accent;
    if (conf === 'medium') return COLORS.accent2;
    return COLORS.textSoft;
}

function updateStats() {
    const filtered = filterIncendios();

    document.getElementById('activeCount').textContent = filtered.length.toLocaleString('es-ES');

    const totalFRP = filtered.reduce((sum, f) => sum + (f.properties.frp || 0), 0);
    const hectares = Math.round(totalFRP * 0.3);
    document.getElementById('hectaresCount').textContent = hectares.toLocaleString('es-ES');

    const avgIntensity = filtered.length > 0
        ? (totalFRP / filtered.length).toFixed(1)
        : '0';
    document.getElementById('intensityAvg').textContent = avgIntensity;

    // "Últimas 24h" respeta el filtro de comunidad (pero no el de rango)
    const region = document.getElementById('regionFilter').value.toLowerCase();
    const cutoff24 = new Date();
    cutoff24.setDate(cutoff24.getDate() - 1);
    const last24 = allIncendios.filter(f => {
        const date = parseAcq(f.properties);
        if (isNaN(date) || date < cutoff24) return false;
        if (region && f.properties.region) {
            return f.properties.region.toLowerCase().includes(region);
        }
        return !region;
    }).length;
    document.getElementById('lastDay').textContent = last24.toLocaleString('es-ES');
}

function updateTable(data) {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    data.slice(0, 100).forEach(feature => {
        const props = feature.properties;
        const confClass = 'confidence-' + (props.confidence || 'low');

        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${props.acq_date} ${formatTime(props.acq_time)}</td>
            <td>${props.region || '—'}</td>
            <td>${(props.frp || 0).toFixed(1)}</td>
            <td class="${confClass}">${props.confidence || '—'}</td>
            <td>${props.instrument}</td>
        `;
    });

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-soft);padding:24px;">Sin detecciones en este rango</td></tr>';
    }
}

function updateCharts() {
    // Evolución 7 días (respeta filtro de comunidad, no de rango)
    const region = document.getElementById('regionFilter').value.toLowerCase();
    const evolutionData = {};
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        evolutionData[date.toISOString().split('T')[0]] = 0;
    }

    allIncendios.forEach(f => {
        if (region && f.properties.region && !f.properties.region.toLowerCase().includes(region)) return;
        const d = f.properties.acq_date;
        if (evolutionData[d] !== undefined) evolutionData[d]++;
    });

    const labels = Object.keys(evolutionData);
    const values = labels.map(l => evolutionData[l]);
    const shortLabels = labels.map(l => l.slice(5)); // MM-DD

    if (evolutionChart) {
        evolutionChart.data.labels = shortLabels;
        evolutionChart.data.datasets[0].data = values;
        evolutionChart.update();
    } else {
        const ctx = document.getElementById('evolutionChart').getContext('2d');
        evolutionChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: shortLabels,
                datasets: [{
                    label: 'Detecciones',
                    data: values,
                    borderColor: COLORS.accent,
                    backgroundColor: 'rgba(220, 38, 38, 0.08)',
                    tension: 0.35,
                    fill: true,
                    pointBackgroundColor: COLORS.accent,
                    pointRadius: 3,
                    borderWidth: 2
                }]
            },
            options: chartOptions()
        });
    }

    // Distribución por comunidad (respeta filtro de rango)
    const filtered = filterIncendios();
    const regionData = {};
    filtered.forEach(f => {
        const r = f.properties.region || 'Otra';
        regionData[r] = (regionData[r] || 0) + 1;
    });

    const regions = Object.keys(regionData).sort((a, b) => regionData[b] - regionData[a]).slice(0, 8);
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
                    label: 'Detecciones',
                    data: regionValues,
                    backgroundColor: COLORS.accent2,
                    borderRadius: 4,
                    borderSkipped: false
                }]
            },
            options: { ...chartOptions(), indexAxis: 'y' }
        });
    }
}

function chartOptions() {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: '#111827',
                titleColor: '#fff',
                bodyColor: '#fff',
                padding: 10,
                cornerRadius: 6,
                displayColors: false
            }
        },
        scales: {
            x: {
                ticks: { color: COLORS.textMut, font: { size: 11 } },
                grid: { color: COLORS.border, drawTicks: false },
                border: { display: false }
            },
            y: {
                ticks: { color: COLORS.textMut, font: { size: 11 } },
                grid: { color: COLORS.border, drawTicks: false },
                border: { display: false },
                beginAtZero: true
            }
        }
    };
}

function updateTimestamp(timestamp) {
    if (timestamp) {
        const date = new Date(timestamp);
        document.getElementById('timestamp-hero').textContent = date.toLocaleString('es-ES', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
        });
    }
}

function refreshAll() {
    filterAndRender();
    updateStats();
    updateCharts();
}

document.getElementById('regionFilter').addEventListener('change', refreshAll);
document.getElementById('daysFilter').addEventListener('change', refreshAll);

function showAlert(msg, type = 'info') {
    const alert = document.createElement('div');
    alert.className = `alert ${type}`;
    alert.dataset.role = 'incendios-alert';
    alert.textContent = msg;
    const main = document.querySelector('main.wrap');
    main.insertBefore(alert, main.firstChild);
}

function clearAlerts() {
    document.querySelectorAll('[data-role="incendios-alert"]').forEach(el => el.remove());
}

window.addEventListener('load', () => {
    initMap();
    loadIncendios();
    loadNoticias();
    setInterval(loadIncendios, 30 * 60 * 1000);
    setInterval(loadNoticias, 30 * 60 * 1000);
});
