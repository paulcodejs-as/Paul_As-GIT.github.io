// ===== Tema (claro/oscuro/auto) =====
(function initTheme() {
    const root = document.documentElement;
    const saved = localStorage.getItem('theme'); // 'light' | 'dark' | 'auto'
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

    function applyTheme(mode) {
        // mode: 'light' | 'dark' | 'auto'
        root.setAttribute('data-theme', mode === 'auto' ? (prefersDark ? 'dark' : 'light') : mode);
        localStorage.setItem('theme', mode);
        updateLabel();
    }

    function currentMode() {
        return localStorage.getItem('theme') || 'auto';
    }

    function updateLabel() {
        const btn = document.getElementById('themeBtn');
        const label = document.getElementById('themeLabel');
        const mode = currentMode();
        const isDark = root.getAttribute('data-theme') === 'dark';
        btn.setAttribute('aria-pressed', isDark.toString());
        label.textContent = mode === 'auto' ? (isDark ? 'Auto • Oscuro' : 'Auto • Claro') : (isDark ? 'Oscuro' : 'Claro');
    }

    // Primer render
    applyTheme(saved || 'auto');

    // Responder a cambios del SO cuando está en auto
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            if ((localStorage.getItem('theme') || 'auto') === 'auto') {
                applyTheme('auto');
            }
        });
    }

    // Click: rota entre light -> dark -> auto
    document.getElementById('themeBtn').addEventListener('click', () => {
        const order = ['light', 'dark', 'auto'];
        const curr = localStorage.getItem('theme') || 'auto';
        const next = order[(order.indexOf(curr) + 1) % order.length];
        applyTheme(next);
    });
})();

// ===== Menú móvil =====
(function initMobileMenu() {
    const menuBtn = document.getElementById('menuBtn');
    const panel = document.getElementById('mobilePanel');
    const closeBtn = document.getElementById('closeMenu');

    function open() { panel.classList.add('open'); panel.hidden = false; menuBtn.setAttribute('aria-expanded', 'true'); }
    function close() { panel.classList.remove('open'); panel.hidden = true; menuBtn.setAttribute('aria-expanded', 'false'); }

    menuBtn.addEventListener('click', () => (panel.hidden ? open() : close()));
    closeBtn.addEventListener('click', close);
    panel.addEventListener('click', (e) => { if (e.target === panel) close(); });
    document.querySelectorAll('[data-nav]').forEach(a => a.addEventListener('click', close));
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) close(); });
})();


// ===== Botón "copiar" para bloques .terminal =====
(function addCopyButtons() {
    const blocks = document.querySelectorAll('.terminal');
    blocks.forEach(block => {
        const btn = document.createElement('button');
        btn.className = 'icon-btn';
        btn.style.position = 'absolute';
        btn.style.top = '.6rem';
        btn.style.right = '.6rem';
        btn.style.padding = '.35rem .5rem';
        btn.setAttribute('aria-label', 'Copiar comandos');
        btn.innerHTML = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><span style="margin-left:.4rem">Copiar</span>';
        btn.addEventListener('click', async () => {
            const text = Array.from(block.querySelectorAll('.command, .command-comment, .command-output')).map(el => el.textContent).join('\n');
            try { await navigator.clipboard.writeText(text); btn.innerHTML = '✔ Copiado'; setTimeout(() => btn.innerHTML = '📋 Copiar', 1500); } catch { btn.innerHTML = '⚠️ Error'; setTimeout(() => btn.innerHTML = '📋 Copiar', 1500); }
        });
        block.appendChild(btn);
    });
})();