// Navegación compartida: menú móvil, tema y año del footer.
// Se carga en todas las páginas. Es idempotente: si otro script ya
// enganchó el toggle de tema, no lo duplica.

(function () {
    // --- Menú hamburguesa ---
    const toggle = document.getElementById('navToggle');
    const nav = document.getElementById('mainNav');

    if (toggle && nav) {
        const close = () => {
            nav.classList.remove('is-open');
            toggle.classList.remove('is-open');
            toggle.setAttribute('aria-expanded', 'false');
            document.body.classList.remove('nav-locked');
        };
        const open = () => {
            nav.classList.add('is-open');
            toggle.classList.add('is-open');
            toggle.setAttribute('aria-expanded', 'true');
            document.body.classList.add('nav-locked');
        };

        toggle.addEventListener('click', () => {
            nav.classList.contains('is-open') ? close() : open();
        });

        // Cerrar al navegar o al pulsar Escape
        nav.querySelectorAll('a').forEach(a => a.addEventListener('click', close));
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') close();
        });
        // Cerrar al pasar a escritorio
        window.addEventListener('resize', () => {
            if (window.innerWidth > 1000) close();
        });
    }

    // --- Tema (solo si nadie lo ha enganchado ya) ---
    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn && !themeBtn.dataset.bound) {
        themeBtn.dataset.bound = '1';
        themeBtn.addEventListener('click', () => {
            const cur = document.documentElement.getAttribute('data-theme') || 'light';
            const next = cur === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem('theme', next);
        });
    }

    // --- Año del footer ---
    const y = document.getElementById('year');
    if (y && !y.textContent.trim()) y.textContent = new Date().getFullYear();
})();
