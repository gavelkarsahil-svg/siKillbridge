const SUPABASE_URL = 'https://wqnxihaxtyafwgyymqit.supabase.co';
const SUPABASE_KEY = 'sb_publishable_xxxxxxxxxxxxxxxx';/* SkillBridge EXTRAS (Supabase version): real login, shared database, admin dashboard, profile page, light/dark mode.
   Needs ONE line in <head> of index.html:  <script src="extras.js"></script>
   Fill in the two Supabase values below. */
(function () {
  'use strict';

  /* ---------- 1. YOUR SUPABASE SETTINGS (Project Settings > API) ---------- */
  const SUPABASE_URL = 'PASTE_PROJECT_URL_HERE';        // looks like https://abcdxyz.supabase.co
  const SUPABASE_KEY = 'PASTE_ANON_PUBLIC_KEY_HERE';    // the long "anon public" key (safe to put here)
  const REQUIRE_LOGIN_TO_LEARN = true;                  // true = visitors must log in before watching a course

  const CONFIGURED = /^https:\/\/[\w-]+\.supabase\.co/.test(SUPABASE_URL) && SUPABASE_KEY.length > 40;

  /* ---------- Helpers ---------- */
  const _set = Storage.prototype.setItem;               // original setItem, used for our own writes
  const get = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v === null ? d : v; } catch (e) { return d; } };
  const put = (k, v) => _set.call(localStorage, k, JSON.stringify(v));
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = t => t ? new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
  let sb = null, sdkError = '';                          // Supabase client
  let uid = get('sb_uid', null), prof = get('sb_prof', null);   // cached login so pages can draw instantly

  /* ---------- Theme ---------- */
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
  .xtoast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--ink);color:var(--bg);padding:12px 20px;border-radius:8px;z-index:20;max-width:90vw}
  `;
  document.head.appendChild(css);
  const toast = m => { const t = document.createElement('div'); t.className = 'xtoast'; t.setAttribute('role', 'status'); t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), 3500); };

  /* ---------- Progress sync: copies what the site saves into the database ---------- */
  const toRow = (id, e) => ({ user_id: uid, course_id: id, course_title: e.course || id, done: e.done || [], total: e.total || 0, last: e.last || 0, completed: !!e.completed, cert_id: e.certId || null, completed_at: e.completedAt || null, enrolled_at: e.enrolledAt || new Date().toISOString(), updated_at: new Date().toISOString() });
  const fromRow = r => ({ course: r.course_title, done: r.done || [], total: r.total, last: r.last, completed: r.completed, certId: r.cert_id || undefined, completedAt: r.completed_at || undefined, enrolledAt: r.enrolled_at });
  const act = m => sb.from('activity').insert({ user_id: uid, message: m });
  let timer = null, busy = false;

  async function push() {
    if (!sb || !uid || busy) return;
    busy = true;
    const now = get('sb_enr', {}), was = get('sb_known', {});
    try {
      for (const id in now) {
        if (JSON.stringify(now[id]) === JSON.stringify(was[id])) continue;
        const r = await sb.from('enrollments').upsert(toRow(id, now[id])); if (r.error) throw r.error;
        if (!was[id]) await act('enrolled in ' + (now[id].course || id));
        else if (now[id].completed && !was[id].completed) await act('completed ' + (now[id].course || id));
      }
      for (const id in was) if (!now[id]) await sb.from('enrollments').delete().eq('user_id', uid).eq('course_id', id);
      put('sb_known', now);
    } catch (er) { console.warn('SkillBridge: could not save progress yet', er); }
    busy = false;
  }
  Storage.prototype.setItem = function (k, v) {
    _set.call(this, k, v);
    if (this === localStorage && k === 'sb_enr' && uid) { clearTimeout(timer); timer = setTimeout(push, 500); }
  };

  /* ---------- Talking to Supabase ---------- */
  function loadSdk() {
    return new Promise((ok, no) => {
      if (window.supabase) return ok();
      const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      s.onload = ok; s.onerror = () => no(Error('Could not load the database library. Check your internet connection.'));
      document.head.appendChild(s);
    });
  }
  async function loadMine() {                           // fetch my profile + my courses from the database
    const [p, e] = await Promise.all([sb.from('profiles').select('*').eq('id', uid).single(), sb.from('enrollments').select('*').eq('user_id', uid)]);
    if (p.error || e.error) throw (p.error || e.error);
    const enr = {}; e.data.forEach(r => enr[r.course_id] = fromRow(r));
    return { prof: { name: p.data.name, email: p.data.email, role: p.data.role, login_count: p.data.login_count, created_at: p.data.created_at }, enr };
  }
  function cache(m) { prof = m.prof; put('sb_uid', uid); put('sb_prof', prof); put('sb_name', prof.name); put('sb_enr', m.enr); put('sb_known', m.enr); }

  async function init() {
    if (!CONFIGURED) return;
    try { await loadSdk(); sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY); } catch (e) { sdkError = e.message; return; }
    const { data } = await sb.auth.getSession(), s = data && data.session;
    if (!s) { if (uid) { clearLocal(); location.reload(); } return; }
    uid = s.user.id;
    try {
      await push();                                     // upload anything saved while offline
      const m = await loadMine();
      const changed = JSON.stringify(m.enr) !== JSON.stringify(get('sb_enr', {}));
      cache(m);
      if (changed && !sessionStorage.getItem('sb_rl')) { sessionStorage.setItem('sb_rl', '1'); location.reload(); return; }
      sessionStorage.removeItem('sb_rl');
    } catch (e) { console.warn('SkillBridge: could not refresh', e); }
    document.body.classList.add('xin'); paintHeader();
  }
  function clearLocal() { ['sb_uid', 'sb_prof', 'sb_known'].forEach(k => localStorage.removeItem(k)); uid = null; prof = null; }

  async function signup(name, email, pw) {
    const guest = get('sb_enr', {}), wasGuest = !uid;
    const { data, error } = await sb.auth.signUp({ email, password: pw, options: { data: { name } } });
    if (error) throw error;
    if (!data.session) throw Error('Account created. Check your email for the confirmation link, then log in.');
    if (wasGuest) put('sb_guest', { enr: guest, name: get('sb_name', '') });
    uid = data.user.id; await sb.rpc('record_login');
    put('sb_known', {}); put('sb_enr', guest); put('sb_uid', uid); put('sb_prof', { name, email, role: 'student' }); put('sb_name', name);
    await push();                                       // visitor progress moves into the new account
    location.reload();
  }
  async function login(email, pw) {
    const wasGuest = !uid, guest = { enr: get('sb_enr', {}), name: get('sb_name', '') };
    const { data, error } = await sb.auth.signInWithPassword({ email, password: pw });
    if (error) throw error;
    uid = data.user.id; await sb.rpc('record_login');
    if (wasGuest) put('sb_guest', guest);
    cache(await loadMine()); location.reload();
  }
  async function logout() {
    try { if (sb) await sb.auth.signOut(); } catch (e) {}
    const g = get('sb_guest', { enr: {}, name: '' });
    clearLocal(); put('sb_enr', g.enr); put('sb_name', g.name);
    location.hash = '#/'; location.reload();
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
  function openM(m, note) {
    if (!CONFIGURED) return toast('The database is not connected yet. Add your Supabase URL and key at the top of extras.js.');
    setMode(m || 'login', note); $('#xm').hidden = false; $('#xemail').focus();
  }
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
      if (!sb) { $('#xerr').textContent = sdkError || 'Still connecting to the database. Try again in a moment.'; return; }
      const em = $('#xemail').value.trim().toLowerCase(), pw = $('#xpass').value, nm = $('#xname').value.trim();
      $('#xgo').disabled = true;
      try { if (mode === 'sign') { if (!nm) throw Error('Please type your full name.'); await signup(nm, em, pw); } else await login(em, pw); }
      catch (er) { $('#xerr').textContent = /Invalid login/i.test(er.message) ? 'Wrong email or password.' : er.message; $('#xgo').disabled = false; }
    };
  }

  /* ---------- Header buttons ---------- */
  function paintHeader() {
    const u = uid && prof;
    $('#xtra').innerHTML = `<button class="alt" id="xth" style="color:#fff" aria-label="Switch between light and dark mode">${theme === 'dark' ? '☀️ Light' : '🌙 Dark'}</button>` +
      (u ? `<a href="#/profile">${esc(prof.name || prof.email)}</a>${prof.role === 'admin' ? '<a href="#/admin">Admin</a>' : ''}<button class="alt" id="xlo" style="color:#fff">Log out</button>` : '<button id="xli">Log in</button>');
    $('#xth').onclick = () => { theme = theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = theme; put('sb_theme', theme); paintHeader(); };
    if (u) $('#xlo').onclick = logout; else $('#xli').onclick = () => openM('login');
  }

  /* ---------- Admin dashboard (#/admin) ---------- */
  async function admin() {
    const app = $('#app');
    if (!uid || !prof || prof.role !== 'admin') { app.innerHTML = '<h1>Admin</h1><p>This page is only for administrators. Log in with an admin account.</p>'; return; }
    app.innerHTML = '<h1>Admin dashboard</h1><p>Loading data…</p>';
    for (let i = 0; i < 20 && !sb; i++) await new Promise(r => setTimeout(r, 250));
    if (!sb) { app.innerHTML = '<h1>Admin dashboard</h1><p>' + esc(sdkError || 'Could not connect to the database.') + '</p>'; return; }
    const [p, e, a] = await Promise.all([
      sb.from('profiles').select('*').order('created_at'),
      sb.from('enrollments').select('*'),
      sb.from('activity').select('*').order('created_at', { ascending: false }).limit(15)]);
    if (p.error || e.error || a.error) { app.innerHTML = '<h1>Admin dashboard</h1><p>Could not load the data: ' + esc((p.error || e.error || a.error).message) + '</p>'; return; }
    const list = p.data, enrs = e.data, names = {}; list.forEach(u => names[u.id] = u.name || u.email);
    const mine = id => enrs.filter(x => x.user_id === id);
    const done = enrs.filter(x => x.completed).length;
    const byC = {}; enrs.forEach(x => { const c = byC[x.course_id] || (byC[x.course_id] = { name: x.course_title || x.course_id, n: 0, d: 0 }); c.n++; if (x.completed) c.d++; });
    const rows = list.map(u => { const self = u.id === uid;
      return `<tr data-s="${esc(((u.name || '') + ' ' + u.email).toLowerCase())}"><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${u.role}</td><td>${fmt(u.created_at)}</td><td>${fmt(u.last_login)}</td><td>${u.login_count}</td><td>${mine(u.id).length}</td><td>${mine(u.id).filter(x => x.completed).length}</td>
      <td>${self ? '<span class="tag">You</span>' : `<button class="alt xb" data-a="role" data-e="${u.id}" data-r="${u.role === 'admin' ? 'student' : 'admin'}" style="color:var(--ink)">${u.role === 'admin' ? 'Remove admin' : 'Make admin'}</button> <button class="alt xb" data-a="del" data-e="${u.id}" data-n="${esc(u.name || u.email)}" style="color:#b3261e">Delete</button>`}</td></tr>`; }).join('');
    const crow = Object.values(byC).map(c => `<tr><td>${esc(c.name)}</td><td>${c.n}</td><td>${c.d}</td><td>${Math.round(c.d / c.n * 100)}%</td></tr>`).join('') || '<tr><td colspan="4">No enrolments yet.</td></tr>';
    const arow = a.data.map(x => `<tr><td>${new Date(x.created_at).toLocaleString('en-GB')}</td><td>${esc(names[x.user_id] || 'Deleted user')}</td><td>${esc(x.message)}</td></tr>`).join('') || '<tr><td colspan="3">No activity yet.</td></tr>';
    app.innerHTML = `<h1>Admin dashboard</h1>
    <div class="stats"><div><b>${list.length}</b>registered users</div><div><b>${enrs.length}</b>enrolments</div><div><b>${done}</b>certificates issued</div><div><b>${enrs.length ? Math.round(done / enrs.length * 100) : 0}%</b>completion rate</div></div>
    <h2>Users</h2><p><input id="xs" type="search" placeholder="Search by name or email" aria-label="Search users" style="max-width:320px;margin-right:10px"><button id="xcsv">Export CSV</button></p>
    <div class="xs"><table class="xt"><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th>Last login</th><th>Logins</th><th>Courses</th><th>Certificates</th><th>Actions</th></tr>${rows}</table></div>
    <h2>Course performance</h2><div class="xs"><table class="xt"><tr><th>Course</th><th>Enrolled</th><th>Completed</th><th>Rate</th></tr>${crow}</table></div>
    <h2>Recent activity</h2><div class="xs"><table class="xt"><tr><th>When</th><th>Who</th><th>What</th></tr>${arow}</table></div>`;
    $('#xs').oninput = ev => document.querySelectorAll('tr[data-s]').forEach(r => r.style.display = r.dataset.s.includes(ev.target.value.toLowerCase()) ? '' : 'none');
    $('#xcsv').onclick = () => {
      const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
      const csv = [['Name', 'Email', 'Role', 'Joined', 'Last login', 'Logins', 'Courses', 'Certificates'].map(q).join(',')].concat(list.map(u => [u.name, u.email, u.role, fmt(u.created_at), fmt(u.last_login), u.login_count, mine(u.id).length, mine(u.id).filter(x => x.completed).length].map(q).join(','))).join('\n');
      const l = document.createElement('a'); l.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); l.download = 'skillbridge-users.csv'; l.click();
    };
    document.querySelectorAll('button[data-a]').forEach(b => b.onclick = async () => {
      let r;
      if (b.dataset.a === 'del') { if (!confirm('Delete ' + b.dataset.n + '\'s account and all their progress?')) return; r = await sb.rpc('delete_user', { target: b.dataset.e }); }
      else r = await sb.rpc('set_role', { target: b.dataset.e, new_role: b.dataset.r });
      if (r.error) toast(r.error.message); admin();
    });
  }

  /* ---------- Profile page (#/profile) ---------- */
  function profile() {
    const app = $('#app');
    if (!uid || !prof) { app.innerHTML = '<h1>My account</h1><p>Log in to see your account.</p>'; return openM('login'); }
    const es = Object.values(get('sb_enr', {}));
    app.innerHTML = `<h1>My account</h1>
    <div class="stats"><div><b>${es.length}</b>courses started</div><div><b>${es.filter(x => x.completed).length}</b>certificates</div><div><b>${prof.login_count || 1}</b>logins</div></div>
    <div class="card" style="max-width:420px"><h3>Profile</h3><p class="tag">${esc(prof.email)} · ${prof.role} · member since ${fmt(prof.created_at)}</p>
      <form id="pf"><label>Full name<input id="pname" value="${esc(prof.name)}" required></label><button>Save name</button></form></div>
    <div class="card" style="max-width:420px;margin-top:20px"><h3>Change password</h3>
      <form id="pw"><label>New password (6+ characters)<input id="p1" type="password" minlength="6" required autocomplete="new-password"></label><div class="err" id="perr"></div><button>Update password</button></form></div>
    <p style="margin-top:24px"><button class="alt" id="pdel" style="color:#b3261e">Delete my account</button></p>`;
    $('#pf').onsubmit = async e => {
      e.preventDefault(); if (!sb) return toast('Still connecting. Try again in a moment.');
      const n = $('#pname').value.trim(); if (!n) return;
      const r = await sb.from('profiles').update({ name: n }).eq('id', uid); if (r.error) return toast(r.error.message);
      await sb.auth.updateUser({ data: { name: n } }); prof.name = n; put('sb_prof', prof); put('sb_name', n); location.reload();
    };
    $('#pw').onsubmit = async e => {
      e.preventDefault(); if (!sb) return toast('Still connecting. Try again in a moment.');
      const r = await sb.auth.updateUser({ password: $('#p1').value });
      if (r.error) { $('#perr').textContent = r.error.message; return; }
      $('#pw').reset(); $('#perr').textContent = ''; toast('Password updated');
    };
    $('#pdel').onclick = async () => {
      if (!sb || !confirm('Delete your account and all your progress? This cannot be undone.')) return;
      const r = await sb.rpc('delete_my_account'); if (r.error) return toast(r.error.message); logout();
    };
  }

  /* ---------- Page routing on top of the existing site ---------- */
  function gate() {
    if (REQUIRE_LOGIN_TO_LEARN && !uid && location.hash.startsWith('#/learn/')) { location.hash = '#/courses'; openM('login', 'Log in to start learning.'); return true; }
    return false;
  }
  function route() { const h = location.hash; if (h.startsWith('#/admin')) admin(); else if (h.startsWith('#/profile')) profile(); }
  addEventListener('hashchange', () => { if (!gate()) setTimeout(route, 0); });   // our handler runs first, then draws our pages after the site's own handler

  document.addEventListener('DOMContentLoaded', () => {
    const s = document.createElement('span'); s.id = 'xtra'; $('header').appendChild(s);
    if (uid && prof) document.body.classList.add('xin');
    buildModal(); paintHeader();
    if (!gate()) setTimeout(route, 0);
    init();
  });
})();
