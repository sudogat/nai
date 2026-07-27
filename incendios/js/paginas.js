// Script compartido para las páginas estáticas (metodología, emergencia).
// Solo tema, año del footer y el generador de embed si existe en la página.

(function () {
    const btn = document.getElementById('themeToggle');
    if (btn) {
        btn.addEventListener('click', () => {
            const cur = document.documentElement.getAttribute('data-theme') || 'light';
            const next = cur === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem('theme', next);
        });
    }

    const y = document.getElementById('year');
    if (y) y.textContent = new Date().getFullYear();

    // Generador de embed
    const w = document.getElementById('embedWidth');
    const h = document.getElementById('embedHeight');
    const code = document.getElementById('embedCode');
    const copyBtn = document.getElementById('copyEmbedBtn');

    if (w && h && code && copyBtn) {
        const render = () => {
            const widthAttr = w.value === '100%' ? '100%' : (w.value + 'px');
            code.value = `<iframe src="https://bigdata.datosclaros.es/incendios/" width="${widthAttr}" height="${h.value}" style="border:0;border-radius:12px;" title="Incendios forestales España — datosclaros.es" loading="lazy"></iframe>`;
        };
        render();
        w.addEventListener('change', render);
        h.addEventListener('change', render);

        copyBtn.addEventListener('click', async () => {
            code.select();
            try {
                await navigator.clipboard.writeText(code.value);
                const orig = copyBtn.textContent;
                copyBtn.textContent = '✓ Copiado';
                setTimeout(() => { copyBtn.textContent = orig; }, 1500);
            } catch (e) {
                document.execCommand('copy');
            }
        });
    }
})();
