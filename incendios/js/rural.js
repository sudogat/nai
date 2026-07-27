const RURAL_URL = '/incendios/data/rural.json';
const CASOS_URL = '/incendios/data/casos-documentados.json';

const C = {
    accent: '#dc2626',
    accent2: '#f59e0b',
    green: '#16a34a',
    blue: '#2563eb',
    textMut: '#475569',
    border: '#e6e8eb',
};

function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function nf(n, dec = 0) {
    return Number(n).toLocaleString('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function chartOptions(unidad) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: '#0f172a',
                titleColor: '#fff',
                bodyColor: '#fff',
                padding: 10,
                cornerRadius: 6,
                displayColors: false,
                callbacks: {
                    label: ctx => nf(ctx.parsed.y, 1) + ' ' + unidad
                }
            }
        },
        scales: {
            x: { ticks: { color: C.textMut, font: { size: 11 } }, grid: { display: false }, border: { display: false } },
            y: { ticks: { color: C.textMut, font: { size: 11 } }, grid: { color: C.border, drawTicks: false }, border: { display: false } }
        }
    };
}

function buildChart(key, block, color, index) {
    const container = document.getElementById('ruralCharts');
    const id = 'chart-' + key;
    const first = block.serie[0].valor;
    const last = block.serie[block.serie.length - 1].valor;
    const delta = ((last - first) / first * 100);
    const up = delta > 0;

    const card = document.createElement('article');
    card.className = 'chart-card';
    card.innerHTML = `
        <div class="chart-head">
            <h3>${esc(block.titulo)}</h3>
            <span class="trend ${up ? 'trend-up' : 'trend-down'}">${up ? '▲' : '▼'} ${nf(Math.abs(delta), 0)}%</span>
        </div>
        <p class="chart-desc">${esc(block.descripcion)}</p>
        <div class="chart-wrap"><canvas id="${id}"></canvas></div>
        <p class="chart-source">Unidad: ${esc(block.unidad)} · Fuente: ${esc(block.fuente)}</p>
    `;
    container.appendChild(card);

    new Chart(document.getElementById(id).getContext('2d'), {
        type: 'line',
        data: {
            labels: block.serie.map(p => p.anio),
            datasets: [{
                data: block.serie.map(p => p.valor),
                borderColor: color,
                backgroundColor: color + '1a',
                fill: true,
                tension: 0.3,
                borderWidth: 2.5,
                pointBackgroundColor: color,
                pointRadius: 4,
                pointHoverRadius: 6,
            }]
        },
        options: chartOptions(block.unidad)
    });
}

function renderKpis(d) {
    const pob = d.poblacion_rural.serie;
    const perdidaPob = pob[0].valor - pob[pob.length - 1].valor;
    document.getElementById('kpi-pob').textContent = nf(perdidaPob, 1) + ' M';

    const ex = d.explotaciones_agrarias.serie;
    const perdidaEx = ex[0].valor - ex[ex.length - 1].valor;
    document.getElementById('kpi-expl').textContent = nf(perdidaEx * 1000);

    const fo = d.superficie_forestal.serie;
    const ganada = fo[fo.length - 1].valor - fo[0].valor;
    document.getElementById('kpi-forestal').textContent = '+' + nf(ganada, 1) + ' M ha';

    const ga = d.cabana_extensiva.serie;
    const perdidaGa = ga[0].valor - ga[ga.length - 1].valor;
    document.getElementById('kpi-ganado').textContent = nf(perdidaGa, 1) + ' M';
}

function renderClaves(claves) {
    document.getElementById('ruralClaves').innerHTML = claves.map(c => `
        <article class="info-card">
            <h3>${esc(c.titulo)}</h3>
            <p>${esc(c.texto)}</p>
        </article>
    `).join('');
}

async function renderCasos() {
    const box = document.getElementById('casosContainer');
    try {
        const res = await fetch(CASOS_URL + '?t=' + Date.now(), { cache: 'no-store' });
        const data = await res.json();
        const casos = data.casos || [];

        if (!casos.length) {
            box.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🗂️</div>
                    <strong>Todavía no hay ningún caso verificado publicado.</strong>
                    <span>El registro se llena solo con casos que tengan expediente o fuente primaria enlazable.</span>
                </div>`;
            return;
        }

        box.innerHTML = '<div class="fires-grid">' + casos.map(c => `
            <article class="fire-card">
                <header>
                    <div>
                        <strong>${esc(c.nombre)}</strong>
                        <span class="fire-loc">${esc(c.municipio)} · ${esc(c.ccaa)}</span>
                    </div>
                    <div class="fire-year">${esc(c.anio_incendio)}</div>
                </header>
                <div class="caso-flow">
                    <span class="caso-before">${esc(c.uso_antes)}</span>
                    <span class="caso-arrow">→</span>
                    <span class="caso-after">${esc(c.uso_despues)}</span>
                </div>
                <p class="fire-desc">${esc(c.resumen)}</p>
                <div class="caso-status status-${esc(c.estado_legal)}">${esc((c.estado_legal || '').replace(/_/g, ' '))}</div>
                <div class="fire-links">
                    ${(c.fuentes || []).map(f => `<a href="${esc(f.url)}" target="_blank" rel="noopener">📄 ${esc(f.titulo)}</a>`).join('')}
                </div>
            </article>
        `).join('') + '</div>';
    } catch (e) {
        box.innerHTML = '<p class="meta">No se pudo cargar el registro de casos.</p>';
    }
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

async function init() {
    setupTheme();
    document.getElementById('year').textContent = new Date().getFullYear();

    const res = await fetch(RURAL_URL + '?t=' + Date.now(), { cache: 'no-store' });
    const d = await res.json();

    renderKpis(d);
    buildChart('pob', d.poblacion_rural, C.accent, 0);
    buildChart('expl', d.explotaciones_agrarias, C.accent2, 1);
    buildChart('forestal', d.superficie_forestal, C.green, 2);
    buildChart('ganado', d.cabana_extensiva, C.blue, 3);
    renderClaves(d.claves);
    renderCasos();
}

init().catch(e => {
    document.getElementById('ruralCharts').innerHTML = '<p class="meta">Error cargando datos: ' + e.message + '</p>';
});
