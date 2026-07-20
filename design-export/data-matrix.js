/* ============================================================
   Data Matrix — tabs, scale-down scenario, switcher,
   reporting engine, polymorphic UI
   ============================================================ */
(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* shared toast (reuse the architect-flow toast element) */
  var toastEl = $('#af-toast'), toastT;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg; toastEl.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('show'); }, 1800);
  }

  /* ---------- tab switching ---------- */
  $$('.tabs .tab').forEach(function (t) {
    t.addEventListener('click', function () {
      $$('.tabs .tab').forEach(function (x) { x.setAttribute('aria-selected', 'false'); });
      t.setAttribute('aria-selected', 'true');
      var id = t.getAttribute('data-target');
      $$('.layout').forEach(function (s) { s.classList.toggle('active', s.id === id); });
      window.scrollTo({ top: 0, behavior: 'auto' });
    });
  });

  /* ============================================================
     STRUCTURE — scale-down accordion / scenario detection
     ============================================================ */
  var LV = { Nursery: '❀', Primary: '✎', Secondary: '▦', Vocational: '⚒', University: '◈' };
  var LV_ORDER = ['Nursery', 'Primary', 'Secondary', 'Vocational', 'University'];

  var PRESETS = {
    A: { org: 'Sunny Days Academy', initials: 'SD', sub: 'single-site nursery',
      campuses: [{ name: 'Main site', region: 'auto · default branch', auto: true, levels: ['Nursery'] }] },
    B: { org: 'Greenfield Group (HQ)', initials: 'GG', sub: 'multi-campus group',
      campuses: [
        { name: 'Mainland Campus', region: 'Lagos · GMT+1', levels: ['Primary', 'Secondary'] },
        { name: 'Island Campus', region: 'Lagos · GMT+1', levels: ['Nursery', 'Secondary', 'Vocational'] }
      ] }
  };
  var struct = clone(PRESETS.B);
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function scenarioOf(s) {
    var levels = {};
    s.campuses.forEach(function (c) { c.levels.forEach(function (l) { levels[l] = 1; }); });
    var nLevels = Object.keys(levels).length;
    return (s.campuses.length <= 1 && nLevels <= 1) ? 'A' : 'B';
  }

  function renderStruct() {
    var tree = $('#otree'); if (!tree) return;
    var html = '<div class="org-node"><div class="onh"><span class="av">' + struct.initials +
      '</span><div><b>' + struct.org + '</b><small>OVERLORD · ' + struct.sub + '</small></div></div>' +
      '<div class="campus-list">';
    struct.campuses.forEach(function (c, ci) {
      html += '<div class="campus"><div class="ch2"><span class="cic">⌖</span><div><b>' + c.name +
        '</b><small>' + c.region + '</small></div>' +
        (struct.campuses.length > 1 ? '<span class="rm" data-rmcampus="' + ci + '">✕</span>' : '') +
        '</div><div class="inst-list">';
      c.levels.forEach(function (l, li) {
        html += '<span class="inst-pill"><span class="ig">' + (LV[l] || '◈') + '</span>' + l +
          (c.levels.length > 1 ? '<span class="rm" data-rminst="' + ci + ',' + li + '">✕</span>' : '') + '</span>';
      });
      html += '<span class="inst-pill add" data-addinst="' + ci + '">＋ level</span></div></div>';
    });
    html += '<div class="add-campus" id="add-campus">＋ Add a campus (branch)</div></div></div>';
    tree.innerHTML = html;

    // verdict
    var scen = scenarioOf(struct);
    $('#struct').setAttribute('data-scenario', scen);
    $$('#scen-toggle .scb').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-scen') === scen); });

    var nCampus = struct.campuses.length;
    var levelSet = {}; struct.campuses.forEach(function (c) { c.levels.forEach(function (l) { levelSet[l] = 1; }); });
    var profiles = 0; struct.campuses.forEach(function (c) { profiles += c.levels.length; });
    var v = $('#verdict'), g = $('#genline');
    if (scen === 'A') {
      var only = Object.keys(levelSet)[0] || 'Nursery';
      v.innerHTML =
        '<div class="vh"><span class="badge2">A</span><b>Scenario A · small school</b></div>' +
        '<ul>' +
        '<li><span class="chk">✓</span><span>Auto-generates a <b>single default branch</b> under the hood</span></li>' +
        '<li><span class="chk">✓</span><span>Auto-generates <b>one institution</b> (' + only + ')</span></li>' +
        '<li class="off"><span class="chk">✕</span><span>Campus switcher <b>hidden</b></span></li>' +
        '<li class="off"><span class="chk">✕</span><span>Institution switcher <b>hidden</b></span></li>' +
        '<li class="off"><span class="chk">✕</span><span>Global matrix <b>off</b> — no clutter</span></li>' +
        '</ul>';
      g.innerHTML = 'Config engine writes <code>org → 1 campus → 1 institution</code>, then sets <code>ui.switchers = hidden</code>. Add a second campus or level to cross into Scenario B.';
    } else {
      v.innerHTML =
        '<div class="vh"><span class="badge2">B</span><b>Scenario B · enterprise</b></div>' +
        '<ul>' +
        '<li><span class="chk">✓</span><span><b>' + nCampus + ' campuses</b> kept distinct (infra · payroll · inventory)</span></li>' +
        '<li><span class="chk">✓</span><span><b>' + profiles + ' institution profiles</b> across ' + Object.keys(levelSet).length + ' levels</span></li>' +
        '<li><span class="chk">✓</span><span>Campus switcher <b>unlocked</b></span></li>' +
        '<li><span class="chk">✓</span><span>Institution switcher <b>unlocked</b></span></li>' +
        '<li><span class="chk">✓</span><span>Global matrix <b>on, platform-wide</b></span></li>' +
        '</ul>';
      g.innerHTML = 'Config engine unlocks <code>ui.switchers = global</code> across every screen, and keeps each (campus × institution) isolated for localized staff &amp; inventory.';
    }
    bindStruct();
  }

  function bindStruct() {
    var add = $('#add-campus');
    if (add) add.addEventListener('click', function () {
      var n = struct.campuses.length + 1;
      struct.campuses.push({ name: 'Campus ' + n, region: 'set location', levels: ['Secondary'] });
      if (struct.org.indexOf('Sunny') === 0) { struct.org = 'Sunny Days Group'; struct.sub = 'now multi-campus'; }
      renderStruct(); toast('Campus added → recalculating scale…');
    });
    $$('#otree .rm[data-rmcampus]').forEach(function (b) {
      b.addEventListener('click', function () {
        struct.campuses.splice(+b.getAttribute('data-rmcampus'), 1); renderStruct(); toast('Campus removed');
      });
    });
    $$('#otree .rm[data-rminst]').forEach(function (b) {
      b.addEventListener('click', function () {
        var p = b.getAttribute('data-rminst').split(','); struct.campuses[+p[0]].levels.splice(+p[1], 1);
        renderStruct(); toast('Institution removed');
      });
    });
    $$('#otree .inst-pill.add').forEach(function (b) {
      b.addEventListener('click', function () {
        var ci = +b.getAttribute('data-addinst'), c = struct.campuses[ci];
        var next = LV_ORDER.find(function (l) { return c.levels.indexOf(l) === -1; });
        if (!next) { toast('All levels already added here'); return; }
        c.levels.push(next); renderStruct(); toast('Added ' + next + ' profile');
      });
    });
  }

  $$('#scen-toggle .scb').forEach(function (b) {
    b.addEventListener('click', function () {
      struct = clone(PRESETS[b.getAttribute('data-scen')]);
      renderStruct();
      toast(b.getAttribute('data-scen') === 'A' ? 'Loaded Sunny Days (small)' : 'Loaded Greenfield Group (enterprise)');
    });
  });

  /* ============================================================
     WORKSPACE SWITCHER
     ============================================================ */
  var WS_COLOR = {
    org: 'var(--accent)',
    campus: 'color-mix(in srgb,var(--accent) 38%,var(--frame))',
    level: ''
  };
  function syncWs() {
    var sel = {};
    $$('#ws-matrix .ws-col').forEach(function (col) {
      var on = col.querySelector('.ws-opt.on');
      sel[col.getAttribute('data-dim')] = on ? on.getAttribute('data-val') : '—';
    });
    var dotStyle = function (dim) {
      return dim === 'level'
        ? 'border:2px dashed var(--line-soft);background:var(--frame);'
        : 'background:' + WS_COLOR[dim] + ';';
    };
    var crumbs = '<span class="pc"><span class="d" style="' + dotStyle('org') + '"></span>' + sel.org + '</span>' +
      '<span class="arrow">▸</span>' +
      '<span class="pc"><span class="d" style="' + dotStyle('campus') + '"></span>' + sel.campus + '</span>' +
      '<span class="arrow">▸</span>' +
      '<span class="pc"><span class="d" style="' + dotStyle('level') + '"></span>' + sel.level + '</span>';
    $('#ws-result').innerHTML = crumbs;
    $('#ws-crumbs').innerHTML = '<span>' + sel.org + '</span><span class="sep">▸</span><span>' + sel.campus +
      '</span><span class="sep">▸</span><span class="cur">' + sel.level + '</span>';
  }
  $$('#ws-matrix .ws-col').forEach(function (col) {
    $$('.ws-opt', col).forEach(function (opt) {
      opt.addEventListener('click', function () {
        $$('.ws-opt', col).forEach(function (o) { o.classList.remove('on'); });
        opt.classList.add('on');
        syncWs();
        toast('Workspace → ' + opt.querySelector('.tx div').textContent);
      });
    });
  });

  /* ============================================================
     REPORTING ENGINE
     ============================================================ */
  var REP_DATA = {
    Mainland: { Primary: { revenue: 84, outstanding: 6.2, payroll: 41 }, Secondary: { revenue: 132, outstanding: 9.8, payroll: 70 } },
    Island: { Nursery: { revenue: 28, outstanding: 1.4, payroll: 15 }, Secondary: { revenue: 118, outstanding: 7.1, payroll: 64 }, Vocational: { revenue: 46, outstanding: 3.3, payroll: 22 } }
  };
  var REP_META = {
    revenue: { label: 'Revenue', col: 'SUM(amount)', tbl: 'fee_ledger', dec: 0 },
    outstanding: { label: 'Outstanding fees', col: 'SUM(balance)', tbl: 'fee_ledger', dec: 1 },
    payroll: { label: 'Staff payroll', col: 'SUM(gross_pay)', tbl: 'payroll', dec: 0 }
  };
  var repState = { measure: 'revenue', dims: { campus: true, level: true } };

  function money(n, dec) { return '₦' + (dec ? n.toFixed(1) : Math.round(n)) + 'm'; }
  function repValue(campus, level, m) { return (REP_DATA[campus][level] || {})[m] || 0; }

  function renderReport() {
    var m = repState.measure, meta = REP_META[m], dec = meta.dec;
    var dims = Object.keys(repState.dims).filter(function (k) { return repState.dims[k]; });

    // query text
    var groupCols = [];
    if (repState.dims.campus) groupCols.push('campus.name');
    if (repState.dims.level) groupCols.push('institution.level');
    var sel = (groupCols.length ? groupCols.join(', ') + ', ' : '') + meta.col + ' AS ' + m;
    var q = 'SELECT ' + sel + '\nFROM ' + meta.tbl + ' f\n  JOIN campuses c ON c.id = f.campus_id\n  JOIN institutions i ON i.id = f.institution_id\nWHERE f.org_id = \'greenfield\' AND f.term = \'2024/25\'' +
      (groupCols.length ? '\nGROUP BY ' + groupCols.join(', ') + ' WITH ROLLUP' : '');
    $('#rep-q').innerHTML = '<code>' + q.replace(/\n/g, '<br>').replace(/  /g, '&nbsp;&nbsp;') + '</code>';

    // totals
    var grand = 0, perCampus = {}, perLevel = {};
    Object.keys(REP_DATA).forEach(function (camp) {
      perCampus[camp] = 0;
      Object.keys(REP_DATA[camp]).forEach(function (lv) {
        var v = repValue(camp, lv, m);
        grand += v; perCampus[camp] += v; perLevel[lv] = (perLevel[lv] || 0) + v;
      });
    });

    // KPIs
    $('#rep-kpis').innerHTML =
      kpi('Group total', money(grand, dec), 'all campuses · all levels', true) +
      kpi('Mainland Campus', money(perCampus.Mainland, dec), 'Primary · Secondary') +
      kpi('Island Campus', money(perCampus.Island, dec), 'Nursery · Sec · Voc');

    // table
    var head = '<thead><tr>';
    if (repState.dims.campus) head += '<th>Campus</th>';
    if (repState.dims.level) head += '<th>Level</th>';
    if (!repState.dims.campus && !repState.dims.level) head += '<th>Scope</th>';
    head += '<th class="num">' + meta.label + '</th></tr></thead>';

    var rows = '';
    if (repState.dims.campus && repState.dims.level) {
      Object.keys(REP_DATA).forEach(function (camp) {
        rows += '<tr class="grp"><td><span class="d" style="background:color-mix(in srgb,var(--accent) 38%,var(--frame));"></span>' + camp + '</td><td></td><td class="num">' + money(perCampus[camp], dec) + '</td></tr>';
        Object.keys(REP_DATA[camp]).forEach(function (lv) {
          rows += '<tr class="leaf"><td>' + camp + '</td><td>' + lv + '</td><td class="num">' + money(repValue(camp, lv, m), dec) + '</td></tr>';
        });
      });
    } else if (repState.dims.campus) {
      Object.keys(perCampus).forEach(function (camp) {
        rows += '<tr class="grp"><td><span class="d" style="background:color-mix(in srgb,var(--accent) 38%,var(--frame));"></span>' + camp + '</td><td class="num">' + money(perCampus[camp], dec) + '</td></tr>';
      });
    } else if (repState.dims.level) {
      Object.keys(perLevel).forEach(function (lv) {
        rows += '<tr class="grp"><td><span class="d" style="background:var(--accent);"></span>' + lv + '</td><td class="num">' + money(perLevel[lv], dec) + '</td></tr>';
      });
    } else {
      rows += '<tr class="grp"><td>Greenfield Group (all)</td><td class="num">' + money(grand, dec) + '</td></tr>';
    }
    var span = head.split('<th').length - 1;
    rows += '<tr class="total"><td' + (span > 2 ? ' colspan="' + (span - 1) + '"' : '') + '>Group total</td><td class="num">' + money(grand, dec) + '</td></tr>';

    $('#rep-table').innerHTML = head + '<tbody>' + rows + '</tbody>';

    var dimLabel = dims.length ? dims.map(function (d) { return d === 'campus' ? 'campus' : 'level'; }).join(' & ') : 'group total';
    $('#rep-title').textContent = meta.label + ' · by ' + dimLabel;
    $('#rep-sub').textContent = '2024/25 · ' + money(grand, dec) + ' total';
  }
  function kpi(lab, val, sub, hl) {
    return '<div class="kpi-card"' + (hl ? ' style="border-color:var(--accent);"' : '') + '><span class="lab">' + lab +
      '</span><span class="val">' + val + '</span><span class="tr">' + sub + '</span></div>';
  }
  $$('#pane-reporting .rep-opt[data-measure]').forEach(function (o) {
    o.addEventListener('click', function () {
      $$('#pane-reporting .rep-opt[data-measure]').forEach(function (x) { x.classList.remove('on'); });
      o.classList.add('on'); repState.measure = o.getAttribute('data-measure'); renderReport();
    });
  });
  $$('#pane-reporting .rep-opt[data-dim]').forEach(function (o) {
    o.addEventListener('click', function () {
      var d = o.getAttribute('data-dim');
      repState.dims[d] = !repState.dims[d]; o.classList.toggle('on', repState.dims[d]); renderReport();
    });
  });
  var runBtn = $('#rep-run');
  if (runBtn) runBtn.addEventListener('click', function () { renderReport(); toast('▷ Query run · rolled up'); });

  /* ============================================================
     POLYMORPHIC UI
     ============================================================ */
  function navItem(label, on, off) {
    return '<div class="nitem' + (on ? ' on' : '') + (off ? ' off' : '') + '"><span class="ti"></span><span>' + label + '</span></div>';
  }
  function flag(label, state) { return '<span class="feature-flag ' + state + '">' + (state === 'off' ? '✕' : '✓') + ' ' + label + '</span>'; }
  function card(title, body, more) {
    return '<div class="panel"><div class="ph"><b>' + title + '</b>' + (more ? '<span class="more">' + more + '</span>' : '') + '</div>' + body + '</div>';
  }
  function rows(arr) {
    return arr.map(function (r) {
      return '<div class="attn-row"><span class="ic ' + (r[2] || '') + '">' + r[0] + '</span><div class="tx">' + r[1] + (r[3] ? '<small>' + r[3] + '</small>' : '') + '</div><span class="go">›</span></div>';
    }).join('');
  }

  var POLY = {
    Nursery: {
      nav: ['Children', 'Developmental Tracking', 'Observations', 'Attendance', 'Meals &amp; Naps', 'Guardians', 'Messages'],
      on: 'Developmental Tracking',
      flags: [['Developmental tracking', 'on'], ['Guardian notes', 'on'], ['GPA &amp; ranking', 'off'], ['Transcripts', 'off']],
      headline: 'Tunde Bello · Butterflies room',
      sub: 'Age 3 · Key worker: Ms. Grace',
      suppress: 'GPA, class ranking &amp; transcripts are suppressed — not meaningful for early years.',
      cards: function () {
        return '<div class="cols even">' +
          card('Developmental milestones', rows([['◔', 'Speaking &amp; listening', 'ok', 'On track · 4 of 5 observed'], ['◔', 'Physical · fine motor', 'ok', 'Emerging'], ['◔', 'Personal &amp; social', 'warn', 'Needs focus']])) +
          card('Today\'s observations', rows([['✎', 'Built a 6-block tower', '', '10:20'], ['✎', 'Shared toys at carpet', '', '11:05'], ['✎', 'Lunch · ate well', '', '12:30']]), '＋ note') +
          '</div>';
      }
    },
    Primary: {
      nav: ['Pupils', 'Gradebook', 'Report Cards', 'Attendance', 'Reading Levels', 'Behaviour', 'Messages'],
      on: 'Gradebook',
      flags: [['Effort grades', 'on'], ['Report cards', 'on'], ['Cumulative GPA', 'off'], ['Modular courses', 'off']],
      headline: 'Primary · Year 4 — Maple class',
      sub: '28 pupils · Teacher: Mr. Okoro',
      suppress: 'Cumulative GPA is off — Primary reports descriptive effort grades, not a GPA.',
      cards: function () {
        return '<div class="cols even">' +
          card('Gradebook snapshot', rows([['#', 'Numeracy', 'ok', 'Class avg · Secure'], ['#', 'Literacy', 'ok', 'Class avg · Expected'], ['#', 'Science', 'warn', 'Below expected']])) +
          card('Reading levels', rows([['▤', 'Band: Gold', 'ok', '9 pupils'], ['▤', 'Band: White', '', '14 pupils'], ['▤', 'Band: Lime', 'warn', '5 pupils need support']]), 'this term') +
          '</div>';
      }
    },
    Secondary: {
      nav: ['Students', 'Gradebook', 'GPA &amp; Ranking', 'Transcripts', 'Exam Entries', 'Attendance', 'Messages'],
      on: 'GPA &amp; Ranking',
      flags: [['Gradebook', 'on'], ['Cumulative GPA', 'on'], ['Transcripts', 'on'], ['Exam entries', 'on']],
      headline: 'Secondary · Year 11 — set 11B',
      sub: '31 students · Form tutor: Mrs. Eze',
      suppress: '',
      cards: function () {
        return '<div class="cols even">' +
          card('GPA &amp; ranking', '<div class="kpis" style="margin:0;grid-template-columns:1fr 1fr;">' +
            kpi('Cohort GPA', '3.42', '▲ 0.08 vs last term') + kpi('Top decile', '8 of 31', 'GPA ≥ 3.8') + '</div>') +
          card('Exam entries', rows([['◷', 'WAEC · May/June', 'ok', '31 entered'], ['◷', 'Mock results due', 'warn', 'in 9 days'], ['◷', 'Transcript requests', '', '4 pending']]), 'term') +
          '</div>';
      }
    },
    Vocational: {
      nav: ['Trainees', 'Module Catalogue', 'Modular Enrolment', 'Competencies', 'Certifications', 'Attendance', 'Messages'],
      on: 'Module Catalogue',
      flags: [['Modular registration', 'on'], ['Competencies', 'on'], ['Certification', 'on'], ['Cumulative GPA', 'off']],
      headline: 'Vocational · Welding &amp; Fabrication',
      sub: '22 trainees · rolling intake',
      suppress: 'GPA is off — Vocational tracks competencies &amp; certificates, not a cumulative GPA.',
      cards: function () {
        return '<div class="cols even">' +
          card('Short-course modules', rows([['⚒', 'MIG welding · L2', 'ok', '12 enrolled · 6 wks'], ['⚒', 'Blueprint reading', '', 'starts Mon'], ['⚒', 'Workshop safety', 'ok', 'rolling']]), '＋ module') +
          card('Certifications', rows([['◈', 'NSQ Level 2 issued', 'ok', '7 this term'], ['◈', 'Competency sign-off', 'warn', '5 awaiting assessor'], ['◈', 'Portfolio review', '', '3 booked']]), 'issued') +
          '</div>';
      }
    }
  };

  function renderPoly(level) {
    var cfg = POLY[level];
    $('#poly-crumb').textContent = level;
    $$('#poly-switch .lvl-pill').forEach(function (p) { p.classList.toggle('on', p.getAttribute('data-level') === level); });
    $('#poly-nav').innerHTML = '<div class="grp-label">' + level + ' workspace</div>' +
      cfg.nav.map(function (n) { return navItem(n, n === cfg.on, false); }).join('') +
      '<div class="nitem" style="margin-top:auto;opacity:.7;"><span class="ti"></span><span>Settings</span></div>';
    var main = '<div class="poly-headline"><h3>' + cfg.headline + '</h3><span class="sub" style="color:var(--ink-soft);font-size:13px;">' + cfg.sub + '</span></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">' + cfg.flags.map(function (f) { return flag(f[0], f[1]); }).join('') + '</div>' +
      cfg.cards();
    if (cfg.suppress) main += '<div class="suppressed-note" style="margin-top:14px;"><span>⊘</span><span>' + cfg.suppress + '</span></div>';
    $('#poly-main').innerHTML = main;
  }
  $$('#poly-switch .lvl-pill').forEach(function (p) {
    p.addEventListener('click', function () { renderPoly(p.getAttribute('data-level')); toast('Level → ' + p.getAttribute('data-level')); });
  });

  /* ---------- init ---------- */
  renderStruct();
  syncWs();
  renderReport();
  renderPoly('Secondary');
})();
