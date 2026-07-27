const FIRES_URL = '/incendios/data/incendios-historicos.json';

let map, marker;

// Boletines oficiales por comunidad, donde se publican los acuerdos de
// cambio de uso en terreno quemado (Ley de Montes art. 50).
const BOLETINES = {
    'Andalucía':            ['BOJA',  'https://www.juntadeandalucia.es/boja'],
    'Aragón':               ['BOA',   'https://www.boa.aragon.es/'],
    'Asturias':             ['BOPA',  'https://sede.asturias.es/bopa'],
    'Illes Balears':        ['BOIB',  'https://www.caib.es/boib/'],
    'Baleares':             ['BOIB',  'https://www.caib.es/boib/'],
    'Canarias':             ['BOC',   'https://www.gobiernodecanarias.org/boc/'],
    'Cantabria':            ['BOC',   'https://boc.cantabria.es/'],
    'Castilla-La Mancha':   ['DOCM',  'https://docm.jccm.es/'],
    'Castilla y León':      ['BOCYL', 'https://bocyl.jcyl.es/'],
    'Cataluña':             ['DOGC',  'https://dogc.gencat.cat/'],
    'Comunidad Valenciana': ['DOGV',  'https://dogv.gva.es/'],
    'Extremadura':          ['DOE',   'https://doe.juntaex.es/'],
    'Galicia':              ['DOG',   'https://www.xunta.gal/diario-oficial-galicia'],
    'La Rioja':             ['BOR',   'https://web.larioja.org/bor'],
    'Madrid':               ['BOCM',  'https://www.bocm.es/'],
    'Región de Murcia':     ['BORM',  'https://www.borm.es/'],
    'Murcia':               ['BORM',  'https://www.borm.es/'],
    'Navarra':              ['BON',   'https://bon.navarra.es/'],
    'País Vasco':           ['BOPV',  'https://www.euskadi.eus/bopv'],
};

function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function initMap() {
    map = L.map('pickMap', { center: [41.87, -6.28], zoom: 8 });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors', maxZoom: 19
    }).addTo(map);

    marker = L.marker([41.87, -6.28], { draggable: true }).addTo(map);
    marker.on('dragend', () => {
        const p = marker.getLatLng();
        setCoords(p.lat, p.lng, false);
    });
    map.on('click', e => setCoords(e.latlng.lat, e.latlng.lng, false));
}

function setCoords(lat, lon, moveMap = true) {
    lat = Number(lat); lon = Number(lon);
    document.getElementById('latInput').value = lat.toFixed(5);
    document.getElementById('lonInput').value = lon.toFixed(5);
    marker.setLatLng([lat, lon]);
    if (moveMap) map.setView([lat, lon], 12);
    generar();
}

function getState() {
    const lat = parseFloat(document.getElementById('latInput').value);
    const lon = parseFloat(document.getElementById('lonInput').value);
    const anio = parseInt(document.getElementById('yearInput').value) || 2022;
    const ccaa = document.getElementById('ccaaInput').value;
    return { lat, lon, anio, ccaa };
}

// ---------- Constructores de URL ----------
const U = {
    ignIberpix: (lat, lon) =>
        `https://iberpix.ign.es/iberpix/visor?center=${lon},${lat}&zoom=16&srs=EPSG:4326`,
    ignComparador: () =>
        'https://www.ign.es/web/comparador_pnoa/index.html',
    ignFototeca: () =>
        'https://fototeca.cnig.es/',
    sigpac: () =>
        'https://sigpac.mapa.gob.es/fega/visor/',
    catastro: (lat, lon) =>
        `https://www1.sedecatastro.gob.es/Cartografia/mapa.aspx?buscar=S&latitud=${lat}&longitud=${lon}`,
    catastroSede: () =>
        'https://www.sedecatastro.gob.es/',
    corine: () =>
        'https://land.copernicus.eu/en/products/corine-land-cover',
    corineViewer: () =>
        'https://land.copernicus.eu/en/map-viewer',
    sentinelFecha: (lat, lon, anio) => {
        const from = `${anio}-06-01T00:00:00.000Z`;
        const to = `${anio}-10-31T23:59:59.999Z`;
        return `https://apps.sentinel-hub.com/eo-browser/?zoom=13&lat=${lat}&lng=${lon}&themeId=DEFAULT-THEME&fromTime=${from}&toTime=${to}&datasetId=S2L2A`;
    },
    sentinelHoy: (lat, lon) =>
        `https://apps.sentinel-hub.com/eo-browser/?zoom=13&lat=${lat}&lng=${lon}&themeId=DEFAULT-THEME&datasetId=S2L2A`,
    googleEarth: (lat, lon) =>
        `https://earth.google.com/web/@${lat},${lon},1000a,15000d,35y,0h,0t,0r`,
    googleMaps: (lat, lon) =>
        `https://www.google.com/maps/@${lat},${lon},15z/data=!3m1!1e3`,
    worldview: (lat, lon, anio) =>
        `https://worldview.earthdata.nasa.gov/?v=${(lon - 0.5).toFixed(2)},${(lat - 0.4).toFixed(2)},${(lon + 0.5).toFixed(2)},${(lat + 0.4).toFixed(2)}&t=${anio}-08-01`,
    effis: () =>
        'https://effis.jrc.ec.europa.eu/apps/effis_current_situation/',
    boe: (q) =>
        `https://www.boe.es/buscar/boe.php?campo%5B0%5D=TIT&dato%5B0%5D=${encodeURIComponent(q)}&operador%5B0%5D=and`,
    transparencia: () =>
        'https://www.consejodetransparencia.es/',
};

