/* SkillBridge EXTRAS: login/sign-up, admin dashboard, profile page, light/dark mode.
   No server and no Firebase: everything is saved in this browser (localStorage).
   To use: add ONE line inside <head> of index.html:   <script src="extras.js"></script>   */
(function () {
  'use strict';

  /* ---------- Settings you can change ---------- */
  const ADMIN_EMAILS = ['admin@skillbridge.com'];   // signing up with one of these emails creates an admin account
  const REQUIRE_LOGIN_TO_LEARN = true;              // true = visitors must log in before watching a course

  /* ---------- Small helpers ---------- */
  const _set = Storage.prototype.setItem;           // original setItem (used for our own writes)
  const get = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v === null ? d : v; } catch (e) { return d; } };
  const put = (k, v) => _set.call(localStorage, k, JSON.stringify(v));
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = t => t ? new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
  const users = () => get('sb_users', {});
  const saveUsers = u => put('sb_users', u);
  const rnd = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
  let me = null;                                    // email of the logged-in user

  /* ---------- Theme (runs immediately so there is no flash) ---------- */
  let theme = get('sb_theme', matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.dataset.theme = theme;

  const css = document.createElement('style');
  css.textContent = `
  :root[data-theme=dark]{--ink:#E6EDF3;--bg:#0D1823;--card:#152433;--mut:#9DB0C0;--line:#274055}
  [data-theme=dark] header{background:#091019}
  [data-theme=dark] main a:not(.btn){color:#4FD1CF}
  [data-theme=dark] .chip.on,[data-theme=dark] .tabs button.on{background:var(--teal);color:#fff}
  [data-theme=dark] .banner{color:#12263A}
  [data-theme=dark] .modal form,[data-theme=dark] input{background:var(--card);color:var(--ink)}
  body.xin #auth{display:none}
  #xtra{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
  #xtra a{color:#fff;text-decoration:none}
  .xt{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line)}
  .xt th,.xt td{padding:10px;text-align:left;border-bottom:1px solid var(--line);font-size:.92rem;vertical-align:middle}
  .xs{overflow-x:auto;margin-bottom:28px}
  .xb{padding:5px 10px;font-size:.85rem}
  .xtoast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--ink);color:var(--bg);padding:12px 20px;border-radius:8px;z-index:20}
  `;
  document.head.appendChild(css);

  const toast = m => { const t = document.createElement('div'); t.className = 'xtoast'; t.setAttribute('role', 'status'); t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), 3000); };

  /* ---------- Session: load the logged-in user's progress into the site ---------- */
  const sess = get('sb_session', null);
  if (sess && users()[sess]) { me = sess; put('sb_enr', users()[sess].enr || {}); put('sb_name', users()[sess].name); }
  else if (sess) localStorage.removeItem('sb_session');

  /* Every time the site saves progress, copy it into the user's account and write an activity log */
  function log(m) { const l = get('sb_log', []); l.unshift({ t: Date.now(), u: me, m }); put('sb_log', l.slice(0, 100)); }
  Storage.prototype.setItem = function (k, v) {
    _set.call(this, k, v);
    if (this === localStorage && k === 'sb_enr' && me) {
      let n; try { n = JSON.parse(v); } catch (e) { return; }
      const U = users(), u = U[me]; if (!u) return;
      const o = u.enr || {};
      for (const id in n) {
        if (!o[id]) log('enrolled in ' + (n[id].course || id));
        else if (n[id].completed && !o[id].completed) log('completed ' + (n[id].course || id));
      }
      u.enr = n; saveUsers(U);
    }
  };

  /* ---------- Accounts ---------- */
  async function hash(pw, salt) {
    if (window.crypto && crypto.subtle) {
      const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + pw));
      return [...new Uint8Array(d)].map(x => x.toString(16).padStart(2, '0')).join('');
    }
    let h = 5381; for (const c of salt + pw) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0; return String(h);
  }
  function begin(email, msg) {
    if (!me) put('sb_guest', { enr: get('sb_enr', {}), name: get('sb_name', '') });   // keep what a visitor did before logging in
    const U = users(), u = U[email];
    put('sb_enr', u.enr || {}); put('sb_name', u.name); put('sb_session', email);
    me = email; log(msg); location.reload();
  }
  async function signup(name, email, pw) {
    const U = users();
    if (U[email]) throw Error('This email is already registered. Try logging in.');
    const salt = rnd();
    U[email] = { name, salt, hash: await hash(pw, salt), role: ADMIN_EMAILS.includes(email) ? 'admin' : 'student', created: Date.now(), lastLogin: Date.now(), loginCount: 1, enr: me ? {} : get('sb_enr', {}) };
    saveUsers(U); begin(email, 'signed up');
  }
  async function login(email, pw) {
    const U = users(), u = U[email];
    if (!u || u.hash !== await hash(pw, u.salt)) throw Error('Wrong email or password.');
    u.lastLogin = Date.now(); u.loginCount = (u.loginCount || 0) + 1; saveUsers(U); begin(email, 'logged in');
  }
  function logout() {
    const g = get('sb_guest', { enr: {}, name: '' });
    put('sb_enr', g.enr); put('sb_name', g.name); localStorage.removeItem('sb_session');
    me = null; location.hash = '#/'; location.reload();
  }

  /* ---------- Login / sign-up window ---------- */
  let mode = 'login';
  function setMode(m, note) {
    mode = m;
    $('#xt').textContent = m === 'login' ? 'Log in' : 'Create your account';
    $('#xn').hidden = m === 'login'; $('#xname').required = m === 'sign';
    $('#xgo').textContent = m === 'login' ? 'Log in' : 'Sign up';
    $('#xsw').innerHTML = m === 'login' ? 'New here? <a href="#" id="xlink">Create an account</a>' : 'Already have an account? <a href="#" id="xlink">Log in</a>';
    $('#xlink').onclick = e => { e.preventDefault(); setMode(m === 'login' ? 'sign' : 'login'); };
    $('#xerr').textContent = note || '';
  }
  function openM(m, note) { setMode(m || 'login', note); $('#xm').hidden = false; $('#xemail').focus(); }
  function buildModal() {
    const m = document.createElement('div'); m.className = 'modal'; m.id = 'xm'; m.hidden = true;
    m.innerHTML = `<form id="xf"><h2 id="xt" style="font-size:1.5rem"></h2>
      <div id="xn" hidden><label>Full name (printed on your certificate)<input id="xname" autocomplete="name"></label></div>
      <label>Email<input id="xemail" type="email" required autocomplete="email"></label>
      <label>Password (6+ characters)<input id="xpass" type="password" required minlength="6" autocomplete="current-password"></label>
      <div class="err" id="xerr" role="alert"></div>
      <button id="xgo"></button> <button type="button" class="alt" id="xx" style="color:var(--ink)">Cancel</button>
      <p class="tag" id="xsw"></p></form>`;
    document.body.appendChild(m);
    $('#xx').onclick = () => m.hidden = true;
    $('#xf').onsubmit = async e => {
      e.preventDefault(); $('#xerr').textContent = '';
      const em = $('#xemail').value.trim().toLowerCase(), pw = $('#xpass').value, nm = $('#xname').value.trim();
      try { if (mode === 'sign') { if (!nm) throw Error('Please type your full name.'); await signup(nm, em, pw); } else await login(em, pw); }
      catch (er) { $('#xerr').textContent = er.message; }
    };
  }

  /* ---------- Header buttons ---------- */
  function paintHeader() {
    const u = me && users()[me];
    $('#xtra').innerHTML = `<button class="alt" id="xth" style="color:#fff" aria-label="Switch between light and dark mode">${theme === 'dark' ? '☀️ Light' : '🌙 Dark'}</button>` +
      (u ? `<a href="#/profile">${esc(u.name)}</a>${u.role === 'admin' ? '<a href="#/admin">Admin</a>' : ''}<button class="alt" id="xlo" style="color:#fff">Log out</button>` : '<button id="xli">Log in</button>');
    $('#xth').onclick = () => { theme = theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = theme; put('sb_theme', theme); paintHeader(); };
    if (u) $('#xlo').onclick = logout; else $('#xli').onclick = () => openM('login');
  }

  /* ---------- Admin dashboard (#/admin) ---------- */
  function admin() {
    const U = users(), cu = U[me], app = $('#app');
    if (!cu || cu.role !== 'admin') { app.innerHTML = '<h1>Admin</h1><p>This page is only for administrators. Log in with an admin account.</p>'; return; }
    const list = Object.entries(U).map(([email, u]) => ({ email, ...u }));
    const enrs = list.flatMap(u => Object.entries(u.enr || {}).map(([id, e]) => ({ id, e })));
    const done = enrs.filter(x => x.e.completed).length;
    const byC = {}; enrs.forEach(x => { const c = byC[x.id] || (byC[x.id] = { name: x.e.course || x.id, n: 0, d: 0 }); c.n++; if (x.e.completed) c.d++; });
    const rows = list.map(u => { const es = Object.values(u.enr || {}); const self = u.email === me;
      return `<tr data-s="${esc((u.name + ' ' + u.email).toLowerCase())}"><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${u.role}</td><td>${fmt(u.created)}</td><td>${fmt(u.lastLogin)}</td><td>${u.loginCount || 0}</td><td>${es.length}</td><td>${es.filter(x => x.completed).length}</td>
      <td>${self ? '<span class="tag">You</span>' : `<button class="alt xb" data-a="role" data-e="${esc(u.email)}" style="color:var(--ink)">${u.role === 'admin' ? 'Remove admin' : 'Make admin'}</button> <button class="alt xb" data-a="del" data-e="${esc(u.email)}" style="color:#b3261e">Delete</button>`}</td></tr>`; }).join('');
    const crow = Object.values(byC).map(c => `<tr><td>${esc(c.name)}</td><td>${c.n}</td><td>${c.d}</td><td>${Math.round(c.d / c.n * 100)}%</td></tr>`).join('') || '<tr><td colspan="4">No enrolments yet.</td></tr>';
    const act = get('sb_log', []).slice(0, 15).map(a => `<tr><td>${new Date(a.t).toLocaleString('en-GB')}</td><td>${esc((U[a.u] || {}).name || a.u || 'Visitor')}</td><td>${esc(a.m)}</td></tr>`).join('') || '<tr><td colspan="3">No activity yet.</td></tr>';
    app.innerHTML = `<h1>Admin dashboard</h1>
    <div class="stats"><div><b>${list.length}</b>registered users</div><div><b>${enrs.length}</b>enrolments</div><div><b>${done}</b>certificates issued</div><div><b>${enrs.length ? Math.round(done / enrs.length * 100) : 0}%</b>completion rate</div></div>
    <h2>Users</h2><p><input id="xs" type="search" placeholder="Search by name or email" aria-label="Search users" style="max-width:320px;margin-right:10px"><button id="xcsv">Export CSV</button></p>
    <div class="xs"><table class="xt"><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th>Last login</th><th>Logins</th><th>Courses</th><th>Certificates</th><th>Actions</th></tr>${rows}</table></div>
    <h2>Course performance</h2><div class="xs"><table class="xt"><tr><th>Course</th><th>Enrolled</th><th>Completed</th><th>Rate</th></tr>${crow}</table></div>
    <h2>Recent activity</h2><div class="xs"><table class="xt"><tr><th>When</th><th>Who</th><th>What</th></tr>${act}</table></div>
    <p class="tag">Data comes from accounts created in this browser, because the site has no server.</p>`;
    $('#xs').oninput = e => document.querySelectorAll('tr[data-s]').forEach(r => r.style.display = r.dataset.s.includes(e.target.value.toLowerCase()) ? '' : 'none');
    $('#xcsv').onclick = () => {
      const q = v => '"' + String(v).replace(/"/g, '""') + '"';
      const csv = [['Name', 'Email', 'Role', 'Joined', 'Last login', 'Logins', 'Courses', 'Certificates'].map(q).join(',')].concat(list.map(u => { const es = Object.values(u.enr || {}); return [u.name, u.email, u.role, fmt(u.created), fmt(u.lastLogin), u.loginCount || 0, es.length, es.filter(x => x.completed).length].map(q).join(','); })).join('\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'skillbridge-users.csv'; a.click();
    };
    document.querySelectorAll('button[data-a]').forEach(b => b.onclick = () => {
      const e = b.dataset.e, V = users(); if (!V[e]) return;
      if (b.dataset.a === 'del') { if (!confirm('Delete ' + V[e].name + '\'s account and progress?')) return; delete V[e]; log('deleted account ' + e); }
      else { V[e].role = V[e].role === 'admin' ? 'student' : 'admin'; log('changed role of ' + e); }
      saveUsers(V); admin();
    });
  }

  /* ---------- Profile page (#/profile) ---------- */
  function profile() {
    const u = me && users()[me], app = $('#app');
    if (!u) { app.innerHTML = '<h1>My account</h1><p>Log in to see your account.</p>'; return openM('login'); }
    const es = Object.values(u.enr || {});
    app.innerHTML = `<h1>My account</h1>
    <div class="stats"><div><b>${es.length}</b>courses started</div><div><b>${es.filter(x => x.completed).length}</b>certificates</div><div><b>${u.loginCount || 0}</b>logins</div></div>
    <div class="card" style="max-width:420px"><h3>Profile</h3><p class="tag">${esc(me)} · ${u.role} · member since ${fmt(u.created)}</p>
      <form id="pf"><label>Full name<input id="pname" value="${esc(u.name)}" required></label><button>Save name</button></form></div>
    <div class="card" style="max-width:420px;margin-top:20px"><h3>Change password</h3>
      <form id="pw"><label>Current password<input id="p0" type="password" required></label><label>New password (6+ characters)<input id="p1" type="password" minlength="6" required></label><div class="err" id="perr"></div><button>Update password</button></form></div>
    <p style="margin-top:24px"><button class="alt" id="pdel" style="color:#b3261e">Delete my account</button></p>`;
    $('#pf').onsubmit = e => { e.preventDefault(); const U = users(); U[me].name = $('#pname').value.trim() || U[me].name; saveUsers(U); put('sb_name', U[me].name); location.reload(); };
    $('#pw').onsubmit = async e => {
      e.preventDefault(); const U = users(), x = U[me];
      if (x.hash !== await hash($('#p0').value, x.salt)) { $('#perr').textContent = 'Your current password is not correct.'; return; }
      x.salt = rnd(); x.hash = await hash($('#p1').value, x.salt); saveUsers(U); $('#pw').reset(); $('#perr').textContent = ''; toast('Password updated');
    };
    $('#pdel').onclick = () => { if (!confirm('Delete your account and all your progress? This cannot be undone.')) return; const U = users(); delete U[me]; saveUsers(U); logout(); };
  }

  /* ---------- Page routing on top of the existing site ---------- */
  function gate() {
    if (REQUIRE_LOGIN_TO_LEARN && !me && location.hash.startsWith('#/learn/')) { location.hash = '#/courses'; openM('login', 'Log in to start learning.'); return true; }
    return false;
  }
  function route() {
    const h = location.hash;
    if (h.startsWith('#/admin')) admin();
    else if (h.startsWith('#/profile')) profile();
  }
  addEventListener('hashchange', () => { if (!gate()) setTimeout(route, 0); });     // runs before the site's own handler, then draws our pages after it

  document.addEventListener('DOMContentLoaded', () => {
    const h = $('header'), s = document.createElement('span'); s.id = 'xtra'; h.appendChild(s);
    if (me) document.body.classList.add('xin');
    buildModal(); paintHeader();
    if (!gate()) setTimeout(route, 0);
  });
})();
