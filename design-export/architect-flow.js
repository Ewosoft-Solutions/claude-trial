/* ============================================================
   Architect Flow — interactions
   ============================================================ */
(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var frame = $('.frame');

  /* ---------- toast ---------- */
  var toastEl = $('#af-toast'), toastT;
  function toast(msg) { toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('show'); }, 1900); }

  /* ---------- stepper ---------- */
  var step = 1, MAX = 6;
  var META = {
    1: { title: 'Create the organisation', sub: 'New tenant onboarding · step 1 of 6', crumb: 'New organisation', hint: 'The Org is the top tier — billing & global settings live here.', next: 'Continue ›' },
    2: { title: 'Shape the structure', sub: 'New tenant onboarding · step 2 of 6', crumb: 'Structure', hint: 'Campuses & levels decide Scenario A (small) vs B (enterprise).', next: 'Continue ›' },
    3: { title: 'Invite first admin', sub: 'New tenant onboarding · step 3 of 6', crumb: 'Invite admin', hint: 'Seat the School Owner or IT Admin — they bring in the rest.', next: 'Continue ›' },
    4: { title: 'Customise features', sub: 'New tenant onboarding · step 4 of 6', crumb: 'Features', hint: 'Core is locked on; add-ons toggle freely; premium needs approval.', next: 'Continue ›' },
    5: { title: 'Roles & permissions', sub: 'New tenant onboarding · step 5 of 6', crumb: 'Roles & permissions', hint: 'Start from a preset, then fine-tune any cell.', next: 'Continue ›' },
    6: { title: 'Plan & pricing', sub: 'New tenant onboarding · step 6 of 6', crumb: 'Plan & pricing', hint: 'Pricing comes last — features & size are known, so the invoice is real.', next: '✓ Finish & launch' }
  };
  function setStep(n) {
    step = Math.max(1, Math.min(MAX, n));
    $$('.step').forEach(function (s) {
      var k = +s.getAttribute('data-step');
      s.classList.toggle('active', k === step);
      s.classList.toggle('done', k < step);
    });
    $$('.step-conn').forEach(function (c) { c.classList.toggle('fill', +c.getAttribute('data-conn') < step); });
    $$('.af-stage').forEach(function (st) { st.classList.toggle('on', st.id === 'st' + step); });
    var m = META[step];
    $('#af-title').textContent = m.title; $('#af-sub').textContent = m.sub; $('#af-crumb').textContent = m.crumb;
    $('#af-hint').textContent = m.hint; $('#af-next').textContent = m.next;
    $('#af-back').style.opacity = step === 1 ? '.5' : '1';
    renderNotes();
  }
  $$('.step').forEach(function (s) { s.addEventListener('click', function () { setStep(+s.getAttribute('data-step')); }); });
  $('#af-next').addEventListener('click', function () { if (step === MAX) { toast('🎉 Greenfield Academy launched'); } else setStep(step + 1); });
  $('#af-back').addEventListener('click', function () { setStep(step - 1); });

  /* ---------- stage 1: wizard ---------- */
  $$('.wz-rail .ws').forEach(function (ws) {
    ws.addEventListener('click', function () {
      var sec = ws.getAttribute('data-sec');
      $$('.wz-rail .ws').forEach(function (x) { x.classList.remove('on'); });
      ws.classList.add('on');
      $$('.wz-rail .ws').forEach(function (x, i) {
        var others = $$('.wz-rail .ws');
        x.classList.toggle('done', others.indexOf(x) < others.indexOf(ws));
      });
      $$('[data-secpane]').forEach(function (p) { p.hidden = p.getAttribute('data-secpane') !== sec; });
    });
  });
  $$('#inst-choices .choice').forEach(function (c) {
    c.addEventListener('click', function () {
      $$('#inst-choices .choice').forEach(function (x) { x.classList.remove('on'); });
      c.classList.add('on');
      instType = c.getAttribute('data-it');
      $('#pv-type').textContent = instType;
      termPref = instType === 'University' ? 'Semester' : 'Termly';
      $$('#term-choices .choice').forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-term') === termPref); });
      buildPeriodSeg();
      setPeriod(termPref, true);
      relabelRoles();
    });
  });

  /* ---------- stage 1: location / map autocomplete ---------- */
  $$('#mapsugg .msug').forEach(function (m) {
    m.addEventListener('click', function () {
      $$('#mapsugg .msug').forEach(function (x) { x.classList.remove('on'); });
      m.classList.add('on');
      var addr = m.getAttribute('data-addr');
      var ai = $('#addr-input');
      ai.innerHTML = '<span style="color:var(--ink-soft)">\u2315</span> ' + addr + ' <span class="suffix">\u2316 located</span>';
      var loc = $('#pv-loc'); if (loc) loc.textContent = (addr.split(',').slice(-1)[0] || 'Lagos').trim() + ' \u00b7 GMT+1';
      toast('\ud83d\udccd Pinned \u00b7 country & timezone auto-filled');
    });
  });

  /* ---------- stage 1: branding colour fields ---------- */
  function applyColor(role, hex) {
    var prev = $('#cf-prev-' + role), hx = $('#cf-hex-' + role);
    prev.classList.remove('none'); prev.style.background = hex;
    hx.classList.remove('ph'); hx.textContent = hex.toUpperCase();
    if (role === 'primary') {
      document.documentElement.style.setProperty('--accent', hex);
      var lg = $('#pv-logo'); if (lg) lg.style.background = hex;
      var c1 = $('#pv-c1'); if (c1) c1.style.background = hex;
    } else {
      var c2 = $('#pv-c2'); if (c2) c2.style.background = hex;
    }
    syncBrandNote();
  }
  function clearColor(role) {
    var prev = $('#cf-prev-' + role), hx = $('#cf-hex-' + role);
    prev.classList.add('none'); prev.style.background = '';
    hx.classList.add('ph'); hx.textContent = 'none set';
    $$('.colorfield[data-role="' + role + '"] .cf-sw').forEach(function (x) { x.classList.remove('on'); });
    if (role === 'primary') {
      document.documentElement.style.setProperty('--accent', '#4f6df5');
      var lg = $('#pv-logo'); if (lg) lg.style.background = '#4f6df5';
      var c1 = $('#pv-c1'); if (c1) c1.style.background = '#4f6df5';
    } else {
      var c2 = $('#pv-c2'); if (c2) c2.style.background = 'repeating-linear-gradient(45deg,#eee,#eee 3px,#fff 3px,#fff 6px)';
    }
    syncBrandNote();
  }
  function syncBrandNote() {
    var note = $('#pv-cnote'); if (!note) return;
    var p = !$('#cf-prev-primary').classList.contains('none');
    var s = !$('#cf-prev-secondary').classList.contains('none');
    note.textContent = p && s ? 'primary + secondary' : p ? 'primary set' : s ? 'secondary only' : 'platform defaults';
  }
  $$('.colorfield .cf-sw').forEach(function (sw) {
    sw.addEventListener('click', function () {
      var field = sw.closest('.colorfield'), role = field.getAttribute('data-role');
      $$('.cf-sw', field).forEach(function (x) { x.classList.remove('on'); });
      sw.classList.add('on');
      applyColor(role, sw.getAttribute('data-c'));
    });
  });
  $$('.colorfield .cf-pick').forEach(function (p) {
    p.addEventListener('click', function () { toast('Paste any hex, or pick a swatch'); });
  });
  $$('.cf-clear').forEach(function (b) {
    b.addEventListener('click', function () { clearColor(b.getAttribute('data-role')); });
  });

  /* ---------- stage 1: term structure -> seeds billing period ---------- */
  var termPref = 'Termly';
  $$('#term-choices .choice').forEach(function (c) {
    c.addEventListener('click', function () {
      $$('#term-choices .choice').forEach(function (x) { x.classList.remove('on'); });
      c.classList.add('on');
      termPref = c.getAttribute('data-term');
      buildPeriodSeg();
      setPeriod(termPref, true);
    });
  });

  /* ============================================================
     stage 6: plan & pricing  (list vs. agreed -> invoice)
     ============================================================ */
  var PRICING = {
    Starter:    { annual: 540000,  seatTerm: 360, label: 'Core suite \u00b7 up to 400 students' },
    Pro:        { annual: 1260000, seatTerm: 280, label: 'Finance, LMS & Behaviour included' },
    Enterprise: { annual: 2700000, seatTerm: 600, label: 'Analytics Pro, Biometric \u00b7 multi-campus' }
  };
  var PERIODS = {
    Monthly:  { n: 12, unit: 'month',    plural: 'months' },
    Termly:   { n: 3,  unit: 'term',     plural: 'terms' },
    Semester: { n: 2,  unit: 'semester', plural: 'semesters' },
    Annual:   { n: 1,  unit: 'year',     plural: 'year' }
  };
  var DISCOUNTS = [0.85, 0.70, 1.0]; // −15%, −30%, bill list price
  var deal = { tier: 'Pro', basis: 'period', period: 'Termly', seats: 1500, discIdx: 0 };

  function naira(n) { return '\u20a6' + Math.round(n).toLocaleString('en-NG'); }

  // billing-period options adapt to the institution: term schools bill monthly/termly/annual; universities swap in per-semester
  function periodOptions() {
    var mid = termPref === 'Semester' ? ['Semester', 'Per semester · ×2'] : ['Termly', 'Termly · ×3'];
    return [['Monthly', 'Monthly · ×12'], mid, ['Annual', 'Annual']];
  }
  function buildPeriodSeg() {
    var opts = periodOptions();
    if (!opts.some(function (o) { return o[0] === deal.period; })) deal.period = opts[1][0];
    var seg = $('#period-seg'); if (!seg) return;
    seg.innerHTML = opts.map(function (o) {
      return '<button data-period="' + o[0] + '" aria-pressed="' + (o[0] === deal.period) + '">' + o[1] + '</button>';
    }).join('');
    $$('#period-seg button').forEach(function (b) {
      b.addEventListener('click', function () { setPeriod(b.getAttribute('data-period')); });
    });
  }
  function setPeriod(p, silent) {
    deal.period = p;
    $$('#period-seg button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-period') === p)); });
    var ph = $('#period-hint');
    if (ph) {
      if (p === termPref) ph.textContent = 'Matches the ' + (termPref === 'Semester' ? '2-semester' : '3-term') + ' calendar set in step 1.';
      else if (p === 'Monthly') ph.textContent = 'Billing spread across 12 monthly invoices.';
      else if (p === 'Annual') ph.textContent = 'One invoice covers the whole year.';
      else ph.textContent = 'Overrides the step-1 calendar default.';
    }
    renderInvoice();
    if (!silent) toast('Billing period: ' + p);
  }

  function listAnnual() {
    var t = PRICING[deal.tier];
    return deal.basis === 'seat' ? deal.seats * t.seatTerm * 3 : t.annual;
  }

  function renderInvoice() {
    var per = PERIODS[deal.period], t = PRICING[deal.tier];
    var annual = listAnnual();
    var listPer = annual / per.n;
    var agreedPer = listPer * DISCOUNTS[deal.discIdx];
    var disc = listPer - agreedPer;
    var pct = Math.round((1 - DISCOUNTS[deal.discIdx]) * 100);

    $('#inv-cycle').textContent = deal.period;
    $('#inv-cycledesc').textContent = per.n + ' invoice' + (per.n > 1 ? 's' : '') + ' / year';

    var lines = '';
    lines += '<div class="inv-line"><div class="il-d"><b>' + deal.tier + ' plan</b><small>' +
      (deal.basis === 'seat'
        ? deal.seats.toLocaleString() + ' seats \u00d7 ' + naira(t.seatTerm) + '/term'
        : 'Flat ' + per.unit + ' fee \u00b7 ' + t.label) +
      '</small></div><div class="il-amt">' + naira(listPer) + '</div></div>';
    lines += '<div class="inv-line muted"><div class="il-d"><b>Included this tier</b><small>' + t.label + '</small></div><div class="il-amt">\u20a60</div></div>';
    $('#inv-lines').innerHTML = lines;

    $('#inv-list').textContent = naira(listPer);
    var dr = $('#inv-discrow');
    if (disc > 0.5) {
      dr.style.display = '';
      $('#inv-disc').textContent = '\u2212' + naira(disc);
      $('#inv-discpct').textContent = '\u2212' + pct + '%';
    } else { dr.style.display = 'none'; }
    $('#inv-grand').textContent = naira(agreedPer);
    $('#inv-year').textContent = naira(agreedPer * per.n);
    $('#inv-yrnote').textContent = '\u00d7 ' + per.n + ' ' + per.plural;

    var ai = $('#agreed-inp');
    if (ai) ai.innerHTML = disc > 0.5
      ? naira(agreedPer) + ' <span class="suffix">negotiated · −' + pct + '%</span>'
      : naira(listPer) + ' <span class="suffix">= list price</span>';

    var pl = $('#pv-plan'); if (pl) pl.textContent = deal.tier + ' \u00b7 ' + deal.period;
  }

  $$('#basis-choices .choice').forEach(function (c) {
    c.addEventListener('click', function () {
      $$('#basis-choices .choice').forEach(function (x) { x.classList.remove('on'); });
      c.classList.add('on');
      deal.basis = c.getAttribute('data-basis');
      var sp = $('#seatprice-row');
      if (sp) {
        if (deal.basis === 'seat') sp.querySelector('.inp').innerHTML = naira(PRICING[deal.tier].seatTerm) + ' <span class="suffix">/ seat / term</span>';
        else sp.querySelector('.inp').innerHTML = '\u20a6 \u2014 <span class="suffix">period basis</span>';
      }
      renderInvoice();
    });
  });
  $$('#period-seg button').forEach(function (b) {
    b.addEventListener('click', function () { setPeriod(b.getAttribute('data-period')); });
  });
  $$('#tier-choices .tier').forEach(function (tr) {
    tr.addEventListener('click', function () {
      $$('#tier-choices .tier').forEach(function (x) { x.classList.remove('on'); });
      tr.classList.add('on');
      deal.tier = tr.getAttribute('data-tier');
      var sp = $('#seatprice-row');
      if (sp && deal.basis === 'seat') sp.querySelector('.inp').innerHTML = naira(PRICING[deal.tier].seatTerm) + ' <span class="suffix">/ seat / term</span>';
      renderInvoice();
    });
  });
  // agreed price: tap to cycle the negotiated discount (-15% -> -30% -> bill list)
  (function () {
    var ai = $('#agreed-inp'); if (!ai) return;
    ai.style.cursor = 'pointer';
    ai.addEventListener('click', function () {
      deal.discIdx = (deal.discIdx + 1) % DISCOUNTS.length;
      renderInvoice();
      toast(DISCOUNTS[deal.discIdx] >= 1 ? 'Billing list price' : 'Slashing ' + Math.round((1 - DISCOUNTS[deal.discIdx]) * 100) + '% off list');
    });
  })();
  $('#inv-gen').addEventListener('click', function () {
    var d = $('#inv-doc'); d.classList.remove('pulse'); void d.offsetWidth; d.classList.add('pulse');
    renderInvoice(); toast('\u21bb Invoice regenerated');
  });
  $('#inv-send').addEventListener('click', function () { toast('\u2709 Pro-forma sent to Greenfield Academy'); });


  /* ---------- stage 2: invites ---------- */
  var sent = false;
  $('#send-invite').addEventListener('click', function () {
    if (sent) { toast('Invite already queued'); return; }
    sent = true;
    var tb = $('#inv-body');
    var tr = document.createElement('tr');
    tr.innerHTML = '<td><div style="display:flex;align-items:center;gap:8px;"><span class="av" style="width:22px;height:22px;font-size:9px;">NA</span>New invitee</div></td><td>School Owner</td><td><span class="statbadge warn">Sending…</span></td><td><span class="btn rsnd" style="padding:3px 9px;font-size:11px;">Resend</span> <span class="btn rvk" style="padding:3px 9px;font-size:11px;">Revoke</span></td>';
    tb.appendChild(tr);
    bindInviteRow(tr);
    updateInvCount();
    toast('✉ Invitation sent');
    setTimeout(function () { var b = tr.querySelector('.statbadge'); b.textContent = 'Sent'; }, 900);
  });
  function bindInviteRow(tr) {
    var rs = tr.querySelector('.rsnd'), rv = tr.querySelector('.rvk');
    if (rs) rs.addEventListener('click', function () { toast('✉ Invite resent'); tr.querySelector('.statbadge').textContent = 'Re-sent'; });
    if (rv) rv.addEventListener('click', function () { tr.remove(); updateInvCount(); toast('Invite revoked'); });
  }
  function updateInvCount() { $('#inv-count').textContent = $$('#inv-body tr').length + ' total'; }
  $$('#inv-body tr').forEach(bindInviteRow);

  /* ---------- stage 3: features ---------- */
  function updateFeatCount() {
    var on = $$('#st4 .sw.on').length + $$('#st4 .feat-row.requested').length;
    $('#feat-count').textContent = on + ' enabled';
  }
  $$('#st4 .sw[data-toggle]').forEach(function (sw) {
    sw.addEventListener('click', function () {
      sw.classList.toggle('on');
      var chip = sw.closest('.feat-row').querySelector('.stchip');
      var onNow = sw.classList.contains('on');
      chip.textContent = onNow ? 'Added' : 'Available';
      chip.classList.toggle('ok', onNow);
      chip.style.borderColor = onNow ? '' : 'var(--line-soft)';
      chip.style.color = onNow ? '' : 'var(--ink-faint)';
      updateFeatCount();
    });
  });
  $$('#st4 .reqbtn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var row = btn.closest('.feat-row');
      if (row.classList.contains('requested')) {
        row.classList.remove('requested');
        btn.textContent = 'Request';
        var ch = row.querySelector('.stchip'); ch.textContent = 'Available'; ch.classList.remove('warn');
        ch.style.borderColor = 'var(--line-soft)'; ch.style.color = 'var(--ink-faint)';
        toast('Request withdrawn');
      } else {
        row.classList.add('requested');
        btn.textContent = 'Cancel';
        var ch2 = row.querySelector('.stchip'); ch2.textContent = 'Requested'; ch2.classList.add('warn');
        ch2.style.borderColor = ''; ch2.style.color = '';
        toast('✓ Request sent for approval');
      }
      updateFeatCount();
    });
  });

  /* ---------- stage 4: RBAC ---------- */
  var MODULES = [['Students', '◉'], ['Attendance', '✓'], ['Gradebook', '#'], ['Finance', '$'], ['Messaging', '✉'], ['Reports', '▤'], ['Settings', '⚙']];
  var ACTIONS = ['View', 'Create', 'Edit', 'Delete', 'Approve'];
  function P(s) { return ['V', 'C', 'E', 'D', 'A'].map(function (l) { return s.indexOf(l) > -1; }); }
  // per-module action grants
  var ROLE_DEFAULTS = {
    Owner:       { Students: 'VCEDA', Attendance: 'VCEDA', Gradebook: 'VCEDA', Finance: 'VCEDA', Messaging: 'VCEDA', Reports: 'VCEDA', Settings: 'VCEDA' },
    ITAdmin:     { Students: 'V',     Attendance: 'V',     Gradebook: 'V',     Finance: 'V',     Messaging: 'VCE',   Reports: 'V',     Settings: 'VCEDA' },
    Principal:   { Students: 'VCEDA', Attendance: 'VCEDA', Gradebook: 'VCEDA', Finance: 'VA',    Messaging: 'VCEA',  Reports: 'VA',    Settings: 'VE' },
    VPAcademic:  { Students: 'VCE',   Attendance: 'VCE',   Gradebook: 'VCEDA', Finance: '',      Messaging: 'VCE',   Reports: 'V',     Settings: '' },
    VPAdmin:     { Students: 'VCED',  Attendance: 'VCE',   Gradebook: 'V',     Finance: 'VCE',   Messaging: 'VCEA',  Reports: 'V',     Settings: 'VE' },
    Teacher:     { Students: 'V',     Attendance: 'VCE',   Gradebook: 'VCE',   Finance: '',      Messaging: 'VC',    Reports: '',      Settings: '' },
    ClassTeacher:{ Students: 'VE',    Attendance: 'VCED',  Gradebook: 'VCE',   Finance: '',      Messaging: 'VC',    Reports: 'V',     Settings: '' },
    Bursar:      { Students: 'V',     Attendance: '',      Gradebook: '',      Finance: 'VCEDA', Messaging: 'VC',    Reports: 'V',     Settings: '' },
    Librarian:   { Students: 'V',     Attendance: '',      Gradebook: '',      Finance: '',      Messaging: 'VC',    Reports: '',      Settings: '' },
    Student:     { Students: 'V',     Attendance: 'V',     Gradebook: 'V',     Finance: 'V',     Messaging: 'VC',    Reports: '',      Settings: '' },
    Parent:      { Students: 'V',     Attendance: 'V',     Gradebook: 'V',     Finance: 'VC',    Messaging: 'VC',    Reports: 'V',     Settings: '' }
  };
  var PRESET_SETS = {
    Principal: ROLE_DEFAULTS.Principal, ITAdmin: ROLE_DEFAULTS.ITAdmin, Teacher: ROLE_DEFAULTS.Teacher, Finance: ROLE_DEFAULTS.Bursar,
    Readonly:  { Students: 'V', Attendance: 'V', Gradebook: 'V', Finance: 'V', Messaging: 'V', Reports: 'V', Settings: 'V' }
  };
  // leadership / community titles vary by institution type
  var instType = 'Secondary';
  var ROLE_LABELS = {
    Secondary: { Principal:'Principal',     VPAcademic:'VP Academic',        VPAdmin:'VP Administration', Teacher:'Teacher', ClassTeacher:'Class Teacher', Bursar:'Bursar',         Student:'Student', Parent:'Parent' },
    Primary:   { Principal:'Head Teacher',  VPAcademic:'Deputy Head · Acad.', VPAdmin:'Deputy Head · Admin', Teacher:'Teacher', ClassTeacher:'Form Teacher',  Bursar:'Bursar',         Student:'Pupil',   Parent:'Parent' },
    University:{ Principal:'Vice-Chancellor', VPAcademic:'Dean of Academics',  VPAdmin:'Registrar',         Teacher:'Lecturer', ClassTeacher:'Course Adviser', Bursar:'Finance Officer', Student:'Student', Parent:'Guardian' },
    Nursery:   { Principal:'Head Teacher',  VPAcademic:'Lead Educator',       VPAdmin:'Admin Lead',        Teacher:'Teacher', ClassTeacher:'Key Person',   Bursar:'Bursar',         Student:'Child',   Parent:'Parent' },
    Training:  { Principal:'Centre Director', VPAcademic:'Programme Lead',     VPAdmin:'Operations Lead',   Teacher:'Trainer', ClassTeacher:'Cohort Lead',  Bursar:'Finance Officer', Student:'Trainee', Parent:'Sponsor' }
  };
  function roleName(k) {
    var m = ROLE_LABELS[instType] || ROLE_LABELS.Secondary;
    if (m[k]) return m[k];
    var r = ROLES.find(function (x) { return x.k === k; });
    return r ? r.n : k;
  }
  function presetLabel(name) {
    if (name === 'Readonly') return 'Read-only';
    if (name === 'ITAdmin') return 'IT Admin';
    if (name === 'Principal') return roleName('Principal');
    return name;
  }
  function relabelRoles() {
    buildRoleList();
    var lead = $('#preset-lead'); if (lead) lead.textContent = roleName('Principal');
    loadRole(rb.role);
  }
  var ROLES = [
    { k: 'Owner', n: 'School Owner', grp: 'Leadership', preset: 'Full', desc: 'Leadership · school-wide' },
    { k: 'Principal', n: 'Principal', grp: 'Leadership', preset: 'Principal', desc: 'Leadership · school-wide' },
    { k: 'VPAcademic', n: 'VP Academic', grp: 'Leadership', preset: 'Academic', desc: 'Leadership · academics' },
    { k: 'VPAdmin', n: 'VP Administration', grp: 'Leadership', preset: 'Admin', desc: 'Leadership · operations' },
    { k: 'ITAdmin', n: 'IT Admin', grp: 'Operations', preset: 'ITAdmin', desc: 'Operations · system & accounts' },
    { k: 'Bursar', n: 'Bursar', grp: 'Operations', preset: 'Finance', desc: 'Operations · finance' },
    { k: 'Teacher', n: 'Teacher', grp: 'Staff', preset: 'Teacher', desc: 'Staff · own classes' },
    { k: 'ClassTeacher', n: 'Class Teacher', grp: 'Staff', preset: 'Teacher+', desc: 'Staff · form group' },
    { k: 'Librarian', n: 'Librarian', grp: 'Staff', preset: 'Library', desc: 'Staff · library' },
    { k: 'Student', n: 'Student', grp: 'Community', preset: 'Read', desc: 'Community · self' },
    { k: 'Parent', n: 'Parent', grp: 'Community', preset: 'Read', desc: 'Community · own children' }
  ];
  var LOCKED = { Settings: { Delete: true } }; // locked-off for non-owner

  var rb = { role: 'Principal', preset: 'Principal', grid: null, baseline: null };

  function cloneGrid(def) {
    var g = {};
    MODULES.forEach(function (m) { g[m[0]] = P(def[m[0]] || ''); });
    return g;
  }
  function buildRoleList() {
    var html = '', lastGrp = '';
    ROLES.forEach(function (r) {
      if (r.grp !== lastGrp) { html += '<div class="rl-h">' + r.grp + '</div>'; lastGrp = r.grp; }
      html += '<div class="role-li' + (r.k === rb.role ? ' on' : '') + '" data-role="' + r.k + '"><span class="ti" style="width:16px;height:16px;border:2px solid var(--line);border-radius:5px;"></span><span>' + roleName(r.k) + '</span><span class="badge">' + (r.k === 'Principal' ? roleName('Principal') : presetLabel(r.preset)) + '</span></div>';
    });
    $('#role-list').innerHTML = html;
    $$('#role-list .role-li').forEach(function (li) {
      li.addEventListener('click', function () { loadRole(li.getAttribute('data-role')); });
    });
  }
  function loadRole(k) {
    rb.role = k;
    var def = ROLE_DEFAULTS[k] || ROLE_DEFAULTS.Teacher;
    rb.grid = cloneGrid(def);
    rb.baseline = cloneGrid(def);
    var meta = ROLES.find(function (r) { return r.k === k; });
    rb.preset = meta.preset;
    $('#rb-role').textContent = roleName(k);
    $('#rb-roledesc').textContent = meta.desc;
    $('#preset-state').textContent = 'Preset: ' + presetLabel(meta.preset);
    $('#preset-state').classList.remove('warn');
    $$('#role-list .role-li').forEach(function (li) { li.classList.toggle('on', li.getAttribute('data-role') === k); });
    renderMatrix();
  }
  function applyPreset(name) {
    var set = PRESET_SETS[name]; if (!set) return;
    rb.grid = cloneGrid(set);
    rb.baseline = cloneGrid(set);
    rb.preset = presetLabel(name);
    $('#preset-state').textContent = 'Preset: ' + rb.preset;
    $('#preset-state').classList.remove('warn');
    renderMatrix();
    toast('Applied ' + rb.preset + ' preset');
  }
  function isLocked(mod, act) { return !!(LOCKED[mod] && LOCKED[mod][act] && rb.role !== 'Owner'); }
  function renderMatrix() {
    var head = '<thead><tr><th>Module</th>' + ACTIONS.map(function (a) { return '<th>' + a + '</th>'; }).join('') + '</tr></thead>';
    var body = '<tbody>' + MODULES.map(function (m) {
      var cells = ACTIONS.map(function (a, ai) {
        var on = rb.grid[m[0]][ai];
        var over = on !== rb.baseline[m[0]][ai];
        var lock = isLocked(m[0], a);
        return '<td><span class="cb' + (on && !lock ? ' on' : '') + (over ? ' over' : '') + (lock ? ' locked' : '') + '" data-mod="' + m[0] + '" data-act="' + ai + '">✓</span></td>';
      }).join('');
      return '<tr><td><div class="modcell"><span class="mi">' + m[1] + '</span>' + m[0] + '</div></td>' + cells + '</tr>';
    }).join('') + '</tbody>';
    $('#rb-matrix').innerHTML = head + body;
    $$('#rb-matrix .cb').forEach(function (cb) {
      if (cb.classList.contains('locked')) return;
      cb.addEventListener('click', function () {
        var mod = cb.getAttribute('data-mod'), ai = +cb.getAttribute('data-act');
        rb.grid[mod][ai] = !rb.grid[mod][ai];
        // recompute override state
        var anyOver = MODULES.some(function (mm) { return rb.grid[mm[0]].some(function (v, i) { return v !== rb.baseline[mm[0]][i]; }); });
        if (anyOver) { rb.preset = 'Custom'; $('#preset-state').textContent = 'Preset: Custom (edited)'; $('#preset-state').classList.add('warn'); }
        else { $('#preset-state').classList.remove('warn'); }
        renderMatrix();
      });
    });
  }
  $$('.preset-bar .preset').forEach(function (p) { p.addEventListener('click', function () { applyPreset(p.getAttribute('data-preset')); }); });
  $$('[data-scope]').forEach(function (b) { b.addEventListener('click', function () { $$('[data-scope]').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); }); b.setAttribute('aria-pressed', 'true'); toast('Scope: ' + b.textContent); }); });

  /* ---------- stage 5: maker-checker approvals ---------- */
  function mkcSync() {
    var master = $('#mkc-master'); if (!master) return;
    var on = master.classList.contains('on');
    $('#mkc').classList.toggle('off', !on);
    var n = on ? $$('#mkc-grid .mkc-row.on').length : 0;
    var sum = $('#mkc-summary');
    sum.textContent = on ? (n + ' domain' + (n !== 1 ? 's' : '') + ' gated') : 'Off · single-actor';
    sum.classList.toggle('ok', on && n > 0);
    sum.classList.toggle('warn', !on || n === 0);
  }
  if ($('#mkc-master')) {
    $('#mkc-master').addEventListener('click', function () { this.classList.toggle('on'); mkcSync(); toast(this.classList.contains('on') ? 'Maker-checker enabled' : 'Maker-checker off'); });
    $$('#mkc-grid [data-mkc-toggle]').forEach(function (sw) {
      sw.addEventListener('click', function () {
        if ($('#mkc').classList.contains('off')) return;
        sw.classList.toggle('on');
        sw.closest('.mkc-row').classList.toggle('on', sw.classList.contains('on'));
        mkcSync();
      });
    });
    $$('#mkc-appr button').forEach(function (b) {
      b.addEventListener('click', function () {
        $$('#mkc-appr button').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', 'true');
        var k = b.getAttribute('data-appr');
        toast(k + ' approver' + (k === '2' ? 's' : '') + ' required to release a change');
      });
    });
  }

  /* ---------- notes per step ---------- */
  var NOTES = {
    1: [['✎', 'Guided, not gated', 'A short section rail (Identity → Academic) keeps creation quick; the live preview shows the org taking shape.'],
        ['↻', 'Adapts later', 'Defaults seed terms, grading &amp; nav — but nothing is permanent.']],
    2: [['◧', 'Scale-down accordion', 'The config engine reads the structure. 1 campus + 1 level → Scenario A: default branch/level auto-generated, switchers hidden.'],
        ['◈', 'Or unlock the matrix', 'Multi-campus / multi-tier → Scenario B: the global switcher matrix turns on platform-wide. Add a campus to cross over.']],
    3: [['✉', 'Owner first', 'The architect seats the School Owner or IT Admin; they invite the rest (or bulk-import via CSV / Excel / Sheets) once inside.'],
        ['◔', 'Names as parts', 'Title, first, middle &amp; last are captured separately — so initials, salutations &amp; first-name greetings all derive cleanly.']],
    4: [['◉', 'Three tiers', 'Core is locked-on, add-ons toggle freely, premium goes to "Requested → pending approval".'],
        ['↻', 'Drives the nav', 'Whatever you enable here is exactly what this tenant\'s sidebar &amp; screens expose.']],
    5: [['▦', 'Titles fit the tier', 'Role names follow the institution type — Principal for secondary, Vice-Chancellor for university, Centre Director for training. Presets include IT Admin.'],
        ['◈', 'Granular + scoped', 'Module × action matrix plus a data scope (school / year / own classes). Some cells are locked by policy.'],
        ['⛿', 'Maker-checker', 'Security, billing &amp; published-record changes can require a second authorised approver before they take effect.']],
    6: [['÷', 'Pricing comes last', 'Tier, enrolment &amp; add-ons are already chosen — so list price is computed, not guessed, and the invoice is real.'],
        ['✂', 'List vs. agreed', 'Enter the negotiated figure; the invoice books the gap as a professional discount — shown to the school, logged for revenue.']]
  };
  function renderNotes() {
    $('#af-notes').innerHTML = (NOTES[step] || []).map(function (n) {
      return '<div class="note"><span class="n">' + n[0] + '</span><div><b>' + n[1] + '</b><p>' + n[2] + '</p></div></div>';
    }).join('');
  }

  /* ---------- init ---------- */
  buildRoleList();
  loadRole('Principal');
  buildPeriodSeg();
  renderInvoice();
  mkcSync();
  setStep(1);
})();
