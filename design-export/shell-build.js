/* ============================================================
   SchoolWithEase — Hi-Fi Layout A shell builder
   window.buildShell(dir, theme, label) -> HTML string
   Registrar context · St. Jude Academy · Spring Term 2025
   ============================================================ */
(function () {
  // ---- inline icon set (stroke = currentColor) -------------------
  const ic = {
    grid: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/>',
    users: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 5.2a3 3 0 0 1 0 5.6M16.5 19a5.5 5.5 0 0 0-2-4.3"/>',
    book: '<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19"/>',
    cal: '<rect x="3.5" y="5" width="17" height="15" rx="2.2"/><path d="M3.5 9.5h17M8 3v3M16 3v3"/><path d="m9 14 2 2 3.5-3.5"/>',
    coins: '<ellipse cx="9" cy="7" rx="5.5" ry="2.6"/><path d="M3.5 7v5c0 1.4 2.5 2.6 5.5 2.6s5.5-1.2 5.5-2.6V7"/><path d="M9 14.6v3.4c0 1.4 2.5 2.6 5.5 2.6s5.5-1.2 5.5-2.6v-5"/>',
    chart: '<path d="M4 4v16h16"/><path d="M8 15v2M12 11v6M16 7v10"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1M18.4 18.4l-2.1-2.1M7.7 7.7 5.6 5.6"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.2 9.3a2.8 2.8 0 0 1 5.4 1c0 1.9-2.6 2.2-2.6 4M12 17.4h.01"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.5-4.5"/>',
    bell: '<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M9.5 19a2.6 2.6 0 0 0 5 0"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    filter: '<path d="M3.5 5h17l-6.5 8v5l-4 2v-7z"/>',
    sort: '<path d="M7 4v16M7 20l-3-3M7 4l3 3M17 20V4M17 4l3 3M17 20l-3-3"/>',
    chevD: '<path d="m5 8 5 5 5-5"/>',
    chevR: '<path d="m9 5 5 5-5 5"/>',
    up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    down: '<path d="M12 5v14M5 12l7 7 7 7"/>',
    expand: '<path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    userplus: '<circle cx="9" cy="8" r="3.4"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M18 7v6M21 10h-6"/>',
    address: '<rect x="5" y="3.5" width="14" height="17" rx="2"/><circle cx="12" cy="10" r="2.4"/><path d="M8.5 16.5a3.5 3.5 0 0 1 7 0M3.5 7h2M3.5 12h2M3.5 17h2"/>',
    clipboard: '<rect x="5" y="4.5" width="14" height="16" rx="2"/><path d="M9 4.5a3 3 0 0 1 6 0M8.5 11h7M8.5 15h5"/>',
    award: '<circle cx="12" cy="9" r="5"/><path d="M9 13.5 7.5 21l4.5-2.5L16.5 21 15 13.5"/>',
    card: '<rect x="3" y="5.5" width="18" height="13" rx="2.2"/><path d="M3 10h18M6.5 14.5h4"/>',
    bus: '<rect x="4" y="5" width="16" height="11" rx="2"/><path d="M4 11h16M8 5v6M16 5v6M7 19v1.5M17 19v1.5M6.5 16v3M17.5 16v3"/><circle cx="8" cy="16" r="0"/>',
    check: '<path d="m5 12 4.5 4.5L19 7"/>',
    pin: '<path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    doc: '<path d="M6 3.5h7l5 5V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z"/><path d="M13 3.5V9h5M8.5 13h7M8.5 16.5h5"/>',
  };
  const I = (name, w) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w || 1.7}" stroke-linecap="round" stroke-linejoin="round">${ic[name]}</svg>`;

  // ---- applicant roster -----------------------------------------
  const students = [
    { av: 'AR', col: '#e0654a', nm: 'Alex Rivera',    g: '9',  st: 'Pending review', cls: 'neutral', sub: 'Apr 28', meta: 'In-zone · Sibling enrolled', on: true },
    { av: 'MJ', col: '#0ea5e9', nm: 'Maria Jones',    g: '11', st: 'Docs needed',    cls: 'warn',    sub: 'Apr 27', meta: 'Transfer · Out-of-zone' },
    { av: 'SO', col: '#8b5cf6', nm: 'Samuel Okafor',  g: '10', st: 'Interview',      cls: 'info',    sub: 'Apr 26', meta: 'Scholarship track' },
    { av: 'TP', col: '#15966a', nm: 'Tobias Pierce',  g: '12', st: 'Accepted',       cls: 'pos',     sub: 'Apr 25', meta: 'Offer sent' },
    { av: 'HW', col: '#f59e0b', nm: 'Hannah Webb',    g: '9',  st: 'Pending review', cls: 'neutral', sub: 'Apr 25', meta: 'In-zone' },
    { av: 'LN', col: '#ec4899', nm: 'Leo Nakamura',   g: '8',  st: 'Waitlisted',     cls: 'neutral', sub: 'Apr 24', meta: 'Capacity hold' },
  ];

  const av = (s, cls) => `<span class="av ${cls || ''}" style="background:${s.col}">${s.av}</span>`;
  const stPip = (cls) => {
    const c = cls === 'pos' ? 'var(--pos)' : cls === 'warn' ? 'var(--warn)' : cls === 'info' ? 'var(--accent-2)' : 'var(--ink-3)';
    return c;
  };

  // KPI cards
  const kpis = [
    { ic: 'userplus', lab: 'New applicants', val: '128', unit: '', delta: '+12%', dir: 'up', foot: 'vs. last term' },
    { ic: 'users',    lab: 'Seats remaining', val: '34', unit: 'of 480', delta: '', dir: '', foot: '446 confirmed' },
    { ic: 'cal',      lab: 'Avg. processing', val: '3.2', unit: 'days', delta: '−0.4d', dir: 'up', foot: 'faster than target' },
    { ic: 'award',    lab: 'Offer acceptance', val: '78', unit: '%', delta: '+4 pts', dir: 'up', foot: '142 of 182 offers' },
  ];

  // chart weeks: {acc, rev} as % of plot height; hl marks current week
  const weeks = [
    { x: 'W1', acc: 14, rev: 30 }, { x: 'W2', acc: 22, rev: 34 }, { x: 'W3', acc: 16, rev: 26 },
    { x: 'W4', acc: 26, rev: 40 }, { x: 'W5', acc: 24, rev: 32 }, { x: 'W6', acc: 34, rev: 48, hl: true },
    { x: 'W7', acc: 28, rev: 38 }, { x: 'W8', acc: 30, rev: 40 },
  ];

  function navItem(icon, label, opts) {
    opts = opts || {};
    const cnt = opts.count ? `<span class="count ${opts.hot ? 'hot' : ''}">${opts.count}</span>` : '';
    const chev = opts.chev ? `<span class="ni-ic" style="margin-left:auto"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ic.chevR}</svg></span>` : '';
    return `<div class="nitem ${opts.on ? 'on' : ''} ${opts.sub ? 'sub' : ''}">
      <span class="ni-ic">${opts.sub ? '' : I(icon)}</span><span>${label}</span>${cnt}${chev}</div>`;
  }

  window.buildShell = function (dir, theme, label, opts) {
    const sel = students[0];
    opts = opts || {};
    // Color overrides: re-express derived tokens via var(--accent) so tint/border/chip recompute.
    let ovr = '';
    if (opts.accent) {
      ovr += `--accent:${opts.accent};`
        + `--accent-tint:color-mix(in oklab, var(--accent) ${theme === 'dark' ? 15 : 11}%, transparent);`
        + `--accent-border:color-mix(in oklab, var(--accent) ${theme === 'dark' ? 70 : 88}%, #000);`
        + `--chip-bg:color-mix(in oklab, var(--accent) ${theme === 'dark' ? 12 : 8}%, transparent);`
        + `--shadow-accent:0 3px 11px -3px color-mix(in oklab, var(--accent) ${theme === 'dark' ? 45 : 52}%, transparent);`;
    }
    if (opts.accent2) ovr += `--accent-2:${opts.accent2};`;

    const railIcons = [
      ['grid', 'Overview', false], ['users', 'Students', true], ['book', 'Classes', false],
      ['cal', 'Attendance', false], ['coins', 'Finance', false], ['chart', 'Reports', false],
    ].map(([k, t, on]) => `<div class="ri ${on ? 'on' : ''}" title="${t}">${I(k)}</div>`).join('');

    const kpiCards = kpis.map((k) => `
      <div class="kpi">
        <div class="k-top"><span class="k-ic">${I(k.ic)}</span><span class="k-lab">${k.lab}</span></div>
        <div class="k-val tnum">${k.val}${k.unit ? `<small>${k.unit}</small>` : ''}</div>
        <div class="k-foot">
          ${k.delta ? `<span class="delta ${k.dir === 'dn' ? 'dn' : ''}">${I(k.dir === 'dn' ? 'down' : 'up', 2)}${k.delta}</span>` : ''}
          <span class="muted">${k.foot}</span>
        </div>
      </div>`).join('');

    const bars = weeks.map((w) => `
      <div class="col ${w.hl ? 'hl' : ''}">
        <div class="bar b2" style="height:${w.rev}%"></div>
        <div class="bar" style="height:${w.acc}%"></div>
      </div>`).join('');
    const xlabs = weeks.map((w) => `<span>${w.x}</span>`).join('');

    // ---- area chart (aurora) ----
    const smooth = (pts) => {
      let d = `M ${pts[0][0]},${pts[0][1]}`;
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
        const t = 0.18;
        d += ` C ${(p1[0] + (p2[0] - p0[0]) * t).toFixed(2)},${(p1[1] + (p2[1] - p0[1]) * t).toFixed(2)}`
           + ` ${(p2[0] - (p3[0] - p1[0]) * t).toFixed(2)},${(p2[1] - (p3[1] - p1[1]) * t).toFixed(2)}`
           + ` ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
      }
      return d;
    };
    const n = weeks.length, X = (i) => +(i / (n - 1) * 100).toFixed(2), Y = (v) => +(60 - v).toFixed(2);
    const accP = weeks.map((w, i) => [X(i), Y(w.acc)]);
    const revP = weeks.map((w, i) => [X(i), Y(w.rev)]);
    const tarP = weeks.map((w, i) => [X(i), Y(Math.min(w.acc + 10, 56))]);
    const area = (pts) => smooth(pts) + ` L 100,60 L 0,60 Z`;
    const hlI = Math.max(0, weeks.findIndex((w) => w.hl));
    const hlX = X(hlI), hlT = +(Y(weeks[hlI].acc) / 60 * 100).toFixed(2);
    const areaBlock = `
            <div class="areachart">
              <div class="legend">
                <i><b style="background:#5b8cff"></b>Accepted</i>
                <i><b style="background:#8c5cff"></b>Applications</i>
                <i><b style="background:#ff6fae;height:0;border-top:2px dashed #ff6fae"></b>Target</i>
              </div>
              <div class="plotwrap">
                <svg viewBox="0 0 100 60" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="gAcc" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0" stop-color="#5b8cff" stop-opacity=".5"/><stop offset="1" stop-color="#5b8cff" stop-opacity="0"/>
                    </linearGradient>
                    <linearGradient id="gRev" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0" stop-color="#8c5cff" stop-opacity=".3"/><stop offset="1" stop-color="#8c5cff" stop-opacity="0"/>
                    </linearGradient>
                  </defs>
                  <path d="${area(revP)}" fill="url(#gRev)"/>
                  <path d="${area(accP)}" fill="url(#gAcc)"/>
                  <path d="${smooth(revP)}" fill="none" stroke="#8c5cff" stroke-width="1.6" stroke-opacity=".75" vector-effect="non-scaling-stroke" stroke-linecap="round"/>
                  <path class="accline" d="${smooth(accP)}" fill="none" stroke="#5b8cff" stroke-width="2.4" vector-effect="non-scaling-stroke" stroke-linecap="round"/>
                  <path d="${smooth(tarP)}" fill="none" stroke="#ff6fae" stroke-width="1.6" stroke-dasharray="3 3" vector-effect="non-scaling-stroke" stroke-linecap="round"/>
                </svg>
                <div class="floatval" style="left:${hlX}%;top:${hlT}%">34</div>
                <div class="dotmark" style="left:${hlX}%;top:${hlT}%"></div>
              </div>
              <div class="xlabels">${xlabs}</div>
            </div>`;
    const barBlock = `
            <div class="chart">
              <div class="legend">
                <i><b style="background:var(--accent)"></b>Accepted</i>
                <i><b style="background:color-mix(in oklab,var(--accent) 42%,var(--surface))"></b>In review</i>
              </div>
              <div class="plot">${bars}</div>
              <div class="xlabels">${xlabs}</div>
            </div>`;
    const chartBlock = dir === 'aurora' ? areaBlock : barBlock;
    const fab = dir === 'aurora' ? `
      <div class="ai-fab">
        <div class="fab-chip">Ask Ada <span class="fab-kbd">⌘J</span></div>
        <button class="fab-bubble" aria-label="Ask Ada — AI assistant"></button>
      </div>` : '';

    const rows = students.map((s) => `
      <tr class="${s.on ? 'on' : ''}">
        <td><div class="who">${av(s, 'sm')}<div><div class="nm">${s.nm}</div><div class="meta">${s.meta}</div></div></div></td>
        <td><span class="gradetag">Grade ${s.g}</span></td>
        <td><span class="badge ${s.cls}"><span class="pip" style="background:${stPip(s.cls)}"></span>${s.st}</span></td>
        <td class="num tnum">${s.sub}</td>
      </tr>`).join('');

    return `
<div class="shell" data-dir="${dir}" data-theme="${theme}" data-screen-label="${label}"${ovr ? ` style="${ovr}"` : ''}>

  <!-- TOP BAR -->
  <div class="topbar">
    <div class="tenant"><span class="tav" style="background:var(--accent)">SJ</span> St. Jude Academy <span class="ni-ic chev">${I('chevD')}</span></div>
    <div class="crumbs"><span>Admin</span><span class="sep">/</span><span>Students</span><span class="sep">/</span><span class="cur">Enrollment</span></div>
    <div class="omni"><span class="ni-ic" style="width:15px;height:15px;color:var(--ink-3)">${I('search')}</span><span class="ph">Search students, classes, records…</span><span class="kbd">⌘K</span></div>
    <div class="top-actions">
      <button class="iconbtn bare" title="Quick add">${I('plus', 2)}</button>
      <button class="iconbtn bare">${I('bell')}<span class="dot-badge">3</span></button>
      <button class="iconbtn bare">${I('help')}</button>
      <div class="sep-v"></div>
      <span class="av" style="background:#334155">BE</span>
    </div>
  </div>

  <!-- BODY -->
  <div class="body">

    <!-- ICON RAIL -->
    <div class="rail">
      <div class="logo-mark" style="margin-bottom:8px"></div>
      ${railIcons}
      <div class="spacer"></div>
      <div class="rdiv"></div>
      <div class="ri" title="Help">${I('help')}</div>
      <div class="ri" title="Settings">${I('gear')}</div>
    </div>

    <!-- SECONDARY NAV -->
    <div class="nav">
      <div class="nav-head">
        <span class="ico">${I('users')}</span>
        <div><h2>Students</h2><div class="sub">St. Jude Academy</div></div>
      </div>
      <div class="grp">Records</div>
      ${navItem('userplus', 'Enrollment', { on: true, count: '42', hot: true })}
      ${navItem('address', 'Directory', { count: '1.2k' })}
      ${navItem('cal', 'Attendance', {})}
      <div class="grp">Academics <span class="ni-ic gchev">${I('chevD')}</span></div>
      ${navItem('book', 'Gradebook', {})}
      ${navItem('', 'Report cards', { sub: true })}
      ${navItem('', 'Transcripts', { sub: true })}
      <div class="grp">Operations</div>
      ${navItem('card', 'Fees & billing', { count: '7' })}
      ${navItem('bus', 'Transport', {})}
      <div class="nav-foot">
        <div class="upsell">
          <div class="ut">Spring intake</div>
          <div class="bar"><i></i></div>
          <div class="us">446 of 480 seats confirmed · 34 open</div>
        </div>
      </div>
    </div>

    <!-- MAIN -->
    <div class="main">
      <div class="main-head">
        <div class="ttl">
          <h1>Enrollment</h1>
          <div class="sub"><b>Spring Term 2025</b><span>·</span>42 pending review<span>·</span>updated 2m ago</div>
        </div>
        <div class="head-actions">
          <div class="seg"><button class="on">Pipeline</button><button>List</button><button>Calendar</button></div>
          <button class="btn">${I('filter', 1.8)} Filter</button>
          <button class="btn primary">${I('plus', 2)} New student</button>
        </div>
      </div>

      <div class="filters">
        <span class="chipf on">All applicants <b style="opacity:.7;font-weight:700">128</b></span>
        <span class="chipf">Needs action <b style="opacity:.7;font-weight:700">15</b></span>
        <span class="chipf">Interviews</span>
        <span class="chipf">Accepted</span>
        <span class="chipf">${I('plus', 1.8)} Add filter</span>
      </div>

      <div class="main-body">
        <div class="kpis">${kpiCards}</div>

        <div class="split">
          <!-- chart panel -->
          <div class="panel">
            <div class="p-head">
              <div><h3>Applicant pipeline</h3></div>
              <div class="p-act"><span class="badge accent"><span class="pip" style="background:var(--accent-2)"></span>This week</span></div>
            </div>
            ${chartBlock}
          </div>

          <!-- table panel -->
          <div class="panel">
            <div class="p-head">
              <div><h3>Recent applications</h3></div>
              <div class="p-act"><button class="btn ghost sm">${I('sort', 1.7)} Sort</button><button class="btn ghost sm">View all</button></div>
            </div>
            <div class="table-wrap">
              <table class="tbl">
                <thead><tr><th>Applicant</th><th>Grade</th><th>Status</th><th class="num">Submitted</th></tr></thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      ${fab}
    </div>

    <!-- INSPECTOR -->
    <div class="inspector">
      <div class="ins-head">
        <span class="eyebrow">Applicant</span>
        <div class="ic-actions">
          <button class="iconbtn bare" style="width:28px;height:28px">${I('pin', 1.7)}</button>
          <button class="iconbtn bare" style="width:28px;height:28px">${I('expand', 1.7)}</button>
        </div>
      </div>
      <div class="ins-body">
        <div class="profile">
          ${av(sel, 'lg')}
          <div class="pinfo">
            <h3>Alex Rivera</h3>
            <div class="pmeta">Grade 9 · Applicant #2025-0428</div>
          </div>
        </div>
        <div class="chips">
          <span class="badge"><span class="pip" style="background:var(--ink-3)"></span>Pending review</span>
          <span class="badge accent">In-zone</span>
          <span class="badge info">Sibling enrolled</span>
        </div>

        <div class="ins-tabs"><span class="on">Overview</span><span>Documents</span><span>Notes</span></div>

        <div class="fields">
          <div class="field-2">
            <div class="field"><span class="fl">Guardian</span><span class="fv">Daniela Rivera</span></div>
            <div class="field"><span class="fl">Date of birth</span><span class="fv tnum">11 Sep 2016</span></div>
          </div>
          <div class="field"><span class="fl">Prior school</span><span class="fv">Maple Grove Elementary</span></div>
          <div class="field-2">
            <div class="field"><span class="fl">Catchment</span><span class="fv">North · In-zone</span></div>
            <div class="field"><span class="fl">Contact</span><span class="fv tnum">07700 900 412</span></div>
          </div>
        </div>

        <div>
          <div class="sec-label" style="margin-bottom:9px">Progress</div>
          <div class="timeline">
            <div class="tl-row done"><span class="tl-dot"></span><div class="tl-tx">Application submitted<small>28 Apr · via parent portal</small></div></div>
            <div class="tl-row done"><span class="tl-dot"></span><div class="tl-tx">Documents received<small>29 Apr · 3 of 4 files</small></div></div>
            <div class="tl-row"><span class="tl-dot"></span><div class="tl-tx">Assessment scheduled<small>6 May · 10:30, Room B2</small></div></div>
            <div class="tl-row"><span class="tl-dot" style="border-color:var(--line)"></span><div class="tl-tx" style="color:var(--ink-3)">Decision<small>Pending</small></div></div>
          </div>
        </div>

        <div class="ins-actions">
          <button class="btn primary">${I('userplus', 1.9)} Enroll &amp; send invite</button>
          <button class="btn ghost">${I('doc', 1.7)} Request documents</button>
        </div>
      </div>
    </div>

  </div>

  <!-- STATUS BAR -->
  <div class="statusbar">
    <span class="sb-i"><span class="sdot"></span> Synced · 2m ago</span>
    <span class="sb-i"><b>Spring Term 2025</b></span>
    <span class="sb-i">3 background jobs</span>
    <span class="spring sb-i"><span class="kbd">⌘K</span> to jump anywhere</span>
  </div>

</div>`;
  };

  /* expose the icon set + a couple of primitives so aurora-screens.js
     can build additional Aurora screens without re-declaring them */
  window.AuroraIcons = { ic: ic, I: I };
})();
