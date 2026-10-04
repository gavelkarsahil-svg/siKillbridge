import { firebaseConfig } from './config.js';
import { COURSES } from './courses.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, sendPasswordResetEmail, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, getDocs, addDoc, collection, serverTimestamp, increment } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ---------- Firebase (the backend) ---------- */
const fb = initializeApp(firebaseConfig), auth = getAuth(fb), db = getFirestore(fb);

/* ---------- Helpers and state ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const S = { user: null, enr: {}, ready: false };      // enr = this user's enrolments, keyed by course id
const F = { q: '', cat: 'All' };                      // catalogue filters
const CATS = ['All', ...new Set(COURSES.map(c => c.cat))];
const course = id => COURSES.find(c => c.id === id);
const myName = () => (auth.currentUser && auth.currentUser.displayName) || (S.user && S.user.email) || '';
const mins = c => c.videos.reduce((a, x) => a + x.m, 0);
let player = null, CUR = { cid: null, i: 0 };

const ytReady = new Promise(r => window.onYouTubeIframeAPIReady = r);
const yt = document.createElement('script'); yt.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(yt);

/* ---------- Database functions ---------- */
async function recordLogin(u) {   // users/{uid} summary + users/{uid}/logins history
  await setDoc(doc(db, 'users', u.uid), { name: u.displayName || u.email, email: u.email, photo: u.photoURL || null, lastLogin: serverTimestamp(), loginCount: increment(1) }, { merge: true });
  await addDoc(collection(db, 'users', u.uid, 'logins'), { at: serverTimestamp() });
}
const saveEnr = (cid, d) => setDoc(doc(db, 'users', S.user.uid, 'enrollments', cid), { ...d, updatedAt: serverTimestamp() }, { merge: true });

onAuthStateChanged(auth, async u => {
  S.user = u ? { uid: u.uid, email: u.email } : null;
  S.enr = {};
  if (u) (await getDocs(collection(db, 'users', u.uid, 'enrollments'))).forEach(d => S.enr[d.id] = d.data());
  S.ready = true; render();
});

/* ---------- Router ---------- */
addEventListener('hashchange', render);
function render() {
  $('#auth').innerHTML = S.user ? `<span style="color:#fff;margin-right:10px">${esc(myName())}</span><button class="alt" id="out" style="color:#fff">Log out</button>` : `<button id="inb">Log in or sign up</button>`;
  if (S.user) $('#out').onclick = () => { signOut(auth); location.hash = '#/'; }; else $('#inb').onclick = openM;
  player = null;
  const [, r, a] = (location.hash || '#/').slice(1).split('/');
  if (!S.ready) return $('#app').innerHTML = '<p>Loading…</p>';
  if (r === 'courses') return catalogue();
  if (r === 'course') return detail(course(a));
  if (r === 'learn') return learn(course(a));
  if (r === 'dashboard') return dash();
  if (r === 'cert') return certPage(course(a));
  if (r === 'verify') return verify(a);
  home();
}

/* ---------- Pages ---------- */
const bar = (c, big) => { const d = (S.enr[c.id] || {}).done || []; return `<div class="span ${big ? 'big' : ''}" role="img" aria-label="${d.length} of ${c.videos.length} videos done">${c.videos.map((_, i) => `<i class="${d.includes(i) ? 'on' : ''}"></i>`).join('')}</div>`; };
const card = c => `<div class="card"><div class="ico">${c.ico}</div><h3>${c.title}</h3><p class="tag">${c.cat} · ${c.level} · ${c.videos.length} videos · ${mins(c)} min</p><p>${c.desc}</p>${S.enr[c.id] ? bar(c) : ''}<a class="btn" href="#/course/${c.id}">${S.enr[c.id] ? 'Continue' : 'View course'}</a></div>`;

