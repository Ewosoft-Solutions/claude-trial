/* ============================================================
   Role Dashboards — renderer + real interactions
   ============================================================ */
(function () {
  var state = { role: 'architect', inst: 'Secondary', screen: 'home', kid: 0, view: 'ready' };
  var ix = {};
  function resetIx() { ix = { att: {}, attInit: null, attSubmitted: false, filter: 'all', reminded: {}, returned: {}, approvals: {}, requests: {}, plans: {} }; }
  resetIx();
  var $ = function (id) { return document.getElementById(id); };
  var initials = function (n) { return n.split(' ').map(function (x) { return x[0]; }).join('').slice(0, 2).toUpperCase(); };

  /* ---------- regions ---------- */
  function railHTML(d) {
    var h = '<div class="logo"></div>';
    d.rail.forEach(function (ic, i) { h += '<div class="ri' + (i === d.railOn ? ' on' : '') + (i === d.rail.length - 1 ? ' spring' : '') + '">' + ic + '</div>'; });
    return h;
  }
  function navHTML(d) {
    var activeK = state.screen === 'deeper' ? d.deeperKey : 'dash';
    var h = '<div class="nav-h"><b>' + d.who.split(' ')[0] + '</b><span style="color:var(--ink-faint)">‹‹</span></div>';
    d.nav.forEach(function (n) {
      if (n.group) { h += '<div class="grp-label">' + n.group + '</div>'; return; }
      var on = n.k === activeK;
      var wired = n.k === 'dash' || n.k === d.deeperKey;
      h += '<div class="nitem' + (on ? ' on' : '') + '" data-k="' + n.k + '" style="cursor:' + (wired ? 'pointer' : 'default') + ';"><span class="ti"></span><span>' + n.t + '</span>' +
        (n.cnt ? '<span class="cnt">' + n.cnt + '</span>' : '') + (wired && !on ? '<span class="chev" style="opacity:.5;">›</span>' : '') + '</div>';
    });
    return h;
  }
  function tenantHTML(d) { return '<span class="sq"></span> ' + d.tenant + ((d.tenantSwitch || d.tenantSub === 'switch school') ? ' <span style="color:var(--ink-faint)">▾</span>' : ''); }
  function crumbHTML(d) {
    var parts = state.screen === 'deeper' ? [d.crumb[0], d.deeperTitle] : d.crumb.slice();
    return parts.map(function (p, i) { return (i ? '<span class="sep">▸</span>' : '') + '<span class="' + (i === parts.length - 1 ? 'cur' : '') + '">' + p + '</span>'; }).join('');
  }
  function iconsHTML(d) { return '<span class="ico">◔</span><span class="ico">⚑</span><span class="av">' + d.avatar + '</span>'; }
  function statusHTML(d) { return '<span class="s-dot"></span> Synced · just now <span>·</span> ' + d.tenant + ' <span class="spring"></span> ' + (state.role === 'architect' ? 'Platform · all regions' : 'Term 3 · 2024') + ' <span>⌘K to jump</span>'; }

  /* ---------- widgets ---------- */
  function chartHTML(w) {
    var bars = w.heights.map(function (ht, i) { return '<i class="' + (i === w.hl ? 'hl' : '') + '" style="height:' + ht + '%"></i>'; }).join('');
    var xl = (w.x || []).map(function (x) { return '<span>' + x + '</span>'; }).join('');
    return '<div class="panel"><div class="ph"><b>' + w.title + '</b><span class="more">view ›</span></div><div class="chart-bars">' + bars + '</div>' + (xl ? '<div class="xlabels">' + xl + '</div>' : '') + '</div>';
  }
  function tableHTML(w) {
    var th = w.head.map(function (h) { return '<th>' + h + '</th>'; }).join('');
    var tr = w.rows.map(function (r) {
      return '<tr>' + r.map(function (c, i) {
        if (i === 0) return '<td><div style="display:flex;align-items:center;gap:8px;"><span class="av" style="width:22px;height:22px;font-size:9px;">' + initials(c) + '</span>' + c + '</div></td>';
        if (i === r.length - 1 && /^[A-F][+\u2212-]?$/.test(c)) return '<td><span class="statbadge ok">' + c + '</span></td>';
        return '<td>' + c + '</td>';
      }).join('') + '</tr>';
    }).join('');
    return '<div class="panel"><div class="ph"><b>' + w.title + '</b><span class="more">all ›</span></div><table class="tbl"><thead><tr>' + th + '</tr></thead><tbody>' + tr + '</tbody></table></div>';
  }
  function feedHTML(w) {
    return '<div class="panel"><div class="ph"><b>' + w.title + '</b></div>' + w.rows.map(function (r) { return '<div class="feed-row"><span class="dotc"></span><div class="ft">' + r[0] + '<small>' + r[1] + '</small></div></div>'; }).join('') + '</div>';
  }
  function scheduleHTML(w) {
    return '<div class="panel"><div class="ph"><b>' + w.title + '</b><span class="more">full ›</span></div>' + w.rows.map(function (r) { return '<div class="sched-row' + (r[3] ? ' dim' : '') + '"><span class="tm">' + r[0] + '</span><span class="bar2"></span><div style="flex:1"><div style="font-size:14px;">' + r[1] + '</div><div style="font-size:11px;color:var(--ink-faint);">' + r[2] + '</div></div>' + (r[3] ? '' : '<span class="statbadge ok">next</span>') + '</div>'; }).join('') + '</div>';
  }
  function instbreakHTML(w) {
    var max = Math.max.apply(null, w.rows.map(function (r) { return r[1]; }));
    return '<div class="panel"><div class="ph"><b>' + w.title + '</b></div>' + w.rows.map(function (r) {
      var hl = r[0] === state.inst;
      return '<div style="display:flex;align-items:center;gap:10px;padding:6px 0;font-size:13px;"><span style="width:74px;color:' + (hl ? 'var(--accent)' : 'inherit') + ';font-weight:' + (hl ? 700 : 400) + ';">' + r[0] + '</span><span style="flex:1;height:11px;background:var(--skel);border-radius:6px;overflow:hidden;"><span style="display:block;height:100%;width:' + Math.round(r[1] / max * 100) + '%;background:' + (hl ? 'var(--accent)' : 'var(--line-soft)') + ';"></span></span><span style="width:40px;text-align:right;color:var(--ink-soft);">' + r[1] + '</span></div>';
    }).join('') + '</div>';
  }
  function widgetHTML(w) { return w ? ({ chart: chartHTML, table: tableHTML, feed: feedHTML, schedule: scheduleHTML, instbreak: instbreakHTML }[w.type])(w) : ''; }

  /* ---------- home ---------- */
  function kpisHTML(d) {
    var labels = (d.instKpiLabels && d.instKpiLabels[state.inst]) || {};
    return '<div class="kpis">' + d.kpis.map(function (k, i) {
      return '<div class="kpi-card"><span class="lab">' + (labels[i] || k[0]) + '</span><span class="val">' + k[1] + '</span>' + (k[2] ? '<span class="tr' + (k[3] ? ' down' : '') + '">' + k[2] + '</span>' : '') + '</div>';
    }).join('') + '</div>';
  }
  function attnHTML(d) {
    return '<div class="panel"><div class="ph"><b>Needs attention</b><span class="more">' + d.attention.length + ' items</span></div>' + d.attention.map(function (a) {
      return '<div class="attn-row"><span class="ic ' + (a[1] || '') + '">' + a[0] + '</span><div class="tx">' + a[2] + '<small>' + a[3] + '</small></div><span class="go">›</span></div>';
    }).join('') + '</div>';
  }
  function quickHTML(d) {
    return '<div class="panel"><div class="ph"><b>Quick actions</b></div><div class="qa-grid">' + d.quick.map(function (q) { return '<div class="qa' + (q[2] ? ' pri' : '') + '"><span class="ic">' + q[0] + '</span>' + q[1] + '</div>'; }).join('') + '</div></div>';
  }
  function kidtabsHTML(d) {
    if (!d.multiChild) return '';
    return '<div class="kidtabs">' + d.multiChild.map(function (c, i) {
      return '<div class="kidtab' + (i === state.kid ? ' on' : '') + '" data-act="kid" data-i="' + i + '"><span class="av">' + c.av + '</span> ' + c.n + ' <span style="color:var(--ink-faint);font-size:11px;">' + c.y + '</span></div>';
    }).join('') + '<div class="kidtab" style="border-style:dashed;">＋ Add child</div></div>';
  }
  function homeHTML(d) {
    return kidtabsHTML(d) + kpisHTML(d) + '<div class="cols">' + attnHTML(d) + quickHTML(d) + '</div><div class="cols">' + widgetHTML(d.wPrimary) + widgetHTML(d.wSecondary) + '</div>';
  }

  /* ---------- interactive building blocks ---------- */
  function rosterScreen(o) {
    if (ix.attInit !== o.id) { ix.att = {}; o.names.forEach(function (n) { ix.att[n] = o.absent.indexOf(n) >= 0 ? 'a' : 'p'; }); ix.attInit = o.id; ix.attSubmitted = false; }
    var present = o.names.filter(function (n) { return ix.att[n] === 'p'; }).length, absent = o.names.length - present;
    var rows = o.names.map(function (n) {
      var v = ix.att[n];
      return '<div class="roster-row"><span class="av">' + initials(n) + '</span><div style="flex:1;font-size:13px;">' + n + '</div><span class="toggle2"><span class="' + (v === 'p' ? 'psel' : '') + '" data-act="att" data-n="' + n + '" data-v="p">Present</span><span class="' + (v === 'a' ? 'asel' : '') + '" data-act="att" data-n="' + n + '" data-v="a">Absent</span></span></div>';
    }).join('');
    var banner = ix.attSubmitted ? '<div class="panel" style="border-color:var(--accent);margin-bottom:12px;display:flex;align-items:center;gap:11px;"><span style="width:27px;height:27px;border:2px solid var(--accent);border-radius:8px;display:grid;place-items:center;color:var(--accent);">✓</span><b style="font-family:Caveat;font-size:19px;">Attendance submitted</b><span style="color:var(--ink-soft);font-size:13px;">' + present + ' present · ' + absent + ' absent · saved</span></div>' : '';
    return banner + '<div class="panel"><div class="ph"><b>Roster · ' + o.names.length + ' students</b><span class="more">' + present + ' present · ' + absent + ' absent</span></div>' + rows + '<div style="display:flex;gap:9px;margin-top:14px;"><span class="btn" data-act="markall">Mark all present</span><span class="btn pri" style="margin-left:auto;" data-act="submit">✓ Submit attendance</span></div></div>';
  }
  function resolveRow(left, sub, idx, kind) {
    var st = ix[kind][idx];
    var right = st ? '<span class="statbadge ' + (st === 'approved' ? 'ok' : 'warn') + '">' + st + '</span>' :
      '<span style="display:flex;gap:7px;"><span class="btn pri" style="padding:3px 11px;font-size:12px;" data-act="' + (kind === 'approvals' ? 'approve' : kind === 'requests' ? 'req-approve' : 'plan-approve') + '" data-i="' + idx + '">' + (kind === 'plans' ? 'Approve' : 'Approve') + '</span><span class="btn" style="padding:3px 11px;font-size:12px;" data-act="' + (kind === 'approvals' ? 'reject' : kind === 'requests' ? 'req-decline' : 'plan-return') + '" data-i="' + idx + '">' + (kind === 'plans' ? 'Return' : kind === 'requests' ? 'Decline' : 'Reject') + '</span></span>';
    return '<div class="roster-row"><div style="flex:1;font-size:13px;"><b>' + left + '</b><div style="font-size:11px;color:var(--ink-faint);">' + sub + '</div></div>' + right + '</div>';
  }

  /* ---------- deeper screens ---------- */
  function deeperHTML(role, d) {
    if (role === 'architect') {
      var data = [['Bright Stars College', 'Secondary', 'Pro', '1,420', 'Active', '12 Aug'], ['Crescent University', 'University', 'Enterprise', '18,200', 'Active', '04 Sep'], ['Little Acorns', 'Nursery', 'Starter', '210', 'Near expiry', '09 Jun'], ['Unity Primary', 'Primary', 'Pro', '880', 'Active', '21 Oct'], ['SkillForge Institute', 'Training', 'Pro', '640', 'Trial', '15 Jun'], ['Hilltop Secondary', 'Secondary', 'Pro', '1,050', 'Active', '30 Nov'], ['Dawn Nursery', 'Nursery', 'Starter', '160', 'Near expiry', '11 Jun']];
      var f = ix.filter;
      var shown = data.filter(function (r) { return f === 'all' || (f === 'active' && r[4] === 'Active') || (f === 'expiry' && r[4] === 'Near expiry') || (f === 'trial' && r[4] === 'Trial'); });
      var chip = function (id, label) { return '<span class="chip' + (f === id ? ' ok' : '') + '" data-act="filter" data-f="' + id + '" style="cursor:pointer;">' + label + '</span>'; };
      var rows = shown.map(function (r) {
        return '<tr><td><b>' + r[0] + '</b></td><td><span class="chip' + (r[1] === state.inst ? ' ok' : '') + '">' + r[1] + '</span></td><td>' + r[2] + '</td><td>' + r[3] + '</td><td><span class="statbadge ' + (r[4] === 'Active' ? 'ok' : 'warn') + '">' + r[4] + '</span></td><td>' + r[5] + '</td></tr>';
      }).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--ink-faint);padding:24px;">No schools match this filter</td></tr>';
      return '<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">' + chip('all', 'All ' + data.length) + chip('active', 'Active') + chip('expiry', 'Near expiry') + chip('trial', 'Trials') + '<span class="btn" style="margin-left:auto;">＋ Create School</span></div><div class="panel"><table class="tbl"><thead><tr><th>School</th><th>Type</th><th>Plan</th><th>Users</th><th>Status</th><th>Expiry</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    }
    if (role === 'owner') {
      var ap = [['J. Okoro', 'JSS 1', '2 days ago', 'New'], ['F. Bello', 'SS 2', '3 days ago', 'Reviewing'], ['A. Musa', 'JSS 3', '4 days ago', 'Docs pending'], ['T. Eze', 'SS 1', '5 days ago', 'New']];
      var rows = ap.map(function (r) { return '<tr><td><div style="display:flex;align-items:center;gap:8px;"><span class="av" style="width:22px;height:22px;font-size:9px;">' + initials(r[0]) + '</span>' + r[0] + '</div></td><td>' + r[1] + '</td><td>' + r[2] + '</td><td><span class="statbadge ' + (r[3] === 'New' ? 'ok' : 'warn') + '">' + r[3] + '</span></td><td><span class="btn" style="padding:3px 10px;font-size:12px;">Review</span></td></tr>'; }).join('');
      return '<div class="panel"><div class="ph"><b>38 applications</b><span class="more">filter ›</span></div><table class="tbl"><thead><tr><th>Applicant</th><th>Class</th><th>Submitted</th><th>Status</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    }
    if (role === 'teacher') return rosterScreen({ id: 'teacher', names: ['Ada Rivera', 'Maya Jones', 'Sam Kemi', 'Tomi Peters', 'Leo Carter', 'Nia Obi'], absent: ['Sam Kemi'] });
    if (role === 'classteacher') return rosterScreen({ id: 'class9b', names: ['Bola Ade', 'Chidi Eze', 'Dami Lawal', 'Efe Okon', 'Femi Bassey', 'Grace Udo'], absent: ['Chidi Eze', 'Femi Bassey'] });
    if (role === 'student') {
      var as = [['Biology', 'Lab report: Osmosis', 'Tomorrow 5pm', 'Not started', 'warn'], ['Maths', 'Problem set 7', 'In 3 days', 'Draft', ''], ['English', 'Persuasive essay', 'In 5 days', 'Not started', ''], ['History', 'Source analysis', 'Submitted', 'Done', 'ok']];
      var rows = as.map(function (r) { return '<tr><td>' + r[0] + '</td><td><b>' + r[1] + '</b></td><td>' + r[2] + '</td><td><span class="statbadge ' + r[4] + '">' + r[3] + '</span></td><td><span class="btn" style="padding:3px 10px;font-size:12px;">' + (r[3] === 'Done' ? 'View' : 'Open') + '</span></td></tr>'; }).join('');
      return '<div class="panel"><div class="ph"><b>4 due this week</b><span class="more">sort ›</span></div><table class="tbl"><thead><tr><th>Subject</th><th>Title</th><th>Due</th><th>Status</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    }
    if (role === 'parent') {
      var kid = d.multiChild[state.kid];
      var res = [['Chemistry', 'Term test', 'A'], ['English', 'Essay', 'B+'], ['Maths', 'Quiz', state.kid ? 'B+' : 'B'], ['Biology', 'Lab report', 'A−']];
      var rrows = res.map(function (r) { return '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td><td><span class="statbadge ok">' + r[2] + '</span></td></tr>'; }).join('');
      return kidtabsHTML(d) + '<div class="cols even"><div class="panel"><div class="ph"><b>' + kid.n + ' · results</b></div><table class="tbl"><thead><tr><th>Subject</th><th>Assessment</th><th>Grade</th></tr></thead><tbody>' + rrows + '</tbody></table></div><div class="panel"><div class="ph"><b>Attendance</b></div><div class="kpi-card" style="border:none;padding:0;"><span class="lab">This term</span><span class="val">' + (state.kid ? '97%' : '95%') + '</span></div><div class="chart-bars" style="height:90px;margin-top:8px;">' + [70, 90, 85, 100, 80, 95, 88, 92].map(function (h) { return '<i style="height:' + h + '%"></i>'; }).join('') + '</div></div></div>';
    }
    if (role === 'bursar') {
      var df = [['A. Rivera', 'SS 2', '₦120k', '34'], ['M. Jones', 'JSS 3', '₦80k', '21'], ['S. Kemi', 'SS 1', '₦200k', '56'], ['T. Peters', 'JSS 1', '₦60k', '12']];
      var rows = df.map(function (r, i) {
        var done = ix.reminded[i];
        return '<tr><td><div style="display:flex;align-items:center;gap:8px;"><span class="av" style="width:22px;height:22px;font-size:9px;">' + initials(r[0]) + '</span>' + r[0] + '</div></td><td>' + r[1] + '</td><td><b>' + r[2] + '</b></td><td><span class="statbadge warn">' + r[3] + ' days</span></td><td>' + (done ? '<span class="statbadge ok">Reminded ✓</span>' : '<span class="btn" style="padding:3px 10px;font-size:12px;" data-act="remind" data-i="' + i + '">Remind</span>') + '</td></tr>';
      }).join('');
      return '<div style="display:flex;gap:8px;margin-bottom:12px;"><span class="chip warn">142 defaulters</span><span class="chip">₦3.1M total</span><span class="btn pri" style="margin-left:auto;">＋ Record payment</span></div><div class="panel"><table class="tbl"><thead><tr><th>Student</th><th>Class</th><th>Amount</th><th>Overdue</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    }
    if (role === 'principal') {
      var items = [['Results · SS2 Maths', 'M. Cole'], ['Results · JSS3 English', 'T. Bola'], ['Results · SS1 Biology', 'A. Musa'], ['Results · JSS2 Science', 'R. Ade'], ['Timetable · Term 3', 'Admin office']];
      var done = items.filter(function (_, i) { return ix.approvals[i]; }).length;
      return '<div class="panel"><div class="ph"><b>Approvals queue</b><span class="more">' + (items.length - done) + ' pending · ' + done + ' done</span></div>' + items.map(function (it, i) { return resolveRow(it[0], 'Submitted by ' + it[1], i, 'approvals'); }).join('') + '</div>';
    }
    if (role === 'vpacademic') {
      var plans = [['Biology · 11B', 'M. Cole'], ['Chemistry · 10A', 'J. Bello'], ['Maths · 9B', 'S. Kemi'], ['English · SS1', 'R. Ade'], ['Physics · 11A', 'D. Umoh'], ['History · JSS3', 'P. Eze'], ['Geography · JSS2', 'L. Obi']];
      var done = plans.filter(function (_, i) { return ix.plans[i]; }).length;
      return '<div class="panel"><div class="ph"><b>Lesson plans</b><span class="more">' + (plans.length - done) + ' to review</span></div>' + plans.map(function (p, i) { return resolveRow(p[0], 'By ' + p[1] + ' · Week 6', i, 'plans'); }).join('') + '</div>';
    }
    if (role === 'vpadmin') {
      var reqs = [['Leave · J. Bello', '2 days · cover arranged'], ['Maintenance · AC, Block C', 'Urgent · reported 18m ago'], ['Leave · A. Musa', '1 day · personal'], ['Maintenance · Projector, Lab 2', 'Open'], ['Stock order · Stationery', 'Below threshold']];
      var done = reqs.filter(function (_, i) { return ix.requests[i]; }).length;
      return '<div class="panel"><div class="ph"><b>Requests queue</b><span class="more">' + (reqs.length - done) + ' open</span></div>' + reqs.map(function (r, i) { return resolveRow(r[0], r[1], i, 'requests'); }).join('') + '</div>';
    }
    if (role === 'librarian') {
      var books = [['Things Fall Apart', 'A. Rivera', '12'], ['1984', 'M. Jones', '8'], ['The Famished Road', 'S. Kemi', '20'], ['Sula', 'T. Peters', '5'], ['Half of a Yellow Sun', 'N. Obi', '3']];
      var done = books.filter(function (_, i) { return ix.returned[i]; }).length;
      var rows = books.map(function (b, i) {
        var ret = ix.returned[i];
        return '<div class="roster-row"' + (ret ? ' style="opacity:.55;"' : '') + '><div style="flex:1;font-size:13px;"><b>' + b[0] + '</b><div style="font-size:11px;color:var(--ink-faint);">' + b[1] + ' · ' + b[2] + ' days overdue</div></div>' + (ret ? '<span class="statbadge ok">Returned ✓</span>' : '<span style="display:flex;gap:7px;"><span class="btn" style="padding:3px 10px;font-size:12px;">Remind</span><span class="btn pri" style="padding:3px 10px;font-size:12px;" data-act="return" data-i="' + i + '">Mark returned</span></span>') + '</div>';
      }).join('');
      return '<div class="panel"><div class="ph"><b>Overdue books</b><span class="more">' + (books.length - done) + ' outstanding</span></div>' + rows + '</div>';
    }
    return '<div class="bigstate"><div class="glyph">▦</div><h4>Screen coming soon</h4></div>';
  }

  /* ---------- notes ---------- */
  function notesHTML(d) {
    return '<div class="note"><span class="n">?</span><div><b>What do I know</b><p>' + d.kpis.slice(0, 3).map(function (k) { return k[0] + ' ' + k[1]; }).join(' · ') + ' — the KPI row scans at a glance.</p></div></div>' +
      '<div class="note"><span class="n">!</span><div><b>What needs me</b><p>' + d.attention[0][2] + ' — top of "Needs attention".</p></div></div>' +
      '<div class="note"><span class="n">→</span><div><b>What next</b><p>' + d.quick[0][1] + ' — the primary action, one tap away.</p></div></div>' +
      '<div class="note"><span class="n">↻</span><div><b>Adapts</b><p>Nav, KPIs &amp; widgets all swapped for <b>' + d.roleLabel + '</b>. Click the highlighted nav item or "Deeper" to open the live screen.</p></div></div>';
  }

  /* ---------- data states (loading / empty) ---------- */
  function loadingHTML() {
    var card = '<div class="kpi-card"><span class="skel sm shimmer" style="width:55%"></span><span class="skel shimmer" style="width:70%;height:20px;margin-top:5px;"></span></div>';
    var kpi = '<div class="kpis">' + new Array(5).fill(card).join('') + '</div>';
    var panel = function () { return '<div class="panel"><div class="ph"><span class="skel shimmer" style="width:42%;height:14px;"></span></div>' + new Array(4).fill('<span class="skel shimmer" style="width:90%;margin:9px 0;"></span>').join('') + '</div>'; };
    return kpi + '<div class="cols">' + panel() + panel() + '</div><div class="cols">' + panel() + panel() + '</div>';
  }
  function emptyHTML(d) {
    var p = d.quick.find(function (q) { return q[2]; }) || d.quick[0];
    return '<div class="bigstate"><div class="glyph">' + d.rail[0] + '</div><h4>Nothing here yet</h4><p>' + d.tenant + ' is all set up. As soon as data flows in, your <b>' + d.roleLabel + '</b> dashboard fills with KPIs, alerts &amp; activity.</p><div style="display:flex;gap:8px;margin-top:6px;"><span class="btn pri">' + p[0] + ' ' + p[1] + '</span><span class="btn">Import data</span></div></div>';
  }

  /* ---------- render ---------- */
  function syncControls() {
    document.querySelectorAll('[data-role]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-role') === state.role)); });
    document.querySelectorAll('[data-inst]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-inst') === state.inst)); });
    document.querySelectorAll('[data-screen]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-screen') === state.screen)); });
    document.querySelectorAll('[data-view]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-view') === state.view)); });
  }
  function renderMain(keepScroll) {
    var d = window.ROLE_DATA[state.role];
    var sc = keepScroll ? $('r-main').scrollTop : 0;
    $('r-main').innerHTML = state.view === 'loading' ? loadingHTML() : (state.view === 'empty' ? emptyHTML(d) : (state.screen === 'deeper' ? deeperHTML(state.role, d) : homeHTML(d)));
    $('r-notes').innerHTML = notesHTML(d);
    $('r-main').scrollTop = sc;
  }
  function render() {
    var d = window.ROLE_DATA[state.role];
    $('r-tenant').innerHTML = tenantHTML(d);
    $('r-crumb').innerHTML = crumbHTML(d);
    $('r-icons').innerHTML = iconsHTML(d);
    $('r-rail').innerHTML = railHTML(d);
    $('r-nav').innerHTML = navHTML(d);
    $('r-status').innerHTML = statusHTML(d);
    var title = state.screen === 'deeper' ? d.deeperTitle : d.hello;
    var sub = state.screen === 'deeper' ? d.deeperSub : new Date().toDateString().replace(/^\w+ /, '') + ' · Term 3';
    var primary = d.quick.find(function (q) { return q[2]; }) || d.quick[0];
    $('r-head').innerHTML = '<div style="display:flex;flex-direction:column;gap:1px;min-width:0;"><h3>' + title + '</h3><span class="sub">' + sub + '</span></div><div class="actions"><span class="inst">adapting to: ' + state.inst + '</span><span class="btn pri">' + primary[0] + ' ' + primary[1] + '</span></div>';
    syncControls();
    renderMain(false);
  }

  /* ---------- wiring (delegated, survives re-render) ---------- */
  $('r-main').addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el) return;
    var a = el.dataset.act;
    if (a === 'kid') { state.kid = +el.dataset.i; }
    else if (a === 'att') { ix.att[el.dataset.n] = el.dataset.v; }
    else if (a === 'markall') { Object.keys(ix.att).forEach(function (n) { ix.att[n] = 'p'; }); }
    else if (a === 'submit') { ix.attSubmitted = true; }
    else if (a === 'filter') { ix.filter = el.dataset.f; }
    else if (a === 'remind') { ix.reminded[el.dataset.i] = true; }
    else if (a === 'return') { ix.returned[el.dataset.i] = true; }
    else if (a === 'approve') { ix.approvals[el.dataset.i] = 'approved'; }
    else if (a === 'reject') { ix.approvals[el.dataset.i] = 'rejected'; }
    else if (a === 'req-approve') { ix.requests[el.dataset.i] = 'approved'; }
    else if (a === 'req-decline') { ix.requests[el.dataset.i] = 'declined'; }
    else if (a === 'plan-approve') { ix.plans[el.dataset.i] = 'approved'; }
    else if (a === 'plan-return') { ix.plans[el.dataset.i] = 'returned'; }
    renderMain(true);
  });
  $('r-nav').addEventListener('click', function (e) {
    var it = e.target.closest('.nitem'); if (!it || !it.dataset.k) return;
    var d = window.ROLE_DATA[state.role], k = it.dataset.k;
    if (k === 'dash' && state.screen !== 'home') { state.screen = 'home'; resetIx(); render(); }
    else if (k === d.deeperKey && state.screen !== 'deeper') { state.screen = 'deeper'; resetIx(); render(); }
  });
  document.querySelectorAll('[data-role]').forEach(function (b) { b.addEventListener('click', function () { state.role = b.getAttribute('data-role'); state.kid = 0; state.screen = 'home'; resetIx(); render(); }); });
  document.querySelectorAll('[data-inst]').forEach(function (b) { b.addEventListener('click', function () { state.inst = b.getAttribute('data-inst'); render(); }); });
  document.querySelectorAll('[data-screen]').forEach(function (b) { b.addEventListener('click', function () { state.screen = b.getAttribute('data-screen'); resetIx(); render(); }); });
  document.querySelectorAll('[data-view]').forEach(function (b) { b.addEventListener('click', function () { state.view = b.getAttribute('data-view'); render(); }); });

  render();
})();
