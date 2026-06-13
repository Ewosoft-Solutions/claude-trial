/* ============================================================
   AI Assistant — renderer + interactions
   Backdrop dashboard (from ROLE_DATA) + AI surface (from AI_DATA)
   Patterns: bubble (FAB) · bar (omnibox) · rail (companion)
   ============================================================ */
(function () {
  var S = { role: 'student', pattern: 'bubble', view: 'live', sys: 'tutor', open: true, justOpened: true, flagOpen: null, flagFb: {}, monFb: null,
            pending: false, pendTimer: null, readyUnseen: 0, toast: null, toastTimer: null, int: null, intTimer: null };
  var convo = {};
  var frame = document.getElementById('ai-frame');
  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); };
  var glyph = function (sys) { return sys === 'tutor' ? '✦' : sys === 'integrity' ? '⚑' : '▤'; };

  /* notification toast above the closed bubble */
  function raiseToast(kind, text) {
    S.toast = { kind: kind, text: text };
    if (S.toastTimer) clearTimeout(S.toastTimer);
    S.toastTimer = setTimeout(function () { S.toast = null; S.toastTimer = null; render(); }, 4600);
  }
  function clearReady() {
    S.readyUnseen = 0;
    if (S.toast && S.toast.kind === 'ready') { S.toast = null; if (S.toastTimer) clearTimeout(S.toastTimer); }
  }

  function info() { return window.AI_DATA[S.role]; }
  function block() { return info()[S.sys]; }
  function key() { return S.role + '|' + S.sys; }
  function seedConvo() { if (!convo[key()]) convo[key()] = [{ who: 'bot', text: block().seed }]; }

  /* ---------- backdrop regions ---------- */
  function railHTML(d) {
    return '<div class="logo"></div>' + d.rail.map(function (ic, i) {
      return '<div class="ri' + (i === d.railOn ? ' on' : '') + (i === d.rail.length - 1 ? ' spring' : '') + '">' + ic + '</div>';
    }).join('');
  }
  function navHTML(d) {
    return '<div class="nav-h"><b>' + d.who.split(' ')[0] + '</b><span style="color:var(--ink-faint)">‹‹</span></div>' +
      d.nav.map(function (n) {
        if (n.group) return '<div class="grp-label">' + n.group + '</div>';
        return '<div class="nitem' + (n.on ? ' on' : '') + '"><span class="ti"></span><span>' + n.t + '</span>' + (n.cnt ? '<span class="cnt">' + n.cnt + '</span>' : '') + '</div>';
      }).join('');
  }
  function backdropMain(d) {
    var kpis = '<div class="kpis">' + d.kpis.slice(0, 5).map(function (k) {
      return '<div class="kpi-card"><span class="lab">' + k[0] + '</span><span class="val">' + k[1] + '</span>' + (k[2] ? '<span class="tr' + (k[3] ? ' down' : '') + '">' + k[2] + '</span>' : '') + '</div>';
    }).join('') + '</div>';
    var attn = '<div class="panel"><div class="ph"><b>Needs attention</b><span class="more">' + d.attention.length + ' items</span></div>' +
      d.attention.slice(0, 3).map(function (a) {
        return '<div class="attn-row"><span class="ic ' + (a[1] || '') + '">' + a[0] + '</span><div class="tx">' + a[2] + '<small>' + a[3] + '</small></div><span class="go">›</span></div>';
      }).join('') + '</div>';
    var quick = '<div class="panel"><div class="ph"><b>Quick actions</b></div><div class="qa-grid">' +
      d.quick.map(function (q) { return '<div class="qa' + (q[2] ? ' pri' : '') + '"><span class="ic">' + q[0] + '</span>' + q[1] + '</div>'; }).join('') + '</div></div>';
    return kpis + '<div class="cols">' + attn + quick + '</div>';
  }
  function topbarHTML(d) {
    var center = S.pattern === 'bar'
      ? '<div class="ai-omni sys-' + S.sys + '" data-ai-act="open"><span class="g">' + glyph(S.sys) + '</span> Ask AI, or search your school… <span class="kbd">⌘K</span></div>'
      : '<div class="search"><span>⌕</span> Search… <span class="kbd">⌘K</span></div>';
    return '<div class="tenant"><span class="sq"></span> ' + d.tenant + (d.tenantSwitch ? ' <span style="color:var(--ink-faint)">▾</span>' : '') + '</div>' +
      '<div class="crumbs">' + d.crumb.map(function (p, i) { return (i ? '<span class="sep">▸</span>' : '') + '<span class="' + (i === d.crumb.length - 1 ? 'cur' : '') + '">' + p + '</span>'; }).join('') + '</div>' +
      center + '<div class="tb-icons"><span class="ico">◔</span><span class="ico">⚑</span><span class="av">' + d.avatar + '</span></div>';
  }

  /* ---------- AI result widgets ---------- */
  function fmt(t) { return esc(t).replace(/\n/g, '<br>'); }
  function resultHTML(r) {
    if (!r) return '';
    if (r.type === 'stat') return '<div class="ai-res"><div class="big">' + r.big + '<small>' + r.sub + '</small></div></div>';
    if (r.type === 'list') return '<div class="ai-res">' + r.rows.map(function (row) {
      return '<div class="ai-rrow"><span class="nm">' + esc(row[0]) + '</span><span class="pill2' + (row[2] ? ' ' + row[2] : '') + '">' + esc(row[1]) + '</span></div>';
    }).join('') + '</div>';
    if (r.type === 'bars') return '<div class="ai-res"><div class="bars">' + r.heights.map(function (h, i) {
      return '<i class="' + (i === r.hl ? 'hl' : '') + '" style="height:' + h + '%"></i>';
    }).join('') + '</div><div class="xl">' + (r.x || []).map(function (s) { return '<span>' + s + '</span>'; }).join('') + '</div></div>';
    if (r.type === 'qlist') return '<div class="ai-res">' + r.items.map(function (q, i) {
      return '<div class="ai-qitem"><span class="qn">' + (i + 1) + '</span><span>' + esc(q) + '</span></div>';
    }).join('') + '</div>';
    return '';
  }
  function botBubble(m) {
    if (m._pending) return '<div class="ai-msg bot"><span class="b-ava">' + glyph(S.sys) + '</span><div class="ai-bubble typing"><span class="td"><i></i><i></i><i></i></span></div></div>';
    var srcs = (m.sources && m.sources.length) ? '<div class="ai-sources">' + m.sources.map(function (s) { return '<span class="ai-src"><span class="g">◫</span> ' + esc(s) + '</span>'; }).join('') + '</div>' : '';
    var acts = (m.actions && m.actions.length) ? '<div class="ai-actions">' + m.actions.map(function (a) { return '<span class="ai-act" data-ai-act="ask" data-q="' + esc(a) + '">' + esc(a) + '</span>'; }).join('') + '</div>' : '';
    return '<div class="ai-msg bot"><span class="b-ava">' + glyph(S.sys) + '</span><div class="ai-bubble">' + fmt(m.text) + resultHTML(m.result) + srcs + acts + '</div></div>';
  }
  function convoHTML() {
    return '<div class="ai-convo" id="ai-convo">' + convo[key()].map(function (m) {
      return m.who === 'user' ? '<div class="ai-msg user">' + fmt(m.text) + '</div>' : botBubble(m);
    }).join('') + '</div>';
  }
  function suggestHTML() {
    return '<div class="ai-suggest"><span class="sg-lab">Try asking</span>' + block().suggest.map(function (q) {
      return '<span class="ai-chip" data-ai-act="ask" data-q="' + esc(q) + '"><span class="g">' + glyph(S.sys) + '</span>' + esc(q) + '</span>';
    }).join('') + '</div>';
  }
  function inputHTML() {
    return '<div class="ai-input"><input class="ai-field" placeholder="' + (S.sys === 'tutor' ? 'Ask about your lesson…' : 'Ask about your data…') + '"><span class="ai-send" data-ai-act="send">➤</span></div>';
  }

  /* ---------- assessment states ---------- */
  function lockedHTML() {
    return '<div class="ai-locked"><div class="lk">🔒</div><h4>AI Tutor is paused</h4>' +
      '<p>You\'re in a protected assessment. The Study Companion is off so the work stays your own.</p>' +
      '<span class="resume">Resumes automatically when the exam ends</span></div>';
  }
  function integrityData() { return window.AI_INTEGRITY[S.role] || window.AI_INTEGRITY.teacher; }
  function ensureInt() {
    var M = window.AI_INTEGRITY[S.role];
    if (!M) { S.int = { role: S.role, flags: [], queue: [], unseen: 0, viewed: false }; return; }
    if (!S.int || S.int.role !== S.role) {
      S.int = {
        role: S.role,
        flags: JSON.parse(JSON.stringify(M.flags)),
        queue: M.incoming ? [JSON.parse(JSON.stringify(M.incoming))] : [],
        unseen: 0, viewed: false
      };
    }
  }
  function flagCount() { return S.int ? S.int.flags.length : integrityData().flags.length; }
  function integrityHTML() {
    var I = integrityData();
    var rows = S.int.flags.map(function (f, i) {
      var open = S.flagOpen === i, fb = S.flagFb[i];
      var rib = f._new ? '<span class="new-rib">NEW</span>' : '';
      var status = fb === 'confirm' ? '<span class="sev done">Confirmed</span>'
        : fb === 'false' ? '<span class="sev muted">Dismissed</span>'
          : '<span class="sev ' + (f.hot ? 'hi' : '') + '">' + f.sev + '</span>';
      var detail = open ? '<div class="ai-flag-detail">' +
        '<div class="fd-meta">' + f.meta.map(function (m) { return '<span><i>' + esc(m[0]) + '</i>' + esc(m[1]) + '</span>'; }).join('') + '</div>' +
        '<p class="fd-note">' + esc(f.detail) + '</p>' +
        '<div class="fd-fb"><span class="fd-lab">Is this flag accurate?</span>' +
        '<span class="fb-btn ' + (fb === 'confirm' ? 'on ok' : '') + '" data-ai-act="fb" data-i="' + i + '" data-v="confirm">✓ Confirm</span>' +
        '<span class="fb-btn ' + (fb === 'false' ? 'on no' : '') + '" data-ai-act="fb" data-i="' + i + '" data-v="false">✕ False positive</span>' +
        '<span class="fb-btn" data-ai-act="fb" data-i="' + i + '" data-v="note">✎ Add note</span></div>' +
        (fb ? '<div class="fd-sent">Recorded — your feedback tunes exam-integrity detection and keeps a human in the loop.</div>' : '') +
        '</div>' : '';
      return '<div class="ai-flag ' + (open ? 'open' : '') + (f._new ? ' isnew' : '') + '">' +
        '<div class="ai-flag-row" data-ai-act="flag" data-i="' + i + '">' +
        '<span class="fi ' + (f.hot ? 'hot' : '') + '">' + f.glyph + '</span>' +
        '<div class="ftx"><b>' + rib + esc(f.title) + '</b><small>' + esc(f.sub) + '</small></div>' +
        status + '<span class="exp">' + (open ? '∧' : '∨') + '</span></div>' + detail + '</div>';
    }).join('');
    var foot = '<div class="ai-mon-foot"><span><span class="livedot"></span>' + esc(I.live) + ' · updates live</span>' +
      '<span class="mon-fb">Useful?<b class="' + (S.monFb === 'up' ? 'on' : '') + '" data-ai-act="monfb" data-v="up">Yes</b>' +
      '<b class="' + (S.monFb === 'down' ? 'on' : '') + '" data-ai-act="monfb" data-v="down">No</b></span></div>';
    return '<div class="ai-integrity">' +
      '<div class="ai-int-banner"><span class="bi">⚑</span><div><b>' + I.headline + '</b><small>' + I.scope + '</small></div></div>' +
      '<div class="ai-int-hint">Your assistant stays available — this monitor tracks integrity <b>in parallel</b> and keeps watching even when the bubble is closed. Tap any flag for detail and to confirm or dismiss it.</div>' +
      rows + foot + '</div>';
  }

  /* ---------- panel assembly ---------- */
  function isMonitor() { return info().examRole === 'monitor'; }
  function isLearnerLock() { return S.view === 'assessment' && info().examRole === 'learner' && S.sys === 'tutor'; }
  function isInt() { return S.sys === 'integrity'; }
  function availableSystems() {
    var sys = info().systems.slice();
    if (S.view === 'assessment' && isMonitor()) sys.push('integrity');
    return sys;
  }

  function headHTML(docked) {
    var name = isInt() ? 'Integrity Monitor' : block().name;
    var tag = isInt() ? 'Academic integrity · live oversight'
      : (S.sys === 'tutor' ? 'Academic AI · learning companion' : 'Analytics AI · operational intelligence');
    var close = docked ? '<span class="x" title="docked">⇥</span>' : '<span class="x" data-ai-act="close">✕</span>';
    return '<div class="ai-head"><span class="ai-ava">' + glyph(S.sys) + '</span><div class="ai-name">' + name + '<small>' + tag + '</small></div>' + close + '</div>';
  }
  function modebarHTML() {
    var sys = availableSystems();
    if (sys.length < 2) return '';
    var labels = { tutor: 'Learning', data: 'Ask data', integrity: 'Integrity' };
    var tabs = sys.map(function (s) {
      var on = s === S.sys;
      var cls = s === 'tutor' ? 't-tutor' : s === 'data' ? 't-data' : 't-int';
      var badge = s === 'integrity'
        ? '<span class="tb-badge' + (S.int && S.int.unseen && !(on) ? ' has-new' : '') + '">' + flagCount() + '</span>'
        : '';
      return '<span class="ai-tab ' + cls + (on ? ' on' : '') + '" data-ai-act="mode" data-sys="' + s + '"><span class="g">' + glyph(s) + '</span>' + labels[s] + badge + '</span>';
    }).join('');
    var lab = isInt() ? 'exam oversight' : S.sys === 'tutor' ? 'grounded in lessons' : 'role-scoped data';
    return '<div class="ai-modebar">' + tabs + '<span class="sys-label">' + lab + '</span></div>';
  }
  function scopeHTML() {
    if (isInt()) return '';
    if (isLearnerLock()) return '<div class="ai-scope"><span class="pin" style="border-color:var(--note);color:var(--note);"><span class="g">⚑</span> Exam in progress · Tutor paused</span></div>';
    var examNote = '';
    if (S.view === 'assessment') {
      examNote = isMonitor()
        ? '<span class="pin" style="border-color:var(--note);color:var(--note);"><span class="g">⚑</span> Exam live · staff AI active</span>'
        : '<span class="pin" style="border-color:var(--note);color:var(--note);"><span class="g">⚑</span> Exam live · analytics unaffected</span>';
    }
    var b = block();
    var pin = S.sys === 'tutor'
      ? '<span class="pin"><span class="g">◫</span> ' + esc(b.context) + '</span>'
      : '<span class="pin"><span class="g">▦</span> ' + esc(b.scope) + '</span>';
    var lock = S.sys === 'tutor' ? '<span class="lock">grounded · source-linked</span>' : '<span class="lock">🔒 role-scoped access</span>';
    return '<div class="ai-scope">' + examNote + pin + lock + '</div>';
  }
  function panelBody() {
    if (isInt()) return integrityHTML();
    if (isLearnerLock()) return lockedHTML();
    seedConvo();
    return convoHTML() + suggestHTML() + inputHTML();
  }
  function panelInner(docked) {
    return headHTML(docked) + modebarHTML() + scopeHTML() + panelBody();
  }

  /* ---------- full render ---------- */
  function render() {
    ensureInt();
    var d = window.ROLE_DATA[S.role];
    var bodyExtra = S.pattern === 'rail' ? '<div class="ai-companion"><div class="ai-panel sys-' + S.sys + '">' + panelInner(true) + '</div></div>' : '';
    var overlay = '';
    var intro = S.justOpened ? ' intro' : '';
    if (S.pattern === 'bubble') {
      var alertN = (S.view === 'assessment' && isMonitor() && S.int) ? S.int.unseen : 0;
      var readyN = S.readyUnseen || 0;
      var badgeN = alertN || readyN;
      var fabCls = 'ai-fab sys-' + S.sys + (!S.open && alertN ? ' alert' : '') + (!S.open && readyN && !alertN ? ' ready' : '');
      var fabGlyph = (!S.open && alertN) ? '⚑' : glyph(S.sys);
      var fabLabel = S.open ? 'Close assistant'
        : alertN ? (alertN + ' new case' + (alertN > 1 ? 's' : ''))
          : readyN ? 'Answer ready'
            : 'Ask AI';
      var fabBadge = (!S.open && badgeN) ? '<span class="fab-badge">' + badgeN + '</span>' : '';
      var toastHTML = (!S.open && S.toast) ? '<div class="ai-toast ' + S.toast.kind + '" data-ai-act="opennotif">' + esc(S.toast.text) + '</div>' : '';
      overlay = (S.open ? '<div class="ai-scrim" data-ai-act="close"></div><div class="ai-panel float' + intro + ' sys-' + S.sys + '">' + panelInner(false) + '</div>' : '') +
        toastHTML +
        '<div class="' + fabCls + '" data-ai-act="toggle">' + fabBadge + '<span class="glyph">' + fabGlyph + '</span> ' + fabLabel + ' <span class="pulse"></span></div>';
    } else if (S.pattern === 'bar') {
      overlay = (S.open ? '<div class="ai-scrim" data-ai-act="close"></div><div class="ai-panel dropdown' + intro + ' sys-' + S.sys + '">' + panelInner(false) + '</div>' : '');
    }
    S.justOpened = false;
    /* arriving on the integrity tab counts as seeing the flags */
    if (S.open && isInt() && S.int) { S.int.unseen = 0; S.int.viewed = true; }
    frame.className = 'frame ai-host';
    frame.innerHTML =
      '<div class="topbar">' + topbarHTML(d) + '</div>' +
      '<div class="body"><div class="rail">' + railHTML(d) + '</div><div class="nav">' + navHTML(d) + '</div>' +
      '<div class="main"><div class="main-head"><div style="display:flex;flex-direction:column;gap:1px;min-width:0;"><h3>' + d.hello + '</h3><span class="sub">Term 3 · 2024</span></div><div class="actions"><span class="btn pri">' + d.quick[0][0] + ' ' + d.quick[0][1] + '</span></div></div>' +
      '<div class="main-body scrolly">' + backdropMain(d) + '</div></div>' + bodyExtra + '</div>' +
      '<div class="statusbar"><span class="s-dot"></span> Synced · just now <span>·</span> ' + d.tenant + ' <span class="spring"></span> AI: ' + (S.view === 'assessment' ? 'exam-safe mode' : 'on') + ' <span>⌘K to ask</span></div>' +
      overlay;
    var c = document.getElementById('ai-convo'); if (c) c.scrollTop = c.scrollHeight;
    armIntTimer();
    syncControls();
    syncNotes();
  }

  /* ---------- live integrity arrivals (fires while you're away / on another tab) ---------- */
  function armIntTimer() {
    var active = S.view === 'assessment' && isMonitor() && S.int && S.int.queue.length;
    if (active && !S.intTimer) {
      S.intTimer = setTimeout(function () {
        S.intTimer = null;
        if (!(S.view === 'assessment' && isMonitor()) || !S.int) return;
        var f = S.int.queue.shift(); if (!f) return;
        f._new = true; S.int.flags.unshift(f);
        var watching = S.open && isInt();
        if (watching) {
          if (S.flagOpen != null) S.flagOpen++;   // keep the open flag aligned after unshift
        } else {
          S.int.unseen++;
          if (!S.open) raiseToast('alert', '⚑ New integrity flag · ' + f.title);
        }
        render();
      }, 3600);
    }
    if (!active && S.intTimer) { clearTimeout(S.intTimer); S.intTimer = null; }
  }

  /* ---------- interactions ---------- */
  function ask(q) {
    if (isLearnerLock() || isInt() || S.pending) return;
    seedConvo();
    var b = block();
    var a = b.answers[q] || b.fallback;
    var k = key();
    convo[k].push({ who: 'user', text: q });
    convo[k].push({ who: 'bot', _pending: true });
    S.pending = true;
    render();
    S.pendTimer = setTimeout(function () {
      S.pendTimer = null; S.pending = false;
      var arr = convo[k];
      for (var j = arr.length - 1; j >= 0; j--) { if (arr[j]._pending) { arr[j] = Object.assign({ who: 'bot' }, a); break; } }
      // delivered while the user was away (closed, or moved to another conversation)?
      if (!(S.open && key() === k && !isInt())) {
        S.readyUnseen = (S.readyUnseen || 0) + 1;
        if (!S.open) raiseToast('ready', '✦ Answer ready — tap to view');
      }
      render();
    }, 1300);
  }
  frame.addEventListener('click', function (e) {
    var el = e.target.closest('[data-ai-act]'); if (!el) return;
    var a = el.dataset.aiAct;
    // once the integrity list has actually been viewed, clear the NEW ribbons on the next action
    if (S.int && S.int.viewed && a !== 'flag' && a !== 'fb') { S.int.flags.forEach(function (f) { f._new = false; }); S.int.viewed = false; }
    if (a === 'toggle') { S.open = !S.open; if (S.open) { S.justOpened = true; clearReady(); } }
    else if (a === 'open') { if (!S.open) S.justOpened = true; S.open = true; clearReady(); }
    else if (a === 'opennotif') {
      if (!S.open) S.justOpened = true;
      S.open = true;
      if (S.toast && S.toast.kind === 'alert' && S.view === 'assessment' && isMonitor()) S.sys = 'integrity';
      clearReady();
      if (S.toast) { S.toast = null; if (S.toastTimer) clearTimeout(S.toastTimer); }
    }
    else if (a === 'close') S.open = false;
    else if (a === 'mode') { S.sys = el.dataset.sys; }
    else if (a === 'flag') { var fi = +el.dataset.i; S.flagOpen = (S.flagOpen === fi ? null : fi); }
    else if (a === 'fb') { S.flagFb[+el.dataset.i] = el.dataset.v; }
    else if (a === 'monfb') { S.monFb = el.dataset.v; }
    else if (a === 'ask') { ask(el.dataset.q); return; }
    else if (a === 'send') {
      var f = frame.querySelector('.ai-field'); var v = f && f.value.trim();
      if (v) { ask(v); } return;
    }
    render();
  });
  frame.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.classList.contains('ai-field')) {
      e.preventDefault(); var v = e.target.value.trim(); if (v) ask(v);
    }
  });

  /* ---------- switcher controls ---------- */
  function setRole(r) {
    S.role = r; S.flagOpen = null; S.flagFb = {}; S.monFb = null;
    if (S.view === 'assessment' && window.AI_DATA[r].examRole === 'monitor') S.sys = 'integrity';
    else S.sys = window.AI_DATA[r].systems[0];
    render();
  }
  function syncControls() {
    document.querySelectorAll('[data-role]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-role') === S.role)); });
    document.querySelectorAll('[data-pattern]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-pattern') === S.pattern)); });
    document.querySelectorAll('[data-view]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-view') === S.view)); });
  }
  document.querySelectorAll('[data-role]').forEach(function (b) { b.addEventListener('click', function () { setRole(b.getAttribute('data-role')); }); });
  document.querySelectorAll('[data-pattern]').forEach(function (b) { b.addEventListener('click', function () { S.pattern = b.getAttribute('data-pattern'); S.open = true; S.justOpened = true; render(); }); });
  document.querySelectorAll('[data-view]').forEach(function (b) { b.addEventListener('click', function () {
    S.view = b.getAttribute('data-view'); S.flagOpen = null;
    if (S.view === 'assessment' && isMonitor()) S.sys = 'integrity';
    else if (S.view === 'live' && S.sys === 'integrity') S.sys = info().systems[0];
    render();
  }); });

  /* ---------- margin notes (role/state aware) ---------- */
  function syncNotes() {
    var n = document.getElementById('ai-notes'); if (!n) return;
    var i = info(), two = i.systems.length > 1;
    var note = function (g, t, p) { return '<div class="note"><span class="n">' + g + '</span><div><b>' + t + '</b><p>' + p + '</p></div></div>'; };
    var html;
    if (S.view === 'assessment') {
      html = i.examRole === 'learner'
        ? note('🔒', 'Student Tutor paused', 'For students, the Academic Tutor is force-disabled during a protected exam — no answers, no hints. It resumes automatically when the exam ends.') +
          note('▤', 'Only the Tutor', 'Coaching is what\'s blocked. A student\'s own non-coaching data (their deadlines, attendance) can\'t help them cheat, so it stays reachable.') +
          note('⚑', 'Integrity by default', 'The lock is enforced by the platform the moment an assessment opens — never left to the student to honour.') +
          note('→', 'See the other side', 'Switch the role above to a teacher or principal to watch the parallel integrity monitor.')
        : i.examRole === 'monitor'
          ? note('✦', 'AI stays on for staff', 'Teachers and leaders keep their <b>full assistant</b> during exams — only the student-facing Tutor is locked. AI never goes dark for the people running the assessment.') +
            note('⚑', 'Integrity, in parallel', 'A dedicated <b>Integrity</b> tab tracks blocked prompts, tab-switching and anomalies as live flags — a separate track beside the assistant, not a replacement for it.') +
            note('◷', 'Detail + human feedback', 'Every flag expands for context and meta, and staff can <b>Confirm</b> or mark a <b>False positive</b> — feedback that tunes detection and keeps a person in the loop.') +
            note('◔', 'Alerts come to you', 'Close the bubble and the monitor keeps watching. When a fresh case arrives it <b>badges the bubble and raises a toast</b> — try it: close the assistant and wait a moment for a new flag to land.')
          : note('▤', 'Analytics unaffected', 'Operational roles keep full Analytics during exams — assessment rules only touch the student-facing Tutor, not back-office data.') +
            note('⚑', 'No oversight tab here', 'This role isn\'t an invigilator, so the integrity monitor doesn\'t surface — it appears for teachers and academic leaders.') +
            note('🔒', 'Integrity by default', 'Across the school the student Tutor is locked automatically the moment any assessment opens.') +
            note('→', 'See the monitor', 'Switch to a teacher or principal to view the parallel integrity track.');
    } else {
      html = note('✦', 'Two systems, one launcher', two
          ? 'This role gets both: the <b>Academic Tutor</b> (lesson-grounded, source-linked) and <b>Analytics</b> (role-scoped data Q&A). Toggle them in the panel tabs.'
          : 'This role gets the <b>Analytics AI</b> — natural-language questions answered against the data they\'re allowed to see.') +
        note('▦', 'Role-scoped', 'Scope is enforced and shown up top: <b>' + esc((i[S.sys] || i.data).scope || (i.tutor && i.tutor.context) || '') + '</b>. The assistant never reaches beyond it.') +
        note('◫', 'Explainable', 'Tutor answers cite their source materials; Analytics answers show the figures behind them. No black box.') +
        note('●', 'Never miss a reply', 'Answers take a moment to arrive. Ask something, then <b>close the bubble before it finishes</b> — when the reply lands the bubble badges you and offers a tap to read it. Nothing gets lost behind a closed panel.');
    }
    n.innerHTML = html;
  }

  render();
})();
