const DATA_URL = '/incendios/data/historico.json';
const COLORS = {
    accent: '#dc2626',
    accent2: '#f59e0b',
    text: '#0f172a',
    textMut: '#475569',
    textSoft: '#64748b',
    border: '#e6e8eb',
};

let histData = null;
let histChart = null;

async function loadHist() {
    const res = await fetch(DATA_URL + '?t=' + Date.now(), { cache: 'no-store' });
    const data = await res.json();
    histData = data.anios;
    renderStats();
    renderChart();
    renderWorstYears();
    renderTable();
}

function renderStats() {
    const sorted = [...histData].sort((a, b) => b.hectareas - a.hectareas);
    const worst = sorted[0];
    document.getElementById('hist-worst-year').textContent = worst.anio;
    document.getElementById('hist-worst-value').textContent = worst.hectareas.toLocaleString('es-ES');

    const last30 = histData.slice(-30);
    const last10 = histData.slice(-10);
    const avg30 = Math.round(last30.reduce((s, y) => s + y.hectareas, 0) / last30.length);
    const avg10 = Math.round(last10.reduce((s, y) => s + y.hectareas, 0) / last10.length);
    document.getElementById('hist-avg-30').textContent = avg30.toLocaleString('es-ES');
    document.getElementById('hist-avg-10').textContent = avg10.toLocaleString('es-ES');

    const current = histData[histData.length - 1];
    document.getElementById('hist-current').textContent = current.hectareas.toLocaleString('es-ES') + (current.provisional ? '*' : '');
}

function renderChart() {
    const ctx = document.getElementById('histChart').getContext('2d');
    const labels = histData.map(y => y.anio);
    const values = histData.map(y => y.hectareas);
    const last30avg = values.slice(-30).reduce((a, b) => a + b, 0) / 30;

    const barColors = histData.map(y => y.provisional ? COLORS.accent2 : COLORS.accent);

    histChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Hectáreas',
                data: values,
                backgroundColor: barColors,
                borderRadius: 3,
            }, {
                label: 'Media 30 años',
                data: values.map(() => last30avg),
                type: 'line',
                borderColor: COLORS.text,
                borderWidth: 1.5,
                borderDash: [6, 4],
                pointRadius: 0,
                fill: false,
                tension: 0,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: COLORS.textMut, boxWidth: 12 } },
                tooltip: {
                    backgroundColor: '#0f172a',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    padding: 10,
                    cornerRadius: 6,
                    callbacks: {
                        label: (ctx) => ctx.dataset.label + ': ' + Math.round(ctx.parsed.y).toLocaleString('es-ES') + ' ha'
                    }
                }
            },
            scales: {
                x: { ticks: { color: COLORS.textMut, autoSkip: true, maxRotation: 45, minRotation: 45 }, grid: { display: false }, border: { display: false } },
                y: { ticks: { color: COLORS.textMut, callback: v => v.toLocaleString('es-ES') }, grid: { color: COLORS.border, drawTicks: false }, border: { display: false }, beginAtZero: true }
            }
        }
    });
}

function renderWorstYears() {
    const container = document.getElementById('worstYears');
    const sorted = [...histData].sort((a, b) => b.hectareas - a.hectareas).slice(0, 10);
    container.innerHTML = sorted.map((y, i) => `
        <div class="top-fire">
            <div class="top-fire-header">
                <div class="top-fire-region">${y.anio}${y.provisional ? ' (provisional)' : ''}</div>
                <div class="top-fire-frp">${y.hectareas.toLocaleString('es-ES')}<small> ha</small></div>
            </div>
            <div class="top-fire-meta">Puesto #${i + 1} de los peores años desde 1980</div>
        </div>
    `).join('');
}

function renderTable() {
    const tbody = document.getElementById('histBody');
    const values = histData.map(y => y.hectareas);
    const avg30 = values.slice(-30).reduce((a, b) => a + b, 0) / 30;
    const rows = [...histData].reverse();

    tbody.innerHTML = rows.map(y => {
        const diff = ((y.hectareas - avg30) / avg30 * 100);
        const diffClass = diff > 0 ? 'confidence-high' : 'confidence-low';
        const diffText = (diff >= 0 ? '+' : '') + diff.toFixed(0) + '%';
        const note = y.provisional ? '<span class="confidence-medium">Provisional</span>' : (y.nota || '');
        return `
            <tr>
                <td><strong>${y.anio}</strong></td>
                <td>${y.hectareas.toLocaleString('es-ES')}</td>
                <td class="${diffClass}">${diffText}</td>
                <td>${note}</td>
            </tr>
        `;
    }).join('');
}

function setupExport() {
    document.getElementById('exportHistCsv').addEventListener('click', () => {
        const csv = 'anio,hectareas,provisional\n' + histData.map(y => `${y.anio},${y.hectareas},${y.provisional ? 'si' : 'no'}`).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'incendios-espana-historico-1980-actual.csv';
        a.click();
        URL.revokeObjectURL(a.href);
    });
}


document.getElementById('year').textContent = new Date().getFullYear();
setupExport();
loadHist().catch(e => {
    document.getElementById('histBody').innerHTML = '<tr><td colspan="4" style="color:#dc2626;padding:24px;">Error cargando datos: ' + e.message + '</td></tr>';
});
