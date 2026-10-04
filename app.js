/* SkillBridge, no-database version: progress is saved in this browser (localStorage). */
import { COURSES } from './courses.js';
import { ytId } from './youtube.js';

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ls = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v === null ? d : v; } catch (e) { return d; } };
const st = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

const S = { enr: ls('sb_enr', {}), name: ls('sb_name', '') };
const F = { q: '', cat: 'All' };
const CATS = ['All', ...new Set(COURSES.map(c => c.cat))];
const course = id => COURSES.find(c => c.id === id);
const mins = c => c.videos.reduce((a, x) => a + x.m, 0);
const save = () => st('sb_enr', S.enr);
let player = null, CUR = { cid: null, i: 0 };

COURSES.forEach(c => c.videos.forEach(x => x.id = ytId(x.y)));   // read every link once

/* YouTube IFrame API */
const ytReady = new Promise(r => window.onYouTubeIframeAPIReady = r);
const yt = document.createElement('script'); yt.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(yt);

addEventListener('hashchange', render);
render();

function render() {
  $('#auth').innerHTML = `<button class="alt" id="nm" style="color:#fff">${S.name ? esc(S.name) : 'Set your name'}</button>`;
  $('#nm').onclick = askName;
  player = null;
  const [, r, a] = (location.hash || '#/').slice(1).split('/');
  if (r === 'courses') return catalogue();
  if (r === 'course') return detail(course(a));
  if (r === 'learn') return learn(course(a));
  if (r === 'dashboard') return dash();
  if (r === 'cert') return certPage(course(a));
  home();
}
function askName() {
  const n = (prompt('Your full name (it is printed on your certificate):', S.name) || '').trim();
  if (n) { S.name = n; st('sb_name', n); render(); }
  return S.name;
}

/* ---------- Pages ---------- */
const bar = (c, big) => { const d = (S.enr[c.id] || {}).done || []; return `<div class="span ${big ? 'big' : ''}" role="img" aria-label="${d.length} of ${c.videos.length} videos done">${c.videos.map((_, i) => `<i class="${d.includes(i) ? 'on' : ''}"></i>`).join('')}</div>`; };
const card = c => `<div class="card"><div class="ico">${c.ico}</div><h3>${c.title}</h3><p class="tag">${c.cat} · ${c.level} · ${c.videos.length} videos · ${mins(c)} min</p><p>${c.desc}</p>${S.enr[c.id] ? bar(c) : ''}<a class="btn" href="#/course/${c.id}">${S.enr[c.id] ? 'Continue' : 'View course'}</a></div>`;

function home() {
  $('#app').innerHTML = `<section class="hero"><h1>Learn a digital skill. Get hired.</h1><p>Free video courses for young people looking for their first digital job. Watch the lessons right here and earn a certificate.</p><a class="btn" href="#/courses">Browse courses</a></section><h2>Popular courses</h2><div class="grid">${COURSES.slice(0, 3).map(card).join('')}</div>`;
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
  <p><button id="go">${e ? (e.completed ? 'Watch again' : 'Continue learning') : 'Start course'}</button></p>
  <h2>What you will learn</h2><ul class="list">${c.videos.map((x, i) => `<li class="${e && e.done.includes(i) ? 'ok' : ''}"><span class="n">${e && e.done.includes(i) ? '✓' : i + 1}</span>${esc(x.t)}<span class="tag">${x.m} min</span></li>`).join('')}</ul>`;
  $('#go').onclick = () => {
    if (!e) { S.enr[c.id] = { course: c.title, done: [], total: c.videos.length, last: 0, completed: false, enrolledAt: new Date().toISOString() }; save(); }
    location.hash = '#/learn/' + c.id;
  };
}

/* ---------- Video player ---------- */
function learn(c) {
  if (!c) return location.hash = '#/courses';
  if (!S.enr[c.id]) return location.hash = '#/course/' + c.id;
  CUR = { cid: c.id, i: Math.min(S.enr[c.id].last || 0, c.videos.length - 1) };
  $('#app').innerHTML = `<p><a href="#/course/${c.id}">← ${esc(c.title)}</a></p><h1 id="vt"></h1><div id="prog"></div>
  <div class="play"><div><div class="vid"><div id="player"></div></div><p class="err" id="verr" role="alert"></p>
  <p><button id="mark">Mark this video as done</button> <span class="tag">The next lesson starts automatically when a video ends.</span></p></div>
  <div><h3>Playlist</h3><ul class="list pick" id="pl"></ul></div></div>`;
  paint(c);
  $('#mark').onclick = () => complete(CUR.i);
  mount(c);
}

function mount(c) {
  const x = c.videos[CUR.i];
  if (!x.id) { $('.vid').innerHTML = '<p style="color:#fff;padding:20px">This lesson\'s YouTube link is not valid. Check it in js/courses.js.</p>'; return; }
  const fallback = () => { if ($('.vid')) $('.vid').innerHTML = `<iframe style="border:0" src="https://www.youtube-nocookie.com/embed/${x.id}?rel=0&playsinline=1" title="${esc(x.t)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`; };
  Promise.race([ytReady, new Promise(r => setTimeout(r, 5000))]).then(() => {
    if (!$('#player')) return;                                    // user left the page
    if (!window.YT || !window.YT.Player) return fallback();       // API blocked or slow: plain embed
    player = new YT.Player('player', {
      width: '100%', height: '100%', videoId: x.id,
      playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
      events: {
        onStateChange: ev => { if (ev.data === 0) onEnd(); },
        onError: () => { $('#verr').textContent = 'This video cannot be played here. It may be private, removed, or the owner turned off embedding. Try another link.'; }
      }
    });
  });
}
function play(i) {
  const c = course(CUR.cid);
  CUR.i = i; S.enr[c.id].last = i; save();
  $('#verr').textContent = '';
  const id = c.videos[i].id;
  if (player && player.loadVideoById && id) player.loadVideoById(id);
  paint(c);
}
function onEnd() {
  const c = course(CUR.cid);
  complete(CUR.i);
  if (CUR.i < c.videos.length - 1) play(CUR.i + 1);
}
function paint(c) {
  const e = S.enr[c.id];
  $('#vt').textContent = c.videos[CUR.i].t;
  $('#prog').innerHTML = bar(c, true) + (e.completed ? `<div class="banner"><strong>Course complete.</strong> Your certificate is ready.<a class="btn" href="#/cert/${c.id}">View certificate</a></div>` : '');
  $('#pl').innerHTML = c.videos.map((x, i) => `<li tabindex="0" data-i="${i}" class="${i === CUR.i ? 'cur' : ''} ${e.done.includes(i) ? 'ok' : ''}"><span class="n">${e.done.includes(i) ? '✓' : i + 1}</span>${x.id ? `<img src="https://i.ytimg.com/vi/${x.id}/default.jpg" alt="" width="64" style="border-radius:4px">` : ''}<span>${esc(x.t)}</span><span class="tag">${x.m} min</span></li>`).join('');
  document.querySelectorAll('#pl li').forEach(li => {
    li.onclick = () => play(+li.dataset.i);
    li.onkeydown = ev => { if (ev.key === 'Enter') play(+li.dataset.i); };
  });
}
function complete(i) {
  const c = course(CUR.cid), e = S.enr[c.id];
  if (e.done.includes(i)) return;
  e.done.push(i);
  if (e.done.length === c.videos.length) { e.completed = true; e.certId = 'SB-' + Date.now().toString(36).toUpperCase(); e.completedAt = new Date().toISOString(); }
  save(); paint(c);
}