const GRUPOS = [
    {
        titulo: 'Fotografía aérea histórica de España',
        nota: 'Empieza siempre por aquí. Es lo único que te dice qué había en ese punto ANTES del incendio.',
        destacado: true,
        links: (s) => [
            ['🛩️', 'IGN Iberpix', 'Visor oficial con las series históricas. Activa la capa de vuelos antiguos.', U.ignIberpix(s.lat, s.lon)],
            ['🔀', 'Comparador PNOA', 'Compara dos vuelos a pantalla partida: 1945, 1956, 1980s y PNOA actual.', U.ignComparador()],
            ['🗄️', 'Fototeca digital CNIG', 'Descarga los fotogramas originales en alta resolución.', U.ignFototeca()],
        ],
    },
    {
        titulo: 'Uso oficial del suelo',
        nota: 'Aquí queda registrado si el suelo cambió de categoría, y cuándo.',
        links: (s) => [
            ['🗺️', 'Corine Land Cover', 'Clasificación europea de usos del suelo: 1990, 2000, 2006, 2012, 2018 y 2024.', U.corine()],
            ['🌍', 'Visor Copernicus', 'Visor de mapas con las capas Corine cargadas.', U.corineViewer()],
            ['🌾', 'SIGPAC', 'Sistema de parcelas agrarias. Uso declarado de cada recinto.', U.sigpac()],
        ],
    },
    {
        titulo: 'Parcela y titularidad',
        nota: 'Público y gratuito. Recuerda: los datos de personas físicas están protegidos.',
        links: (s) => [
            ['📐', 'Catastro en este punto', 'Abre la cartografía catastral centrada en las coordenadas.', U.catastro(s.lat, s.lon)],
            ['🏛️', 'Sede del Catastro', 'Consulta por referencia catastral, uso y superficie.', U.catastroSede()],
        ],
    },
    {
        titulo: 'Satélite: antes y después',
        nota: 'Sentinel-2 solo cubre desde 2015. Para incendios anteriores, tira de la fototeca del IGN.',
        links: (s) => [
            ['🛰️', `Sentinel en el año del incendio (${s.anio})`, 'Ventana de junio a octubre del año que hayas indicado.', U.sentinelFecha(s.lat, s.lon, s.anio)],
            ['📡', 'Sentinel hoy', 'Estado actual. Usa el modo Compare para el split-slider.', U.sentinelHoy(s.lat, s.lon)],
            ['🌐', 'Google Earth', 'Línea temporal con imágenes históricas.', U.googleEarth(s.lat, s.lon)],
            ['📍', 'Google Maps satélite', 'Vista actual en alta resolución.', U.googleMaps(s.lat, s.lon)],
            ['🔭', 'NASA Worldview', 'Imagen diaria global, útil para ver la columna de humo.', U.worldview(s.lat, s.lon, s.anio)],
        ],
    },
    {
        titulo: 'Expedientes y boletines',
        nota: 'Todo cambio de uso en terreno quemado debe estar publicado. Si no aparece, esa es la pregunta.',
        links: (s) => {
            const out = [
                ['📜', 'Buscar en el BOE', 'Búsqueda por «cambio de uso forestal».', U.boe('cambio de uso forestal')],
                ['🔎', 'Portal de Transparencia', 'Registra una solicitud de información si el expediente no aparece.', U.transparencia()],
            ];
            const b = BOLETINES[s.ccaa];
            if (b) {
                out.unshift(['📰', `Boletín oficial — ${b[0]}`, `Diario oficial de ${s.ccaa}. Busca por municipio y por «Ley de Montes».`, b[1]]);
            }
            return out;
        },
    },
];

