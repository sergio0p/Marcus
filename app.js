(() => {
  'use strict';

  const RANGES = {
    easy:   { y: [2, 7],   x: [40, 199] },
    medium: { y: [4, 9],   x: [120, 999] },
    hard:   { y: [11, 25], x: [400, 9999] },
  };

  const HL_COLORS = 5;

  const els = {
    x: document.getElementById('display-x'),
    y: document.getElementById('display-y'),
    stack: document.getElementById('stack'),
    activeRow: document.getElementById('active-row'),
    quotientList: document.getElementById('quotient-list'),
    quotientBar: document.getElementById('quotient-bar'),
    quotientTotal: document.getElementById('quotient-total'),
    prompt: document.getElementById('prompt'),
    diff: document.getElementById('difficulty'),
    newBtn: document.getElementById('new-problem'),
  };

  const state = {
    x: 0,
    y: 0,
    current: 0,
    rows: [],          // committed: { s, sy, remainder }
    phase: 'pickS',    // 'pickS' | 'computeSY' | 'computeRem' | 'sumQuotients' | 'done'
    s: null,
    sy: null,
  };

  function randInt(lo, hi) {
    return Math.floor(Math.random() * (hi - lo + 1)) + lo;
  }

  function newProblem() {
    const r = RANGES[els.diff.value] || RANGES.medium;
    let x, y;
    do {
      y = randInt(r.y[0], r.y[1]);
      x = randInt(r.x[0], r.x[1]);
    } while (x < y * 3);
    state.x = x;
    state.y = y;
    state.current = x;
    state.rows = [];
    state.phase = 'pickS';
    state.s = null;
    state.sy = null;
    render();
  }

  function colorClass(idx) {
    return `color-${(idx % HL_COLORS) + 1}`;
  }

  function makeRow({ op = '', val = '', cls = [] } = {}) {
    const div = document.createElement('div');
    div.className = ['row', ...cls].join(' ');
    div.innerHTML = `<span class="op">${op}</span><span class="val">${val}</span>`;
    return div;
  }

  function render() {
    els.x.textContent = state.x;
    els.y.textContent = state.y;

    els.stack.innerHTML = '';

    // Top minuend (the original dividend)
    els.stack.appendChild(makeRow({ val: state.x }));

    // Each completed row: subtrahend (highlighted, with bar) + difference
    state.rows.forEach((row, i) => {
      els.stack.appendChild(makeRow({
        op: '−',
        val: row.sy,
        cls: ['has-bar', 'completed', colorClass(i)],
      }));
      const isLatest = i === state.rows.length - 1;
      els.stack.appendChild(makeRow({
        val: row.remainder,
        cls: isLatest ? ['minuend-fresh'] : [],
      }));
    });

    renderActive();
    renderQuotient();
  }

  function renderActive() {
    els.activeRow.innerHTML = '';

    if (state.phase === 'sumQuotients') {
      const sList = state.rows.map(r => r.s).join(' + ');
      els.prompt.className = 'prompt';
      els.prompt.innerHTML =
        `Last step, Marcus! Add up your chunks: <span class="hint">${sList}</span> = ?`;
      return; // input lives in the quotient column
    }

    if (state.phase === 'done') {
      const total = state.rows.reduce((a, r) => a + r.s, 0);
      const remainder = state.current;
      els.prompt.className = 'prompt celebrate';
      els.prompt.textContent = remainder
        ? `Yes, Marcus! ${state.x} ÷ ${state.y} = ${total}, with ${remainder} left over.`
        : `Perfect, Marcus! ${state.x} ÷ ${state.y} = ${total}.`;
      celebrate();
      return;
    }

    if (state.phase === 'pickS') {
      els.prompt.className = 'prompt';
      els.prompt.innerHTML = state.rows.length === 0
        ? `Okay Marcus — how many <span class="hint">${state.y}s</span> can you pull out of <span class="hint">${state.current}</span>?`
        : `Nice. How many more <span class="hint">${state.y}s</span> fit in <span class="hint">${state.current}</span>?`;
      const wrap = document.createElement('div');
      wrap.className = 'row has-bar';
      const tentColor = colorClass(state.rows.length);
      wrap.innerHTML = `
        <span class="op">−</span>
        <span class="val">
          <span class="paren">(</span><input class="box" id="input-s" inputmode="numeric" autocomplete="off" maxlength="5" aria-label="how many ${state.y}s"/> <span class="paren">×</span> ${state.y}<span class="paren">)</span>
        </span>`;
      els.activeRow.appendChild(wrap);
      attachInput('input-s', onSubmitS);
      return;
    }

    if (state.phase === 'computeSY') {
      els.prompt.className = 'prompt';
      els.prompt.innerHTML =
        `Cool — so what's <span class="hint">${state.s} × ${state.y}</span>?`;
      const wrap = document.createElement('div');
      wrap.className = 'row has-bar';
      wrap.innerHTML = `
        <span class="op">−</span>
        <span class="val"><input class="box wide" id="input-sy" inputmode="numeric" autocomplete="off" maxlength="6" aria-label="${state.s} times ${state.y}"/></span>`;
      els.activeRow.appendChild(wrap);
      attachInput('input-sy', onSubmitSY);
      return;
    }

    if (state.phase === 'computeRem') {
      els.prompt.className = 'prompt';
      els.prompt.innerHTML =
        `And <span class="hint">${state.current} − ${state.sy}</span> is...?`;
      const sub = makeRow({
        op: '−',
        val: state.sy,
        cls: ['has-bar'],
      });
      const remRow = document.createElement('div');
      remRow.className = 'row';
      remRow.innerHTML = `
        <span class="op"></span>
        <span class="val"><input class="box wide" id="input-rem" inputmode="numeric" autocomplete="off" maxlength="6" aria-label="${state.current} minus ${state.sy}"/></span>`;
      els.activeRow.appendChild(sub);
      els.activeRow.appendChild(remRow);
      attachInput('input-rem', onSubmitRem);
      return;
    }
  }

  function attachInput(id, handler) {
    const el = document.getElementById(id);
    if (!el) return;
    el.focus();
    el.addEventListener('keydown', handler);
    el.addEventListener('input', () => el.classList.remove('wrong'));
  }

  function renderQuotient() {
    els.quotientList.innerHTML = '';

    state.rows.forEach((r, i) => {
      const span = document.createElement('span');
      span.className = `q ${colorClass(i)}`;
      span.textContent = r.s;
      els.quotientList.appendChild(span);
    });

    // tentative entry while user is mid-row
    if (state.s != null && state.phase !== 'pickS' && state.phase !== 'done') {
      const span = document.createElement('span');
      span.className = `q tentative ${colorClass(state.rows.length)}`;
      span.textContent = state.s;
      els.quotientList.appendChild(span);
    }

    if (state.phase === 'sumQuotients') {
      const remainder = state.current;
      els.quotientBar.hidden = false;
      els.quotientTotal.hidden = false;
      els.quotientTotal.classList.add('input-mode');
      els.quotientTotal.innerHTML =
        `<input class="quotient-input" id="input-sum" inputmode="numeric" autocomplete="off" maxlength="6" aria-label="total quotient" />` +
        (remainder ? ` <span class="rem">r ${remainder}</span>` : '');
      attachInput('input-sum', onSubmitSum);
    } else if (state.phase === 'done') {
      const total = state.rows.reduce((a, r) => a + r.s, 0);
      const remainder = state.current;
      els.quotientBar.hidden = false;
      els.quotientTotal.hidden = false;
      els.quotientTotal.classList.remove('input-mode');
      els.quotientTotal.innerHTML = remainder
        ? `${total} <span class="rem">r ${remainder}</span>`
        : `${total}`;
    } else {
      els.quotientBar.hidden = true;
      els.quotientTotal.hidden = true;
      els.quotientTotal.classList.remove('input-mode');
    }
  }

  function shake(input) {
    input.classList.add('wrong');
    setTimeout(() => input.classList.remove('wrong'), 460);
    input.select();
  }

  function flashPrompt(text, cls = 'warn') {
    els.prompt.className = `prompt ${cls}`;
    els.prompt.innerHTML = text;
  }

  function isSubmitKey(e) {
    return e.key === 'Enter' || e.key === 'Tab';
  }

  function onSubmitS(e) {
    if (!isSubmitKey(e)) return;
    e.preventDefault();
    const input = e.currentTarget;
    const v = parseInt(input.value, 10);
    if (!Number.isFinite(v) || v <= 0) return shake(input);
    if (v * state.y > state.current) {
      flashPrompt(
        `Hmm Marcus — <span class="hint">${v} × ${state.y} = ${v * state.y}</span>, that's bigger than ${state.current}. Try a smaller chunk.`,
        'warn'
      );
      shake(input);
      return;
    }
    state.s = v;
    state.phase = 'computeSY';
    renderActive();
    renderQuotient();
  }

  function onSubmitSY(e) {
    if (!isSubmitKey(e)) return;
    e.preventDefault();
    const input = e.currentTarget;
    const v = parseInt(input.value, 10);
    if (v !== state.s * state.y) return shake(input);
    state.sy = v;
    state.phase = 'computeRem';
    renderActive();
  }

  function onSubmitRem(e) {
    if (!isSubmitKey(e)) return;
    e.preventDefault();
    const input = e.currentTarget;
    const v = parseInt(input.value, 10);
    const expected = state.current - state.sy;
    if (v !== expected) return shake(input);

    state.rows.push({ s: state.s, sy: state.sy, remainder: expected });
    state.current = expected;
    state.s = null;
    state.sy = null;
    state.phase = (expected < state.y) ? 'sumQuotients' : 'pickS';
    render();
  }

  function onSubmitSum(e) {
    if (!isSubmitKey(e)) return;
    e.preventDefault();
    const input = e.currentTarget;
    const v = parseInt(input.value, 10);
    const total = state.rows.reduce((a, r) => a + r.s, 0);
    if (v !== total) return shake(input);
    state.phase = 'done';
    render();
  }

  /* ---------- celebration ---------- */

  function celebrate() {
    const layer = document.createElement('div');
    layer.className = 'confetti';
    document.body.appendChild(layer);
    const colors = ['#fff09e', '#ffc8a0', '#c5edcb', '#bedaf2', '#d9c8e8', '#d6453d', '#3aa847'];
    for (let i = 0; i < 60; i++) {
      const piece = document.createElement('span');
      piece.style.left = `${Math.random() * 100}vw`;
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      const dur = 1.6 + Math.random() * 1.6;
      piece.style.animationDuration = `${dur}s`;
      piece.style.animationDelay = `${Math.random() * 0.4}s`;
      piece.style.transform = `rotate(${Math.random() * 360}deg)`;
      layer.appendChild(piece);
    }
    setTimeout(() => layer.remove(), 3500);
  }

  /* ---------- listeners ---------- */

  els.newBtn.addEventListener('click', newProblem);
  els.diff.addEventListener('change', newProblem);

  /* ---------- splash dismissal ---------- */

  const splash = document.getElementById('splash');
  const splashDismiss = document.getElementById('splash-dismiss');

  function dismissSplash() {
    if (!splash || splash.classList.contains('hidden')) return;
    splash.classList.add('hidden');
    setTimeout(() => splash.remove(), 700);
    const liveInput = document.querySelector('input.box, .quotient-input');
    if (liveInput) liveInput.focus();
  }

  if (splash) {
    splash.addEventListener('click', dismissSplash);
    splashDismiss && splashDismiss.addEventListener('click', (e) => {
      e.stopPropagation();
      dismissSplash();
    });
    document.addEventListener('keydown', function onceKey(e) {
      if (splash.classList.contains('hidden')) return;
      e.preventDefault();
      dismissSplash();
      document.removeEventListener('keydown', onceKey);
    });
  }

  newProblem();
})();