/* ---------- Dashboard and certificate ---------- */
function dash() {
  const mine = COURSES.filter(c => S.enr[c.id]), certs = mine.filter(c => S.enr[c.id].completed);
  $('#app').innerHTML = `<h1>My learning</h1><div class="stats"><div><b>${mine.length}</b>courses started</div><div><b>${certs.length}</b>certificates earned</div></div>
  <h2>My courses</h2>${mine.length ? `<div class="grid">${mine.map(card).join('')}</div>` : '<p>You have not started a course yet. <a href="#/courses">Find a course</a></p>'}
  ${certs.length ? `<h2 style="margin-top:32px">My certificates</h2><ul class="list">${certs.map(c => `<li>${esc(c.title)}<span class="tag"><a href="#/cert/${c.id}">Open</a></span></li>`).join('')}</ul>` : ''}`;
}

function certPage(c) {
  const e = c && S.enr[c.id];
  if (!e || !e.completed) return $('#app').innerHTML = '<h1>Certificate</h1><p>Finish every video in a course to unlock its certificate.</p>';
  if (!S.name && !askName()) return $('#app').innerHTML = '<h1>Certificate</h1><p>Set your name with the button at the top, then reopen this page.</p>';
  $('#app').innerHTML = `<h1>Your certificate</h1><canvas id="cv" width="1200" height="850"></canvas><p><button id="dl">Download PNG</button> <button class="alt" onclick="print()" style="color:var(--ink)">Print</button></p>`;
  const x = $('#cv').getContext('2d'); x.textAlign = 'center';
  const t = (txt, y, font, col) => { x.font = font; x.fillStyle = col; x.fillText(txt, 600, y); };
  x.fillStyle = '#fff'; x.fillRect(0, 0, 1200, 850);
  x.strokeStyle = '#12263A'; x.lineWidth = 14; x.strokeRect(30, 30, 1140, 790);
  x.strokeStyle = '#FFC93C'; x.lineWidth = 4; x.strokeRect(58, 58, 1084, 734);
  const H = '800 54px "Bricolage Grotesque",sans-serif', P = '28px system-ui,sans-serif';
  t('SkillBridge', 150, H, '#12263A'); t('Certificate of completion', 215, P, '#12263A'); t('This certifies that', 310, P, '#12263A');
  t(S.name, 410, '800 68px "Bricolage Grotesque",sans-serif', '#12263A');
  t('has completed all videos in the course', 490, P, '#12263A'); t(c.title, 565, '800 46px "Bricolage Grotesque",sans-serif', '#0E7C7B');
  t('Completed on ' + new Date(e.completedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), 670, '22px system-ui,sans-serif', '#5b6b7a');
  t('Certificate ID: ' + e.certId, 710, '22px system-ui,sans-serif', '#5b6b7a');
  $('#dl').onclick = () => { const a = document.createElement('a'); a.download = `SkillBridge-${c.id}-certificate.png`; a.href = $('#cv').toDataURL('image/png'); a.click(); };
}
