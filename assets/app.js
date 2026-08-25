// Фильтрация каталогов и клиентский поиск по индексу сайта.
(function () {
  const norm = s => (s || '').toLowerCase().replace(/ё/g, 'е');

  // --- мобильное меню (бургер) ---
  const burger = document.querySelector('.burger');
  const topNav = document.querySelector('.top nav');
  if (burger && topNav) {
    const setOpen = on => {
      topNav.classList.toggle('open', on);
      burger.setAttribute('aria-expanded', on ? 'true' : 'false');
    };
    burger.addEventListener('click', e => {
      e.stopPropagation();
      setOpen(!topNav.classList.contains('open'));
    });
    // клик вне меню и Escape — закрыть
    document.addEventListener('click', e => {
      if (topNav.classList.contains('open') && !topNav.contains(e.target)) setOpen(false);
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && topNav.classList.contains('open')) { setOpen(false); burger.focus(); }
    });
    // возврат к десктопной ширине — сбросить состояние
    window.addEventListener('resize', () => { if (window.innerWidth > 700) setOpen(false); });
  }

  // --- фильтры на страницах каталогов (квесты, города, карты) ---
  const box = document.querySelector('[data-filter-root]');
  if (box) {
    const rows = Array.from(box.querySelectorAll('[data-row]'));
    const q = document.querySelector('#f-q');
    const selects = Array.from(document.querySelectorAll('[data-facet]'));
    const counter = document.querySelector('#f-count');
    const apply = () => {
      const needle = norm(q && q.value);
      let shown = 0;
      rows.forEach(r => {
        let ok = !needle || norm(r.dataset.search).includes(needle);
        if (ok) {
          for (const s of selects) {
            const want = s.value;
            if (want && (r.dataset[s.dataset.facet] || '') !== want) { ok = false; break; }
          }
        }
        r.style.display = ok ? '' : 'none';
        if (ok) shown++;
      });
      if (counter) counter.textContent = `показано ${shown} из ${rows.length}`;
    };
    if (q) q.addEventListener('input', apply);
    selects.forEach(s => s.addEventListener('change', apply));
    apply();
  }

  // --- страница поиска ---
  const out = document.querySelector('#search-out');
  if (!out) return;
  const input = document.querySelector('#search-q');
  const params = new URLSearchParams(location.search);
  const initial = params.get('q') || '';
  if (input && initial) input.value = initial;

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hl = (text, words) => {
    let t = esc(text);
    words.forEach(w => {
      if (w.length < 2) return;
      t = t.replace(new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'), '<mark>$1</mark>');
    });
    return t;
  };

  const boot = (window.SEARCH_INDEX
    ? Promise.resolve(window.SEARCH_INDEX)
    : fetch('data/search-index.json').then(r => r.json()));
  boot.then(index => {
    const run = () => {
      const raw = norm(input.value).trim();
      if (!raw) { out.innerHTML = '<p class="sub">Введите запрос: название квеста, город, товар, предмет, NPC.</p>'; return; }
      const words = raw.split(/\s+/).filter(Boolean);
      const scored = [];
      for (const it of index) {
        const hay = it.h;
        let score = 0, all = true;
        for (const w of words) {
          const pos = hay.indexOf(w);
          if (pos < 0) { all = false; break; }
          score += (pos === 0 ? 8 : 3) + (norm(it.t).includes(w) ? 12 : 0);
        }
        if (!all) continue;
        score += ({ quest: 40, town: 35, page: 25, map: 12, tip: 6 })[it.k] || 0;
        scored.push([score, it]);
      }
      scored.sort((a, b) => b[0] - a[0]);
      if (!scored.length) { out.innerHTML = '<p class="sub">Ничего не нашлось. Попробуйте короче — например «Калеуче», «Бриджтаун», «ром».</p>'; return; }
      const kindName = { quest: 'квест', town: 'город', page: 'раздел', map: 'карта', tip: 'фишка' };
      out.innerHTML = `<p class="sub">Найдено: ${scored.length}${scored.length > 300 ? ', показаны первые 300' : ''}</p>` +
        scored.slice(0, 300).map(([, it]) => `<div class="hit"><div class="k">${kindName[it.k] || it.k}</div>
        <a href="${it.u}"><b>${hl(it.t, words)}</b></a>
        ${it.d ? `<div class="src">${hl(it.d, words)}</div>` : ''}</div>`).join('');
    };
    input.addEventListener('input', run);
    run();
  }).catch(e => { out.innerHTML = '<p class="sub">Не удалось загрузить поисковый индекс: ' + esc(e.message) + '</p>'; });
})();
