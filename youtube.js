// Reads one YouTube link and says what it is:
//   {list: 'PL...'}  -> a playlist (all its videos play in order)
//   {id: 'abc...'}   -> a single video
//   null             -> not a valid YouTube link
const isId = s => /^[\w-]{11}$/.test(s || '');

export function ytId(input) {
  const s = String(input || '').trim();
  if (isId(s)) return s;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s);
    const host = u.hostname.replace(/^(www\.|m\.|music\.)/, '');
    let id = null;
    if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      id = u.searchParams.get('v');
      if (!id) { const m = u.pathname.match(/^\/(embed|shorts|live|v)\/([\w-]{11})/); if (m) id = m[2]; }
    }
    return isId(id) ? id : null;
  } catch (e) { return null; }
}

export function ytInfo(input) {
  const s = String(input || '').trim();
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s);
    const list = u.searchParams.get('list');
    // playlist links; "RD..." are auto-made mixes that cannot be embedded, so they are treated as single videos
    if (list && /^[\w-]{10,}$/.test(list) && !list.startsWith('RD')) return { list };
  } catch (e) {}
  const id = ytId(s);
  return id ? { id } : null;
}
