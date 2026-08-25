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

  // --- просмотр изображений в модалке ---
  // Карты открываются поверх страницы, а не в новой вкладке: в PWA на Android из новой
  // вкладки нельзя вернуться кнопкой «Назад». Открытие добавляет запись в history,
  // поэтому системная кнопка «Назад» закрывает просмотр и оставляет пользователя на странице.
  const IMG_HREF = /\.(webp|png|jpe?g|gif|svg)$/i;
  const viewer = (() => {
    let box, stage, pic, caption, opened = false;
    let scale = 0;   // 0 — вписано в экран, иначе множитель к натуральному размеру

    const natural = () => pic.naturalWidth || 1;
    const current = () => scale || pic.clientWidth / natural();

    const fit = () => {
      scale = 0;
      stage.classList.remove('zoomed');
      pic.style.width = '';
    };

    const zoomTo = (value, anchorX, anchorY) => {
      const before = current();
      scale = Math.min(8, Math.max(0.05, value));
      // точка, вокруг которой масштабируем: центр видимой области или место двойного тапа
      const cx = (anchorX === undefined ? stage.clientWidth / 2 : anchorX) + stage.scrollLeft;
      const cy = (anchorY === undefined ? stage.clientHeight / 2 : anchorY) + stage.scrollTop;
      stage.classList.add('zoomed');
      pic.style.width = natural() * scale + 'px';
      const k = scale / before;
      stage.scrollLeft = cx * k - (anchorX === undefined ? stage.clientWidth / 2 : anchorX);
      stage.scrollTop = cy * k - (anchorY === undefined ? stage.clientHeight / 2 : anchorY);
    };

    const build = () => {
      box = document.createElement('div');
      box.className = 'lb';
      box.innerHTML =
        '<div class="lb-bar">' +
        '<span class="lb-cap"></span>' +
        '<button type="button" data-lb="out" aria-label="Уменьшить">−</button>' +
        '<button type="button" data-lb="in" aria-label="Увеличить">+</button>' +
        '<button type="button" data-lb="fit" aria-label="Вписать в экран">⤢</button>' +
        '<button type="button" data-lb="close" aria-label="Закрыть просмотр">✕</button>' +
        '</div><div class="lb-stage"><img class="lb-img" alt=""></div>';
      document.body.appendChild(box);
      stage = box.querySelector('.lb-stage');
      pic = box.querySelector('.lb-img');
      caption = box.querySelector('.lb-cap');

      box.addEventListener('click', e => {
        const act = e.target.dataset && e.target.dataset.lb;
        if (act === 'close' || e.target === stage) close();
        else if (act === 'in') zoomTo(current() * 1.5);
        else if (act === 'out') zoomTo(current() / 1.5);
        else if (act === 'fit') fit();
      });

      // двойной тап/клик по картинке: натуральный размер <-> вписать
      let lastTap = 0;
      const toggle = (x, y) => (scale ? fit() : zoomTo(1, x, y));
      pic.addEventListener('dblclick', e => {
        const r = stage.getBoundingClientRect();
        toggle(e.clientX - r.left, e.clientY - r.top);
      });
      pic.addEventListener('touchend', e => {
        if (e.touches.length) return;
        const now = e.timeStamp;
        if (now - lastTap < 300) { e.preventDefault(); toggle(); }
        lastTap = now;
      });

      // щипок двумя пальцами
      let pinchStart = 0, pinchScale = 1;
      const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
      stage.addEventListener('touchstart', e => {
        if (e.touches.length === 2) { pinchStart = dist(e.touches); pinchScale = current(); }
      }, { passive: true });
      stage.addEventListener('touchmove', e => {
        if (e.touches.length === 2 && pinchStart) {
          e.preventDefault();
          zoomTo(pinchScale * dist(e.touches) / pinchStart);
        }
      }, { passive: false });
      stage.addEventListener('touchend', e => { if (e.touches.length < 2) pinchStart = 0; }, { passive: true });
    };

    const hide = () => {
      opened = false;
      box.classList.remove('open');
      document.documentElement.style.overflow = '';
      pic.removeAttribute('src');
    };

    const close = () => {
      if (!opened) return;
      // запись в истории добавляли мы — снимаем её, popstate доведёт закрытие до конца
      if (history.state && history.state.kksViewer) history.back();
      else hide();
    };

    const open = (href, text) => {
      if (!box) build();
      fit();
      pic.src = href;
      pic.alt = text || '';
      caption.textContent = text || href.split('/').pop();
      box.classList.add('open');
      document.documentElement.style.overflow = 'hidden';
      opened = true;
      history.pushState({ kksViewer: true }, '');
    };

    window.addEventListener('popstate', () => { if (opened) hide(); });
    document.addEventListener('keydown', e => {
      if (!opened) return;
      if (e.key === 'Escape') close();
      else if (e.key === '+' || e.key === '=') zoomTo(current() * 1.5);
      else if (e.key === '-') zoomTo(current() / 1.5);
      else if (e.key === '0') fit();
    });

    return { open, isOpen: () => opened };
  })();

  document.addEventListener('click', e => {
    if (!e.target.closest) return;
    const a = e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    if (!IMG_HREF.test(href.split(/[?#]/)[0])) return;
    // не мешаем открыть картинку в новой вкладке или сохранить её
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    // подпись: заголовок из галереи, иначе подпись фигуры, иначе alt или текст ссылки
    const fig = a.closest('figure');
    const cap = fig && (fig.querySelector('figcaption b') || fig.querySelector('figcaption'));
    const inner = a.querySelector('img');
    const text = (cap && cap.textContent.trim()) || (inner && inner.alt) || a.textContent.trim();
    viewer.open(a.href, text.slice(0, 120));
  });

  // --- фильтры на страницах каталогов (квесты, города, карты) ---
  const box = document.querySelector('[data-filter-root]');
  if (box) {
    // строки лежат рядом с блоком фильтров, а не внутри него — ищем по всему документу
    const rows = Array.from(document.querySelectorAll('[data-row]'));
    // группы галереи (карты): заголовок + сетка, их прячем целиком, если внутри ничего не осталось
    const groups = Array.from(document.querySelectorAll('.gal')).map(gal => ({
      gal,
      head: gal.previousElementSibling && /^H[23]$/.test(gal.previousElementSibling.tagName)
        ? gal.previousElementSibling : null,
      items: Array.from(gal.querySelectorAll('[data-row]')),
    })).filter(g => g.items.length);
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
      groups.forEach(g => {
        const empty = g.items.every(it => it.style.display === 'none');
        g.gal.style.display = empty ? 'none' : '';
        if (g.head) g.head.style.display = empty ? 'none' : '';
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
