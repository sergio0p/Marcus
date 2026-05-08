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
    x: 0, y: 0,
    xDigits: [],
    consumed: 0,         // how many digits of x have been used
    working: 0,          // current minuend
    steps: [],           // [{working, d, product, diff, broughtDown}]
    phase: 'pickDigit',  // 'pickDigit' | 'computeProduct' | 'computeDiff' | 'done'
    d: null,
    product: null,
  };

  function randInt(lo, hi) {
    return Math.floor(Math.random() * (hi - lo + 1)) + lo;
  }

  function digitsOf(n) {
    return String(n).split('').map(d => +d);
  }

  function colorClass(idx) {
    return `color-${(idx % HL_COLORS) + 1}`;
  }

  /* ---------- problem setup ---------- */

  function findFirstPrefix(digits, y) {
    let val = 0;
    let i = 0;
    while (i < digits.length) {
      val = val * 10 + digits[i];
      i++;
      if (val >= y) return { working: val, consumed: i };
    }
    return { working: val, consumed: i };
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
    state.xDigits = digitsOf(x);
    const fp = findFirstPrefix(state.xDigits, y);
    state.consumed = fp.consumed;
    state.working = fp.working;
    state.steps = [];
    state.phase = 'pickDigit';
    state.d = null;
    state.product = null;

    render();
  }

  /* ---------- rendering ---------- */

  function makeStepBlock(step, idx, isLast) {
    const div = document.createElement('div');
    div.className = `step ${colorClass(idx)}`;
    const downArrow = step.broughtDown != null
      ? `<div class="bring-down">↓ bring down <span class="brought">${step.broughtDown}</span></div>`
      : '';
    const remNote = isLast && step.broughtDown == null && step.diff > 0
      ? `<div class="rem-note">remainder = <span class="rem-val">${step.diff}</span></div>`
      : '';
    div.innerHTML = `
      <div class="step-head"><span class="step-label">working</span><span class="working-val">${step.working}</span></div>
      <div class="step-line">
        <span class="op">${step.d}</span>
        <span class="muted">×</span>
        <span class="muted">${state.y}</span>
        <span class="muted">=</span>
        <span class="prod-val">${step.product}</span>
      </div>
      <div class="step-line subline">
        <span class="muted">${step.working}</span>
        <span class="op">−</span>
        <span class="muted">${step.product}</span>
        <span class="muted">=</span>
        <span class="diff-val">${step.diff}</span>
      </div>
      ${downArrow}
      ${remNote}
    `;
    return div;
  }

  function render() {
    els.x.textContent = state.x;
    els.y.textContent = state.y;

    els.stack.innerHTML = '';
    state.steps.forEach((step, i) => {
      const isLast = i === state.steps.length - 1;
      els.stack.appendChild(makeStepBlock(step, i, isLast && state.phase === 'done'));
    });

    renderActive();
    renderQuotient();
  }

  function renderActive() {
    els.activeRow.innerHTML = '';

    if (state.phase === 'done') {
      const quotient = state.steps.map(s => s.d).join('');
      const remainder = state.steps.length ? state.steps[state.steps.length - 1].diff : 0;
      els.prompt.className = 'prompt celebrate';
      els.prompt.textContent = remainder
        ? `Yes, Marcus! ${state.x} ÷ ${state.y} = ${quotient}, with ${remainder} left over.`
        : `Perfect, Marcus! ${state.x} ÷ ${state.y} = ${quotient}.`;
      celebrate();
      return;
    }

    if (state.phase === 'pickDigit') {
      els.prompt.className = 'prompt';
      els.prompt.innerHTML = pickDigitPrompt();
      const wrap = document.createElement('div');
      wrap.className = 'active-step';
      wrap.innerHTML = `
        <div class="step-head"><span class="step-label">working</span><span class="working-val">${state.working}</span></div>
        <div class="active-line">
          <span class="muted">highest digit, then</span>
          <input class="box" id="input-d" inputmode="numeric" autocomplete="off" maxlength="1" aria-label="quotient digit"/>
          <span class="muted">×</span>
          <span class="muted">${state.y}</span>
          <span class="muted">≤</span>
          <span class="muted">${state.working}</span>
        </div>
      `;
      els.activeRow.appendChild(wrap);
      attachInput('input-d', onSubmitDigit);
      return;
    }

    if (state.phase === 'computeProduct') {
      els.prompt.className = 'prompt';
      els.prompt.innerHTML = `Cool — so what's <span class="hint">${state.d} × ${state.y}</span>, Marcus?`;
      const wrap = document.createElement('div');
      wrap.className = 'active-step';
      wrap.innerHTML = `
        <div class="step-head"><span class="step-label">working</span><span class="working-val">${state.working}</span></div>
        <div class="active-line">
          <span class="op">${state.d}</span>
          <span class="muted">×</span>
          <span class="muted">${state.y}</span>
          <span class="muted">=</span>
          <input class="box wide" id="input-p" inputmode="numeric" autocomplete="off" maxlength="4" aria-label="${state.d} times ${state.y}"/>
        </div>
      `;
      els.activeRow.appendChild(wrap);
      attachInput('input-p', onSubmitProduct);
      return;
    }

    if (state.phase === 'computeDiff') {
      els.prompt.className = 'prompt';
      els.prompt.innerHTML = `And <span class="hint">${state.working} − ${state.product}</span>, Marcus?`;
      const wrap = document.createElement('div');
      wrap.className = 'active-step';
      wrap.innerHTML = `
        <div class="step-head"><span class="step-label">working</span><span class="working-val">${state.working}</span></div>
        <div class="active-line">
          <span class="op">${state.d}</span>
          <span class="muted">×</span>
          <span class="muted">${state.y}</span>
          <span class="muted">=</span>
          <span class="muted">${state.product}</span>
        </div>
        <div class="active-line subline">
          <span class="muted">${state.working}</span>
          <span class="op">−</span>
          <span class="muted">${state.product}</span>
          <span class="muted">=</span>
          <input class="box wide" id="input-r" inputmode="numeric" autocomplete="off" maxlength="4" aria-label="${state.working} minus ${state.product}"/>
        </div>
      `;
      els.activeRow.appendChild(wrap);
      attachInput('input-r', onSubmitDiff);
      return;
    }
  }

  function pickDigitPrompt() {
    const lines = [
      `What is the highest number, Marcus, such that when you multiply it by <span class="hint">${state.y}</span> it stays at most <span class="hint">${state.working}</span>?`,
      `Marcus, what's the largest digit you can pick so that digit × <span class="hint">${state.y}</span> still fits inside <span class="hint">${state.working}</span>?`,
      `Highest single-digit number, Marcus, with that × <span class="hint">${state.y}</span> ≤ <span class="hint">${state.working}</span>?`,
    ];
    return lines[Math.floor(Math.random() * lines.length)];
  }

  function renderQuotient() {
    els.quotientList.innerHTML = '';

    // Show digits horizontally for long-division convention.
    state.steps.forEach((step, i) => {
      const span = document.createElement('span');
      span.className = `q ${colorClass(i)}`;
      span.textContent = step.d;
      els.quotientList.appendChild(span);
    });

    if (state.d != null && state.phase !== 'pickDigit' && state.phase !== 'done') {
      const span = document.createElement('span');
      span.className = `q tentative ${colorClass(state.steps.length)}`;
      span.textContent = state.d;
      els.quotientList.appendChild(span);
    }

    if (state.phase === 'done') {
      const total = state.steps.map(s => s.d).join('');
      const remainder = state.steps[state.steps.length - 1].diff;
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

  /* ---------- input handlers ---------- */

  function attachInput(id, handler) {
    const el = document.getElementById(id);
    if (!el) return;
    el.focus();
    el.addEventListener('keydown', handler);
    el.addEventListener('input', () => el.classList.remove('wrong'));
  }

  function shake(input) {
    input.classList.add('wrong');
    setTimeout(() => input.classList.remove('wrong'), 460);
    input.select();
  }

  function flashPrompt(html, cls = 'warn') {
    els.prompt.className = `prompt ${cls}`;
    els.prompt.innerHTML = html;
  }

  function isSubmitKey(e) {
    return e.key === 'Enter' || e.key === 'Tab';
  }

  function onSubmitDigit(e) {
    if (!isSubmitKey(e)) return;
    e.preventDefault();
    const input = e.currentTarget;
    const v = parseInt(input.value, 10);
    if (!Number.isFinite(v) || v < 0 || v > 9) return shake(input);
    if (v * state.y > state.working) {
      flashPrompt(
        `Hmm Marcus — <span class="hint">${v} × ${state.y} = ${v * state.y}</span>, that's bigger than ${state.working}. Try a smaller digit.`,
        'warn'
      );
      shake(input);
      return;
    }
    if ((v + 1) * state.y <= state.working) {
      flashPrompt(
        `That fits, Marcus, but you can go higher — try a bigger digit.`,
        'warn'
      );
      shake(input);
      return;
    }
    state.d = v;
    state.phase = 'computeProduct';
    renderActive();
    renderQuotient();
  }

  function onSubmitProduct(e) {
    if (!isSubmitKey(e)) return;
    e.preventDefault();
    const input = e.currentTarget;
    const v = parseInt(input.value, 10);
    if (v !== state.d * state.y) return shake(input);
    state.product = v;
    state.phase = 'computeDiff';
    renderActive();
  }

  function onSubmitDiff(e) {
    if (!isSubmitKey(e)) return;
    e.preventDefault();
    const input = e.currentTarget;
    const v = parseInt(input.value, 10);
    const expected = state.working - state.product;
    if (v !== expected) return shake(input);

    const step = {
      working: state.working,
      d: state.d,
      product: state.product,
      diff: expected,
      broughtDown: null,
    };

    if (state.consumed < state.xDigits.length) {
      // Bring down the next digit.
      const next = state.xDigits[state.consumed];
      state.consumed++;
      step.broughtDown = next;
      state.steps.push(step);
      state.working = expected * 10 + next;
      state.d = null;
      state.product = null;
      state.phase = 'pickDigit';
    } else {
      state.steps.push(step);
      state.phase = 'done';
    }
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

  newProblem();
})();