function home() {
  $('#app').innerHTML = `<section class="hero"><h1>Learn a digital skill. Get hired.</h1><p>Free video courses for young people looking for their first digital job. Enrol, watch the lessons here, and earn a certificate you can verify online.</p><a class="btn" href="#/courses">Browse courses</a></section><h2>Popular courses</h2><div class="grid">${COURSES.slice(0, 3).map(card).join('')}</div>`;
}

function catalogue() {
  $('#app').innerHTML = `<h1>All courses</h1><div class="bar"><input id="q" type="search" placeholder="Search courses" aria-label="Search courses" value="${esc(F.q)}">${CATS.map(k => `<button class="chip ${k === F.cat ? 'on' : ''}" data-c="${k}">${k}</button>`).join('')}</div><div class="grid" id="grid"></div>`;
  const paint = () => {
    const l = COURSES.filter(c => (F.cat === 'All' || c.cat === F.cat) && (c.title + c.desc).toLowerCase().includes(F.q.toLowerCase()));
    $('#grid').innerHTML = l.length ? l.map(card).join('') : '<p>No course matches your search. Try a different word or category.</p>';
  };
  paint();
  $('#q').oninput = e => { F.q = e.target.value; paint(); };
  document.querySelectorAll('.chip').forEach(b => b.onclick = () => { F.cat = b.dataset.c; catalogue(); });
}

function detail(c) {
  if (!c) return location.hash = '#/courses';
  const e = S.enr[c.id];
  $('#app').innerHTML = `<h1>${c.ico} ${c.title}</h1><p class="tag">${c.cat} · ${c.level} · by ${esc(c.by)} · ${mins(c)} min</p><p style="max-width:60ch">${c.desc}</p>
  ${e ? bar(c, true) + (e.completed ? `<div class="banner"><strong>Course complete.</strong><a class="btn" href="#/cert/${c.id}">View certificate</a></div>` : '') : ''}
  <p><button id="go">${e ? (e.completed ? 'Watch again' : 'Continue learning') : 'Enrol for free'}</button></p>
  <h2>What you will learn</h2><ul class="list">${c.videos.map((x, i) => `<li class="${e && e.done.includes(i) ? 'ok' : ''}"><span class="n">${e && e.done.includes(i) ? '✓' : i + 1}</span>${esc(x.t)}<span class="tag">${x.m} min</span></li>`).join('')}</ul>`;
  $('#go').onclick = async () => {
    if (!S.user) return openM();
    if (!e) { const d = { course: c.title, done: [], total: c.videos.length, last: 0, completed: false, enrolledAt: new Date().toISOString() }; await saveEnr(c.id, d); S.enr[c.id] = d; }
    location.hash = '#/learn/' + c.id;
  };
}

