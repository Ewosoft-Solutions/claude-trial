/* ============================================================
   SchoolWithEase — Aurora extra screens
   window.buildAuroraScreen(key, theme, opts) -> HTML string
   Builds full Aurora shells for 7 additional screens, reusing
   the same regions/classes as buildShell so the responsive
   layer applies. St. Jude Academy · Spring Term 2025.
   ============================================================ */
(function () {
  const base = window.AuroraIcons || {};
  const ic = Object.assign({}, base.ic, {
    clock:  '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/>',
    sparkle:'<path d="M12 3l1.7 5.1L19 10l-5.3 1.9L12 17l-1.7-5.1L5 10l5.3-1.9z"/>',
    send:   '<path d="M5.5 12 19 5.5 14.5 19 11 13z"/>',
    download:'<path d="M12 4v10M7.5 11l4.5 5 4.5-5"/><path d="M5 20h14"/>',
    cap:    '<path d="M3 9.2 12 5l9 4.2-9 4.2z"/><path d="M7.5 11.4V16c0 1.4 2.5 2.4 4.5 2.4s4.5-1 4.5-2.4v-4.6"/>',
    msg:    '<path d="M5 5.5h14v9H9.5L5 18.5z"/>',
    receipt:'<path d="M6 3.5h12v17l-2.2-1.5-2 1.5-1.8-1.5L10 20.5l-2-1.5L6 20.5z"/><path d="M9 8h6M9 12h6"/>',
    flag:   '<path d="M6 21V4M6 4h11l-2 4 2 4H6"/>',
  });
  const I = (name, w) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w || 1.7}" stroke-linecap="round" stroke-linejoin="round">${ic[name] || ''}</svg>`;

  /* ---------- shared primitives ---------- */
  const RAIL = [['grid', 'Overview'], ['users', 'Students'], ['book', 'Classes'], ['cal', 'Timetable'], ['coins', 'Finance'], ['chart', 'Reports']];
  const FAB = `<div class="ai-fab"><div class="fab-chip">Ask Ada <span class="fab-kbd">⌘J</span></div><button class="fab-bubble" aria-label="Ask Ada — AI assistant"></button></div>`;
  const STATUS = `<span class="sb-i"><span class="sdot"></span> Synced · 2m ago</span><span class="sb-i"><b>Spring Term 2025</b></span><span class="sb-i">3 background jobs</span><span class="spring sb-i"><span class="kbd">⌘K</span> to jump anywhere</span>`;

  function navHead(icon, title, sub) {
    return `<div class="nav-head"><span class="ico">${I(icon)}</span><div><h2>${title}</h2><div class="sub">${sub}</div></div></div>`;
  }
  function navItem(icon, label, o) {
    o = o || {};
    const cnt = o.count ? `<span class="count ${o.hot ? 'hot' : ''}">${o.count}</span>` : '';
    const chev = o.chev ? `<span class="ni-ic" style="margin-left:auto">${I('chevR')}</span>` : '';
    return `<div class="nitem ${o.on ? 'on' : ''} ${o.sub ? 'sub' : ''}"><span class="ni-ic">${o.sub ? '' : I(icon)}</span><span>${label}</span>${cnt}${chev}</div>`;
  }
  const grp = (t, chev) => `<div class="grp">${t}${chev ? `<span class="ni-ic gchev">${I('chevD')}</span>` : ''}</div>`;
  const av = (txt, col, cls) => `<span class="av ${cls || ''}" style="background:${col}">${txt}</span>`;

  function mainHead(h1, sub, actions) {
    return `<div class="main-head"><div class="ttl"><h1>${h1}</h1><div class="sub">${sub}</div></div><div class="head-actions">${actions}</div></div>`;
  }
  function seg(labels, on) {
    return `<div class="seg">${labels.map((l, i) => `<button class="${i === (on || 0) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  }
  const btn = (label, icon, cls) => `<button class="btn ${cls || ''}">${icon ? I(icon, cls === 'primary' ? 2 : 1.8) + ' ' : ''}${label}</button>`;
  function panelHead(title, sub, act) {
    return `<div class="p-head"><div><h3>${title}</h3>${sub ? `<div class="p-sub">${sub}</div>` : ''}</div>${act ? `<div class="p-act">${act}</div>` : ''}</div>`;
  }
  function kpiCards(cards) {
    return `<div class="kpis">${cards.map((k) => `
      <div class="kpi">
        <div class="k-top"><span class="k-ic">${I(k.ic)}</span><span class="k-lab">${k.lab}</span></div>
        <div class="k-val tnum">${k.val}${k.unit ? `<small>${k.unit}</small>` : ''}</div>
        <div class="k-foot">${k.delta ? `<span class="delta ${k.dir === 'dn' ? 'dn' : ''}">${I(k.dir === 'dn' ? 'down' : 'up', 2)}${k.delta}</span>` : ''}<span class="muted">${k.foot}</span></div>
      </div>`).join('')}</div>`;
  }

  // area chart matching aurora.css .areachart
  function areaChart(o) {
    const n = o.labels.length, X = (i) => +(i / (n - 1) * 100).toFixed(2), Y = (v) => +(60 - v).toFixed(2);
    const smooth = (pts) => {
      let d = `M ${pts[0][0]},${pts[0][1]}`;
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2, t = 0.18;
        d += ` C ${(p1[0] + (p2[0] - p0[0]) * t).toFixed(2)},${(p1[1] + (p2[1] - p0[1]) * t).toFixed(2)} ${(p2[0] - (p3[0] - p1[0]) * t).toFixed(2)},${(p2[1] - (p3[1] - p1[1]) * t).toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
      }
      return d;
    };
    const pts = (arr) => arr.map((v, i) => [X(i), Y(v)]);
    const A = pts(o.a), B = o.b ? pts(o.b) : null, T = o.t ? pts(o.t) : null;
    const area = (p) => smooth(p) + ` L 100,60 L 0,60 Z`;
    const hlX = X(o.hl), hlT = +(Y(o.a[o.hl]) / 60 * 100).toFixed(2);
    const leg = (o.legend || []).map(([c, l, dash]) => `<i><b style="background:${c};${dash ? 'height:0;border-top:2px dashed ' + c : ''}"></b>${l}</i>`).join('');
    const gA = 'gA_' + o.id, gB = 'gB_' + o.id;
    return `<div class="areachart">
      <div class="legend">${leg}</div>
      <div class="plotwrap">
        <svg viewBox="0 0 100 60" preserveAspectRatio="none">
          <defs>
            <linearGradient id="${gA}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#5b8cff" stop-opacity=".5"/><stop offset="1" stop-color="#5b8cff" stop-opacity="0"/></linearGradient>
            <linearGradient id="${gB}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#8c5cff" stop-opacity=".3"/><stop offset="1" stop-color="#8c5cff" stop-opacity="0"/></linearGradient>
          </defs>
          ${B ? `<path d="${area(B)}" fill="url(#${gB})"/>` : ''}
          <path d="${area(A)}" fill="url(#${gA})"/>
          ${B ? `<path d="${smooth(B)}" fill="none" stroke="#8c5cff" stroke-width="1.6" stroke-opacity=".75" vector-effect="non-scaling-stroke" stroke-linecap="round"/>` : ''}
          <path class="accline" d="${smooth(A)}" fill="none" stroke="#5b8cff" stroke-width="2.4" vector-effect="non-scaling-stroke" stroke-linecap="round"/>
          ${T ? `<path d="${smooth(T)}" fill="none" stroke="#ff6fae" stroke-width="1.6" stroke-dasharray="3 3" vector-effect="non-scaling-stroke" stroke-linecap="round"/>` : ''}
        </svg>
        ${o.hlVal != null ? `<div class="floatval" style="left:${hlX}%;top:${hlT}%">${o.hlVal}</div><div class="dotmark" style="left:${hlX}%;top:${hlT}%"></div>` : ''}
      </div>
      <div class="xlabels">${o.labels.map((x) => `<span>${x}</span>`).join('')}</div>
    </div>`;
  }

  function spark(vals, color) {
    const n = vals.length, mx = Math.max.apply(null, vals), mn = Math.min.apply(null, vals);
    const X = (i) => +(i / (n - 1) * 100).toFixed(2), Y = (v) => +(48 - (v - mn) / (mx - mn || 1) * 40).toFixed(2);
    const P = vals.map((v, i) => [X(i), Y(v)]);
    let d = `M ${P[0][0]},${P[0][1]}`;
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || p2, t = 0.2;
      d += ` C ${(p1[0] + (p2[0] - p0[0]) * t).toFixed(2)},${(p1[1] + (p2[1] - p0[1]) * t).toFixed(2)} ${(p2[0] - (p3[0] - p1[0]) * t).toFixed(2)},${(p2[1] - (p3[1] - p1[1]) * t).toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
    }
    return `<svg viewBox="0 0 100 50" preserveAspectRatio="none"><path d="${d} L 100,50 L 0,50 Z" fill="${color}" fill-opacity=".14"/><path d="${d}" fill="none" stroke="${color}" stroke-width="2.2" vector-effect="non-scaling-stroke" stroke-linecap="round"/></svg>`;
  }

  function ring(pct, color) {
    const r = 34, c = 2 * Math.PI * r, off = c * (1 - pct / 100);
    return `<svg class="ring" viewBox="0 0 84 84">
      <circle cx="42" cy="42" r="${r}" fill="none" stroke="var(--inset)" stroke-width="9"/>
      <circle cx="42" cy="42" r="${r}" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 42 42)"/>
      <text class="rv" x="42" y="48" text-anchor="middle">${pct}%</text>
    </svg>`;
  }

  // accent override (mirrors buildShell)
  function buildOvr(theme, opts) {
    let ovr = '';
    if (opts.accent) {
      ovr += `--accent:${opts.accent};`
        + `--accent-tint:color-mix(in oklab, var(--accent) ${theme === 'dark' ? 15 : 11}%, transparent);`
        + `--accent-border:color-mix(in oklab, var(--accent) ${theme === 'dark' ? 70 : 88}%, #000);`
        + `--chip-bg:color-mix(in oklab, var(--accent) ${theme === 'dark' ? 12 : 8}%, transparent);`
        + `--shadow-accent:0 3px 11px -3px color-mix(in oklab, var(--accent) ${theme === 'dark' ? 45 : 52}%, transparent);`;
    }
    if (opts.accent2) ovr += `--accent-2:${opts.accent2};`;
    return ovr;
  }

  // chrome assembler
  function shell(o) {
    const railItems = (o.railItems || RAIL).map(([k, t], i) => `<div class="ri ${i === o.railOn ? 'on' : ''}" title="${t}">${I(k)}</div>`).join('');
    const rail = `<div class="rail"><div class="logo-mark" style="margin-bottom:8px"></div>${railItems}<div class="spacer"></div><div class="rdiv"></div><div class="ri" title="Help">${I('help')}</div><div class="ri" title="Settings">${I('gear')}</div></div>`;
    const topbar = `<div class="topbar">
      <div class="tenant"><span class="tav" style="background:var(--accent)">SJ</span> St. Jude Academy <span class="ni-ic chev">${I('chevD')}</span></div>
      <div class="crumbs">${o.crumbs}</div>
      <div class="omni"><span class="ni-ic" style="width:15px;height:15px;color:var(--ink-3)">${I('search')}</span><span class="ph">${o.search || 'Search students, classes, records…'}</span><span class="kbd">⌘K</span></div>
      <div class="top-actions">
        <button class="iconbtn bare" title="Quick add">${I('plus', 2)}</button>
        <button class="iconbtn bare">${I('bell')}<span class="dot-badge">${o.badge || 3}</span></button>
        <button class="iconbtn bare">${I('help')}</button>
        <div class="sep-v"></div>
        ${av(o.me || 'BE', o.meCol || '#334155')}
      </div>
    </div>`;
    return `<div class="shell" data-dir="aurora" data-theme="${o.theme}" data-screen-label="${o.label}"${o.ovr ? ` style="${o.ovr}"` : ''}>
      ${topbar}
      <div class="body">
        ${rail}
        ${o.nav ? `<div class="nav">${o.nav}</div>` : ''}
        <div class="main">${o.main}${o.fab === false ? '' : FAB}</div>
        ${o.inspector ? `<div class="inspector">${o.inspector}</div>` : ''}
      </div>
      <div class="statusbar">${o.status || STATUS}</div>
    </div>`;
  }

  const crumb = (parts) => parts.map((p, i) => i === parts.length - 1 ? `<span class="cur">${p}</span>` : `<span>${p}</span><span class="sep">/</span>`).join('');

  /* ============================================================
     1 · DASHBOARD — Head's overview (Principal)
     ============================================================ */
  function dashboard(theme, ovr) {
    const nav = navHead('grid', 'Overview', 'St. Jude Academy')
      + grp('School') + navItem('grid', 'Dashboard', { on: true }) + navItem('msg', 'Announcements', { count: '2' })
      + grp('People') + navItem('users', 'Students', { count: '1.2k' }) + navItem('userplus', 'Staff', { count: '96' })
      + grp('Academic') + navItem('cal', 'Timetable', {}) + navItem('clock', 'Attendance', {}) + navItem('book', 'Gradebook', {})
      + grp('Operations') + navItem('coins', 'Finance', { count: '7' }) + navItem('chart', 'Reports', {})
      + `<div class="nav-foot"><div class="upsell"><div class="ut">Term progress</div><div class="bar"><i style="width:64%"></i></div><div class="us">Week 8 of 12 · exams in 3 weeks</div></div></div>`;

    const feed = `<div class="feed">
      <div class="fr"><span class="fi warn">${I('check')}</span><span class="ft"><b>5 items await approval</b><small>4 results · 1 timetable change</small></span><span class="chev">${I('chevR')}</span></div>
      <div class="fr"><span class="fi warn">${I('flag')}</span><span class="ft"><b>2 discipline cases</b><small>Need review today · Year 10</small></span><span class="chev">${I('chevR')}</span></div>
      <div class="fr"><span class="fi pink">${I('clock')}</span><span class="ft"><b>Low attendance · 9A</b><small>88% this week, below 92% target</small></span><span class="chev">${I('chevR')}</span></div>
      <div class="fr"><span class="fi">${I('cal')}</span><span class="ft"><b>Mock exam timetable</b><small>Confirm by Fri · next week</small></span><span class="chev">${I('chevR')}</span></div>
      <div class="fr"><span class="fi pos">${I('coins')}</span><span class="ft"><b>£42k fees collected</b><small>Today · 96 payments</small></span><span class="when">2h</span></div>
    </div>`;

    const main = mainHead('Good morning, Dr Eze',
      `<b>Spring Term 2025</b><span>·</span>Wed 6 Jun<span>·</span>1,312 present today`,
      seg(['This week', 'Term'], 0) + btn('Filter', 'filter') + btn('Announcement', 'plus', 'primary'))
      + `<div class="main-body">
        ${kpiCards([
          { ic: 'users', lab: 'Students present', val: '1,312', unit: '/ 1,420', delta: '+2%', dir: 'up', foot: 'attendance up' },
          { ic: 'userplus', lab: 'Staff present', val: '88', unit: 'of 96', delta: '', dir: '', foot: '2 classes covered' },
          { ic: 'award', lab: 'Attendance (wk)', val: '94', unit: '%', delta: '+1 pt', dir: 'up', foot: 'vs. last week' },
          { ic: 'check', lab: 'Approvals', val: '5', unit: 'pending', delta: '', dir: '', foot: 'awaiting sign-off' },
        ])}
        <div class="split" style="grid-template-columns:minmax(0,1.18fr) minmax(0,1fr)">
          <div class="panel">
            ${panelHead('Attendance trend', 'two weeks', `<span class="badge accent"><span class="pip" style="background:var(--accent-2)"></span>This week</span>`)}
            ${areaChart({ id: 'dash', labels: ['M', 'T', 'W', 'T', 'F', 'M', 'T', 'W', 'T', 'F'], a: [44, 46, 42, 48, 45, 46, 48, 50, 47, 49], b: [38, 40, 36, 42, 40, 40, 42, 44, 41, 43], hl: 7, hlVal: '94%', legend: [['#5b8cff', 'Present'], ['#8c5cff', 'On time']] })}
          </div>
          <div class="panel">
            ${panelHead('Needs attention', '', btn('View all', '', 'ghost sm'))}
            ${feed}
          </div>
        </div>
      </div>`;

    const inspector = `<div class="ins-head"><span class="eyebrow">Today at St. Jude</span><div class="ic-actions"><button class="iconbtn bare" style="width:28px;height:28px">${I('cal', 1.7)}</button></div></div>
      <div class="ins-body">
        <div class="ins-stats"><div class="ins-stat"><div class="v">42</div><div class="l">Classes running</div></div><div class="ins-stat"><div class="v">3</div><div class="l">Events today</div></div></div>
        <div><div class="sec-label" style="margin-bottom:8px">Schedule</div>
          <div class="agenda">
            <div class="ag"><span class="t">08:15</span><span class="dotline"></span><div class="e"><b>Whole-school assembly</b><small>Main hall</small></div></div>
            <div class="ag now"><span class="t">10:00</span><span class="dotline"></span><div class="e"><b>SLT briefing</b><small>Office · in progress</small></div></div>
            <div class="ag"><span class="t">13:30</span><span class="dotline"></span><div class="e"><b>Year 11 mock review</b><small>Room B2 · with VP Academic</small></div></div>
            <div class="ag"><span class="t">16:00</span><span class="dotline"></span><div class="e"><b>Governors call</b><small>Online</small></div></div>
          </div>
        </div>
        <div class="ins-actions"><button class="btn primary">${I('check', 1.9)} Review approvals</button><button class="btn ghost">${I('msg', 1.7)} Send announcement</button></div>
      </div>`;

    return shell({ theme, ovr, label: 'Aurora · Overview', railOn: 0, me: 'DE', meCol: '#0ea5e9', crumbs: crumb(['Admin', 'Overview']), search: 'Search students, staff, records…', nav, main, inspector });
  }

  /* ============================================================
     2 · TIMETABLE
     ============================================================ */
  function timetable(theme, ovr) {
    const C = { bio: '#5b8cff', chem: '#2ee6a6', math: '#8c5cff', eng: '#ff6fae', phys: '#22d3ee', hist: '#ffce5c', pe: '#f59e0b', form: '#94a3b8' };
    const L = (s, r, c, tag) => `<div class="lesson" style="--lc:${c}"><b>${s}</b><span class="lm">${r}</span><span class="tag">${tag}</span></div>`;
    const empty = `<div class="cell"></div>`;
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const rows = [
      { t: '08:30', cells: [L('Biology', 'Rm 204', C.bio, '11B'), L('Maths', 'Rm 108', C.math, '11B'), L('English', 'Rm 12', C.eng, '11B'), L('Chemistry', 'Lab 2', C.chem, '11B'), L('Biology', 'Rm 204', C.bio, '11B')] },
      { t: '09:30', cells: [L('English', 'Rm 12', C.eng, '11B'), L('Physics', 'Lab 1', C.phys, '11B'), L('Maths', 'Rm 108', C.math, '11B'), L('History', 'Rm 9', C.hist, '11B'), empty] },
      { brk: 'Break · 10:30' },
      { t: '10:45', cells: [L('Chemistry', 'Lab 2', C.chem, '11B'), L('Biology', 'Rm 204', C.bio, '11B'), L('PE', 'Sports hall', C.pe, '11B'), L('English', 'Rm 12', C.eng, '11B'), L('Maths', 'Rm 108', C.math, '11B')] },
      { t: '11:45', cells: [L('Maths', 'Rm 108', C.math, '11B'), empty, L('Physics', 'Lab 1', C.phys, '11B'), L('Biology', 'Rm 204', C.bio, '11B'), L('History', 'Rm 9', C.hist, '11B')] },
      { brk: 'Lunch · 12:45' },
      { t: '13:30', cells: [L('Form time', 'Rm 109', C.form, '11B'), L('History', 'Rm 9', C.hist, '11B'), L('Chemistry', 'Lab 2', C.chem, '11B'), L('Maths', 'Rm 108', C.math, '11B'), L('Physics', 'Lab 1', C.phys, '11B')] },
      { t: '14:30', cells: [L('Physics', 'Lab 1', C.phys, '11B'), L('PE', 'Sports hall', C.pe, '11B'), empty, L('English', 'Rm 12', C.eng, '11B'), L('Form time', 'Rm 109', C.form, '11B')] },
    ];
    const grid = `<div class="tt">
      <div class="hd"></div>${days.map((d, i) => `<div class="hd">${d}<small>${5 + i} Jun</small></div>`).join('')}
      ${rows.map((r) => r.brk ? `<div class="brk">${r.brk}</div>` : `<div class="tm">${r.t}</div>${r.cells.join('')}`).join('')}
    </div>`;

    const nav = navHead('cal', 'Timetable', 'Spring Term 2025')
      + grp('View') + navItem('cal', 'My week', { on: true }) + navItem('clock', 'Day', {}) + navItem('pin', 'By room', {}) + navItem('users', 'By teacher', {})
      + grp('Classes') + navItem('book', 'Biology · 11B', { count: '28' }) + navItem('book', 'Biology · 11A', { count: '26' }) + navItem('book', 'Chemistry · 10A', { count: '30' })
      + `<div class="nav-foot"><div class="upsell"><div class="ut">This week</div><div class="us">34 lessons · 2 cover slots · 1 room clash flagged</div></div></div>`;

    const main = mainHead('Timetable',
      `<b>Week of 5 Jun</b><span>·</span>11B · Year 11<span>·</span>34 lessons`,
      seg(['Week', 'Day', 'List'], 0) + btn('Today', 'clock') + btn('Add lesson', 'plus', 'primary'))
      + `<div class="main-body"><div class="panel solo">${panelHead('11B · weekly view', 'Mon – Fri', `<span class="badge accent"><span class="pip" style="background:var(--accent-2)"></span>Wed, today</span>`)}<div class="tt-wrap">${grid}</div></div></div>`;

    const inspector = `<div class="ins-head"><span class="eyebrow">Lesson</span><div class="ic-actions"><button class="iconbtn bare" style="width:28px;height:28px">${I('expand', 1.7)}</button></div></div>
      <div class="ins-body">
        <div class="profile"><span class="av lg" style="background:linear-gradient(135deg,#5b8cff,#8c5cff)">Bi</span><div class="pinfo"><h3>Biology</h3><div class="pmeta">11B · Wed 08:30 – 09:30</div></div></div>
        <div class="chips"><span class="badge accent">Room 204</span><span class="badge info">Mr Okafor</span><span class="badge"><span class="pip" style="background:var(--ink-3)"></span>28 students</span></div>
        <div class="fields">
          <div class="field"><span class="fl">Topic</span><span class="fv">Cell transport — osmosis</span></div>
          <div class="field-2"><div class="field"><span class="fl">Unit</span><span class="fv">3 · Cells</span></div><div class="field"><span class="fl">Lesson</span><span class="fv tnum">7 of 12</span></div></div>
        </div>
        <div><div class="sec-label" style="margin-bottom:8px">Attached</div>
          <div class="agenda">
            <div class="ag"><span class="t">${I('doc', 1.6)}</span><div class="e"><b>Lesson slides</b><small>Osmosis · 18 slides</small></div></div>
            <div class="ag"><span class="t">${I('clipboard', 1.6)}</span><div class="e"><b>Lab worksheet</b><small>Due next lesson</small></div></div>
          </div>
        </div>
        <div class="ins-actions"><button class="btn primary">${I('clock', 1.9)} Take attendance</button><button class="btn ghost">${I('doc', 1.7)} Open lesson</button></div>
      </div>`;

    return shell({ theme, ovr, label: 'Aurora · Timetable', railOn: 3, me: 'MC', meCol: '#8b5cf6', crumbs: crumb(['Academic', 'Timetable', 'Week']), search: 'Search lessons, rooms, classes…', nav, main, inspector });
  }

  /* ============================================================
     3 · GRADEBOOK
     ============================================================ */
  function gradebook(theme, ovr) {
    const band = (g) => /A/.test(g) ? 'a' : /B/.test(g) ? 'b' : /C/.test(g) ? 'c' : 'd';
    const g = (x) => x === '—' ? `<span class="grade na">—</span>` : `<span class="grade ${band(x)}">${x}</span>`;
    const cols = [['Cells', 'Test · 20%'], ['Photo&shy;synthesis', 'CW · 15%'], ['Genetics', 'Quiz · 10%'], ['Mock P1', 'Exam · 30%'], ['Ecology', 'Lab · 15%']];
    const studs = [
      { av: 'AR', col: '#e0654a', nm: 'Alex Rivera', gs: ['A', 'A−', 'B+', 'A', 'A−'], avg: 'A−' },
      { av: 'MJ', col: '#0ea5e9', nm: 'Maria Jones', gs: ['B+', 'B', 'A−', 'B', 'B+'], avg: 'B+' },
      { av: 'SO', col: '#8b5cf6', nm: 'Samuel Okafor', gs: ['A', 'A', 'A', 'A−', 'A'], avg: 'A' },
      { av: 'TP', col: '#15966a', nm: 'Tobias Pierce', gs: ['B', 'C+', 'B−', 'C', 'B'], avg: 'B−' },
      { av: 'HW', col: '#f59e0b', nm: 'Hannah Webb', gs: ['A−', 'B+', 'A', 'B+', 'A−'], avg: 'A−' },
      { av: 'LN', col: '#ec4899', nm: 'Leo Nakamura', gs: ['C+', 'B', 'C', '—', 'C+'], avg: 'C+' },
      { av: 'KB', col: '#6366f1', nm: 'Kira Bauer', gs: ['B', 'B+', 'B', 'B', 'A−'], avg: 'B+' },
      { av: 'DV', col: '#0891b2', nm: 'Diego Vega', gs: ['A', 'A−', 'B+', 'A', 'A'], avg: 'A' },
    ];
    const head = `<tr><th class="stu">Student</th>${cols.map((c) => `<th>${c[0]}<small>${c[1]}</small></th>`).join('')}<th class="avg">Avg</th></tr>`;
    const body = studs.map((s) => `<tr><td class="stu"><div class="who">${av(s.av, s.col, 'sm')}<span class="nm">${s.nm}</span></div></td>${s.gs.map((x) => `<td>${g(x)}</td>`).join('')}<td class="avg">${g(s.avg)}</td></tr>`).join('');

    const nav = navHead('book', 'Gradebook', 'Mr Okafor')
      + grp('My classes') + navItem('book', 'Biology · 11B', { on: true, count: 'A−' }) + navItem('book', 'Biology · 11A', { count: 'B+' }) + navItem('book', 'Chemistry · 10A', { count: 'B' })
      + grp('Term') + navItem('cal', 'Spring 2025', { chev: true }) + navItem('award', 'Report cards', {})
      + `<div class="nav-foot"><div class="upsell"><div class="ut">Class average</div><div class="bar"><i style="width:78%"></i></div><div class="us">B+ · up from B last term</div></div></div>`;

    const main = mainHead('Biology · 11B',
      `<b>Spring Term 2025</b><span>·</span>28 students<span>·</span>5 assessments`,
      seg(['Marks', 'Analytics'], 0) + btn('Export', 'download') + btn('Assessment', 'plus', 'primary'))
      + `<div class="filters"><span class="chipf on">All assessments <b style="opacity:.7;font-weight:700">5</b></span><span class="chipf">Tests</span><span class="chipf">Coursework</span><span class="chipf">Below target <b style="opacity:.7;font-weight:700">3</b></span><span class="chipf">${I('plus', 1.8)} Add filter</span></div>`
      + `<div class="main-body"><div class="panel solo">${panelHead('Marks grid', 'tap a cell to edit', btn('Sort', 'sort', 'ghost sm') + btn('Comment', '', 'ghost sm'))}<div class="gb-wrap"><table class="gb"><thead>${head}</thead><tbody>${body}</tbody></table></div></div></div>`;

    const dist = [['A', '#2ee6a6', 38, 11], ['B', '#5b8cff', 36, 10], ['C', '#ffce5c', 18, 5], ['D', '#ff6b6b', 8, 2]];
    const inspector = `<div class="ins-head"><span class="eyebrow">Class summary</span><div class="ic-actions"><button class="iconbtn bare" style="width:28px;height:28px">${I('chart', 1.7)}</button></div></div>
      <div class="ins-body">
        <div class="ins-stats"><div class="ins-stat"><div class="v">B+</div><div class="l">Class average</div></div><div class="ins-stat"><div class="v">92%</div><div class="l">Submitted</div></div></div>
        <div><div class="sec-label" style="margin-bottom:10px">Grade distribution</div>
          <div class="dist">${dist.map(([gr, c, pct, n]) => `<div class="d"><span class="g" style="color:${c}">${gr}</span><span class="track"><span class="fill" style="width:${pct}%;background:${c}"></span></span><span class="n">${n}</span></div>`).join('')}</div>
        </div>
        <div class="fields"><div class="field-2"><div class="field"><span class="fl">Top mark</span><span class="fv">S. Okafor · A</span></div><div class="field"><span class="fl">Needs support</span><span class="fv">2 students</span></div></div></div>
        <div class="ins-actions"><button class="btn primary">${I('award', 1.9)} Publish results</button><button class="btn ghost">${I('msg', 1.7)} Message guardians</button></div>
      </div>`;

    return shell({ theme, ovr, label: 'Aurora · Gradebook', railOn: 2, me: 'MC', meCol: '#8b5cf6', crumbs: crumb(['Academic', 'Gradebook', 'Biology 11B']), search: 'Search students, assessments…', nav, main, inspector });
  }

  /* ============================================================
     4 · ADA — AI assistant
     ============================================================ */
  function ada(theme, ovr) {
    const nav = navHead('sparkle', 'Ada', 'Your school copilot')
      + btn('New chat', 'plus', 'primary') + `<div style="height:6px"></div>`
      + grp('Today') + navItem('msg', 'Attendance this week', { on: true }) + navItem('msg', 'Year 11 mock results', {}) + navItem('msg', 'Fees outstanding', {})
      + grp('Earlier') + navItem('msg', 'Staff cover Friday', {}) + navItem('msg', 'Enrollment vs target', {}) + navItem('msg', 'Library overdue list', {})
      + `<div class="nav-foot"><div class="upsell"><div class="ut">Grounded &amp; private</div><div class="us">Ada only reads data you can access. Answers cite their source.</div></div></div>`;

    const thread = `<div class="thread">
      <div class="hello"><span class="orb"></span><div><h2>Hi Dr Eze — ask Ada anything</h2><div class="sub">Grounded in St. Jude's live data · Spring Term 2025</div></div></div>
      <div class="msg user"><div class="ub">How is attendance trending this week compared with last week?</div></div>
      <div class="msg ada"><span class="orb sm"></span><div class="ab">
        <p>Attendance is <strong>up 1.4 points</strong> week-on-week. The school is averaging <strong>94%</strong> this week versus 92.6% last week — driven mainly by Years 7–9 recovering after the bug going round.</p>
        <p>One group to watch: <strong>9A is at 88%</strong>, still below the 92% target for the third week running.</p>
        <div class="answer-card">
          <div class="ac-top"><span class="ac-v">94%</span><span class="ac-d">▲ 1.4 pts</span><span class="ac-l">whole-school · this week</span></div>
          <div class="spark">${spark([91, 92, 90, 93, 92, 93, 94, 95, 94, 94], '#5b8cff')}</div>
        </div>
        <div class="src"><span class="s">${I('clock', 1.7)} Attendance register</span><span class="s">${I('chart', 1.7)} Weekly report</span><span class="s">${I('users', 1.7)} 1,420 students</span></div>
        <div class="followups"><span class="fu">Break down by year group</span><span class="fu">Flag students below 90%</span><span class="fu">Draft a note to 9A tutors</span></div>
      </div></div>
    </div>`;

    const composer = `<div class="composer">
      <div class="prompts">
        <span class="prompt">${I('sparkle')} Summarise today's approvals</span>
        <span class="prompt">${I('sparkle')} Which classes are below target?</span>
        <span class="prompt">${I('sparkle')} Fees collected this term</span>
      </div>
      <div class="box"><span class="ph">Ask about attendance, results, finance, staffing…</span><span class="mini">Grounded</span><button class="send">${I('send', 1.9)}</button></div>
    </div>`;

    const main = mainHead('Ask Ada',
      `<b>Analytics copilot</b><span>·</span>role-scoped<span>·</span>sources cited`,
      seg(['Chat', 'Insights'], 0) + btn('History', 'clock', 'ghost'))
      + `<div class="ada">${thread}${composer}</div>`;

    return shell({ theme, ovr, label: 'Aurora · Ada', railOn: 0, me: 'DE', meCol: '#0ea5e9', crumbs: crumb(['Ada', 'Chat']), search: 'Search conversations…', nav, main, inspector: null, fab: false });
  }

  /* ============================================================
     5 · REPORTS / ANALYTICS
     ============================================================ */
  function reports(theme, ovr) {
    const nav = navHead('chart', 'Reports', 'St. Jude Academy')
      + grp('Library') + navItem('chart', 'Overview', { on: true }) + navItem('clock', 'Attendance', {}) + navItem('award', 'Academic', {}) + navItem('coins', 'Finance', {}) + navItem('userplus', 'Enrollment', {})
      + grp('Saved') + navItem('doc', 'Termly board pack', { chev: true }) + navItem('doc', 'Weekly SLT digest', {})
      + `<div class="nav-foot"><div class="upsell"><div class="ut">Scheduled</div><div class="us">Board pack auto-sends Monday 07:00 to 6 recipients</div></div></div>`;

    const hb = [['Year 7', 91, '91%'], ['Year 8', 88, '88%'], ['Year 9', 84, '84%'], ['Year 10', 90, '90%'], ['Year 11', 93, '93%']];
    const hbars = `<div class="hbars">${hb.map(([l, p, v]) => `<div class="hb"><span class="lab">${l}</span><span class="track"><span class="fill" style="width:${p}%"></span></span><span class="val">${v}</span></div>`).join('')}</div>`;

    const main = mainHead('Reports',
      `<b>Spring Term 2025</b><span>·</span>auto-updated 9m ago<span>·</span>36 run this term`,
      seg(['Overview', 'Builder'], 0) + btn('Export', 'download') + btn('New report', 'plus', 'primary'))
      + `<div class="filters"><span class="chipf on">This term</span><span class="chipf">All year groups</span><span class="chipf">vs. target</span><span class="chipf">${I('plus', 1.8)} Add filter</span></div>`
      + `<div class="main-body">
        ${kpiCards([
          { ic: 'award', lab: 'Avg attendance', val: '92', unit: '%', delta: '+1 pt', dir: 'up', foot: 'term to date' },
          { ic: 'cap', lab: 'Pass rate', val: '88', unit: '%', delta: '+3 pts', dir: 'up', foot: 'mock exams' },
          { ic: 'coins', lab: 'Fees collected', val: '92', unit: '%', delta: '+4 pts', dir: 'up', foot: '£286k of £312k' },
          { ic: 'chart', lab: 'Reports run', val: '36', unit: '', delta: '', dir: '', foot: '6 scheduled' },
        ])}
        <div class="split" style="grid-template-columns:minmax(0,1.12fr) minmax(0,1fr)">
          <div class="panel">${panelHead('Attendance vs target', 'two weeks', `<span class="badge accent"><span class="pip" style="background:var(--accent-2)"></span>On track</span>`)}
            ${areaChart({ id: 'rep', labels: ['M', 'T', 'W', 'T', 'F', 'M', 'T', 'W', 'T', 'F'], a: [40, 44, 41, 46, 43, 45, 47, 49, 46, 48], t: [44, 44, 44, 44, 44, 46, 46, 46, 46, 46], hl: 7, hlVal: '93%', legend: [['#5b8cff', 'Actual'], ['#ff6fae', 'Target', true]] })}
          </div>
          <div class="panel">${panelHead('Attendance by year group', 'this week', btn('Drill in', '', 'ghost sm'))}${hbars}</div>
        </div>
      </div>`;

    const inspector = `<div class="ins-head"><span class="eyebrow">Saved reports</span><div class="ic-actions"><button class="iconbtn bare" style="width:28px;height:28px">${I('plus', 1.7)}</button></div></div>
      <div class="ins-body">
        <div class="rep-list">
          <div class="rep"><span class="ri-ic">${I('doc', 1.6)}</span><div><b>Termly board pack</b><small>12 pages · scheduled Mon</small></div></div>
          <div class="rep"><span class="ri-ic">${I('clock', 1.6)}</span><div><b>Weekly SLT digest</b><small>Attendance + behaviour</small></div></div>
          <div class="rep"><span class="ri-ic">${I('coins', 1.6)}</span><div><b>Fee collection</b><small>Updated 9m ago</small></div></div>
        </div>
        <div class="fields"><div class="field"><span class="fl">Last export</span><span class="fv">PDF · 14:02 today</span></div><div class="field-2"><div class="field"><span class="fl">Recipients</span><span class="fv">6</span></div><div class="field"><span class="fl">Cadence</span><span class="fv">Weekly</span></div></div></div>
        <div class="ins-actions"><button class="btn primary">${I('download', 1.9)} Export board pack</button><button class="btn ghost">${I('cal', 1.7)} Schedule send</button></div>
      </div>`;

    return shell({ theme, ovr, label: 'Aurora · Reports', railOn: 5, me: 'DE', meCol: '#0ea5e9', crumbs: crumb(['Insight', 'Reports', 'Overview']), search: 'Search reports, metrics…', nav, main, inspector });
  }

  /* ============================================================
     6 · FINANCE & FEES (bursar)
     ============================================================ */
  function finance(theme, ovr) {
    const nav = navHead('coins', 'Finance', 'Mr Ade · Bursar')
      + grp('Money') + navItem('coins', 'Fees', { on: true }) + navItem('receipt', 'Invoices', { count: '27' }) + navItem('card', 'Payments', {}) + navItem('award', 'Scholarships', {})
      + grp('Insight') + navItem('chart', 'Reports', {}) + navItem('flag', 'Defaulters', { count: '142', hot: true })
      + `<div class="nav-foot"><div class="upsell"><div class="ut">Collection rate</div><div class="bar"><i style="width:92%"></i></div><div class="us">£286k of £312k invoiced · 92%</div></div></div>`;

    const pays = [
      { av: 'AR', col: '#e0654a', nm: 'Alex Rivera', meta: 'Year 9 · Term fee', amt: '£840', cls: 'pos', st: 'Paid', via: 'Transfer' },
      { av: 'MJ', col: '#0ea5e9', nm: 'Maria Jones', meta: 'Year 11 · Term fee', amt: '£1,120', cls: 'warn', st: 'Part-paid', via: 'Card' },
      { av: 'SO', col: '#8b5cf6', nm: 'Samuel Okafor', meta: 'Scholarship · waiver', amt: '£0', cls: 'info', st: 'Waived', via: '—' },
      { av: 'TP', col: '#15966a', nm: 'Tobias Pierce', meta: 'Year 12 · Term fee', amt: '£1,240', cls: 'pos', st: 'Paid', via: 'Transfer' },
      { av: 'LN', col: '#ec4899', nm: 'Leo Nakamura', meta: 'Year 8 · Term fee', amt: '£760', cls: 'neutral', st: 'Overdue', via: '—' },
    ];
    const pip = (c) => c === 'pos' ? 'var(--pos)' : c === 'warn' ? 'var(--warn)' : c === 'info' ? 'var(--accent-2)' : 'var(--ink-3)';
    const rows = pays.map((p, i) => `<tr class="${i === 0 ? 'on' : ''}"><td><div class="who">${av(p.av, p.col, 'sm')}<div><div class="nm">${p.nm}</div><div class="meta">${p.meta}</div></div></div></td><td><span class="gradetag">${p.via}</span></td><td><span class="badge ${p.cls}"><span class="pip" style="background:${pip(p.cls)}"></span>${p.st}</span></td><td class="num tnum">${p.amt}</td></tr>`).join('');

    const main = mainHead('Fees &amp; billing',
      `<b>Spring Term 2025</b><span>·</span>£312k invoiced<span>·</span>142 outstanding`,
      seg(['Overview', 'Ledger'], 0) + btn('Export', 'download') + btn('Record payment', 'plus', 'primary'))
      + `<div class="filters"><span class="chipf on">All <b style="opacity:.7;font-weight:700">480</b></span><span class="chipf">Paid <b style="opacity:.7;font-weight:700">338</b></span><span class="chipf">Outstanding <b style="opacity:.7;font-weight:700">142</b></span><span class="chipf">Overdue</span><span class="chipf">${I('plus', 1.8)} Add filter</span></div>`
      + `<div class="main-body">
        ${kpiCards([
          { ic: 'coins', lab: 'Collected (term)', val: '£286k', unit: '', delta: '+9%', dir: 'up', foot: 'vs. last term' },
          { ic: 'card', lab: 'Outstanding', val: '£26k', unit: '', delta: '', dir: '', foot: '142 students' },
          { ic: 'flag', lab: 'Overdue', val: '142', unit: '', delta: '−8', dir: 'up', foot: 'reminders sent' },
          { ic: 'award', lab: 'Collection rate', val: '92', unit: '%', delta: '+4 pts', dir: 'up', foot: 'target 90%' },
        ])}
        <div class="split">
          <div class="panel">${panelHead('Daily collections', 'two weeks', `<span class="badge accent"><span class="pip" style="background:var(--accent-2)"></span>£42k today</span>`)}
            ${areaChart({ id: 'fin', labels: ['M', 'T', 'W', 'T', 'F', 'M', 'T', 'W', 'T', 'F'], a: [24, 32, 28, 40, 30, 26, 34, 42, 36, 44], b: [16, 22, 20, 28, 22, 18, 24, 30, 26, 32], hl: 9, hlVal: '£44k', legend: [['#5b8cff', 'Collected'], ['#8c5cff', 'Cleared']] })}
          </div>
          <div class="panel">${panelHead('Recent payments', '', btn('View all', '', 'ghost sm'))}
            <div class="table-wrap"><table class="tbl"><thead><tr><th>Student</th><th>Method</th><th>Status</th><th class="num">Amount</th></tr></thead><tbody>${rows}</tbody></table></div>
          </div>
        </div>
      </div>`;

    const inspector = `<div class="ins-head"><span class="eyebrow">Invoice</span><div class="ic-actions"><button class="iconbtn bare" style="width:28px;height:28px">${I('pin', 1.7)}</button><button class="iconbtn bare" style="width:28px;height:28px">${I('expand', 1.7)}</button></div></div>
      <div class="ins-body">
        <div class="profile">${av('AR', '#e0654a', 'lg')}<div class="pinfo"><h3>Alex Rivera</h3><div class="pmeta">Year 9 · INV-2025-0418</div></div></div>
        <div class="chips"><span class="badge pos"><span class="pip" style="background:var(--pos)"></span>Paid</span><span class="badge accent">In full</span><span class="badge info">Transfer</span></div>
        <div><div class="sec-label" style="margin-bottom:9px">Breakdown</div>
          <div class="infocard" style="padding:11px 13px"><div class="row"><span class="k">Tuition · Spring</span><span class="v tnum">£720</span></div><div class="row"><span class="k">Activities</span><span class="v tnum">£80</span></div><div class="row"><span class="k">Transport</span><span class="v tnum">£40</span></div><div class="row"><span class="k" style="font-weight:700;color:var(--ink)">Total</span><span class="v tnum">£840</span></div></div>
        </div>
        <div><div class="sec-label" style="margin-bottom:9px">Activity</div>
          <div class="timeline"><div class="tl-row done"><span class="tl-dot"></span><div class="tl-tx">Invoice issued<small>1 May · emailed guardian</small></div></div><div class="tl-row done"><span class="tl-dot"></span><div class="tl-tx">Payment received<small>3 May · £840 · transfer</small></div></div><div class="tl-row done"><span class="tl-dot"></span><div class="tl-tx">Receipt sent<small>3 May · auto</small></div></div></div>
        </div>
        <div class="ins-actions"><button class="btn primary">${I('receipt', 1.9)} Send receipt</button><button class="btn ghost">${I('doc', 1.7)} View ledger</button></div>
      </div>`;

    return shell({ theme, ovr, label: 'Aurora · Finance', railOn: 4, me: 'MA', meCol: '#0891b2', crumbs: crumb(['Operations', 'Finance', 'Fees']), search: 'Search invoices, students, payments…', nav, main, inspector });
  }

  /* ============================================================
     7 · STUDENT RECORD
     ============================================================ */
  function record(theme, ovr) {
    const nav = navHead('users', 'Students', 'St. Jude Academy')
      + grp('Records') + navItem('address', 'Directory', { on: true, count: '1.2k' }) + navItem('userplus', 'Enrollment', { count: '42', hot: true }) + navItem('clock', 'Attendance', {})
      + grp('Academics', true) + navItem('book', 'Gradebook', {}) + navItem('', 'Report cards', { sub: true }) + navItem('', 'Transcripts', { sub: true })
      + grp('Operations') + navItem('card', 'Fees & billing', { count: '7' }) + navItem('bus', 'Transport', {})
      + `<div class="nav-foot"><div class="upsell"><div class="ut">Viewing</div><div class="us">Maya Chen · Year 11 · record open</div></div></div>`;

    const cls = [['Biology', 'Mr Okafor', '#5b8cff'], ['Chemistry', 'Ms Diaz', '#2ee6a6'], ['Maths', 'Mr Bell', '#8c5cff'], ['English', 'Ms Cole', '#ff6fae'], ['Physics', 'Dr Ofori', '#22d3ee'], ['History', 'Mr Udo', '#ffce5c']];
    const results = [['Chemistry', 'Term test', 'A'], ['English', 'Essay', 'B+'], ['Biology', 'Quiz', 'A−'], ['Maths', 'Problem set', 'B+']];

    const main = mainHead('Maya Chen',
      `<b>Year 11 · STEM track</b><span>·</span>Form 11-B<span>·</span>#SJA-2024-0188`,
      btn('Export', 'download', 'ghost') + btn('Edit record', '', 'primary'))
      + `<div class="main-body"><div class="rec-scroll">
        <div class="rec-head"><span class="ph-av">MC</span><div><h2>Maya Chen</h2><div class="rm">Year 11 · STEM track · Form 11-B · joined Sep 2021</div><div class="chips" style="margin-top:8px"><span class="badge pos"><span class="pip" style="background:var(--pos)"></span>Enrolled</span><span class="badge accent">Good standing</span><span class="badge info">Scholarship</span></div></div></div>
        <div class="rec-tabs"><span class="on">Overview</span><span>Academics</span><span>Attendance</span><span>Documents</span></div>
        <div class="infogrid">
          <div class="infocard"><h4>Personal</h4><div class="row"><span class="k">Date of birth</span><span class="v tnum">14 Mar 2009</span></div><div class="row"><span class="k">Home language</span><span class="v">English</span></div><div class="row"><span class="k">Address</span><span class="v">42 Elm Row, North</span></div><div class="row"><span class="k">Catchment</span><span class="v">North · In-zone</span></div></div>
          <div class="infocard"><h4>Guardians</h4><div class="guard">${av('RC', '#6366f1', 'sm')}<div class="gx"><b>Robert Chen</b><small>Father · primary contact</small></div></div><div class="guard">${av('LC', '#ec4899', 'sm')}<div class="gx"><b>Lena Chen</b><small>Mother · 07700 900 188</small></div></div></div>
          <div class="infocard span2"><h4>Current classes</h4><div class="clsgrid">${cls.map(([s, t, c]) => `<div class="clschip" style="--lc:${c}"><b>${s}</b><small>${t}</small></div>`).join('')}</div></div>
          <div class="infocard"><h4>Attendance</h4><div class="ring-wrap">${ring(96, '#2ee6a6')}<div class="ring-leg"><div class="rl"><b style="background:#2ee6a6"></b>Present · 96%</div><div class="rl"><b style="background:var(--warn)"></b>Late · 2%</div><div class="rl"><b style="background:var(--ink-3)"></b>Absent · 2%</div></div></div></div>
          <div class="infocard"><h4>Recent results</h4>${results.map(([s, a, g]) => `<div class="row"><span class="k">${s} · ${a}</span><span class="v" style="color:${/A/.test(g) ? 'var(--pos)' : 'var(--accent)'}">${g}</span></div>`).join('')}</div>
        </div>
      </div></div>`;

    const inspector = `<div class="ins-head"><span class="eyebrow">Quick facts</span><div class="ic-actions"><button class="iconbtn bare" style="width:28px;height:28px">${I('pin', 1.7)}</button><button class="iconbtn bare" style="width:28px;height:28px">${I('expand', 1.7)}</button></div></div>
      <div class="ins-body">
        <div class="ins-stats"><div class="ins-stat"><div class="v">96%</div><div class="l">Attendance</div></div><div class="ins-stat"><div class="v">3.7</div><div class="l">GPA</div></div></div>
        <div class="fields"><div class="field"><span class="fl">Next class</span><span class="fv">Biology · 13:30 · Rm 204</span></div><div class="field-2"><div class="field"><span class="fl">Subjects</span><span class="fv">8</span></div><div class="field"><span class="fl">House</span><span class="fv">Aurora</span></div></div></div>
        <div><div class="sec-label" style="margin-bottom:9px">Recent activity</div>
          <div class="timeline"><div class="tl-row done"><span class="tl-dot"></span><div class="tl-tx">Submitted Biology lab<small>Today · 09:12</small></div></div><div class="tl-row done"><span class="tl-dot"></span><div class="tl-tx">Chemistry test graded<small>Yesterday · A</small></div></div><div class="tl-row"><span class="tl-dot"></span><div class="tl-tx">Parents evening booked<small>Thu 6pm</small></div></div></div>
        </div>
        <div class="ins-actions"><button class="btn primary">${I('msg', 1.9)} Message guardians</button><button class="btn ghost">${I('doc', 1.7)} Generate report card</button></div>
      </div>`;

    return shell({ theme, ovr, label: 'Aurora · Student record', railOn: 1, me: 'BE', crumbs: crumb(['People', 'Students', 'Maya Chen']), search: 'Search students, records…', nav, main, inspector });
  }

  const SCREENS = { dashboard, timetable, gradebook, ada, reports, finance, record };

  window.buildAuroraScreen = function (key, theme, opts) {
    opts = opts || {};
    const ovr = buildOvr(theme, opts);
    return (SCREENS[key] || dashboard)(theme, ovr);
  };
})();
