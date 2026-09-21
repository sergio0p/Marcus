/* Perfect-run star show.
   A big shiny star flies in flat, tilts Star-Wars style while it wanders,
   settles top-right, slams down as an ink stamp, then confetti and a
   congratulations message.

   Owns its own markup so division.html and star-demo.html cannot drift.
   Debug it from star-demo.html:
       StarShow.play()            run the whole thing
       StarShow.jump('settle')    snap to the start of a phase
       StarShow.timing.tilt3d=5000
       StarShow.reset()                                                   */
(function () {
  'use strict';

  var PHASES = ['fly2d', 'tilt3d', 'settle', 'stamp', 'finale'];

  // Durations in ms. Mutable so the demo page can retune them live.
  var timing = {
    fly2d:  2050,   // flat 2-D sweep in
    tilt3d: 3500,   // perspective tilt, rocking back and forth
    settle:  900,   // glide to the top-right corner
    stamp:   700,   // impact + ink
    finale:  520,   // confetti and the message
  };

  var FINAL_SCALE = 0.44;   // size once parked in the corner
  var MARGIN = 26;          // gap from the corner, px

  var CONFETTI_COLORS =
    ['#fff09e', '#ffc8a0', '#c5edcb', '#bedaf2', '#d9c8e8', '#d6453d', '#3aa847'];

  // Three staggered bursts read as a celebration building; one big dump
  // reads as a glitch. Mutable so the demo page can retune it live.
  var confettiConfig = {
    waves:     3,
    gap:     520,   // ms between waves
    pieces:   55,   // per wave, before the per-wave weighting below
  };

  var root = null, fly = null, tilt = null, svg = null;
  var runId = 0;
  var onPhase = null;
  var waveTimers = [];

  /* ---------- geometry ---------- */

  function starPath(cx, cy, R, r, points) {
    var pts = [], i, ang, rad;
    for (i = 0; i < points * 2; i++) {
      ang = (-90 + i * (180 / points)) * Math.PI / 180;
      rad = (i % 2 === 0) ? R : r;
      pts.push((cx + rad * Math.cos(ang)).toFixed(2) + ',' +
               (cy + rad * Math.sin(ang)).toFixed(2));
    }
    return 'M ' + pts.join(' L ') + ' Z';
  }

  var D = starPath(50, 50, 48, 18.5, 5);

  function starSize() {
    var m = Math.min(window.innerWidth, window.innerHeight);
    return Math.max(140, Math.min(340, m * 0.42));
  }

  // Everything is computed in px so each phase interpolates cleanly into
  // the next — mixing vw/vh with px across keyframes does not tween.
  function pose(x, y, s) { return 'translate(' + x + 'px, ' + y + 'px) scale(' + s + ')'; }
  function spin(rx, ry, rz) {
    return 'rotateX(' + rx + 'deg) rotateY(' + ry + 'deg) rotateZ(' + rz + 'deg)';
  }

  function corner() {
    var half = starSize() * FINAL_SCALE / 2;
    return {
      x:  (window.innerWidth  / 2) - half - MARGIN,
      y: -((window.innerHeight / 2) - half - MARGIN),
    };
  }

  /* ---------- choreography ---------- */

  function frames() {
    var w = window.innerWidth, h = window.innerHeight, c = corner();
    return {
      // Phase 1 — strictly 2-D: rotateX/rotateY stay at 0.
      fly2d: {
        fly: [pose(-w * 0.46, h * 0.38, 0.18),
              pose(-w * 0.06, -h * 0.04, 1.08),
              pose( w * 0.20, -h * 0.07, 1.18)],
        tilt: [spin(0, 0, -260), spin(0, 0, -40), spin(0, 0, 8)],
        easing: 'cubic-bezier(.22,.9,.3,1)',
      },
      // Phase 2 — the crawl tilt, rocking back and forth while it wanders.
      tilt3d: {
        fly: [pose( w * 0.20, -h * 0.07, 1.18),
              pose(-w * 0.18,  h * 0.06, 1.26),
              pose( w * 0.12,  h * 0.13, 1.12),
              pose(-w * 0.08, -h * 0.02, 1.22),
              pose(0, 0, 1.30)],
        tilt: [spin(0, 0, 8), spin(64, -16, 2), spin(14, 14, -6),
               spin(58, 10, 4), spin(22, -8, -2)],
        easing: 'ease-in-out',
      },
      // Phase 3 — level out and park in the corner.
      settle: {
        fly: [pose(0, 0, 1.30), pose(c.x * 0.7, c.y * 0.8, 0.8),
              pose(c.x, c.y, FINAL_SCALE * 1.22)],
        tilt: [spin(22, -8, -2), spin(6, -2, -8), spin(0, 0, -12)],
        easing: 'cubic-bezier(.3,.7,.25,1)',
      },
    };
  }

  /* ---------- markup ---------- */

  function build() {
    if (root) return root;
    root = document.createElement('div');
    root.className = 'star-show';
    root.id = 'star-show';
    root.setAttribute('aria-hidden', 'true');
    root.hidden = true;
    root.innerHTML =
      '<div class="star-fly"><div class="star-tilt">' +
        '<svg class="star-svg" viewBox="0 0 100 100" role="img" aria-label="Perfect run star">' +
          '<defs>' +
            '<linearGradient id="starMetal" x1="0" y1="0" x2="0.35" y2="1">' +
              '<stop offset="0%" stop-color="#fffbe8"/>' +
              '<stop offset="18%" stop-color="#eef1f5"/>' +
              '<stop offset="38%" stop-color="#ffdf7a"/>' +
              '<stop offset="58%" stop-color="#e5a824"/>' +
              '<stop offset="78%" stop-color="#fff3bd"/>' +
              '<stop offset="100%" stop-color="#bf8410"/>' +
            '</linearGradient>' +
            '<linearGradient id="starSheen" x1="0" y1="0" x2="1" y2="0">' +
              '<stop offset="0%" stop-color="#fff" stop-opacity="0"/>' +
              '<stop offset="50%" stop-color="#fff" stop-opacity="0.92"/>' +
              '<stop offset="100%" stop-color="#fff" stop-opacity="0"/>' +
            '</linearGradient>' +
            '<clipPath id="starClip"><path d="' + D + '"/></clipPath>' +
            // rubber stamp: low-frequency displacement gives a wavy, hand-cut
            // edge; the patch mask then knocks out only the brightest noise so
            // the ink reads solid with a few dry spots, not eaten away
            '<filter id="inkStamp" x="-25%" y="-25%" width="150%" height="150%">' +
              '<feTurbulence type="fractalNoise" baseFrequency="0.17" numOctaves="3" seed="11" result="grain"/>' +
              '<feDisplacementMap in="SourceGraphic" in2="grain" scale="3.4" xChannelSelector="R" yChannelSelector="G" result="rough"/>' +
              '<feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="4" seed="5" result="patch"/>' +
              '<feColorMatrix in="patch" type="luminanceToAlpha" result="patchA"/>' +
              '<feComponentTransfer in="patchA" result="patchMask">' +
                '<feFuncA type="linear" slope="3" intercept="-1.62"/>' +
              '</feComponentTransfer>' +
              '<feComposite in="rough" in2="patchMask" operator="out"/>' +
            '</filter>' +
          '</defs>' +
          '<g class="star-shiny">' +
            '<path d="' + D + '" fill="url(#starMetal)"/>' +
            '<g clip-path="url(#starClip)"><g class="sheen-wrap">' +
              '<rect x="-78" y="-30" width="26" height="160" fill="url(#starSheen)" transform="rotate(20 50 50)"/>' +
            '</g></g>' +
            '<path d="' + D + '" fill="none" stroke="#fff8d6" stroke-opacity="0.75" stroke-width="1.4"/>' +
          '</g>' +
          '<g class="star-ink"><path d="' + D + '" fill="#9e2b26" filter="url(#inkStamp)"/></g>' +
        '</svg>' +
      '</div></div>' +
      '<div class="congrats">' +
        '<span class="congrats-l1">Congratulations Marcus !!!</span>' +
        '<span class="congrats-l2">That was perfect !!!</span>' +
      '</div>';
    document.body.appendChild(root);
    fly  = root.querySelector('.star-fly');
    tilt = root.querySelector('.star-tilt');
    svg  = root.querySelector('.star-svg');
    return root;
  }

  function sizeStar() {
    var s = starSize();
    svg.setAttribute('width', s);
    svg.setAttribute('height', s);
  }

  /* ---------- playback ---------- */

  function run(el, keyframes, ms, easing) {
    return el.animate(keyframes.map(function (t) { return { transform: t }; }),
                      { duration: ms, easing: easing || 'ease-in-out', fill: 'forwards' });
  }

  function phase(name, f) {
    if (onPhase) onPhase(name);
    var a = run(fly, f.fly, timing[name], f.easing);
    var b = run(tilt, f.tilt, timing[name], f.easing);
    return Promise.all([a.finished, b.finished]);
  }

  function reduced() {
    return window.matchMedia &&
           window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function clearWaves() {
    waveTimers.forEach(clearTimeout);
    waveTimers = [];
  }

  function reset() {
    runId++;
    clearWaves();
    if (!root) return;
    [fly, tilt].forEach(function (el) {
      el.getAnimations().forEach(function (a) { a.cancel(); });
    });
    root.classList.remove('is-inked', 'is-done');
    root.hidden = true;
    Array.prototype.forEach.call(document.querySelectorAll('.confetti'),
      function (n) { n.remove(); });
    if (onPhase) onPhase(null);
  }

  function confetti(count) {
    var layer = document.createElement('div');
    layer.className = 'confetti';
    document.body.appendChild(layer);
    for (var i = 0; i < (count || 60); i++) {
      var piece = document.createElement('span');
      piece.style.left = (Math.random() * 100) + 'vw';
      piece.style.background = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
      piece.style.animationDuration = (1.6 + Math.random() * 1.6) + 's';
      piece.style.animationDelay = (Math.random() * 0.4) + 's';
      piece.style.transform = 'rotate(' + (Math.random() * 360) + 'deg)';
      layer.appendChild(piece);
    }
    setTimeout(function () { layer.remove(); }, 3500);
    return layer;
  }

  // Fires cfg.waves bursts spaced cfg.gap apart. The middle wave is the
  // heaviest and the last one the thinnest, so it swells and tails off
  // instead of looking like the same burst stamped out three times.
  function confettiWaves(cfg) {
    cfg = cfg || confettiConfig;
    var n = Math.max(1, cfg.waves | 0);
    var weight = [1, 1.35, 0.8];
    clearWaves();
    return new Promise(function (resolve) {
      for (var i = 0; i < n; i++) {
        (function (k) {
          waveTimers.push(setTimeout(function () {
            confetti(Math.round(cfg.pieces * (weight[k % weight.length])));
            if (k === n - 1) resolve();
          }, k * cfg.gap));
        })(i);
      }
    });
  }

  // Snap to the opening pose of a phase, no animation — for eyeballing a
  // single moment without sitting through the run-up.
  function jump(name) {
    build(); sizeStar(); reset(); runId++;
    root.hidden = false;
    var f = frames(), c = corner();
    var at = {
      fly2d:  [f.fly2d.fly[0],  f.fly2d.tilt[0]],
      tilt3d: [f.tilt3d.fly[1], f.tilt3d.tilt[1]],   // mid-tilt, the pose worth looking at
      settle: [f.settle.fly[0], f.settle.tilt[0]],
      stamp:  [pose(c.x, c.y, FINAL_SCALE), spin(0, 0, -12)],
      finale: [pose(c.x, c.y, FINAL_SCALE), spin(0, 0, -12)],
    }[name];
    if (!at) return;
    fly.style.transform = at[0];
    tilt.style.transform = at[1];
    if (name === 'stamp' || name === 'finale') root.classList.add('is-inked');
    if (name === 'finale') { root.classList.add('is-done'); confettiWaves(); }
    if (onPhase) onPhase(name);
  }

  function play() {
    build();
    sizeStar();
    reset();
    var me = ++runId;
    var alive = function () { return me === runId; };
    var f = frames(), c = corner();

    root.hidden = false;
    fly.style.transform = '';
    tilt.style.transform = '';

    var chain;
    if (reduced()) {
      // Skip the flight; go straight to the corner and stamp it.
      fly.style.transform = pose(c.x, c.y, FINAL_SCALE * 1.22);
      tilt.style.transform = spin(0, 0, -12);
      chain = Promise.resolve();
    } else {
      chain = phase('fly2d', f.fly2d)
        .then(function () { return alive() && phase('tilt3d', f.tilt3d); })
        .then(function () { return alive() && phase('settle', f.settle); });
    }

    return chain
      .then(function () {
        if (!alive()) return;
        if (onPhase) onPhase('stamp');
        root.classList.add('is-inked');          // metal -> ink, glow off
        return run(fly, [pose(c.x, c.y, FINAL_SCALE * 1.22),
                         pose(c.x, c.y, FINAL_SCALE * 0.92),
                         pose(c.x, c.y, FINAL_SCALE)],
                   timing.stamp, 'cubic-bezier(.2,1.6,.35,1)').finished;
      })
      .then(function () {
        if (!alive()) return;
        if (onPhase) onPhase('finale');
        root.classList.add('is-done');
        return confettiWaves();
      })
      .catch(function (err) {
        if (err && err.name === 'AbortError') return;   // reset mid-flight
        console.warn('[star-show]', err);
      });
  }

  window.StarShow = {
    PHASES: PHASES,
    timing: timing,
    play: play,
    jump: jump,
    reset: reset,
    confetti: confetti,
    confettiWaves: confettiWaves,
    confettiConfig: confettiConfig,
    onPhase: function (fn) { onPhase = fn; },
  };
})();