function learn(c) {
  if (!c) return location.hash = '#/courses';
  if (!S.user) { openM(); return $('#app').innerHTML = '<p>Log in to watch this course.</p>'; }
  if (!S.enr[c.id]) return location.hash = '#/course/' + c.id;
  CUR = { cid: c.id, i: Math.min(S.enr[c.id].last || 0, c.videos.length - 1) };
  $('#app').innerHTML = `<p><a href="#/course/${c.id}">← ${esc(c.title)}</a></p><h1 id="vt"></h1><div id="prog"></div><div class="play"><div><div class="vid"><div id="player"></div></div><p><button id="mark">Mark this video as done</button> <span class="tag">It is also marked automatically when the video ends.</span></p></div><div><h3>Playlist</h3><ul class="list pick" id="pl"></ul></div></div>`;
  paint(c);
  $('#mark').onclick = () => complete(CUR.i);
  ytReady.then(() => { if ($('#player')) player = new YT.Player('player', { width: '100%', height: '100%', videoId: c.videos[CUR.i].y, events: { onStateChange: ev => { if (ev.data === 0) complete(CUR.i); } } }); });
}
function paint(c) {
  const e = S.enr[c.id];
  $('#vt').textContent = c.videos[CUR.i].t;
  $('#prog').innerHTML = bar(c, true) + (e.completed ? `<div class="banner"><strong>Course complete.</strong> Your certificate is ready.<a class="btn" href="#/cert/${c.id}">View certificate</a></div>` : '');
  $('#pl').innerHTML = c.videos.map((x, i) => `<li tabindex="0" data-i="${i}" class="${i === CUR.i ? 'cur' : ''} ${e.done.includes(i) ? 'ok' : ''}"><span class="n">${e.done.includes(i) ? '✓' : i + 1}</span>${esc(x.t)}<span class="tag">${x.m} min</span></li>`).join('');
  document.querySelectorAll('#pl li').forEach(li => {
    const go = () => { CUR.i = +li.dataset.i; if (player && player.loadVideoById) player.loadVideoById(c.videos[CUR.i].y); paint(c); };
    li.onclick = go; li.onkeydown = ev => { if (ev.key === 'Enter') go(); };
  });
}
async function complete(i) {
  const c = course(CUR.cid), e = S.enr[c.id];
  if (e.done.includes(i)) return;
  const done = [...e.done, i], all = done.length === c.videos.length;
  const d = { done, last: Math.min(i + 1, c.videos.length - 1), completed: all };
  if (all) { d.certId = 'SB-' + Date.now().toString(36).toUpperCase(); d.completedAt = new Date().toISOString(); }
  S.enr[c.id] = { ...e, ...d }; paint(c);
  try {
    await saveEnr(c.id, d);
    if (all) await setDoc(doc(db, 'certificates', d.certId), { uid: S.user.uid, name: myName(), courseId: c.id, course: c.title, issuedAt: d.completedAt });
  } catch (er) { alert('Could not save progress: ' + er.message); }
}

function dash() {
  if (!S.user) { openM(); return $('#app').innerHTML = '<h1>My learning</h1><p>Log in to see your courses and certificates.</p>'; }
  const mine = COURSES.filter(c => S.enr[c.id]), certs = mine.filter(c => S.enr[c.id].completed);
  $('#app').innerHTML = `<h1>My learning</h1><p>${esc(myName())} · ${esc(S.user.email)}</p>
  <div class="stats"><div><b>${mine.length}</b>courses enrolled</div><div><b>${certs.length}</b>certificates earned</div></div>
  <h2>My courses</h2>${mine.length ? `<div class="grid">${mine.map(card).join('')}</div>` : '<p>You have not enrolled yet. <a href="#/courses">Find a course</a></p>'}
  ${certs.length ? `<h2 style="margin-top:32px">My certificates</h2><ul class="list">${certs.map(c => `<li>${esc(c.title)}<span class="tag"><a href="#/cert/${c.id}">Open</a></span></li>`).join('')}</ul>` : ''}`;
}

function certPage(c) {
  const e = c && S.enr[c.id];
  if (!e || !e.completed) return $('#app').innerHTML = '<h1>Certificate</h1><p>Finish every video in a course to unlock its certificate.</p>';
  const link = location.origin + location.pathname + '#/verify/' + e.certId;
  $('#app').innerHTML = `<h1>Your certificate</h1><canvas id="cv" width="1200" height="850"></canvas><p><button id="dl">Download PNG</button> <button class="alt" onclick="print()" style="color:var(--ink)">Print</button></p><p class="tag">Anyone can check it at ${esc(link)}</p>`;
  const x = $('#cv').getContext('2d'); x.textAlign = 'center';
  const t = (txt, y, font, col) => { x.font = font; x.fillStyle = col; x.fillText(txt, 600, y); };
  x.fillStyle = '#fff'; x.fillRect(0, 0, 1200, 850);
  x.strokeStyle = '#12263A'; x.lineWidth = 14; x.strokeRect(30, 30, 1140, 790);
  x.strokeStyle = '#FFC93C'; x.lineWidth = 4; x.strokeRect(58, 58, 1084, 734);
  const H = '800 54px "Bricolage Grotesque",sans-serif', P = '28px system-ui,sans-serif';
  t('SkillBridge', 150, H, '#12263A'); t('Certificate of completion', 215, P, '#12263A'); t('This certifies that', 310, P, '#12263A');
  t(myName(), 410, '800 68px "Bricolage Grotesque",sans-serif', '#12263A');
  t('has completed all videos in the course', 490, P, '#12263A'); t(c.title, 565, '800 46px "Bricolage Grotesque",sans-serif', '#0E7C7B');
  t('Completed on ' + new Date(e.completedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), 670, '22px system-ui,sans-serif', '#5b6b7a');
  t('Certificate ID: ' + e.certId, 710, '22px system-ui,sans-serif', '#5b6b7a');
  t('Verify at the SkillBridge website using this ID', 750, '18px system-ui,sans-serif', '#5b6b7a');
  $('#dl').onclick = () => { const a = document.createElement('a'); a.download = `SkillBridge-${c.id}-certificate.png`; a.href = $('#cv').toDataURL('image/png'); a.click(); };
}

