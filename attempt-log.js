/* Attempt log — one Firestore row per answer Marcus submits.
   Rows are appended to /attempts and are create-only (see firestore.rules):
   the apps can write but never read back. Pull the log from the Firebase
   console or with the Admin SDK.

   Offline or mid-write failure, rows park in localStorage and are flushed
   on the next load, so a flaky connection loses nothing. */
(function () {
  'use strict';

  var QUEUE_KEY = 'marcusapps.attempts.pending';
  var MAX_QUEUE = 300;
  var MAX_FLUSH = 400;

  var MA = (window.MarcusApps = window.MarcusApps || {});

  var sessionId = rid();
  var problem = null;           // { id, openedAt, meta }
  var openedAt = Date.now();    // when the live input was put in front of him

  function rid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  function iso(ms) {
    return new Date(ms).toISOString();
  }

  function readQueue() {
    try { return JSON.parse(localStorage.getItem(QUEUE_KEY)) || []; }
    catch (e) { return []; }
  }

  function writeQueue(rows) {
    try { localStorage.setItem(QUEUE_KEY, JSON.stringify(rows.slice(-MAX_QUEUE))); }
    catch (e) { /* private mode or quota — nothing useful to do */ }
  }

  function enqueue(row) {
    writeQueue(readQueue().concat([row]));
  }

  function stamped(row, user) {
    return Object.assign({}, row, {
      uid: user ? user.uid : null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  }

  function push(row) {
    if (!MA.db || !MA.ready) { enqueue(row); return; }
    MA.ready.then(function (user) {
      return MA.db.collection('attempts').add(stamped(row, user));
    }).catch(function (err) {
      console.warn('[attempts] write failed, queued:', err);
      enqueue(row);
    });
  }

  function flushQueue() {
    var pending = readQueue();
    if (!pending.length || !MA.db || !MA.ready) return;
    var batch = pending.slice(0, MAX_FLUSH);
    writeQueue(pending.slice(batch.length));
    MA.ready.then(function (user) {
      var wb = MA.db.batch();
      batch.forEach(function (row) {
        wb.set(MA.db.collection('attempts').doc(),
               Object.assign(stamped(row, user), { replayed: true }));
      });
      return wb.commit();
    }).catch(function (err) {
      console.warn('[attempts] flush failed, re-queued:', err);
      writeQueue(batch.concat(readQueue()));
    });
  }

  MA.log = {
    // Call when a fresh problem goes on screen. `meta` (app, x, y, level…)
    // is merged into every row belonging to this problem.
    startProblem: function (meta) {
      problem = { id: rid(), openedAt: Date.now(), meta: meta || {} };
      openedAt = problem.openedAt;
      return problem.id;
    },

    // Restart the clock — the input just became answerable (rendered and
    // focused, or the splash finally got out of the way).
    open: function () {
      openedAt = Date.now();
    },

    attempt: function (data) {
      var now = Date.now();
      var row = Object.assign(
        {
          app: 'unknown',
          sessionId: sessionId,
          problemId: problem ? problem.id : null,
          problemOpenedAt: problem ? iso(problem.openedAt) : null,
          openedAt: iso(openedAt),
          submittedAt: iso(now),
          ms: now - openedAt,
        },
        problem ? problem.meta : {},
        data
      );
      openedAt = now;   // a retry of the same step is timed from here
      push(row);
      return row;
    },
  };

  if (MA.ready) MA.ready.then(flushQueue);
})();
