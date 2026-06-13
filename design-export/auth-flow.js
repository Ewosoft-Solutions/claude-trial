/* ============================================================
   Auth Flow — interactions
   gateway · MFA · discovery · sign-up · invite + tweak config
   ============================================================ */
(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- toast ---------- */
  var toastEl = document.createElement('div');
  toastEl.className = 'toast';
  toastEl.style.position = 'fixed';
  toastEl.style.bottom = '24px';
  document.body.appendChild(toastEl);
  var toastT;
  function toast(msg) {
    toastEl.textContent = msg; toastEl.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('show'); }, 1900);
  }

  /* ---------- tab switching ---------- */
  function gotoTab(id) {
    $$('.tabs .tab').forEach(function (x) { x.setAttribute('aria-selected', x.getAttribute('data-target') === id ? 'true' : 'false'); });
    $$('.layout').forEach(function (s) { s.classList.toggle('active', s.id === id); });
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
  $$('.tabs .tab').forEach(function (t) {
    t.addEventListener('click', function () { gotoTab(t.getAttribute('data-target')); });
  });

  /* ---------- generic "walk the flow" + cross-file links ---------- */
  document.addEventListener('click', function (e) {
    var g = e.target.closest('[data-goto]');
    if (g) { gotoTab(g.getAttribute('data-goto')); return; }
    var nav = e.target.closest('[data-go]');
    if (nav) {
      var href = nav.getAttribute('data-go');
      toast('↗ Opening ' + href.replace('.html', ''));
      setTimeout(function () { window.location.href = href; }, 450);
    }
  });

  /* ---------- password reveal ---------- */
  $$('.reveal').forEach(function (r) {
    r.addEventListener('click', function (e) {
      e.stopPropagation();
      var inp = r.parentElement;
      var shown = r.textContent === 'hide';
      r.textContent = shown ? 'show' : 'hide';
      inp.childNodes[0].nodeValue = shown ? '••••••••••' : 'Sunshine!2024';
    });
  });

  /* ---------- generic checkbox toggles (.ckbox in .ckrow / .accrow) ---------- */
  $$('.ckrow, .accrow').forEach(function (row) {
    row.addEventListener('click', function (e) {
      if (e.target.closest('a, .flink')) return;
      var bx = row.querySelector('.ckbox'); if (!bx) return;
      bx.classList.toggle('on');
      bx.textContent = bx.classList.contains('on') ? '✓' : '';
    });
  });

  /* ============================================================
     VERIFY — method picker + code entry
     ============================================================ */
  var vfTryAnother = $('#vf-try-another'), vfBack = $('#vf-back-entry');
  var vfEntry = $('#vf-entry'), vfPicker = $('#vf-picker');
  function showPicker(on) { vfEntry.hidden = on; vfPicker.hidden = !on; }
  if (vfTryAnother) vfTryAnother.addEventListener('click', function () { showPicker(true); });
  if (vfBack) vfBack.addEventListener('click', function () { showPicker(false); });

  $$('#vf-methods .method').forEach(function (m) {
    m.addEventListener('click', function () {
      if (m.classList.contains('disabled')) return;
      $$('#vf-methods .method').forEach(function (x) { x.classList.remove('on'); });
      m.classList.add('on');
      $('#vf-method-ic').textContent = m.getAttribute('data-icon');
      $('#vf-method-label').textContent = m.getAttribute('data-title');
      $('#vf-instruction').textContent = m.getAttribute('data-instr');
      $('#vf-resend').style.display = m.getAttribute('data-resend') === 'on' ? '' : 'none';
      // reset code cells
      $$('#vf-otp .cell').forEach(function (c, i) { c.className = 'cell' + (i === 0 ? ' cur' : ''); c.textContent = ''; });
      showPicker(false);
      toast('Switched to ' + m.querySelector('b').textContent);
    });
  });
  var resendLink = $('#vf-resend-link');
  if (resendLink) resendLink.addEventListener('click', function () { toast('✉ New code sent'); $('#vf-timer').textContent = '0:30'; });

  /* fake OTP typing on the entry cells */
  var vfOtp = $('#vf-otp');
  if (vfOtp) {
    vfOtp.addEventListener('click', function () {
      var cells = $$('.cell', vfOtp);
      var next = cells.find(function (c) { return !c.textContent; });
      if (next) {
        next.textContent = String(Math.floor(Math.random() * 10));
        next.classList.add('f'); next.classList.remove('cur');
        var after = cells[cells.indexOf(next) + 1];
        if (after) after.classList.add('cur');
      }
    });
  }

  /* ============================================================
     DISCOVERY — state toggle (first / returning / single)
     ============================================================ */
  function setDiscState(state) {
    // single-profile overrides via tweak
    if (document.documentElement.getAttribute('data-user') === 'single') state = 'single';
    $$('#disc-seg button').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-state') === state ? 'true' : 'false'); });
    $('#disc-first').classList.toggle('on', state === 'first');
    $('#disc-returning').classList.toggle('on', state === 'returning');
    $('#disc-single').classList.toggle('on', state === 'single');
  }
  $$('#disc-seg button').forEach(function (b) {
    b.addEventListener('click', function () { setDiscState(b.getAttribute('data-state')); });
  });
  // recents chip -> jump to full matrix
  $$('#disc-returning .rec').forEach(function (r) {
    r.addEventListener('click', function () { setDiscState('first'); });
  });
  // star a workspace
  $$('.profile-card .star').forEach(function (s) {
    s.addEventListener('click', function (e) {
      e.stopPropagation();
      $$('.profile-card .star').forEach(function (x) { x.classList.remove('on'); x.textContent = '☆'; });
      s.classList.add('on'); s.textContent = '★';
      toast('Set as default workspace');
    });
  });

  /* ============================================================
     ACQUISITION — route toggle, lead submit, sandbox spin-up
     ============================================================ */
  (function () {
    var ROUTE = { A: 'Lead → CRM → manual provisioning', B: 'Verify → locked sandbox playground' };
    function setRoute(rt) {
      if (rt === 'B' && document.documentElement.getAttribute('data-sandbox') === 'off') rt = 'A';
      $('#pane-acquire').setAttribute('data-route', rt);
      $$('#rt-seg button').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-route') === rt ? 'true' : 'false'); });
      var rb = $('#rt-badge'); if (rb) rb.textContent = ROUTE[rt];
      $('#rt-A').classList.toggle('on', rt === 'A');
      $('#rt-B').classList.toggle('on', rt === 'B');
      $$('.route-card.pick').forEach(function (c) { c.classList.toggle('primary', c.getAttribute('data-route') === rt); });
    }
    window.__setRoute = setRoute;
    $$('#rt-seg button[data-route], .route-card.pick[data-route], a[data-route]').forEach(function (el) {
      el.addEventListener('click', function () { setRoute(el.getAttribute('data-route')); });
    });
    var aSubmit = $('#rtA-submit'), aDone = $('#rtA-done'), aForm = $('#rtA-form'), aReset = $('#rtA-reset');
    if (aSubmit) aSubmit.addEventListener('click', function () { aForm.hidden = true; aDone.hidden = false; toast('✓ Lead #SWE-2048 sent to onboarding CRM'); });
    if (aReset) aReset.addEventListener('click', function () { aDone.hidden = true; aForm.hidden = false; });
    var bSpin = $('#rtB-spin'), bVerify = $('#rtB-verify'), bPlay = $('#rtB-play');
    if (bSpin) bSpin.addEventListener('click', function () { bVerify.style.display = 'none'; bPlay.hidden = false; bPlay.style.display = 'flex'; toast('▷ Sandbox deployed — dummy data loaded'); });
    ['#lk-student', '#lk-invoice'].forEach(function (id) { var el = $(id); if (el) el.addEventListener('click', function () { toast('🔒 Disabled in sandbox — activate your real school first'); }); });
    setRoute('A');
  })();

  /* ============================================================
     PROVISIONING — pipeline · ops queue · lead detail · contracts
     ============================================================ */
  (function () {
    var STATES = [['lead', 'Pending Lead'], ['contacted', 'Contacted'], ['docs', 'Docs in'], ['review', 'Under Review'], ['approved', 'Approved'], ['provisioned', 'Provisioned'], ['active', 'Active Tenant']];
    var SIDX = {}; STATES.forEach(function (s, i) { SIDX[s[0]] = i; });
    var LEADS = [
      { id: 'SWE-2048', name: 'Brightside Group of Schools', route: 'A', state: 'review', av: 'BG', contact: 'Mrs. Funke Adeyemi', phone: '+234 803 221 0098', email: 'funke@brightside.edu.ng', pop: '200 – 1,000', loc: 'Lagos, NG', plan: 'Pro', cac: 'RC 1402887', tier: '1 org · 2 campuses · 4 institutions', checks: [['CAC number resolves', 'on'], ['Domain ownership (DNS TXT)', 'on'], ['Not a duplicate / look-alike', 'warn'], ['Contact reachable on WhatsApp', 'on']] },
      { id: 'SWE-2052', name: "Crescent Int'l Academy", route: 'B', state: 'docs', av: 'CI', contact: 'Mr. Sola Bright', phone: '+234 701 555 1212', email: 'admin@crescent.sch.ng', pop: '1,000 – 5,000', loc: 'Abuja, NG', plan: 'Enterprise', cac: 'RC 998120', tier: '1 org · 4 campuses · 9 institutions', checks: [['CAC number resolves', 'on'], ['Domain ownership (DNS TXT)', 'off'], ['Not a duplicate / look-alike', 'on'], ['Contact reachable on WhatsApp', 'off']] },
      { id: 'SWE-2051', name: 'Little Stars Nursery', route: 'A', state: 'contacted', av: 'LS', contact: 'Mrs. Ada Nwosu', phone: '+234 805 010 7788', email: 'hello@littlestars.ng', pop: '< 200', loc: 'Enugu, NG', plan: 'Starter', cac: 'pending', tier: '1 org · 1 campus · 1 institution', checks: [['CAC number resolves', 'off'], ['Domain ownership (DNS TXT)', 'off'], ['Not a duplicate / look-alike', 'on'], ['Contact reachable on WhatsApp', 'on']] },
      { id: 'SWE-2050', name: 'Unity College', route: 'A', state: 'approved', av: 'UC', contact: 'Dr. Emeka Obi', phone: '+234 802 444 9001', email: 'principal@unity.edu.ng', pop: '1,000 – 5,000', loc: 'Ibadan, NG', plan: 'Pro', cac: 'RC 771204', tier: '1 org · 3 campuses · 6 institutions', checks: [['CAC number resolves', 'on'], ['Domain ownership (DNS TXT)', 'on'], ['Not a duplicate / look-alike', 'on'], ['Contact reachable on WhatsApp', 'on']] }
    ];
    var sel = LEADS[0].id;
    function stateBadge(st) { var ok = ['approved', 'provisioned', 'active']; return '<span class="statbadge ' + (ok.indexOf(st) > -1 ? 'ok' : '') + '">' + STATES[SIDX[st]][1] + '</span>'; }
    function routeChip(r) { return '<span class="route-pin">' + (r === 'A' ? 'A · demo' : 'B · sandbox') + '</span>'; }
    function renderPipeline(lead) {
      var idx = SIDX[lead.state], html = '';
      STATES.forEach(function (s, i) {
        var cls = i < idx ? 'done' : (i === idx ? 'cur' : '');
        html += '<div class="pstate ' + cls + '"><span class="pdot">' + (i < idx ? '✓' : (i + 1)) + '</span><small>' + s[1] + '</small></div>';
        if (i < STATES.length - 1) html += '<div class="pconn ' + (i < idx ? 'fill' : '') + '"></div>';
      });
      $('#prov-pipeline').innerHTML = html;
    }
    function renderQueue() {
      var html = '<div class="qh">Verification queue · ' + LEADS.length + '</div>';
      LEADS.forEach(function (l) {
        html += '<div class="lead-row' + (l.id === sel ? ' on' : '') + '" data-lead="' + l.id + '">'
          + '<div class="lr-h"><span class="av">' + l.av + '</span><b>' + l.name + '</b>' + routeChip(l.route) + '</div>'
          + '<div class="meta"><span>' + l.id + '</span><span>' + l.loc + '</span><span>' + l.pop + '</span></div>'
          + '<div>' + stateBadge(l.state) + '</div></div>';
      });
      $('#prov-queue').innerHTML = html;
      $$('#prov-queue .lead-row').forEach(function (r) { r.addEventListener('click', function () { sel = r.getAttribute('data-lead'); renderQueue(); renderDetail(); }); });
    }
    function renderDetail() {
      var l = LEADS.find(function (x) { return x.id === sel; });
      renderPipeline(l);
      var canProvision = l.checks.every(function (c) { return c[1] === 'on'; });
      var checks = l.checks.map(function (c) {
        var on = c[1] !== 'off', warn = c[1] === 'warn';
        return '<div class="ci"><span class="cbx ' + (warn ? 'warn ' : '') + (on ? 'on' : '') + '">' + (on ? (warn ? '!' : '✓') : '') + '</span>' + c[0] + '<span class="meta">' + (c[1] === 'off' ? 'pending' : (warn ? 'needs sign-off' : 'verified')) + '</span></div>';
      }).join('');
      var kv = [['Contact person', l.contact], ['Phone · WhatsApp', l.phone], ['Work email', l.email], ['Expected students', l.pop], ['Location', l.loc], ['Plan interest', l.plan]]
        .map(function (p) { return '<div class="kv-i"><span class="k">' + p[0] + '</span><span class="v">' + p[1] + '</span></div>'; }).join('');
      $('#prov-detail').innerHTML =
        '<div class="od-head"><span class="av">' + l.av + '</span><div style="flex:1;min-width:0;"><h3>' + l.name + '</h3><span class="sub">' + l.id + ' · source: Route ' + l.route + (l.route === 'A' ? ' (demo)' : ' (sandbox)') + '</span></div>' + stateBadge(l.state) + '</div>'
        + '<div class="panel"><div class="ph"><b>Lead telemetry</b><span class="more">from CRM</span></div><div class="kv">' + kv + '</div></div>'
        + '<div class="panel"><div class="ph"><b>Credential verification</b><span class="more">CAC ' + l.cac + '</span></div>'
        + '<div class="docrow" style="margin-bottom:11px;"><span class="fic">⎙</span><div style="flex:1;min-width:0;"><b style="font-size:12.5px;">CAC_certificate.pdf</b><div style="color:var(--ink-faint);font-size:11px;">uploaded · 1.2MB</div></div><span class="btn" style="padding:3px 11px;font-size:12px;">View</span></div>'
        + '<div class="checklist">' + checks + '</div></div>'
        + '<div class="panel"><div class="ph"><b>Provisioning order</b><span class="more">3-tier</span></div>'
        + '<div class="kv"><div class="kv-i"><span class="k">Structure</span><span class="v">' + l.tier + '</span></div><div class="kv-i"><span class="k">Owner invite</span><span class="v">' + l.email + '</span></div></div>'
        + '<div class="prov-actions">'
        + '<span class="btn pri' + (canProvision ? '' : ' locked') + '" id="prov-go">⚙ Provision production workspace</span>'
        + '<span class="btn" id="prov-docs">Request more docs</span>'
        + '<span class="btn" id="prov-reject" style="border-color:var(--note);color:var(--note);">Reject</span>'
        + '</div></div>';
      var go = $('#prov-go');
      if (go) go.addEventListener('click', function () { if (go.classList.contains('locked')) { toast('⚠ Clear all checks before provisioning'); return; } toast('⚙ Provisioning ' + l.name + ' → 3-tier tenant created'); });
      var dq = $('#prov-docs'); if (dq) dq.addEventListener('click', function () { toast('✉ Requested more docs from ' + l.contact); });
      var rj = $('#prov-reject'); if (rj) rj.addEventListener('click', function () { toast('Lead ' + l.id + ' rejected'); });
    }
    var PAYLOADS = [
      { title: 'Lead', sub: 'marketing site → CRM', hub: true, rows: [['id', 'PK'], ['school_name', 'text'], ['expected_population', 'enum'], ['location', 'json'], ['contact_name', 'text'], ['contact_phone', 'text·wa'], ['contact_email', 'text'], ['source', 'enum A/B'], ['status', 'enum'], ['created_at', 'ts']] },
      { title: 'VerificationCase', sub: 'compliance ops', hub: false, rows: [['id', 'PK'], ['lead_id', 'FK'], ['cac_number', 'text'], ['cac_document', 'file'], ['domain_verified', 'bool'], ['duplicate_check', 'enum'], ['risk_flags', 'json'], ['reviewed_by', 'FK'], ['decision', 'enum'], ['decided_at', 'ts']] },
      { title: 'ProvisioningOrder', sub: 'provisioning engine', hub: true, rows: [['id', 'PK'], ['verification_id', 'FK'], ['org_name', 'text'], ['plan', 'enum'], ['seats', 'int'], ['region', 'text'], ['currency', 'text'], ['campuses', 'json[]'], ['institutions', 'json[]'], ['owner_email', 'text'], ['owner_role', 'enum']] }
    ];
    function renderPayloads() {
      $('#prov-payloads').innerHTML = PAYLOADS.map(function (p) {
        var rows = p.rows.map(function (r) {
          var isKey = r[1] === 'PK' || r[1] === 'FK';
          var keyHtml = isKey ? '<span class="key ' + (r[1] === 'PK' ? 'pk' : 'fk') + '">' + r[1] + '</span>' : '<span class="ty">' + r[1] + '</span>';
          return '<div class="erow' + (r[1] === 'FK' ? ' hot' : '') + '"><span class="fn">' + r[0] + '</span>' + keyHtml + '</div>';
        }).join('');
        return '<div class="entity' + (p.hub ? ' hub' : '') + '"><div class="eh"><span class="eic">▤</span><div><b>' + p.title + '</b><small>' + p.sub + '</small></div></div>' + rows + '</div>';
      }).join('');
      $('#prov-flow').innerHTML = 'State machine&nbsp; <code>pending_lead</code><span class="arrow">▸</span><code>contacted</code><span class="arrow">▸</span><code>docs_received</code><span class="arrow">▸</span><code>under_review</code><span class="arrow">▸</span><code>approved</code><span class="arrow">▸</span><code>provisioning</code><span class="arrow">▸</span><code>active</code> &nbsp;·&nbsp; any review step may branch to <code style="color:var(--note);">rejected</code>';
    }
    renderQueue(); renderDetail(); renderPayloads();
  })();

  /* ============================================================
     INVITE ACCEPTANCE — stepper
     ============================================================ */
  (function () {
    var step = 1, MAX = 4;
    var META = {
      1: { title: "You're invited", sub: 'Accept invitation · step 1 of 4', hint: 'Invites expire in 14 days · locked to the invited email.', next: 'Continue ›' },
      2: { title: 'Review what you get', sub: 'Accept invitation · step 2 of 4', hint: 'See the exact role, scope & permissions before accepting.', next: 'Accept & continue ›' },
      3: { title: 'Secure your account', sub: 'Accept invitation · step 3 of 4', hint: '2FA is mandatory for every SchoolWithEase account.', next: 'Finish ›' },
      4: { title: "You're in", sub: 'Accept invitation · step 4 of 4', hint: 'Multiple profiles → you land on the workspace picker.', next: '✓ Done' }
    };
    function set(n) {
      step = Math.max(1, Math.min(MAX, n));
      $$('[data-ivstep]').forEach(function (s) { var k = +s.getAttribute('data-ivstep'); s.classList.toggle('active', k === step); s.classList.toggle('done', k < step); });
      $$('[data-ivconn]').forEach(function (c) { c.classList.toggle('fill', +c.getAttribute('data-ivconn') < step); });
      $$('#pane-invite .af-stage').forEach(function (st) { st.classList.toggle('on', st.id === 'iv' + step); });
      var m = META[step];
      $('#iv-title').textContent = m.title; $('#iv-sub').textContent = m.sub; $('#iv-hint').textContent = m.hint; $('#iv-next').textContent = m.next;
      $('#iv-back').style.opacity = step === 1 ? '.5' : '1';
    }
    $$('[data-ivstep]').forEach(function (s) { s.addEventListener('click', function () { set(+s.getAttribute('data-ivstep')); }); });
    $('#iv-next').addEventListener('click', function () {
      if (step === MAX) { toast('🎉 Joined Greenfield'); }
      else { set(step + 1); if (step === 2) toast('✓ Both invitations accepted'); }
    });
    $('#iv-back').addEventListener('click', function () { set(step - 1); });
    set(1);
  })();

  /* ============================================================
     INVITE — recipient type (staff / student / parent)
     ============================================================ */
  (function () {
    var DATA = {
      staff:   { badge: 'Role & scope grant',     contactlab: 'Your email',       email: 'grace.o@greenfield.edu', name: 'Mrs. Grace Okafor', twofa: "2FA is required for everyone on SchoolWithEase. Pick how you'll verify.", doneH: "You're all set, Grace", doneP: '2 workspaces added to your account. Because you hold more than one profile, you\u2019ll land on the workspace picker.' },
      parent:  { badge: 'Linked to 2 children',   contactlab: 'Email or phone',   email: 'femi.bello@gmail.com',   name: 'Mr. Femi Bello',    twofa: "Secure your parent portal \u2014 2FA keeps your children's data safe.", doneH: "You're linked, Femi", doneP: '2 children linked to your parent portal. You\u2019ll land on your family dashboard.' },
      student: { badge: 'Student portal access',  contactlab: 'Your school email', email: 'ada.bello@greenfield.edu', name: 'Ada Bello',         twofa: "Add a recovery method \u2014 a guardian's phone works too.", doneH: 'Portal activated, Ada', doneP: 'Your student portal is ready. Taking you straight in.' }
    };
    function setText(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }
    function setRtype(rt) {
      var d = DATA[rt]; if (!d) return;
      var pane = $('#pane-invite'); pane.setAttribute('data-rtype', rt);
      $$('#iv-seg button').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-rtype') === rt ? 'true' : 'false'); });
      ['#iv1', '#iv2'].forEach(function (stg) {
        $$(stg + ' > * [data-rtype], ' + stg + ' [data-rtype]').forEach(function (blk) {
          if (blk.closest('#iv-seg')) return;
          blk.hidden = blk.getAttribute('data-rtype') !== rt;
        });
      });
      setText('iv-rbadge', d.badge); setText('iv-contactlab', d.contactlab);
      setText('iv-email', d.email); setText('iv-name', d.name); setText('iv-wb-email', d.email);
      setText('iv-2fa-hint', d.twofa); setText('iv-done-h', d.doneH); setText('iv-done-p', d.doneP);
    }
    $$('#iv-seg button').forEach(function (b) { b.addEventListener('click', function () { setRtype(b.getAttribute('data-rtype')); }); });
    setRtype('staff');
  })();

  /* ============================================================
     TWEAK CONFIG — apply MFA channels + discovery user mode
     ============================================================ */
  window.__authApply = function (t) {
    // sandbox route off → force Route A
    if (t.sandbox === false && window.__setRoute) window.__setRoute('A');
    // grey out unavailable MFA channels in the picker
    var avail = t.mfa || [];
    $$('#vf-methods .method').forEach(function (m) {
      var on = avail.indexOf(m.getAttribute('data-method')) > -1;
      m.classList.toggle('disabled', !on);
    });
    // if current entry method got disabled, fall back to first available
    var curOn = $('#vf-methods .method.on');
    if (curOn && curOn.classList.contains('disabled')) {
      var first = $('#vf-methods .method:not(.disabled)');
      if (first) first.click();
    }
    // discovery user mode
    var userBadge = $('#disc-userbadge');
    if (t.user === 'single') {
      if (userBadge) userBadge.textContent = 'Single-profile user · 1 profile';
      setDiscState('single');
    } else {
      if (userBadge) userBadge.textContent = 'Multi-profile user · 4 profiles';
      var pressed = $('#disc-seg button[aria-pressed="true"]');
      setDiscState(pressed ? pressed.getAttribute('data-state') : 'first');
    }
  };

  /* ---------- init ---------- */
  setDiscState('first');
})();