async function verify(id) {
  $('#app').innerHTML = '<h1>Certificate check</h1><p>Checking…</p>';
  try {
    const s = id && await getDoc(doc(db, 'certificates', id));
    $('#app').innerHTML = '<h1>Certificate check</h1>' + (s && s.exists() ? `<div class="banner"><strong>Valid certificate.</strong> ${esc(s.data().name)} completed “${esc(s.data().course)}” on ${new Date(s.data().issuedAt).toLocaleDateString('en-GB')}.</div>` : '<p>No certificate found with this ID. Check the ID and try again.</p>');
  } catch (er) { $('#app').innerHTML = '<h1>Certificate check</h1><p>Could not check right now. Please try again.</p>'; }
}

/* ---------- Login and sign-up modal ---------- */
let mode = 'login';
const MSG = { 'auth/invalid-credential': 'Wrong email or password.', 'auth/email-already-in-use': 'This email is already registered. Try logging in.', 'auth/weak-password': 'Use a password with at least 6 characters.', 'auth/popup-closed-by-user': 'Google sign-in was closed before finishing.', 'auth/unauthorized-domain': 'This website address is not authorised in Firebase yet.' };
const say = (m, ok) => { $('#err').textContent = m; $('#err').className = 'err' + (ok ? ' ok' : ''); };
function setMode(m) { mode = m; $('#tLogin').classList.toggle('on', m === 'login'); $('#tSign').classList.toggle('on', m === 'sign'); $('#nameRow').hidden = m === 'login'; $('#fName').required = m === 'sign'; $('#fGo').textContent = m === 'login' ? 'Log in' : 'Create account'; say(''); }
function openM() { $('#modal').hidden = false; $('#fEmail').focus(); }
const done = () => { $('#modal').hidden = true; $('#authForm').reset(); render(); };
$('#tLogin').onclick = () => setMode('login'); $('#tSign').onclick = () => setMode('sign');
$('#fCancel').onclick = () => $('#modal').hidden = true;
$('#authForm').onsubmit = async ev => {
  ev.preventDefault(); say('');
  const em = $('#fEmail').value.trim(), pw = $('#fPass').value;
  try {
    let c;
    if (mode === 'login') c = await signInWithEmailAndPassword(auth, em, pw);
    else { c = await createUserWithEmailAndPassword(auth, em, pw); await updateProfile(c.user, { displayName: $('#fName').value.trim() }); }
    await recordLogin(c.user); done();
  } catch (er) { say(MSG[er.code] || er.message); }
};
$('#gBtn').onclick = async () => {
  try { const c = await signInWithPopup(auth, new GoogleAuthProvider()); await recordLogin(c.user); done(); } catch (er) { say(MSG[er.code] || er.message); }
};
$('#forgot').onclick = async ev => {
  ev.preventDefault();
  const em = $('#fEmail').value.trim();
  if (!em) return say('Type your email above first, then click this link again.');
  try { await sendPasswordResetEmail(auth, em); say('Reset link sent. Check your inbox and spam folder.', true); } catch (er) { say(MSG[er.code] || er.message); }
};
