// Global state
let map;
let markers = [];
let allIncendios = [];
let evolutionChart, regionChart;

const DATA_URL = '/incendios/data/incendios.json';
const NEWS_URL = '/incendios/data/noticias.json';
const UPDATE_URL = '/incendios/update-data.php';

// Control de actualizaciones automáticas (sin crons, vía AJAX)
let lastDataUpdate = 0;
let lastNewsUpdate = 0;
const FIRMS_UPDATE_INTERVAL = 5 * 60 * 1000;  // 5 minutos
const NEWS_UPDATE_INTERVAL = 10 * 60 * 1000;  // 10 minutos

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
    const timestamp = document.getElementById('timestamp-hero');
    if (timestamp) {
        timestamp.style.opacity = '0.6';
        timestamp.style.transition = 'opacity 0.3s';
    }

    try {
        const response = await fetch(DATA_URL + '?t=' + Date.now(), { cache: 'no-store' });
        if (!response.ok) throw new Error('HTTP ' + response.status);

        const data = await response.json();
        allIncendios = data.features || [];

        clearAlerts();
        updateTimestamp(data.timestamp);

        if (timestamp) {
            setTimeout(() => {
                timestamp.style.opacity = '1';
            }, 200);
        }

        if (allIncendios.length === 0 && Array.isArray(data.errors) && data.errors.length > 0) {
            showAlert('Sin datos NASA FIRMS ahora mismo (' + data.errors.join(', ') + '). Reintentando…', 'warning');
        }

        refreshAll();

    } catch (error) {
        console.error('Error loading fires:', error);
        if (timestamp) timestamp.style.opacity = '1';
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
    const conf = (document.getElementById('confidenceFilter') || { value: 'all' }).value;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return allIncendios.filter(feature => {
        const props = feature.properties;
        const date = parseAcq(props);
        if (isNaN(date)) return false;
        if (date < cutoffDate) return false;

        if (region && props.region) {
            if (!props.region.toLowerCase().includes(region)) return false;
        } else if (region) {
            return false;
        }

        if (conf === 'high' && props.confidence !== 'high') return false;
        if (conf === 'medium' && !(props.confidence === 'high' || props.confidence === 'medium')) return false;

        return true;
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

let lastUpdateTime = null;

function updateTimestamp(timestamp) {
    if (timestamp) {
        lastUpdateTime = new Date(timestamp);
        const date = new Date(timestamp);
        document.getElementById('timestamp-hero').textContent = date.toLocaleString('es-ES', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
        });
    }
}

// Actualiza cada segundo el "hace X minutos"
function updateTimeAgo() {
    if (!lastUpdateTime) return;
    const now = new Date();
    const diff = Math.floor((now - lastUpdateTime) / 1000);
    const heroEl = document.getElementById('timestamp-hero');
    if (!heroEl) return;

    let text;
    if (diff < 60) {
        text = 'Ahora mismo';
    } else if (diff < 3600) {
        const m = Math.floor(diff / 60);
        text = `Hace ${m} min`;
    } else {
        const h = Math.floor(diff / 3600);
        text = `Hace ${h} h`;
    }

    // Mostrar la hora exacta en el title para más info
    heroEl.title = lastUpdateTime.toLocaleString('es-ES');

    // Si queremos mostrar el contador, descomentar:
    // heroEl.textContent = text + ' · ' + lastUpdateTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function refreshAll() {
    filterAndRender();
    updateStats();
    updateCharts();
    renderTopFires();
    renderRanking();
}

// ---------- Ranking de comunidades ----------
function renderRanking() {
    const tbody = document.getElementById('rankingBody');
    if (!tbody) return;
    const filtered = filterIncendios();
    if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty">Sin detecciones en el rango elegido.</td></tr>';
        return;
    }

    const cutoff24 = new Date();
    cutoff24.setDate(cutoff24.getDate() - 1);

    const grouped = {};
    filtered.forEach(f => {
        const r = f.properties.region || 'Otra';
        if (!grouped[r]) grouped[r] = { count: 0, frpSum: 0, last24: 0 };
        grouped[r].count++;
        grouped[r].frpSum += (f.properties.frp || 0);
        const d = parseAcq(f.properties);
        if (!isNaN(d) && d >= cutoff24) grouped[r].last24++;
    });

    const total = filtered.length;
    const rows = Object.entries(grouped)
        .map(([region, s]) => ({ region, ...s, pct: (s.count / total * 100), frpAvg: s.frpSum / s.count }))
        .sort((a, b) => b.count - a.count);

    const maxPct = rows[0]?.pct || 1;

    tbody.innerHTML = rows.map((r, i) => {
        const rankClass = i < 3 ? `rank-${i+1}` : '';
        const barWidth = Math.max(4, (r.pct / maxPct) * 100);
        return `
            <tr>
                <td><span class="rank-num ${rankClass}">${i + 1}</span></td>
                <td><strong>${escapeHtml(r.region)}</strong></td>
                <td>${r.count.toLocaleString('es-ES')}</td>
                <td>
                    <span class="rank-bar" style="width:${barWidth}px"></span>
                    ${r.pct.toFixed(1)}%
                </td>
                <td>${r.frpAvg.toFixed(1)}</td>
                <td>${r.last24.toLocaleString('es-ES')}</td>
            </tr>
        `;
    }).join('');
}

// ---------- Top 10 focos más intensos ----------
function renderTopFires() {
    const container = document.getElementById('topFires');
    if (!container) return;
    const filtered = filterIncendios();
    if (filtered.length === 0) {
        container.innerHTML = '<p class="meta">Sin detecciones en el rango elegido.</p>';
        return;
    }
    const top = [...filtered].sort((a, b) => (b.properties.frp || 0) - (a.properties.frp || 0)).slice(0, 10);
    container.innerHTML = top.map(f => {
        const p = f.properties;
        const c = f.geometry.coordinates;
        return `
            <div class="top-fire">
                <div class="top-fire-header">
                    <div class="top-fire-region">${escapeHtml(p.region || '—')}</div>
                    <div class="top-fire-frp">${(p.frp || 0).toFixed(0)}<small> MW</small></div>
                </div>
                <div class="top-fire-meta">${p.acq_date} ${formatTime(p.acq_time)} · Confianza ${p.confidence} · ${p.instrument}</div>
                <a href="https://maps.google.com/?q=${c[1]},${c[0]}" target="_blank" rel="noopener">Ver ubicación exacta →</a>
            </div>
        `;
    }).join('');
}

// ---------- Exportar CSV ----------
function setupExport() {
    const btn = document.getElementById('exportCsvBtn');
    if (!btn) return;
    btn.addEventListener('click', () => {
        const filtered = filterIncendios();
        if (!filtered.length) {
            alert('No hay detecciones para exportar con los filtros actuales.');
            return;
        }
        const headers = ['fecha', 'hora', 'latitud', 'longitud', 'frp_mw', 'confianza', 'sensor', 'satelite', 'comunidad'];
        const rows = filtered.map(f => {
            const p = f.properties;
            return [
                p.acq_date, formatTime(p.acq_time),
                p.latitude.toFixed(5), p.longitude.toFixed(5),
                (p.frp || 0).toFixed(2), p.confidence,
                p.instrument, p.satellite || '',
                (p.region || '').replace(/,/g, ' '),
            ].join(',');
        });
        const csv = headers.join(',') + '\n' + rows.join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'incendios-espana-' + new Date().toISOString().slice(0,10) + '.csv';
        a.click();
        URL.revokeObjectURL(a.href);
    });
}

document.getElementById('regionFilter').addEventListener('change', refreshAll);
document.getElementById('daysFilter').addEventListener('change', refreshAll);
const confFilter = document.getElementById('confidenceFilter');
if (confFilter) confFilter.addEventListener('change', refreshAll);

// Share (Web Share API con fallback a copiar al portapapeles)
function setupShare() {
    const btn = document.getElementById('shareBtn');
    if (!btn) return;
    btn.addEventListener('click', async () => {
        const url = location.href;
        const title = document.title;
        const text = 'Incendios forestales en España en tiempo real';
        if (navigator.share) {
            try { await navigator.share({ title, text, url }); } catch (e) { /* cancelado */ }
        } else if (navigator.clipboard) {
            await navigator.clipboard.writeText(url);
            btn.innerHTML = '✓ Enlace copiado';
            setTimeout(() => location.reload(), 1500);
        } else {
            prompt('Copia este enlace:', url);
        }
    });
}

function setupYear() {
    const el = document.getElementById('year');
    if (el) el.textContent = new Date().getFullYear();
}

// Actualizar datos vía update-data.php (sin crons)
async function updateDataViaAjax(firms = false, news = false) {
    if (!firms && !news) return;

    try {
        const params = new URLSearchParams();
        if (firms) params.append('firms', '1');
        if (news) params.append('news', '1');

        const response = await fetch(UPDATE_URL + '?' + params.toString(), {
            cache: 'no-store',
            timeout: 30000
        });

        if (response.ok) {
            const result = await response.json();
            console.log('Auto-update via AJAX:', result);

            // Recargar datos después de actualizar
            if (firms) {
                setTimeout(loadIncendios, 1000);
            }
            if (news) {
                setTimeout(loadNoticias, 1000);
            }
        }
    } catch (error) {
        console.warn('Auto-update AJAX failed:', error);
        // Sin crons, si falla el AJAX, intentar nuevamente en 5 min
    }
}

// Planificador de actualizaciones automáticas
function scheduleAutoUpdates() {
    setInterval(() => {
        const now = Date.now();

        // Actualizar FIRMS cada 5 minutos
        if (now - lastDataUpdate >= FIRMS_UPDATE_INTERVAL) {
            lastDataUpdate = now;
            updateDataViaAjax(true, false);
        }

        // Actualizar noticias cada 10 minutos
        if (now - lastNewsUpdate >= NEWS_UPDATE_INTERVAL) {
            lastNewsUpdate = now;
            updateDataViaAjax(false, true);
        }
    }, 60000); // Verificar cada minuto
}

function setupRefresh() {
    const btn = document.getElementById('refreshBtn');
    if (!btn) return;
    btn.addEventListener('click', async () => {
        const originalText = btn.textContent;
        const originalOpacity = btn.style.opacity;
        btn.disabled = true;
        btn.style.opacity = '0.6';
        btn.textContent = 'Cargando…';

        try {
            // Forzar actualización vía AJAX + recargar datos
            await updateDataViaAjax(true, true);
            await Promise.all([loadIncendios(), loadNoticias()]);

            lastDataUpdate = Date.now();
            lastNewsUpdate = Date.now();

            btn.textContent = '✓ Actualizado';
            setTimeout(() => {
                btn.textContent = originalText;
                btn.style.opacity = originalOpacity;
                btn.disabled = false;
            }, 1500);
        } catch (e) {
            btn.textContent = '✗ Error';
            setTimeout(() => {
                btn.textContent = originalText;
                btn.style.opacity = originalOpacity;
                btn.disabled = false;
            }, 2000);
        }
    });
}

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
    setupShare();
    setupExport();
    setupRefresh();
    setupYear();
    initMap();
    loadIncendios();
    loadNoticias();

    // Actualizar datos cada 5 minutos
    setInterval(loadIncendios, 5 * 60 * 1000);
    setInterval(loadNoticias, 10 * 60 * 1000);

    // Actualizar contador "hace X minutos" cada segundo
    setInterval(updateTimeAgo, 1000);
    updateTimeAgo(); // Llamar una vez al inicio
});
