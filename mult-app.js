(() => {
  'use strict';

  // Mouth point on the Tsunami image, expressed as fractions of the image.
  // The image is 1440x816; her open mouth sits on the right side, ~62% across,
  // ~56% down.
  const MOUTH_FX = 0.60;
  const MOUTH_FY = 0.62;

  // Three callouts. Callout 1 alternates red/black slowly; auto-advance.
  // colorCycle: list of {color, hold} states. After last state, advance.
  const CALLOUTS = [
    {
      html: 'Argh !!! I am mad !<br/>Why am I mad ???',
      bigText: true,
      colorCycle: [
        { color: '#d6453d', hold: 5000 },
        { color: '#000000', hold: 5000 },
        { color: '#d6453d', hold: 5000 },
        { color: '#000000', hold: 5000 },
      ],
    },
    {
      html: 'Because Starflight asked me to fill this <span class="cdot">S⋅T⋅U⋅P⋅I⋅D</span> multiplication table for the Jade Academy dragonets!',
      colorCycle: [{ color: '#000000', hold: 9000 }],
    },
    {
      html: 'Please Marcus, Clay told me you have fun with math. Please, pretty please, help me!',
      colorCycle: [{ color: '#000000', hold: 7500 }],
    },
  ];

  const els = {
    opening: document.getElementById('opening'),
    tsunami: document.getElementById('tsunami'),
    svg:     document.getElementById('callout-layer'),
    callout: document.getElementById('callout'),
    helpBtn: document.getElementById('help-button'),
  };

  let idx = 0;          // current callout index
  let cycleTimer = null;

  /* ---------- bubble path ---------- */

  function bubblePath(mouth, b, r = 24) {
    // Tail attaches at the left edge of the bubble.
    // Two attach points (upper, lower) are spaced ~70px apart.
    const tailUpY = b.y + b.h * 0.55;
    const tailLoY = b.y + b.h * 0.55 + 70;
    // Control points pull the tail outward (left) for a soft tikz-ish curve.
    const ctrl1 = { x: b.x - 60, y: tailUpY + 40 };
    const ctrl2 = { x: b.x - 60, y: tailLoY - 40 };

    return [
      `M ${b.x + r} ${b.y}`,
      `L ${b.x + b.w - r} ${b.y}`,
      `Q ${b.x + b.w} ${b.y} ${b.x + b.w} ${b.y + r}`,
      `L ${b.x + b.w} ${b.y + b.h - r}`,
      `Q ${b.x + b.w} ${b.y + b.h} ${b.x + b.w - r} ${b.y + b.h}`,
      `L ${b.x + r} ${b.y + b.h}`,
      `Q ${b.x} ${b.y + b.h} ${b.x} ${b.y + b.h - r}`,
      `L ${b.x} ${tailLoY}`,
      `Q ${ctrl2.x} ${ctrl2.y} ${mouth.x} ${mouth.y}`,
      `Q ${ctrl1.x} ${ctrl1.y} ${b.x} ${tailUpY}`,
      `L ${b.x} ${b.y + r}`,
      `Q ${b.x} ${b.y} ${b.x + r} ${b.y}`,
      'Z',
    ].join(' ');
  }

  /* ---------- layout / draw ---------- */

  function computeGeometry() {
    const W = window.innerWidth;
    const H = window.innerHeight;

    const r = els.tsunami.getBoundingClientRect();
    const mouth = {
      x: r.left + r.width * MOUTH_FX,
      y: r.top  + r.height * MOUTH_FY,
    };

    // Bubble: positioned to the right of the image, centered on the
    // image's vertical band so the tail doesn't shoot diagonally across.
    const gap = Math.max(24, W * 0.04);
    const bubbleX = Math.min(r.right + gap, W * 0.46);
    const bubbleW = W - bubbleX - W * 0.04;
    const bubbleH = Math.min(H * 0.7, Math.max(r.height * 1.4, 320));
    const imgCenterY = r.top + r.height / 2;
    let bubbleY = imgCenterY - bubbleH / 2;
    const minY = H * 0.04;
    const maxY = H - bubbleH - H * 0.04;
    bubbleY = Math.max(minY, Math.min(maxY, bubbleY));

    return {
      W, H,
      mouth,
      bubble: { x: bubbleX, y: bubbleY, w: bubbleW, h: bubbleH },
    };
  }

  function draw() {
    const geom = computeGeometry();
    els.svg.setAttribute('viewBox', `0 0 ${geom.W} ${geom.H}`);

    const data = CALLOUTS[idx];
    const path = bubblePath(geom.mouth, geom.bubble);
    const padX = 36;
    const padY = 28;

    const textCls = 'bubble-text' + (data.bigText ? ' big' : '');
    els.callout.innerHTML = `
      <path class="bubble" d="${path}" filter="url(#bubble-shadow)"></path>
      <foreignObject
        x="${geom.bubble.x + padX}"
        y="${geom.bubble.y + padY}"
        width="${geom.bubble.w - 2 * padX}"
        height="${geom.bubble.h - 2 * padY}">
        <div xmlns="http://www.w3.org/1999/xhtml" class="${textCls}" id="bubble-text">
          ${data.html}
        </div>
      </foreignObject>
    `;
  }

  /* ---------- sequencing ---------- */

  function setTextColor(color) {
    const t = document.getElementById('bubble-text');
    if (t) t.style.color = color;
  }

  function runColorCycle(cycle, onDone) {
    let i = 0;
    const step = () => {
      setTextColor(cycle[i].color);
      cycleTimer = setTimeout(() => {
        i++;
        if (i < cycle.length) step();
        else onDone();
      }, cycle[i].hold);
    };
    step();
  }

  function showCallout() {
    if (cycleTimer) { clearTimeout(cycleTimer); cycleTimer = null; }

    draw();

    const data = CALLOUTS[idx];
    runColorCycle(data.colorCycle, advance);
  }

  function advance() {
    if (cycleTimer) { clearTimeout(cycleTimer); cycleTimer = null; }
    if (idx < CALLOUTS.length - 1) {
      idx++;
      els.callout.classList.add('fading');
      setTimeout(() => {
        showCallout();
        // double rAF so the new content paints before un-fading
        requestAnimationFrame(() => requestAnimationFrame(() => {
          els.callout.classList.remove('fading');
        }));
      }, 240);
    } else {
      // Terminal — last callout stays visible, reveal the help button.
      els.helpBtn.classList.add('visible');
    }
  }

  // Clicking the callout skips the timer and advances.
  els.callout.addEventListener('click', advance);
  els.helpBtn.addEventListener('click', () => {
    document.getElementById('opening').classList.add('hide');
    const app = document.getElementById('table-app');
    app.hidden = false;
    requestAnimationFrame(() => app.classList.add('shown'));
    initTable();
  });

  window.addEventListener('resize', () => {
    // Re-draw with current text. Don't restart blink.
    draw();
    // Re-apply red class if currently red.
  });

  // Wait for image to load so getBoundingClientRect is accurate.
  if (els.tsunami.complete) {
    showCallout();
  } else {
    els.tsunami.addEventListener('load', showCallout, { once: true });
  }

  /* ====================================================================
     TABLE APP
     ==================================================================== */

  const N = 9;
  const tableState = {
    selectedRow: null,
    selectedCol: null,
    filled: new Map(), // "r,c" -> value
  };

  function key(r, c) { return `${r},${c}`; }
  function cellEl(r, c) {
    return document.querySelector(`#mult-table td.cell[data-row="${r}"][data-col="${c}"]`);
  }
  function colHeaderEl(c) {
    return document.querySelector(`#mult-table th.col-header[data-col="${c}"]`);
  }
  function rowHeaderEl(r) {
    return document.querySelector(`#mult-table th.row-header[data-row="${r}"]`);
  }

  function buildTable() {
    const t = document.getElementById('mult-table');
    t.innerHTML = '';
    for (let r = 0; r <= N; r++) {
      const tr = document.createElement('tr');
      for (let c = 0; c <= N; c++) {
        let cell;
        if (r === 0 && c === 0) {
          cell = document.createElement('th');
          cell.className = 'corner';
          cell.textContent = '×';
        } else if (r === 0) {
          cell = document.createElement('th');
          cell.className = 'col-header';
          cell.dataset.col = String(c);
          cell.textContent = c;
        } else if (c === 0) {
          cell = document.createElement('th');
          cell.className = 'row-header';
          cell.dataset.row = String(r);
          cell.textContent = r;
        } else {
          cell = document.createElement('td');
          cell.className = 'cell';
          cell.dataset.row = String(r);
          cell.dataset.col = String(c);
        }
        tr.appendChild(cell);
      }
      t.appendChild(tr);
    }
  }

  function updateHeaderHighlight() {
    document.querySelectorAll('#mult-table .col-header.selected, #mult-table .row-header.selected')
      .forEach(el => el.classList.remove('selected'));
    if (tableState.selectedCol) colHeaderEl(tableState.selectedCol).classList.add('selected');
    if (tableState.selectedRow) rowHeaderEl(tableState.selectedRow).classList.add('selected');
  }

  function clearWaves() {
    document.querySelectorAll('#mult-table td.cell.wave, #mult-table td.cell.intersection')
      .forEach(el => {
        el.classList.remove('wave', 'intersection');
        const r = +el.dataset.row;
        const c = +el.dataset.col;
        const v = tableState.filled.get(key(r, c));
        el.textContent = v != null ? v : '';
      });
  }

  function setPrompt(text, cls = '') {
    const p = document.getElementById('prompt');
    p.className = 'prompt' + (cls ? ' ' + cls : '');
    p.textContent = text;
  }

  // Engagement lines, rotated so it doesn't feel mechanical.
  const LINES = {
    correct: [
      (r, c, v) => `Yes Marcus! ${r} × ${c} = ${v}. Tsunami is so impressed.`,
      (r, c, v) => `Boom — ${r} × ${c} = ${v}! Way to go, Marcus.`,
      (r, c, v) => `${r} × ${c} = ${v}. You make this look easy, Marcus.`,
      (r, c, v) => `Brilliant, Marcus! ${r} × ${c} = ${v}.`,
      (r, c, v) => `${r} × ${c} = ${v}. Tsunami is doing a happy splash for you, Marcus!`,
      (r, c, v) => `Nailed it, Marcus — ${r} × ${c} = ${v}.`,
      (r, c, v) => `Yes! ${r} × ${c} = ${v}. Keep going, Marcus, Tsunami needs you!`,
    ],
    wrong: [
      (r, c) => `Almost, Marcus — what's ${r} × ${c}?`,
      (r, c) => `Hmm Marcus, give it another go. What's ${r} × ${c}?`,
      (r, c) => `So close, Marcus! Try ${r} × ${c} again.`,
      (r, c) => `Tsunami believes in you, Marcus. What's ${r} × ${c}?`,
      (r, c) => `Not quite Marcus — picture ${r} groups of ${c}.`,
    ],
    pickedCol: [
      (c) => `Great pick, Marcus! Now grab a row from the side.`,
      (c) => `Top row ${c}, nice. Pick a side number, Marcus.`,
      (c) => `Cool Marcus — now choose one from the side column.`,
    ],
    pickedRow: [
      (r) => `Nice, Marcus! Now pick a number from the top row.`,
      (r) => `Side row ${r} locked in. Grab a top number, Marcus.`,
      (r) => `Got it Marcus — now a number from up top.`,
    ],
    typing: [
      (r, c) => `Okay Marcus — what's ${r} × ${c}? Type it and hit Enter.`,
      (r, c) => `${r} × ${c} = ? Show Tsunami how it's done, Marcus.`,
      (r, c) => `Tsunami needs ${r} × ${c}. Over to you, Marcus.`,
    ],
    alreadyFilled: [
      (r, c, v) => `You already aced ${r} × ${c} = ${v}, Marcus. Pick another!`,
      (r, c, v) => `${r} × ${c} = ${v} is already in the bag, Marcus. Try a new pair.`,
    ],
    done: [
      `You did it, Marcus! Tsunami's whole STUPID table is full. She owes you.`,
      `Marcus, you finished the entire table! Tsunami is so so proud.`,
    ],
  };
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function maybeStartRound() {
    if (tableState.selectedRow == null || tableState.selectedCol == null) return;

    const r = tableState.selectedRow;
    const c = tableState.selectedCol;

    // Already filled? Just acknowledge and reset selection.
    if (tableState.filled.has(key(r, c))) {
      setPrompt(pick(LINES.alreadyFilled)(r, c, r * c), 'celebrate');
      tableState.selectedRow = null;
      tableState.selectedCol = null;
      updateHeaderHighlight();
      return;
    }

    // Tsunami wave!
    // Row & column reveal SIMULTANEOUSLY (both start at step 0)
    // but SEQUENTIALLY within each (one cell per step).
    const stepMs = 130;
    for (let cc = 1; cc < c; cc++) {
      const el = cellEl(r, cc);
      const stepIdx = cc - 1;
      setTimeout(() => {
        el.classList.add('wave');
        el.textContent = '';
      }, stepIdx * stepMs);
    }
    for (let rr = 1; rr < r; rr++) {
      const el = cellEl(rr, c);
      const stepIdx = rr - 1;
      setTimeout(() => {
        el.classList.add('wave', 'wave-col');
        el.textContent = '';
      }, stepIdx * stepMs);
    }

    // Intersection input appears once the tsunami has reached the cell.
    const lastStep = Math.max(c - 2, r - 2, 0);
    const inputDelay = (lastStep + 1) * stepMs + 80;
    setTimeout(() => {
      const cell = cellEl(r, c);
      cell.classList.add('intersection');
      cell.innerHTML = `<input class="prod-input" id="prod-input" inputmode="numeric" autocomplete="off" maxlength="3" aria-label="${r} times ${c}" />`;
      const inp = cell.querySelector('input');
      inp.focus();
      inp.addEventListener('keydown', onSubmitProduct);
      inp.addEventListener('input', () => inp.classList.remove('wrong'));
      setPrompt(pick(LINES.typing)(r, c));
    }, inputDelay);
  }

  function onSubmitProduct(e) {
    if (e.key !== 'Enter' && e.key !== 'Tab') return;
    e.preventDefault();
    const r = tableState.selectedRow;
    const c = tableState.selectedCol;
    const inp = e.currentTarget;
    const v = parseInt(inp.value, 10);
    if (v !== r * c) {
      inp.classList.add('wrong');
      setTimeout(() => inp.classList.remove('wrong'), 460);
      inp.select();
      setPrompt(pick(LINES.wrong)(r, c), '');
      return;
    }

    tableState.filled.set(key(r, c), v);
    saveProgress();
    clearWaves();
    const cell = cellEl(r, c);
    cell.classList.add('filled');
    cell.textContent = v;

    tableState.selectedRow = null;
    tableState.selectedCol = null;
    updateHeaderHighlight();

    if (tableState.filled.size === N * N) {
      maybeCelebrate();
    } else {
      setPrompt(pick(LINES.correct)(r, c, v), 'celebrate');
    }
  }

  function isAwaitingAnswer() {
    return !!document.querySelector('#mult-table td.cell.intersection .prod-input');
  }

  function onTableClick(e) {
    if (isAwaitingAnswer()) {
      const inp = document.getElementById('prod-input');
      if (inp) inp.focus();
      return;
    }
    const t = e.target.closest('th');
    if (!t) return;
    if (t.classList.contains('col-header')) {
      tableState.selectedCol = +t.dataset.col;
    } else if (t.classList.contains('row-header')) {
      tableState.selectedRow = +t.dataset.row;
    } else {
      return;
    }
    updateHeaderHighlight();
    // If only one is picked so far, nudge with a name.
    if (tableState.selectedRow == null) {
      setPrompt(pick(LINES.pickedCol)(tableState.selectedCol));
    } else if (tableState.selectedCol == null) {
      setPrompt(pick(LINES.pickedRow)(tableState.selectedRow));
    }
    maybeStartRound();
  }

  function initTable() {
    buildTable();
    document.getElementById('mult-table').addEventListener('click', onTableClick);
    document.getElementById('btn-reset').addEventListener('click', onResetClick);
    subscribeProgress();
  }

  function onResetClick() {
    if (tableState.filled.size === 0) return;
    const ok = window.confirm("Start over, Marcus? This clears every answer Tsunami has so far.");
    if (!ok) return;

    tableState.filled.clear();
    tableState.selectedRow = null;
    tableState.selectedCol = null;
    _celebrated = false;

    document.querySelectorAll('#mult-table td.cell').forEach(el => {
      el.classList.remove('filled', 'wave', 'wave-col', 'intersection');
      el.textContent = '';
    });
    updateHeaderHighlight();
    setPrompt(`Fresh start, Marcus! Pick a top number and a side number to begin.`, '');
    resetCloud();
  }

  /* ---------- Firestore sync (cross-device) ---------- */

  let _subscribed = false;
  const DOC_PATH = ['apps', 'marcus-mult'];

  function progressDoc() {
    return MarcusApps.db.collection(DOC_PATH[0]).doc(DOC_PATH[1]);
  }

  function applyRemoteFilled(filled) {
    // Add or update cells present in the remote payload.
    Object.keys(filled).forEach(k => {
      const v = filled[k];
      if (tableState.filled.get(k) === v) return;
      tableState.filled.set(k, v);
      const [r, c] = k.split(',').map(Number);
      const cell = cellEl(r, c);
      if (cell) {
        cell.classList.add('filled');
        cell.textContent = v;
      }
    });
    // Remove any cells the remote no longer has (e.g. a reset elsewhere).
    Array.from(tableState.filled.keys()).forEach(k => {
      if (filled[k] != null) return;
      tableState.filled.delete(k);
      const [r, c] = k.split(',').map(Number);
      const cell = cellEl(r, c);
      if (cell) {
        cell.classList.remove('filled');
        cell.textContent = '';
      }
    });
    maybeCelebrate();
  }

  function subscribeProgress() {
    if (_subscribed) return;
    if (!window.MarcusApps || !MarcusApps.ready || !MarcusApps.db) return;
    _subscribed = true;
    MarcusApps.ready.then(() => {
      progressDoc().onSnapshot(snap => {
        if (!snap.exists) return;
        const data = snap.data() || {};
        applyRemoteFilled(data.filled || {});
      }, err => console.warn('[mult] subscribe failed:', err));
    });
  }

  function saveProgress() {
    if (!window.MarcusApps || !MarcusApps.ready || !MarcusApps.db) return;
    MarcusApps.ready.then(() => {
      const obj = {};
      tableState.filled.forEach((v, k) => { obj[k] = v; });
      progressDoc().set({
        filled: obj,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: true }).catch(err => console.warn('[mult] save failed:', err));
    });
  }

  function resetCloud() {
    if (!window.MarcusApps || !MarcusApps.ready || !MarcusApps.db) return;
    MarcusApps.ready.then(() => {
      progressDoc().set({
        filled: {},
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      }).catch(err => console.warn('[mult] reset failed:', err));
    });
  }

  /* ---------- Sea-creature confetti finale ---------- */

  const CREATURES = ['🐳','🐋','🐬','🦭','🦦','🐟','🐠','🐡','🦈','🐙','🦑','🦀','🦞','🦐','🐢','🪼','🪸','🐚'];
  let _celebrated = false;

  function maybeCelebrate() {
    if (tableState.filled.size === N * N && !_celebrated) {
      _celebrated = true;
      setPrompt(pick(LINES.done), 'celebrate');
      seaCelebrate();
    } else if (tableState.filled.size < N * N) {
      _celebrated = false;
    }
  }

  function seaCelebrate() {
    const layer = document.createElement('div');
    layer.className = 'confetti';
    document.body.appendChild(layer);

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const vmin = Math.min(vw, vh);

    const REF_VMIN = 768;
    const scale = vmin / REF_VMIN;

    const pieces     = Math.round(Math.max(30, Math.min(200, 70 * scale)));
    const baseSize   = Math.max(26, Math.min(96, 46 * scale));
    const sizeJitter = baseSize * 0.7;

    const fallBase = 2.2 + (vh / 900) * 0.8;
    const fallJitter = 1.6;

    const currentDir = Math.random() < 0.5 ? -1 : 1;

    for (let i = 0; i < pieces; i++) {
      const piece = document.createElement('span');
      piece.textContent = CREATURES[Math.floor(Math.random() * CREATURES.length)];
      piece.style.left = `${Math.random() * 100}vw`;
      piece.style.animationDuration = `${fallBase + Math.random() * fallJitter}s`;
      piece.style.animationDelay = `${Math.random() * 0.6}s`;
      piece.style.fontSize = `${baseSize + Math.random() * sizeJitter}px`;
      const amp = (8 + Math.random() * 14) * currentDir;
      piece.style.setProperty('--dx', `${amp}vw`);
      layer.appendChild(piece);
    }

    setTimeout(() => layer.remove(), (fallBase + fallJitter + 0.6) * 1000 + 200);
  }
})();
