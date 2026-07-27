const CAUSAS_URL = '/incendios/data/causas.json';

function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderCausas(c) {
    document.getElementById('causas-titulo').textContent = c.titulo;
    document.getElementById('causas-sub').textContent = c.subtitulo + ' · Fuente: ' + c.fuente;

    new Chart(document.getElementById('causasChart').getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: c.datos.map(d => d.causa),
            datasets: [{
                data: c.datos.map(d => d.pct),
                backgroundColor: c.datos.map(d => d.color),
                borderWidth: 3,
                borderColor: getComputedStyle(document.body).backgroundColor,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '58%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#0f172a',
                    padding: 10,
                    cornerRadius: 6,
                    displayColors: false,
                    callbacks: { label: ctx => ctx.label + ': ' + ctx.parsed + '%' }
                }
            }
        }
    });

    document.getElementById('causasList').innerHTML = c.datos.map(d => `
        <div class="cause-item">
            <div class="cause-head">
                <span class="cause-dot" style="background:${d.color}"></span>
                <strong>${esc(d.causa)}</strong>
                <span class="cause-pct">${d.pct}%</span>
            </div>
            <p>${esc(d.detalle)}</p>
        </div>
    `).join('');
}

function renderMotivaciones(m) {
    document.getElementById('motiv-titulo').textContent = m.titulo;
    document.getElementById('motiv-sub').innerHTML = '<strong>Lo que casi nadie cuenta</strong><p>' + esc(m.subtitulo) + '</p>';
    document.getElementById('motiv-fuente').textContent = 'Unidad: ' + m.unidad + ' · Fuente: ' + m.fuente;

    const max = Math.max(...m.datos.map(d => d.pct));
    document.getElementById('motivBars').innerHTML = m.datos.map(d => {
        const destacado = d.pct <= 3 ? ' bar-row-highlight' : '';
        return `
        <div class="bar-row${destacado}">
            <div class="bar-label">
                <strong>${esc(d.motivo)}</strong>
                <span class="bar-value">${d.pct}%</span>
            </div>
            <div class="bar-track">
                <div class="bar-fill" style="width:${(d.pct / max * 100).toFixed(1)}%"></div>
            </div>
            <p class="bar-detail">${esc(d.detalle)}</p>
        </div>`;
    }).join('');
}

function renderJudicial(j) {
    document.getElementById('judicial-titulo').textContent = j.titulo;
    document.getElementById('judicial-desc').textContent = j.descripcion;
    document.getElementById('judicial-cuello').textContent = j.cuello_de_botella;

    document.getElementById('funnel').innerHTML = j.pasos.map((p, i) => `
        <div class="funnel-step" style="--i:${i}">
            <div class="funnel-value">${esc(p.valor)}</div>
            <div class="funnel-label">${esc(p.etapa)}</div>
            <div class="funnel-note">${esc(p.nota)}</div>
        </div>
    `).join('');
}

function renderPerfiles(p) {
    document.getElementById('perfiles-titulo').textContent = p.titulo;
    document.getElementById('perfiles-aviso').textContent = p.aviso;
    document.getElementById('perfilesGrid').innerHTML = p.items.map(i => `
        <article class="info-card">
            <h3>${esc(i.perfil)}</h3>
            <p>${esc(i.descripcion)}</p>
        </article>
    `).join('');
    document.getElementById('perfiles-extincion').innerHTML =
        '<strong>Sobre el personal de extinción</strong><p>' + esc(p.sobre_personal_de_extincion) + '</p>';
}

function renderPenas(p) {
    document.getElementById('penas-titulo').textContent = p.titulo;
    document.getElementById('penasGrid').innerHTML = p.articulos.map(a => `
        <article class="law-card">
            <div class="law-tag">${esc(a.art)}</div>
            <h3>${esc(a.pena)}</h3>
            <p>${esc(a.texto)}</p>
        </article>
    `).join('');
}

function renderDenunciar(items) {
    document.getElementById('denunciarLinks').innerHTML = items.map(d => {
        const href = d.url || (d.via.match(/^\d+/) ? 'tel:' + d.via.match(/^\d+/)[0] : null);
        const attrs = href && !href.startsWith('tel:') ? ' target="_blank" rel="noopener"' : '';
        const inner = `<strong>${esc(d.via)}</strong><small>${esc(d.detalle)}</small>`;
        return href ? `<a href="${esc(href)}"${attrs}>${inner}</a>` : `<span class="auth-static">${inner}</span>`;
    }).join('');
}

fetch(CAUSAS_URL + '?t=' + Date.now(), { cache: 'no-store' })
    .then(r => r.json())
    .then(d => {
        renderCausas(d.causas);
        renderMotivaciones(d.motivaciones);
        renderJudicial(d.judicial);
        renderPerfiles(d.perfiles);
        renderPenas(d.penas);
        renderDenunciar(d.como_denunciar);
    })
    .catch(e => {
        document.getElementById('causasList').innerHTML = '<p class="meta">Error cargando datos: ' + e.message + '</p>';
    });
