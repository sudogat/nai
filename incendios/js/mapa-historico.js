const DATA_URL = '/incendios/data/incendios-historicos.json';
let allFires = [];
let map, markers = [];

// Deep-link builders
function sentinelUrl(lat, lon, year, month) {
    // Ventana ~2 meses centrada en el incendio: mes-1 a mes+1
    const y = year, m = month || 7;
    const fromM = String(Math.max(1, m - 1)).padStart(2, '0');
    const toM = String(Math.min(12, m + 1)).padStart(2, '0');
    return `https://apps.sentinel-hub.com/eo-browser/?zoom=13&lat=${lat}&lng=${lon}&themeId=DEFAULT-THEME&fromTime=${y}-${fromM}-01T00:00:00.000Z&toTime=${y}-${toM}-28T23:59:59.999Z&datasetId=S2L2A`;
}
function sentinelCompareUrl(lat, lon, year) {
    // Comparativa: dos fechas — antes (año-1) y hoy
    return `https://apps.sentinel-hub.com/eo-browser/?zoom=13&lat=${lat}&lng=${lon}&themeId=DEFAULT-THEME&datasetId=S2L2A`;
}
function googleEarthUrl(lat, lon) {
    return `https://earth.google.com/web/@${lat},${lon},1000a,15000d,35y,0h,0t,0r`;
}
function googleMapsUrl(lat, lon) {
    return `https://www.google.com/maps/@${lat},${lon},14z/data=!3m1!1e3`; // vista satélite
}
function corineUrl() {
    return 'https://land.copernicus.eu/en/products/corine-land-cover';
}
function nasaWorldviewUrl(lat, lon, year) {
    const yy = year;
    return `https://worldview.earthdata.nasa.gov/?v=${lon - 0.5},${lat - 0.4},${lon + 0.5},${lat + 0.4}&t=${yy}-08-01`;
}

function initMap() {
    map = L.map('histMap', { center: [40.0, -3.75], zoom: 6, scrollWheelZoom: false });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);
}

function colorFor(ha) {
    if (ha >= 20000) return '#dc2626';
    if (ha >= 10000) return '#f59e0b';
    return '#64748b';
}
function radiusFor(ha) {
    return Math.min(30, 8 + Math.sqrt(ha) / 12);
}

function render() {
    const year = document.getElementById('yearFilter').value;
    const ccaa = document.getElementById('ccaaFilter').value;
    const size = parseInt(document.getElementById('sizeFilter').value) || 0;

    const filtered = allFires.filter(f =>
        (!year || String(f.anio) === year) &&
        (!ccaa || f.ccaa === ccaa) &&
        (f.hectareas >= size)
    );

    markers.forEach(m => map.removeLayer(m));
    markers = [];

    filtered.forEach(f => {
        const m = L.circleMarker([f.lat, f.lon], {
            radius: radiusFor(f.hectareas),
            fillColor: colorFor(f.hectareas),
            color: '#fff', weight: 2, opacity: 1, fillOpacity: 0.75
        }).addTo(map);

        m.bindPopup(`
            <strong>${escapeHtml(f.nombre)}</strong> · ${f.anio}<br>
            ${escapeHtml(f.provincia)} (${escapeHtml(f.ccaa)})<br>
            <strong>${f.hectareas.toLocaleString('es-ES')} ha</strong> quemadas<br>
            <div style="margin-top:8px;font-size:12px;">
                <a href="${sentinelUrl(f.lat, f.lon, f.anio, f.mes)}" target="_blank" rel="noopener">🛰️ Ver satélite del incendio</a><br>
                <a href="${sentinelCompareUrl(f.lat, f.lon, f.anio)}" target="_blank" rel="noopener">🔄 Comparar antes / hoy</a><br>
                <a href="${googleEarthUrl(f.lat, f.lon)}" target="_blank" rel="noopener">🌍 Google Earth</a><br>
                <a href="${googleMapsUrl(f.lat, f.lon)}" target="_blank" rel="noopener">🗺️ Google Maps (satélite hoy)</a>
            </div>
        `, { maxWidth: 320 });

        markers.push(m);
    });

    renderGrid(filtered);
}

function renderGrid(fires) {
    const container = document.getElementById('firesGrid');
    if (!fires.length) {
        container.innerHTML = '<p class="meta">Sin incendios con esos filtros.</p>';
        return;
    }
    const sorted = [...fires].sort((a, b) => b.hectareas - a.hectareas);
    container.innerHTML = sorted.map(f => `
        <article class="fire-card">
            <header>
                <div>
                    <strong>${escapeHtml(f.nombre)}</strong>
                    <span class="fire-loc">${escapeHtml(f.provincia)} · ${escapeHtml(f.ccaa)}</span>
                </div>
                <div class="fire-year">${f.anio}</div>
            </header>
            <div class="fire-ha">${f.hectareas.toLocaleString('es-ES')} <small>ha</small></div>
            <p class="fire-desc">${escapeHtml(f.descripcion || '')}</p>
            <div class="fire-links">
                <a href="${sentinelUrl(f.lat, f.lon, f.anio, f.mes)}" target="_blank" rel="noopener">🛰️ Sentinel del incendio</a>
                <a href="${sentinelCompareUrl(f.lat, f.lon, f.anio)}" target="_blank" rel="noopener">🔄 Comparar antes/hoy</a>
                <a href="${googleEarthUrl(f.lat, f.lon)}" target="_blank" rel="noopener">🌍 Google Earth</a>
                <a href="${googleMapsUrl(f.lat, f.lon)}" target="_blank" rel="noopener">🗺️ Maps satélite hoy</a>
                ${f.wikipedia ? `<a href="${f.wikipedia}" target="_blank" rel="noopener">📖 Wikipedia</a>` : ''}
            </div>
        </article>
    `).join('');
}

function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function populateFilters() {
    const years = [...new Set(allFires.map(f => f.anio))].sort((a, b) => b - a);
    const ccaas = [...new Set(allFires.map(f => f.ccaa))].sort();
    const yearSel = document.getElementById('yearFilter');
    const ccaaSel = document.getElementById('ccaaFilter');
    years.forEach(y => yearSel.insertAdjacentHTML('beforeend', `<option value="${y}">${y}</option>`));
    ccaas.forEach(c => ccaaSel.insertAdjacentHTML('beforeend', `<option value="${c}">${escapeHtml(c)}</option>`));
    yearSel.addEventListener('change', render);
    ccaaSel.addEventListener('change', render);
    document.getElementById('sizeFilter').addEventListener('change', render);
}

function setupTheme() {
    const btn = document.getElementById('themeToggle');
    if (!btn) return;
    btn.addEventListener('click', () => {
        const cur = document.documentElement.getAttribute('data-theme') || 'light';
        const next = cur === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
    });
}

async function load() {
    setupTheme();
    document.getElementById('year').textContent = new Date().getFullYear();
    initMap();
    const res = await fetch(DATA_URL + '?t=' + Date.now(), { cache: 'no-store' });
    const data = await res.json();
    allFires = data.incendios || [];
    populateFilters();
    render();
}

load().catch(e => {
    document.getElementById('firesGrid').innerHTML = '<p style="color:#dc2626">Error cargando datos: ' + e.message + '</p>';
});