function generar() {
    const s = getState();
    const out = document.getElementById('linksOutput');

    if (isNaN(s.lat) || isNaN(s.lon)) {
        out.innerHTML = '<p class="meta">Introduce unas coordenadas válidas.</p>';
        return;
    }

    out.innerHTML = `
        <div class="coord-badge">
            <span>📍 ${s.lat.toFixed(5)}, ${s.lon.toFixed(5)}</span>
            <button class="btn btn-ghost btn-sm" id="copyCoords">Copiar coordenadas</button>
        </div>
    ` + GRUPOS.map(g => `
        <div class="link-group${g.destacado ? ' link-group-featured' : ''}">
            <div class="link-group-head">
                <h3>${esc(g.titulo)}</h3>
                <p>${esc(g.nota)}</p>
            </div>
            <div class="link-cards">
                ${g.links(s).map(([icon, titulo, desc, url]) => `
                    <a class="link-card" href="${esc(url)}" target="_blank" rel="noopener">
                        <span class="link-icon">${icon}</span>
                        <span class="link-body">
                            <strong>${esc(titulo)}</strong>
                            <small>${esc(desc)}</small>
                        </span>
                    </a>
                `).join('')}
            </div>
        </div>
    `).join('');

    const cp = document.getElementById('copyCoords');
    if (cp) cp.addEventListener('click', async () => {
        await navigator.clipboard.writeText(`${s.lat.toFixed(5)}, ${s.lon.toFixed(5)}`);
        cp.textContent = '✓ Copiado';
        setTimeout(() => { cp.textContent = 'Copiar coordenadas'; }, 1500);
    });
}

// Extrae lat/lon de una URL pegada de Google Maps u otras
function parsePasted(txt) {
    let m = txt.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);           // maps/@lat,lon
    if (m) return [parseFloat(m[1]), parseFloat(m[2])];
    m = txt.match(/[?&]q=(-?\d+\.\d+),\s*(-?\d+\.\d+)/);        // ?q=lat,lon
    if (m) return [parseFloat(m[1]), parseFloat(m[2])];
    m = txt.match(/(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/);            // lat, lon suelto
    if (m) return [parseFloat(m[1]), parseFloat(m[2])];
    return null;
}

async function init() {
    const y = document.getElementById('year');
    if (y) y.textContent = new Date().getFullYear();

    initMap();

    // Comunidades para el selector de boletín
    const ccaaSel = document.getElementById('ccaaInput');
    Object.keys(BOLETINES).sort().forEach(c => {
        if (ccaaSel.querySelector(`option[value="${c}"]`)) return;
        ccaaSel.insertAdjacentHTML('beforeend', `<option value="${esc(c)}">${esc(c)}</option>`);
    });

    // Presets de grandes incendios
    try {
        const res = await fetch(FIRES_URL + '?t=' + Date.now(), { cache: 'no-store' });
        const data = await res.json();
        const fires = (data.incendios || []).sort((a, b) => b.anio - a.anio);
        const sel = document.getElementById('firePreset');
        fires.forEach((f, i) => {
            sel.insertAdjacentHTML('beforeend',
                `<option value="${i}">${esc(f.nombre)} (${f.anio}) — ${f.hectareas.toLocaleString('es-ES')} ha</option>`);
        });
        sel.addEventListener('change', () => {
            const f = fires[sel.value];
            if (!f) return;
            document.getElementById('yearInput').value = f.anio;
            if (BOLETINES[f.ccaa]) document.getElementById('ccaaInput').value = f.ccaa;
            setCoords(f.lat, f.lon, true);
        });
    } catch (e) {
        console.warn('No se pudieron cargar los incendios de referencia', e);
    }

    // Eventos
    document.getElementById('genBtn').addEventListener('click', () => {
        const s = getState();
        if (!isNaN(s.lat) && !isNaN(s.lon)) setCoords(s.lat, s.lon, true);
    });
    ['latInput', 'lonInput', 'yearInput'].forEach(id => {
        document.getElementById(id).addEventListener('change', generar);
    });
    document.getElementById('ccaaInput').addEventListener('change', generar);
    document.getElementById('pasteInput').addEventListener('input', e => {
        const c = parsePasted(e.target.value);
        if (c) setCoords(c[0], c[1], true);
    });

    generar();
}

init();
