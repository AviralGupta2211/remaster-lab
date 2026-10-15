(function () {
'use strict';
var $ = function (id) { return document.getElementById(id); };
var STEMS = ['vocals', 'drums', 'bass', 'other'];
var STEM_LABEL = { vocals: 'Vocals', drums: 'Drums', bass: 'Bass', other: 'Other' };
var PARAMS = [
  { k: 'gain', label: 'Gain', min: -24, max: 12, step: 0.5, def: 0, unit: ' dB' },
  { k: 'low', label: 'Low', min: -12, max: 12, step: 0.5, def: 0, unit: ' dB' },
  { k: 'mid', label: 'Mid', min: -12, max: 12, step: 0.5, def: 0, unit: ' dB' },
  { k: 'high', label: 'High', min: -12, max: 12, step: 0.5, def: 0, unit: ' dB' },
  { k: 'crunch', label: 'Crunch', min: 0, max: 100, step: 1, def: 0, unit: '%' },
  { k: 'punch', label: 'Punch', min: 0, max: 100, step: 1, def: 0, unit: '%' },
  { k: 'width', label: 'Width', min: 0, max: 200, step: 1, def: 100, unit: '%' },
  { k: 'reverb', label: 'Reverb', min: 0, max: 100, step: 1, def: 0, unit: '%' },
  { k: 'decay', label: 'Decay', min: 0, max: 100, step: 1, def: 40, unit: '' }
];
var MPARAMS = [
  { k: 'low', label: 'Low', min: -12, max: 12, step: 0.5, def: 0, unit: ' dB' },
  { k: 'mid', label: 'Mid', min: -12, max: 12, step: 0.5, def: 0, unit: ' dB' },
  { k: 'high', label: 'High', min: -12, max: 12, step: 0.5, def: 0, unit: ' dB' },
  { k: 'out', label: 'Output', min: -12, max: 6, step: 0.5, def: 0, unit: ' dB' }
];
var PADMAP = {
  vocals: { x: { neg: 'Close & dry', pos: 'Big & airy', map: { reverb: [0, 60], decay: [-25, 40], width: [-30, 50] } },
            y: { neg: 'Warm', pos: 'Bright & forward', map: { low: [4, -3], mid: [-2, 3], high: [-4, 6], punch: [0, 40] } } },
  drums:  { x: { neg: 'Tight', pos: 'Roomy', map: { reverb: [0, 40], decay: [-30, 20], width: [-20, 40] } },
            y: { neg: 'Soft', pos: 'Punchy & crunchy', map: { punch: [0, 80], crunch: [0, 45], low: [-3, 4], high: [-4, 4] } } },
  bass:   { x: { neg: 'Round & clean', pos: 'Gritty', map: { crunch: [0, 80], mid: [-3, 5], high: [-3, 3] } },
            y: { neg: 'Lean', pos: 'Heavy', map: { low: [-6, 8], punch: [0, 50], width: [0, -40] } } },
  other:  { x: { neg: 'Narrow', pos: 'Wide', map: { width: [-60, 100], reverb: [0, 35], decay: [0, 20] } },
            y: { neg: 'Dark', pos: 'Shimmering', map: { high: [-6, 6], low: [3, -3], mid: [-2, 2] } } },
  master: { x: { neg: 'Dark', pos: 'Bright', map: { low: [3, -2], mid: [-1, 1], high: [-4, 4] } },
            y: { neg: 'Gentle', pos: 'Loud', map: { out: [-6, 4] } } }
};
var rackMode = 'pads';
try { var _m = localStorage.getItem('rl-mode'); if (_m === 'pads' || _m === 'sliders') rackMode = _m; } catch (e) {}
var BAND_FILTERS = [['lowshelf', 60, 0], ['peaking', 150, 0.9], ['peaking', 350, 1.0], ['peaking', 1000, 0.8], ['peaking', 3500, 0.8], ['highshelf', 8000, 0]];
var ZONE_SLOTS = { mix: 12, vocals: 6, drums: 6, bass: 6, other: 6 };
var MOTION_RATE = 50; // trajectory points per second
function defMotionStem(i) { return { mode: 'off', period: 16, sync: 0, dir: 1, width: 70, elev: 0, offset: [0, 90, 180, 270][i % 4], react: 0 }; }
function defMotion() { var m = { depth: 100, room: 25, focus: 0, ears: 50, stems: {} }; STEMS.forEach(function (s, i) { m.stems[s] = defMotionStem(i); }); return m; }
function motionOn() { var M = S.recipe && S.recipe.motion; return !!M && STEMS.some(function (s) { return M.stems[s].mode !== 'off'; }); }
function freshBands() { return [0, 0, 0, 0, 0, 0]; }
function zoneFQ(z) { if (z.kind === 'note') return { f: z.f, q: 18 }; var f = Math.sqrt(z.fLo * z.fHi); return { f: f, q: clamp(f / Math.max(1, z.fHi - z.fLo), 0.3, 12) }; }
function defStem() { var o = { mute: false, pad: { x: 0, y: 0 } }; PARAMS.forEach(function (p) { o[p.k] = p.def; }); return o; }
function defMaster() { return { low: 0, mid: 0, high: 0, out: 0, limiter: true, pad: { x: 0, y: 0 } }; }
function uid() { return Math.random().toString(36).slice(2, 10); }
function db2g(db) { return Math.pow(10, db / 20); }
function fmt(t, dec) { t = Math.max(0, t || 0); var m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(dec == null ? 1 : dec); }
function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
var toastT;
function toast(msg) { var el = $('toast'); el.textContent = msg; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { el.hidden = true; }, 3200); }
function status(msg, p) { $('statusText').textContent = msg; $('progBar').style.width = (p == null ? 0 : Math.round(p * 100)) + '%'; }

// ---------- storage (IndexedDB, falls back to memory) ----------
var Store = (function () {
  var mem = { songs: {}, recipes: {}, renders: {} }, dbp = null;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise(function (res) {
      try {
        var rq = indexedDB.open('remaster-lab', 1);
        rq.onupgradeneeded = function () { var d = rq.result; ['songs', 'recipes', 'renders'].forEach(function (s) { if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: 'id' }); }); };
        rq.onsuccess = function () { res(rq.result); };
        rq.onerror = function () { res(null); };
      } catch (e) { res(null); }
    });
    return dbp;
  }
  function tx(store, mode, fn) {
    return open().then(function (d) {
      if (!d) return fn(null);
      return new Promise(function (res, rej) {
        try { var t = d.transaction(store, mode), s = t.objectStore(store), out = fn(s); t.oncomplete = function () { res(out && out.result !== undefined ? out.result : out); }; t.onerror = function () { rej(t.error); }; }
        catch (e) { rej(e); }
      });
    });
  }
  return {
    all: function (store) { return tx(store, 'readonly', function (s) { if (!s) return { result: Object.values(mem[store]) }; return s.getAll(); }).catch(function () { return Object.values(mem[store]); }); },
    put: function (store, v) { mem[store][v.id] = v; return tx(store, 'readwrite', function (s) { if (s) s.put(v); }).catch(function () {}); },
    del: function (store, id) { delete mem[store][id]; return tx(store, 'readwrite', function (s) { if (s) s.delete(id); }).catch(function () {}); }
  };
})();

// ---------- worker ----------
var worker = null, jobs = {}, jobN = 0;
function getWorker() {
  if (worker) return worker;
  var src = $('dsp-src').textContent;
  worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
  worker.onmessage = function (e) {
    var j = jobs[e.data.id]; if (!j) return;
    if (e.data.progress != null) { j.onp && j.onp(e.data.progress); return; }
    delete jobs[e.data.id];
    if (e.data.error) j.rej(new Error(e.data.error)); else j.res(e.data.result);
  };
  return worker;
}
function run(type, payload, transfer, onp) {
  return new Promise(function (res, rej) {
    var id = ++jobN; jobs[id] = { res: res, rej: rej, onp: onp };
    payload.id = id; payload.type = type;
    try { getWorker().postMessage(payload, transfer || []); }
    catch (e) { delete jobs[id]; rej(e); }
  });
}

// ---------- state ----------
var ctx = null;
function getCtx() { if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)(); return ctx; }
var S = {
  song: null,      // {id, title, sr, duration, orig, mono, stems:{}, analysis, fp, stemSource}
  recipe: null,    // {master, regions:[]}
  sel: 0, ab: 'B', loop: false, solo: {},
  playing: false, pos: 0, ctxStart: 0, startPos: 0, graph: null, origNodes: null,
  library: [], index: new Map(), versions: [], renders: [],
  peaks: {}
};

// ---------- demo track ----------
function makeDemo() {
  var c = getCtx(), sr = c.sampleRate, dur = 36, n = Math.floor(sr * dur);
  var buf = c.createBuffer(2, n, sr), L = buf.getChannelData(0), R = buf.getChannelData(1);
  var seed = 11; function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
  var bpm = 112, beat = 60 / bpm, i, t;
  function add(arr, s0, v) { if (s0 >= 0 && s0 < n) arr[s0] += v; }
  var chords = [[220, 261.63, 329.63], [174.61, 220, 261.63], [196, 246.94, 293.66], [164.81, 207.65, 246.94]];
  var bassN = [55, 43.65, 49, 41.2];
  var mel = [659.25, 587.33, 523.25, 587.33, 659.25, 783.99, 659.25, 587.33];
  var ph = 0, ph2 = 0;
  for (i = 0; i < n; i++) {
    t = i / sr; var bar = Math.floor(t / (4 * beat)) % 4, sec = t < 8.6 ? 0 : t < 21.4 ? 1 : 2;
    var ch = chords[bar], pad = 0, padR = 0;
    for (var k = 0; k < 3; k++) { pad += Math.sin(2 * Math.PI * ch[k] * t + k) ; padR += Math.sin(2 * Math.PI * ch[k] * 1.004 * t + k * 2); }
    var pg = sec === 2 ? 0.06 : 0.04;
    L[i] += pg * pad; R[i] += pg * padR;
    if (sec > 0) { var bf = bassN[bar], env = 1 - 0.5 * ((t / beat) % 1); var b = 0.32 * env * (Math.sin(2 * Math.PI * bf * t) + 0.3 * Math.sin(4 * Math.PI * bf * t)); L[i] += b; R[i] += b; }
    if (sec > 0) {
      var step = Math.floor(t / (beat / 2)), f = mel[step % 8] * (sec === 2 ? 1.5 : 1) * (1 + 0.005 * Math.sin(2 * Math.PI * 5.4 * t));
      ph += 2 * Math.PI * f / sr; var noteT = (t % (beat / 2)) / (beat / 2), a = Math.min(1, noteT * 12) * (1 - 0.35 * noteT);
      var v = 0.13 * a * (Math.sin(ph) + 0.6 * Math.sin(2 * ph) + 0.35 * Math.sin(3 * ph) + 0.2 * Math.sin(4 * ph));
      L[i] += v; R[i] += v;
    }
  }
  var beats = Math.floor(dur / beat);
  for (var bt = 0; bt < beats; bt++) {
    var tb = bt * beat, s0 = Math.round(tb * sr), sec2 = tb < 8.6 ? 0 : tb < 21.4 ? 1 : 2;
    if (sec2 > 0) for (i = 0; i < sr * 0.3; i++) { t = i / sr; var fk = 48 + 90 * Math.exp(-t * 35), kv = 0.7 * Math.sin(2 * Math.PI * fk * t) * Math.exp(-t * 9); add(L, s0 + i, kv); add(R, s0 + i, kv); }
    if (sec2 === 2 && bt % 2 === 1) for (i = 0; i < sr * 0.18; i++) { t = i / sr; var sv = (0.25 * (rnd() * 2 - 1) + 0.2 * Math.sin(2 * Math.PI * 190 * t)) * Math.exp(-t * 22); add(L, s0 + i, sv); add(R, s0 + i, sv); }
    for (var hh = 0; hh < 2; hh++) { var h0 = Math.round((tb + hh * beat / 2 + beat / 4) * sr); for (i = 0; i < sr * 0.05; i++) { var hv = 0.12 * (rnd() * 2 - 1) * Math.exp(-i / sr * 80); add(L, h0 + i, hv * 0.7); add(R, h0 + i, hv); } }
  }
  var pk = 0; for (i = 0; i < n; i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i]));
  var g = 0.89 / pk; for (i = 0; i < n; i++) { L[i] *= g; R[i] *= g; }
  // gentle fade
  for (i = 0; i < sr * 0.5; i++) { var fo = i / (sr * 0.5); L[n - 1 - i] *= fo; R[n - 1 - i] *= fo; }
  return buf;
}

// ---------- loading pipeline ----------
var loadToken = 0;
function loadBuffer(buf, title) {
  var my = ++loadToken;
  stop(true);
  if (worker && Object.keys(jobs).length) { worker.terminate(); worker = null; jobs = {}; }
  if (aiBusy && aiWorker) { aiWorker.terminate(); aiWorker = null; aiBusy = false; aiUI(false); }
  if (buf.numberOfChannels === 1) { var b2 = getCtx().createBuffer(2, buf.length, buf.sampleRate); b2.copyToChannel(buf.getChannelData(0), 0); b2.copyToChannel(buf.getChannelData(0), 1); buf = b2; }
  var L = buf.getChannelData(0), R = buf.getChannelData(1), mono = new Float32Array(buf.length);
  for (var i = 0; i < mono.length; i++) mono[i] = 0.5 * (L[i] + R[i]);
  S.song = { id: null, title: title, sr: buf.sampleRate, duration: buf.duration, orig: buf, mono: mono, stems: null, analysis: null, fp: null, stemSource: null };
  S.recipe = { master: defMaster(), zones: [], motion: defMotion(), regions: [{ id: uid(), name: 'Whole song', start: 0, end: buf.duration, stems: freshStems(), bands: freshBands() }] };
  S.sel = 0; S.pos = 0; S.solo = {}; S.peaks = { orig: peaksOf(buf) }; S.wc = waveColors(buf); ovImg = null;
  $('songTitle').textContent = title;
  renderChips(); renderRack(); renderSpace(); drawAll(); enableUI();
  status('Analysing the song…', 0.02);
  var monoCopy = mono.slice(0);
  return run('analyze', { mono: monoCopy, sr: buf.sampleRate }, [monoCopy.buffer], function (p) { if (my === loadToken) status('Analysing the song…', p * 0.3); })
    .then(function (r) {
      if (my !== loadToken) return;
      S.song.analysis = r.analysis; S.song.fp = r.fp;
      seedRegions();
      return identifyOrAdd().then(function () {
        renderSongList(); renderChips(); drawAll(); renderRack(); refreshVersions();
        status('Splitting into stems…', 0.32);
        var Lc = L.slice(0), Rc = R.slice(0);
        return run('separate', { L: Lc, R: Rc, sr: buf.sampleRate }, [Lc.buffer, Rc.buffer], function (p) { if (my === loadToken) status('Splitting into stems… ' + Math.round(p * 100) + '%', 0.32 + p * 0.66); });
      });
    })
    .then(function (st) {
      if (!st || my !== loadToken) return;
      setStems(st, 'DSP estimate');
      status('Ready. Shape a region, then press Play.', 1);
      setTimeout(function () { if (my === loadToken) status('Ready', 0); }, 2500);
    })
    .catch(function (e) { console.error(e); status('Something went wrong: ' + e.message, 0); });
}
function setStems(st, label) {
  var c = getCtx(), len = S.song.orig.length, sr = S.song.sr;
  S.song.stems = {};
  STEMS.forEach(function (s) {
    var b = c.createBuffer(2, len, sr); b.copyToChannel(st[s][0], 0); b.copyToChannel(st[s][1], 1);
    S.song.stems[s] = b; S.peaks[s] = peaksOf(b);
  });
  S.song.stemSource = label; S.env = stemEnvelopes(); motionCache = {};
  $('stemSrc').textContent = 'Stems: ' + label;
  enableUI(); drawTimeline(); renderChips(); renderSpace();
}
function freshStems() { var o = {}; STEMS.forEach(function (s) { o[s] = defStem(); }); return o; }
function seedRegions() {
  var a = S.song.analysis; if (!a) return;
  var count = {};
  S.recipe.regions = a.sections.map(function (sg) {
    count[sg.label] = (count[sg.label] || 0) + 1;
    return { id: uid(), name: 'Section ' + sg.label + (count[sg.label] > 1 ? count[sg.label] : ''), start: sg.start, end: sg.end, stems: freshStems(), bands: freshBands() };
  });
  S.recipe.regions[0].start = 0; S.recipe.regions[S.recipe.regions.length - 1].end = S.song.duration;
  S.sel = 0;
}
function decodeFile(file) {
  return file.arrayBuffer().then(function (ab) {
    return new Promise(function (res, rej) { getCtx().decodeAudioData(ab, res, function () { rej(new Error('This file could not be decoded. Try MP3, WAV, FLAC or M4A.')); }); });
  });
}
function openFile(file) {
  if (!file) return;
  status('Decoding ' + file.name + '…', 0.01);
  decodeFile(file).then(function (buf) {
    if (buf.duration > 900) { status('That file is over 15 minutes; try a single song.', 0); return; }
    loadBuffer(buf, file.name.replace(/\.[^.]+$/, ''));
  }).catch(function (e) { status(e.message, 0); });
}

// ---------- fingerprint library ----------
function indexSong(song) {
  for (var i = 0; i < song.hashes.length; i++) {
    var h = song.hashes[i], l = S.index.get(h); if (!l) { l = []; S.index.set(h, l); }
    l.push(song.id, song.times[i]);
  }
}
function rebuildIndex() { S.index = new Map(); S.library.forEach(indexSong); }
function matchHashes(fp) {
  var votes = new Map(), perSong = {};
  for (var i = 0; i < fp.hashes.length; i++) {
    var l = S.index.get(fp.hashes[i]); if (!l) continue;
    for (var j = 0; j < l.length; j += 2) { var key = l[j] + '|' + (l[j + 1] - fp.times[i]); votes.set(key, (votes.get(key) || 0) + 1); }
  }
  votes.forEach(function (v, key) {
    var p = key.split('|'), sid = p[0], off = +p[1];
    var ps = perSong[sid] || (perSong[sid] = { id: sid, best: 0, off: 0, hist: new Map() });
    ps.hist.set(off, v);
  });
  var ranked = Object.values(perSong).map(function (ps) {
    ps.hist.forEach(function (v, off) { var s = v + (ps.hist.get(off - 1) || 0) + (ps.hist.get(off + 1) || 0); if (s > ps.best) { ps.best = s; ps.off = off; } });
    return ps;
  }).sort(function (a, b) { return b.best - a.best; });
  var top = ranked[0], second = ranked[1];
  if (!top) return { match: null, total: fp.hashes.length };
  var song = S.library.find(function (s) { return s.id === top.id; });
  var ok = top.best >= 12 && (!second || top.best >= 2 * second.best);
  return { match: ok ? song : null, best: song, votes: top.best, runnerUp: second ? second.best : 0, offset: top.off / fp.fps, hist: top.hist, total: fp.hashes.length, fps: fp.fps };
}
function identifyOrAdd() {
  var fp = S.song.fp, r = matchHashes(fp);
  if (r.match && Math.abs(r.match.duration - S.song.duration) < 3) {
    S.song.id = r.match.id; S.song.recognised = r.match.title;
    if (r.match.title !== S.song.title) toast('Recognised as "' + r.match.title + '" from your library');
    return Promise.resolve();
  }
  var rec = { id: 'song_' + uid(), title: S.song.title, duration: S.song.duration, added: Date.now(), hashes: fp.hashes, times: fp.times };
  S.song.id = rec.id; S.song.recognised = null;
  S.library.push(rec); indexSong(rec); renderSongList();
  return Store.put('songs', rec);
}
function renderSongList() {
  var el = $('songList'); el.innerHTML = '';
  if (!S.library.length) { el.innerHTML = '<div class="empty">No songs yet.</div>'; return; }
  S.library.slice().sort(function (a, b) { return b.added - a.added; }).forEach(function (s) {
    var it = document.createElement('div'); it.className = 'item';
    var m = document.createElement('div'); m.className = 'meta';
    var d = document.createElement('div'); d.textContent = s.title; m.appendChild(d);
    var sm = document.createElement('small'); sm.textContent = fmt(s.duration, 0) + ' · ' + s.hashes.length.toLocaleString() + ' hashes' + (S.song && S.song.id === s.id ? ' · loaded' : ''); m.appendChild(sm);
    var del = document.createElement('button'); del.className = 'btn small'; del.textContent = 'Remove';
    del.onclick = function () { S.library = S.library.filter(function (x) { return x.id !== s.id; }); rebuildIndex(); Store.del('songs', s.id); renderSongList(); };
    it.appendChild(m); it.appendChild(del); el.appendChild(it);
  });
}

// ---------- audio engine ----------
var irCache = new WeakMap();
function makeIR(c, seconds) {
  var m = irCache.get(c) || {}; irCache.set(c, m);
  if (m[seconds]) return m[seconds];
  var sr = c.sampleRate, n = Math.floor(sr * seconds), b = c.createBuffer(2, n, sr), seed = Math.round(seconds * 1000);
  function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; }
  for (var ch = 0; ch < 2; ch++) {
    var d = b.getChannelData(ch), lp = 0;
    for (var i = 0; i < n; i++) { var t = i / sr, env = Math.pow(0.001, t / seconds) * Math.min(1, t * 200); lp += (rnd() - lp) * (0.55 - 0.35 * t / seconds); d[i] = lp * env; }
  }
  m[seconds] = b; return b;
}
var SHAPER = (function () { var n = 2048, c = new Float32Array(n); for (var i = 0; i < n; i++) { var x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(x * 3) / Math.tanh(3); } return c; })();
function stemTargets(st, soloed, isSolo, forExport) {
  var w = st.width / 100, c = st.crunch / 100, p = st.punch / 100, r = st.reverb / 100, d = st.decay / 100;
  var pre = 1 + 14 * c;
  var silent = st.mute || (!forExport && soloed && !isSolo);
  return {
    aa: (1 + w) / 2, bb: (1 - w) / 2, low: st.low, mid: st.mid, high: st.high,
    clean: 1 - 0.55 * c, pre: pre, wet: c * 0.75 / Math.pow(pre, 0.35),
    thr: -p * 30, ratio: 1 + p * 7,
    fader: silent ? 0 : db2g(st.gain + p * 6),
    s0: r * Math.max(0, 1 - 2 * d) * 0.9, s1: r * (1 - Math.abs(2 * d - 1)) * 0.9, s2: r * Math.max(0, 2 * d - 1) * 0.9
  };
}
function masterTargets(m) { return { low: m.low, mid: m.mid, high: m.high, thr: m.limiter ? -1.5 : 0, ratio: m.limiter ? 20 : 1, out: db2g(m.out) }; }
function buildGraph(c, dest, offset, when, opts) {
  var g = { stems: {}, sources: [] }, song = S.song;
  function bq(type, f, q) { var b = c.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q) b.Q.value = q; return b; }
  var mIn = c.createGain(), mL = bq('lowshelf', 120), mM = bq('peaking', 1000, 0.7), mH = bq('highshelf', 6000), lim = c.createDynamicsCompressor(), out = c.createGain();
  lim.knee.value = 0; lim.attack.value = 0.003; lim.release.value = 0.12;
  var bandNodes = BAND_FILTERS.map(function (b) { return bq(b[0], b[1], b[2]); });
  var mixZones = []; for (var zi = 0; zi < ZONE_SLOTS.mix; zi++) { var zf = bq('peaking', 1000, 1); zf.gain.value = 0; mixZones.push(zf); }
  var chain = [mIn, mL, mM, mH].concat(bandNodes, mixZones, [lim, out]);
  for (var ci = 0; ci < chain.length - 1; ci++) chain[ci].connect(chain[ci + 1]);
  out.connect(dest);
  g.bands = bandNodes.map(function (n) { return n.gain; });
  g.zones = { mix: mixZones };
  g.master = { low: [mL.gain], mid: [mM.gain], high: [mH.gain], thr: [lim.threshold], ratio: [lim.ratio], out: [out.gain] };
  g.out = out;
  var revs = [0.6, 1.8, 4.0].map(function (sec) { var cv = c.createConvolver(); cv.buffer = makeIR(c, sec); var rg = c.createGain(); rg.gain.value = 0.6; cv.connect(rg); rg.connect(mIn); return cv; });
  STEMS.forEach(function (s) {
    var src = c.createBufferSource(); src.buffer = song.stems[s];
    var sp = c.createChannelSplitter(2), mg = c.createChannelMerger(2);
    var gLL = c.createGain(), gRL = c.createGain(), gRR = c.createGain(), gLR = c.createGain();
    src.connect(sp); sp.connect(gLL, 0); sp.connect(gRL, 1); sp.connect(gRR, 1); sp.connect(gLR, 0);
    gLL.connect(mg, 0, 0); gRL.connect(mg, 0, 0); gRR.connect(mg, 0, 1); gLR.connect(mg, 0, 1);
    var lo = bq('lowshelf', 120), mi = bq('peaking', 1000, 0.8), hi = bq('highshelf', 6000);
    mg.connect(lo); lo.connect(mi); mi.connect(hi);
    var sz = [], prev = hi; for (var k = 0; k < ZONE_SLOTS[s]; k++) { var f2 = bq('peaking', 1000, 1); f2.gain.value = 0; prev.connect(f2); prev = f2; sz.push(f2); }
    g.zones[s] = sz; var zout = prev;
    var clean = c.createGain(), pre = c.createGain(), sh = c.createWaveShaper(), wet = c.createGain(), sum = c.createGain();
    sh.curve = SHAPER; sh.oversample = '4x';
    zout.connect(clean); clean.connect(sum); zout.connect(pre); pre.connect(sh); sh.connect(wet); wet.connect(sum);
    var comp = c.createDynamicsCompressor(); comp.attack.value = 0.008; comp.release.value = 0.16; comp.knee.value = 6;
    var fader = c.createGain();
    sum.connect(comp); comp.connect(fader);
    var mDry = c.createGain(), mPan = c.createPanner(), mWet = c.createGain(), mRoom = c.createGain();
    mPan.panningModel = 'HRTF'; mPan.distanceModel = 'inverse'; mPan.refDistance = 1; mPan.rolloffFactor = 0.7;
    mPan.channelCount = 1; mPan.channelCountMode = 'explicit';
    mPan.positionX.value = 0; mPan.positionY.value = 0; mPan.positionZ.value = -1.5;
    var mSP = c.createStereoPanner(); mSP.pan.value = 0;
    fader.connect(mDry); mDry.connect(mIn); fader.connect(mPan); mPan.connect(mSP); mSP.connect(mWet); mWet.connect(mIn); mWet.connect(mRoom); mRoom.connect(revs[1]);
    mDry.gain.value = 1; mWet.gain.value = 0; mRoom.gain.value = 0;
    var sends = revs.map(function (cv) { var sg = c.createGain(); fader.connect(sg); sg.connect(cv); return sg; });
    g.motion = g.motion || {}; g.motion[s] = { pan: mPan, sp: mSP.pan, dry: mDry.gain, wet: mWet.gain, room: mRoom.gain, nodes: { dry: mDry, wet: mWet, room: mRoom, fader: fader } };
    g.stems[s] = { aa: [gLL.gain, gRR.gain], bb: [gRL.gain, gLR.gain], low: [lo.gain], mid: [mi.gain], high: [hi.gain], clean: [clean.gain], pre: [pre.gain], wet: [wet.gain], thr: [comp.threshold], ratio: [comp.ratio], fader: [fader.gain], s0: [sends[0].gain], s1: [sends[1].gain], s2: [sends[2].gain] };
    if (opts.loop) { src.loop = true; src.loopStart = opts.loop.start; src.loopEnd = opts.loop.end; }
    src.start(when, offset);
    g.sources.push(src);
  });
  return g;
}
function regionAt(t) { var rs = S.recipe.regions; for (var i = 0; i < rs.length; i++) if (t < rs[i].end) return i; return rs.length - 1; }
function schedule(g, c, fromSong, ctxAt, opts) {
  var rs = S.recipe.regions, now = c.currentTime, live = !!opts.live, forExport = !!opts.export;
  var soloed = !forExport && STEMS.some(function (s) { return S.solo[s]; });
  var i0 = regionAt(fromSong);
  function setParam(ap, vals) { // vals[i] per region
    if (live) { ap.cancelScheduledValues(now); ap.setTargetAtTime(vals[i0], now, 0.015); }
    else ap.setValueAtTime(vals[i0], ctxAt);
    if (opts.loop) return;
    for (var i = i0 + 1; i < rs.length; i++) {
      var tb = ctxAt + (rs[i].start - fromSong); if (tb <= now + 0.05) continue;
      ap.setValueAtTime(vals[i - 1], Math.max(now + 0.02, tb - 0.03)); ap.linearRampToValueAtTime(vals[i], tb + 0.03);
    }
  }
  STEMS.forEach(function (s) {
    var tg = rs.map(function (r) { return stemTargets(r.stems[s], soloed, !!S.solo[s], forExport); });
    var node = g.stems[s];
    Object.keys(node).forEach(function (k) { var vals = tg.map(function (t) { return t[k]; }); node[k].forEach(function (ap) { setParam(ap, vals); }); });
  });
  if (g.bands) g.bands.forEach(function (ap, bi) { setParam(ap, rs.map(function (r) { return (r.bands || freshBands())[bi]; })); });
  if (g.zones) scheduleZones(g, c, fromSong, ctxAt, opts, now, live);
  if (g.motion) scheduleMotion(g, c, fromSong, ctxAt, opts, now, live);
  var mt = masterTargets(S.recipe.master);
  Object.keys(g.master).forEach(function (k) { g.master[k].forEach(function (ap) { if (live) { ap.cancelScheduledValues(now); ap.setTargetAtTime(mt[k], now, 0.015); } else ap.setValueAtTime(mt[k], ctxAt); }); });
}
// ---------- space: 8D motion ----------
var motionCache = {};
function stemEnvelopes() { // per stem: loudness envelope (0..1) and onset strength at MOTION_RATE
  var out = {}, sr = S.song.sr, hop = Math.round(sr / MOTION_RATE), n = Math.ceil(S.song.orig.length / hop);
  STEMS.forEach(function (s) {
    var L = S.song.stems[s].getChannelData(0), R = S.song.stems[s].getChannelData(1), e = new Float32Array(n);
    for (var i = 0; i < n; i++) { var a = i * hop, b = Math.min(L.length, a + hop), acc = 0; for (var k = a; k < b; k += 2) { var v = 0.5 * (L[k] + R[k]); acc += v * v; } e[i] = Math.sqrt(acc / Math.max(1, (b - a) / 2)); }
    var sorted = Array.prototype.slice.call(e).sort(function (p, q) { return p - q; }), ref = sorted[Math.floor(n * 0.95)] || 1;
    var sm = new Float32Array(n), on = new Float32Array(n), prev = 0, fast = 0;
    for (i = 0; i < n; i++) {
      var x = Math.min(1.2, e[i] / ref); fast += (x - fast) * 0.5; prev += (x - prev) * 0.06; // ~0.3 s smoothing
      sm[i] = prev; on[i] = Math.max(0, fast - prev);
    }
    var omx = 0; for (i = 0; i < n; i++) if (on[i] > omx) omx = on[i];
    if (omx > 0) for (i = 0; i < n; i++) on[i] /= omx;
    out[s] = { env: sm, onset: on, raw: e, ref: ref };
  });
  return out;
}
function lerpAngle(a, b, t) { var d = ((b - a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; return a + d * t; }
function motionCurves(s) {
  var M = S.recipe.motion, st = M.stems[s], key = s + JSON.stringify(st) + M.focus + '|' + M.ears + '|' + STEMS.map(function (x) { return M.stems[x].mode; }).join();
  if (motionCache[key]) return motionCache[key];
  var dur = S.song.duration, n = Math.ceil(dur * MOTION_RATE) + 2, X = new Float32Array(n), Y = new Float32Array(n), Z = new Float32Array(n), AZ = new Float32Array(n), P = new Float32Array(n), ears = (M.ears == null ? 50 : M.ears) / 100;
  var E = S.env && S.env[s], bpm = S.song.analysis ? S.song.analysis.bpm : 0;
  var period = st.sync && bpm ? st.sync * 4 * 60 / bpm : st.period, w = 2 * Math.PI / Math.max(0.5, period);
  var react = st.react / 100, focus = M.focus / 100, off = st.offset * Math.PI / 180, dir = st.dir >= 0 ? 1 : -1, phase = 0;
  var moving = STEMS.filter(function (x) { return M.stems[x].mode !== 'off'; });
  for (var i = 0; i < n; i++) {
    var j = Math.min(i, E ? E.env.length - 1 : 0), e = E ? E.env[j] : 0.5, o = E ? E.onset[j] : 0;
    var speed = Math.max(0.15, 1 + react * (2.2 * e - 0.7));
    phase += w * speed / MOTION_RATE + react * o * 0.5 * (o > 0.35 ? 1 : 0);
    var az;
    if (st.mode === 'orbit') az = off + dir * phase;
    else if (st.mode === 'swing') az = off + dir * (st.width / 100) * (Math.PI / 2) * Math.sin(phase);
    else az = off + react * 0.5 * Math.sin(phase * 0.5) * e; // place: holds its spot, sways a little with the music
    if (focus > 0 && E && moving.length > 1) { // the loudest instrument right now is pulled toward the front
      var tot = 0; moving.forEach(function (x) { var Ex = S.env[x]; tot += Ex.env[Math.min(i, Ex.env.length - 1)]; });
      var dom = tot > 0 ? Math.max(0, e / tot * moving.length - 1) / Math.max(1, moving.length - 1) : 0;
      az = lerpAngle(az, 0, Math.min(1, focus * dom * 1.5));
    }
    var el = (st.elev + react * 18 * (e - 0.3)) * Math.PI / 180, r = 1.5 - react * 0.6 * Math.min(1, e);
    X[i] = r * Math.sin(az) * Math.cos(el); Y[i] = r * Math.sin(el); Z[i] = -r * Math.cos(az) * Math.cos(el); AZ[i] = az; P[i] = Math.sin(az) * Math.cos(el) * ears * 0.85;
  }
  var res = { X: X, Y: Y, Z: Z, AZ: AZ, P: P };
  if (Object.keys(motionCache).length > 40) motionCache = {};
  return (motionCache[key] = res);
}
function scheduleMotion(g, c, fromSong, ctxAt, opts, now, live) {
  var M = S.recipe.motion || (S.recipe.motion = defMotion()), at = live ? now + 0.02 : ctxAt;
  STEMS.forEach(function (s) {
    var m = g.motion[s], st = M.stems[s], on = st.mode !== 'off', d = M.depth / 100;
    var vals = [[m.dry, on ? 1 - d : 1], [m.wet, on ? d : 0], [m.room, on ? d * M.room / 100 * 0.6 : 0]];
    vals.forEach(function (p) { if (live) { p[0].cancelScheduledValues(now); p[0].setTargetAtTime(p[1], now, 0.03); } else p[0].setValueAtTime(p[1], ctxAt); });
    if (!on || !S.song.stems) { try { if (m.sp.cancelAndHoldAtTime) m.sp.cancelAndHoldAtTime(at); else m.sp.cancelScheduledValues(0); m.sp.setValueAtTime(0, at + 0.005); } catch (e) {} return; }
    var cv = motionCurves(s), i0 = Math.min(cv.X.length - 2, Math.floor(fromSong * MOTION_RATE));
    [[m.pan.positionX, cv.X], [m.pan.positionY, cv.Y], [m.pan.positionZ, cv.Z], [m.sp, cv.P]].forEach(function (p) {
      var ap = p[0], sub = p[1].subarray(i0);
      try {
        if (ap.cancelAndHoldAtTime) ap.cancelAndHoldAtTime(at); else ap.cancelScheduledValues(0);
        if (opts.loop) { ap.setValueAtTime(sub[0], at + 0.005); return; }
        ap.setValueCurveAtTime(sub, at + 0.005, sub.length / MOTION_RATE);
      } catch (err) { try { ap.cancelScheduledValues(0); ap.setValueAtTime(sub[0], at + 0.01); } catch (e2) {} }
    });
  });
}
function zoneVal(z, t) { return z && t >= z.start && t < z.end ? z.gain : 0; }
function scheduleZones(g, c, fromSong, ctxAt, opts, now, live) {
  var zones = S.recipe.zones || [];
  Object.keys(g.zones).forEach(function (target) {
    var list = zones.filter(function (z) { return (z.target || 'mix') === target; }), slots = g.zones[target];
    slots.forEach(function (node, i) {
      var z = list[i] || null, at = live ? now : ctxAt;
      if (z) { var fq = zoneFQ(z); node.frequency.setValueAtTime(fq.f, at); node.Q.setValueAtTime(fq.q, at); }
      var ap = node.gain, v0 = zoneVal(z, fromSong);
      if (live) { ap.cancelScheduledValues(now); ap.setTargetAtTime(v0, now, 0.015); } else ap.setValueAtTime(v0, ctxAt);
      if (!z || opts.loop) return;
      [[z.start, 0, z.gain], [z.end, z.gain, 0]].forEach(function (e) {
        if (e[0] <= fromSong) return; var tb = ctxAt + (e[0] - fromSong); if (tb <= now + 0.05) return;
        ap.setValueAtTime(e[1], Math.max(now + 0.02, tb - 0.02)); ap.linearRampToValueAtTime(e[2], tb + 0.02);
      });
    });
  });
}
var monitor = null, analyser = null, abB = null, abA = null;
function ensureMonitor() {
  var c = getCtx();
  if (monitor) return;
  monitor = c.createGain(); analyser = c.createAnalyser(); analyser.fftSize = 4096; analyser.smoothingTimeConstant = 0.72;
  monitor.connect(analyser); monitor.connect(c.destination);
  abA = c.createGain(); abB = c.createGain(); abA.connect(monitor); abB.connect(monitor);
  setAB(S.ab, true);
}
function setAB(mode, instant) {
  S.ab = mode;
  $('abA').classList.toggle('on', mode === 'A'); $('abB').classList.toggle('on', mode === 'B');
  $('meterMode').textContent = mode === 'A' ? 'A · original' : 'B · remaster';
  if (!abA) return;
  var now = getCtx().currentTime;
  abA.gain.cancelScheduledValues(now); abB.gain.cancelScheduledValues(now);
  abA.gain.setTargetAtTime(mode === 'A' ? 1 : 0, now, instant ? 0.001 : 0.012);
  abB.gain.setTargetAtTime(mode === 'B' ? 1 : 0, now, instant ? 0.001 : 0.012);
}
function currentPos() {
  if (!S.playing) return S.pos;
  var t = S.startPos + (getCtx().currentTime - S.ctxStart);
  if (S.playLoop) { var a = S.playLoop.start, b = S.playLoop.end; if (t >= b) t = a + ((t - a) % (b - a)); }
  return Math.min(t, S.song.duration);
}
function play(from) {
  if (!S.song || !S.song.stems) return;
  var c = getCtx(); ensureMonitor();
  if (c.state === 'suspended') c.resume();
  stop(true);
  var pos = from == null ? S.pos : from;
  var loop = S.loop ? { start: S.recipe.regions[S.sel].start, end: S.recipe.regions[S.sel].end } : null;
  if (loop && (pos < loop.start || pos >= loop.end - 0.05)) pos = loop.start;
  if (pos >= S.song.duration - 0.05) pos = 0;
  var when = c.currentTime + 0.06;
  var g = buildGraph(c, abB, pos, when, { loop: loop });
  schedule(g, c, pos, when, { loop: loop });
  var o = c.createBufferSource(); o.buffer = S.song.orig; o.connect(abA);
  if (loop) { o.loop = true; o.loopStart = loop.start; o.loopEnd = loop.end; }
  o.start(when, pos);
  S.graph = g; S.origSrc = o; S.playing = true; S.startPos = pos; S.ctxStart = when; S.playLoop = loop;
  g.sources[0].onended = function () { if (S.graph === g && !loop) { S.playing = false; S.pos = 0; $('playBtn').textContent = 'Play'; if (VID.rec) VID.rec.stop(); } };
  $('playBtn').textContent = 'Pause';
  tick();
}
function stop(keepPos) {
  if (S.graph) {
    var og = S.graph; og.sources.forEach(function (s) { try { s.onended = null; s.stop(); } catch (e) {} });
    setTimeout(function () { try { og.out.disconnect(); } catch (e) {} }, 150);
  }
  if (S.origSrc) { try { S.origSrc.stop(); } catch (e) {} }
  if (S.playing && keepPos) S.pos = currentPos();
  S.graph = null; S.origSrc = null; S.playing = false;
  $('playBtn').textContent = 'Play';
}
function liveUpdateFix() {
  if (!(S.playing && S.graph)) return;
  var c = getCtx(), pos = currentPos();
  schedule(S.graph, c, pos, c.currentTime, { live: true, loop: S.playLoop });
}
function seek(t) { t = clamp(t, 0, S.song ? S.song.duration : 0); var was = S.playing; S.pos = t; if (was) play(t); else { drawAll(); updateTime(); } }

// ---------- render / export ----------
function renderOffline() {
  var song = S.song, sr = song.sr, len = song.orig.length;
  var oc = new OfflineAudioContext(2, len, sr);
  var g = buildGraph(oc, oc.destination, 0, 0, {});
  schedule(g, oc, 0, 0, { export: true });
  return oc.startRendering();
}
function wavBlob(buf) {
  var ch = buf.numberOfChannels, n = buf.length, sr = buf.sampleRate, bytes = 44 + n * ch * 2, ab = new ArrayBuffer(bytes), v = new DataView(ab);
  function str(o, s) { for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); }
  str(0, 'RIFF'); v.setUint32(4, bytes - 8, true); str(8, 'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * ch * 2, true);
  var data = []; for (var c = 0; c < ch; c++) data.push(buf.getChannelData(c));
  var o = 44;
  for (var i = 0; i < n; i++) for (c = 0; c < ch; c++) { var s = clamp(data[c][i], -1, 1); v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2; }
  return new Uint8Array(ab);
}
var CRC = (function () { var t = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8) { var c = 0xffffffff; for (var i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function zip(files) { // [{name, data:Uint8Array}] stored, no compression
  var parts = [], central = [], off = 0, enc = new TextEncoder();
  files.forEach(function (f) {
    var nm = enc.encode(f.name), crc = crc32(f.data), h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true); h.setUint32(10, 0, true);
    h.setUint32(14, crc, true); h.setUint32(18, f.data.length, true); h.setUint32(22, f.data.length, true); h.setUint16(26, nm.length, true); h.setUint16(28, 0, true);
    parts.push(new Uint8Array(h.buffer), nm, f.data);
    var cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true); cd.setUint16(8, 0x0800, true); cd.setUint16(10, 0, true); cd.setUint32(12, 0, true);
    cd.setUint32(16, crc, true); cd.setUint32(20, f.data.length, true); cd.setUint32(24, f.data.length, true); cd.setUint16(28, nm.length, true);
    cd.setUint32(42, off, true);
    central.push(new Uint8Array(cd.buffer), nm);
    off += 30 + nm.length + f.data.length;
  });
  var cdSize = central.reduce(function (a, b) { return a + b.length; }, 0), e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cdSize, true); e.setUint32(16, off, true);
  return new Blob(parts.concat(central, [new Uint8Array(e.buffer)]), { type: 'application/zip' });
}
function recipeJSON(name) {
  return JSON.stringify({ version: 1, app: 'Remaster Lab', name: name || 'Untitled version', song: { title: S.song.title, duration: +S.song.duration.toFixed(3), fingerprintId: S.song.id }, stemSource: S.song.stemSource, master: S.recipe.master,
    zones: S.recipe.zones || [], motion: S.recipe.motion || defMotion(), regions: S.recipe.regions.map(function (r) { return { id: r.id, name: r.name, start: +r.start.toFixed(3), end: +r.end.toFixed(3), stems: r.stems, bands: r.bands || freshBands() }; }) }, null, 2);
}
function safeName(s) { return (s || 'remaster').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'remaster'; }
var downloads = null;
function saveFile(filename, data) {
  if (!downloads) { // self-hosted copy: a normal browser download
    try {
      var blob = data instanceof Blob ? data : new Blob([data]), a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000); toast('Saved ' + filename); return Promise.resolve(true);
    } catch (e) { toast('Saving files is not available in this view.'); return Promise.resolve(false); }
  }
  return downloads.save({ filename: filename, data: data }).then(function () { toast('Saved ' + filename); return true; })
    .catch(function (e) { if (e && e.code === 'declined') toast('Save cancelled'); else toast('Could not save: ' + (e && e.message || e)); return false; });
}
function doRender(keep) {
  if (!S.song || !S.song.stems) return;
  var btns = [$('renderBtn'), $('renderKeepBtn')]; btns.forEach(function (b) { b.disabled = true; });
  status('Rendering the remaster…', 0.4);
  var name = $('verName').value.trim() || currentVersionName || 'My remaster';
  renderOffline().then(function (buf) {
    status('Packing the file…', 0.9);
    var wav = wavBlob(buf);
    if (keep) {
      var rec = { id: 'r_' + uid(), songId: S.song.id, title: S.song.title, name: name, created: Date.now(), duration: buf.duration, wav: new Blob([wav], { type: 'audio/wav' }) };
      S.renders.unshift(rec); renderRenderList();
      return Store.put('renders', rec).then(function () { toast('Added to My remasters'); });
    }
    var z = zip([{ name: safeName(S.song.title) + ' - ' + safeName(name) + '.wav', data: wav }, { name: 'recipe.json', data: new TextEncoder().encode(recipeJSON(name)) }]);
    return saveFile(safeName(S.song.title) + '-' + safeName(name) + '.zip', z);
  }).catch(function (e) { toast('Render failed: ' + e.message); })
    .then(function () { status('Ready', 0); btns.forEach(function (b) { b.disabled = false; }); });
}
var renderPlayer = null;
function renderRenderList() {
  var el = $('renderList'); el.innerHTML = '';
  if (!S.renders.length) { el.innerHTML = '<div class="empty">Rendered remasters are kept in this browser so you can play them back any time.</div>'; return; }
  S.renders.forEach(function (r) {
    var it = document.createElement('div'); it.className = 'item';
    var m = document.createElement('div'); m.className = 'meta';
    var d = document.createElement('div'); d.textContent = r.name; m.appendChild(d);
    var sm = document.createElement('small'); sm.textContent = r.title + ' · ' + fmt(r.duration, 0); m.appendChild(sm);
    var bx = document.createElement('div'); bx.className = 'row'; bx.style.gap = '4px';
    var pb = document.createElement('button'); pb.className = 'btn small'; pb.textContent = renderPlayer && renderPlayer.id === r.id ? 'Stop' : 'Play';
    pb.onclick = function () { playRender(r); };
    var sb = document.createElement('button'); sb.className = 'btn small'; sb.textContent = 'Save';
    sb.onclick = function () { r.wav.arrayBuffer().then(function (ab) { saveFile(safeName(r.title) + '-' + safeName(r.name) + '.zip', zip([{ name: safeName(r.name) + '.wav', data: new Uint8Array(ab) }])); }); };
    var db = document.createElement('button'); db.className = 'btn small'; db.textContent = 'Delete';
    db.onclick = function () { if (renderPlayer && renderPlayer.id === r.id) playRender(r); S.renders = S.renders.filter(function (x) { return x.id !== r.id; }); Store.del('renders', r.id); renderRenderList(); };
    bx.appendChild(pb); bx.appendChild(sb); bx.appendChild(db);
    it.appendChild(m); it.appendChild(bx); el.appendChild(it);
  });
}
function playRender(r) {
  if (renderPlayer) { try { renderPlayer.src.stop(); } catch (e) {} var same = renderPlayer.id === r.id; renderPlayer = null; renderRenderList(); if (same) return; }
  stop(true);
  var c = getCtx(); ensureMonitor(); if (c.state === 'suspended') c.resume();
  r.wav.arrayBuffer().then(function (ab) { return c.decodeAudioData(ab); }).then(function (buf) {
    var s = c.createBufferSource(); s.buffer = buf; s.connect(monitor); s.start();
    renderPlayer = { id: r.id, src: s }; s.onended = function () { if (renderPlayer && renderPlayer.src === s) { renderPlayer = null; renderRenderList(); } };
    renderRenderList(); meterLoop();
  });
}

// ---------- versions (recipes) ----------
var currentVersionName = '';
function refreshVersions() {
  return Store.all('recipes').then(function (all) {
    S.versions = all.filter(function (v) { return S.song && v.songId === S.song.id; }).sort(function (a, b) { return b.created - a.created; });
    renderVersions();
  });
}
function renderVersions() {
  var el = $('verList'); el.innerHTML = '';
  if (!S.versions.length) { el.innerHTML = '<div class="empty">Saved versions of the loaded song show up here.</div>'; return; }
  S.versions.forEach(function (v) {
    var it = document.createElement('div'); it.className = 'item';
    var m = document.createElement('div'); m.className = 'meta';
    var d = document.createElement('div'); d.textContent = v.name; m.appendChild(d);
    var sm = document.createElement('small'); sm.textContent = new Date(v.created).toLocaleString() + ' · ' + v.recipe.regions.length + ' regions'; m.appendChild(sm);
    var bx = document.createElement('div'); bx.className = 'row'; bx.style.gap = '4px';
    var lb = document.createElement('button'); lb.className = 'btn small'; lb.textContent = 'Load'; lb.onclick = function () { applyRecipe(v.recipe, v.name); };
    var db = document.createElement('button'); db.className = 'btn small'; db.textContent = 'Delete'; db.onclick = function () { Store.del('recipes', v.id).then(refreshVersions); };
    bx.appendChild(lb); bx.appendChild(db); it.appendChild(m); it.appendChild(bx); el.appendChild(it);
  });
}
function applyRecipe(rc, name) {
  var dur = S.song.duration;
  var regs = (rc.regions || []).filter(function (r) { return r.start < dur; }).map(function (r) {
    var st = freshStems(); STEMS.forEach(function (s) { if (r.stems && r.stems[s]) Object.assign(st[s], r.stems[s]); });
    var bd = freshBands(); (r.bands || []).slice(0, 6).forEach(function (v, i) { bd[i] = +v || 0; });
    return { id: r.id || uid(), name: r.name || 'Region', start: +r.start, end: Math.min(dur, +r.end), stems: st, bands: bd };
  }).sort(function (a, b) { return a.start - b.start; });
  if (!regs.length) { toast('That recipe has no regions for this song.'); return; }
  regs[0].start = 0; regs[regs.length - 1].end = dur;
  for (var i = 1; i < regs.length; i++) regs[i].start = regs[i - 1].end;
  var zs = (rc.zones || []).filter(function (z) { return z && z.start < dur && z.end > z.start; }).map(function (z) { return Object.assign({ id: uid(), target: 'mix', gain: 0 }, z); });
  var mo = defMotion(); if (rc.motion) { ['depth', 'room', 'focus', 'ears'].forEach(function (k) { if (rc.motion[k] != null) mo[k] = +rc.motion[k]; }); STEMS.forEach(function (s) { if (rc.motion.stems && rc.motion.stems[s]) Object.assign(mo.stems[s], rc.motion.stems[s]); }); }
  S.recipe = { master: Object.assign(defMaster(), rc.master || {}), regions: regs, zones: zs, motion: mo };
  S.sel = 0; currentVersionName = name || ''; $('verName').value = name || '';
  motionCache = {}; renderRack(); renderSpace(); drawTimeline(); liveUpdateFix(); toast('Loaded "' + (name || 'recipe') + '"');
}
function saveVersion() {
  var name = $('verName').value.trim() || ('Version ' + (S.versions.length + 1));
  var rec = { id: 'v_' + uid(), songId: S.song.id, name: name, created: Date.now(), recipe: JSON.parse(recipeJSON(name)) };
  currentVersionName = name;
  Store.put('recipes', rec).then(refreshVersions).then(function () { toast('Saved "' + name + '"'); });
}

// ---------- UI: chips, rack ----------
function renderChips() {
  var el = $('chips'), s = S.song; el.innerHTML = '';
  if (!s) return;
  function chip(label, val, cls) { var c = document.createElement('span'); c.className = 'chip' + (cls ? ' ' + cls : ''); c.append(label + ' '); var b = document.createElement('b'); b.textContent = val; c.appendChild(b); el.appendChild(c); }
  chip('Length', fmt(s.duration, 0));
  chip('Rate', (s.sr / 1000).toFixed(1) + ' kHz');
  $('deckBpm').textContent = s.analysis ? s.analysis.bpm.toFixed(1) : '—'; $('deckKey').textContent = s.analysis ? s.analysis.key.replace(' major', '').replace(' minor', 'm') : '—';
  if (s.analysis) { chip('Tempo', s.analysis.bpm.toFixed(1) + ' BPM'); chip('Key', s.analysis.key); chip('Sections', String(s.analysis.sections.length)); }
  else chip('Analysis', 'running');
  if (s.recognised) chip('Recognised', s.recognised, 'ok');
  if (s.stemSource) chip('Stems', s.stemSource);
}
var rackInputs = {};
function renderRack() {
  if (typeof renderControls === 'function') setTimeout(renderControls, 0);
  $('modePads').classList.toggle('on', rackMode === 'pads'); $('modeSliders').classList.toggle('on', rackMode === 'sliders');
  $('rack').classList.toggle('pads', rackMode === 'pads');
  $('rackNote').textContent = rackMode === 'pads' ? 'Drag the dot on each pad; one move changes several settings together (the readout lists them). Use several fingers on a touch screen to shape stems at once. Double-tap a pad to centre it, which is the untouched sound. Level sets the stem volume.' : 'Each region keeps its own settings per stem; the engine glides between them at region edges. Crunch adds saturation, Punch compresses, Width spreads or narrows stereo, Decay picks short, medium or long reverb. Solo is for listening only and is not exported. Double-click a slider to reset it.';
  if (rackMode === 'pads') renderPads(); else renderSliders();
}
function renderSliders() {
  var el = $('rack'); el.innerHTML = ''; rackInputs = {};
  if (!S.recipe) return;
  var reg = S.recipe.regions[S.sel];
  $('regName').value = reg.name; $('regTime').textContent = fmt(reg.start) + ' – ' + fmt(reg.end);
  STEMS.forEach(function (s) {
    var st = reg.stems[s], strip = document.createElement('div'); strip.className = 'strip' + (st.mute ? ' dim' : ''); strip.style.setProperty('--c', 'var(--' + s + ')');
    var h = document.createElement('h3'); h.textContent = STEM_LABEL[s];
    var ms = document.createElement('div'); ms.className = 'ms';
    var mb = document.createElement('button'); mb.className = 'm' + (st.mute ? ' on' : ''); mb.textContent = 'M'; mb.title = 'Mute in this region'; mb.setAttribute('aria-pressed', st.mute);
    mb.onclick = function () { st.mute = !st.mute; renderRack(); liveUpdateFix(); drawTimeline(); };
    var sb = document.createElement('button'); sb.className = 's' + (S.solo[s] ? ' on' : ''); sb.textContent = 'S'; sb.title = 'Solo while listening'; sb.setAttribute('aria-pressed', !!S.solo[s]);
    sb.onclick = function () { S.solo[s] = !S.solo[s]; renderRack(); liveUpdateFix(); };
    ms.appendChild(mb); ms.appendChild(sb); h.appendChild(ms); strip.appendChild(h);
    PARAMS.forEach(function (p) { strip.appendChild(ctl(s + '-' + p.k, p, st[p.k], function (v) { st[p.k] = v; liveUpdateFix(); })); });
    el.appendChild(strip);
  });
  var m = S.recipe.master, strip = document.createElement('div'); strip.className = 'strip master';
  var h = document.createElement('h3'); h.textContent = 'Master'; var sm = document.createElement('span'); sm.className = 'label'; sm.textContent = 'whole song'; h.appendChild(sm); strip.appendChild(h);
  MPARAMS.forEach(function (p) { strip.appendChild(ctl('m-' + p.k, p, m[p.k], function (v) { m[p.k] = v; liveUpdateFix(); })); });
  var lw = document.createElement('label'); lw.className = 'row'; lw.style.fontSize = '12.5px'; lw.style.gap = '6px';
  var cb = document.createElement('input'); cb.type = 'checkbox'; cb.id = 'm-limiter'; cb.checked = m.limiter; cb.onchange = function () { m.limiter = cb.checked; liveUpdateFix(); };
  lw.appendChild(cb); lw.append('Limiter (stops clipping)'); strip.appendChild(lw);
  var note = document.createElement('p'); note.className = 'note'; note.style.margin = '0'; note.textContent = S.song && S.song.stems ? 'Tip: press A and B to compare.' : 'Stems are still being prepared.'; strip.appendChild(note);
  el.appendChild(strip);
}
function ctl(id, p, val, on) {
  var row = document.createElement('div'); row.className = 'ctl';
  var lb = document.createElement('label'); lb.htmlFor = id; lb.textContent = p.label;
  var inp = document.createElement('input'); inp.type = 'range'; inp.id = id; inp.min = p.min; inp.max = p.max; inp.step = p.step; inp.value = val;
  var out = document.createElement('output'); out.htmlFor = id;
  function show(v) { out.textContent = p.k === 'decay' ? (v < 34 ? 'short' : v < 67 ? 'medium' : 'long') : ((v > 0 && p.unit === ' dB' ? '+' : '') + (+v) + p.unit); }
  show(val);
  inp.oninput = function () { var v = +inp.value; followRegion = false; show(v); on(v); };
  inp.ondblclick = function () { inp.value = p.def; show(p.def); on(p.def); };
  inp.addEventListener('sync', function () { show(+inp.value); });
  row.appendChild(lb); row.appendChild(inp); row.appendChild(out); return row;
}
function enableUI() {
  var has = !!S.song, stems = has && !!S.song.stems;
  ['playBtn', 'stopBtn', 'renderBtn', 'renderKeepBtn'].forEach(function (id) { $(id).disabled = !stems; });
  $('aiBtn').disabled = !has || aiBusy;
  ['splitBtn', 'mergeBtn', 'resetRegBtn', 'copyAllBtn', 'resetRegionBtn', 'saveVerBtn', 'exportJsonBtn', 'testClipBtn'].forEach(function (id) { $(id).disabled = !has; });
  $('regName').disabled = !has;
  if (has && !S.song.analysis) { $('resetRegBtn').disabled = true; $('testClipBtn').disabled = true; }
}

// ---------- drawing ----------
function setupCanvas(cv) {
  var dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  var g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); return { g: g, w: w, h: h };
}
function peaksOf(buf) {
  var B = 1600, n = buf.length, mn = new Float32Array(B), mx = new Float32Array(B), L = buf.getChannelData(0), R = buf.getChannelData(1);
  for (var b = 0; b < B; b++) {
    var a = Math.floor(b * n / B), e = Math.floor((b + 1) * n / B), lo = 0, hi = 0;
    for (var i = a; i < e; i += 4) { var v = 0.5 * (L[i] + R[i]); if (v < lo) lo = v; if (v > hi) hi = v; }
    mn[b] = lo; mx[b] = hi;
  }
  return { mn: mn, mx: mx };
}
var TL = { strip: 30, gap: 6 };
function lanes(h) {
  var top = TL.strip + TL.gap, avail = h - top - 4, origH = Math.round(avail * 0.3), stemH = (avail - origH) / 4;
  var L = [{ k: 'orig', y: top, h: origH }];
  STEMS.forEach(function (s, i) { L.push({ k: s, y: top + origH + i * stemH, h: stemH }); });
  return L;
}
function drawTimeline() {
  var cv = $('timeline'), o = setupCanvas(cv), g = o.g, w = o.w, h = o.h;
  g.clearRect(0, 0, w, h);
  if (!S.song) return;
  var dur = S.song.duration, x = function (t) { return t / dur * w; };
  var line = css('--line'), muted = css('--muted'), fg = css('--fg'), accent = css('--accent'), panel = css('--panel');
  // regions strip + region tint
  S.recipe.regions.forEach(function (r, i) {
    var x0 = x(r.start), x1 = x(r.end), sel = i === S.sel;
    g.fillStyle = sel ? css('--accent-soft') : (i % 2 ? panel : 'transparent');
    g.fillRect(x0, 0, x1 - x0, h);
    g.fillStyle = sel ? accent : css('--panel');
    g.globalAlpha = sel ? 1 : 0.9; g.fillRect(x0 + 1, 2, Math.max(0, x1 - x0 - 2), TL.strip - 4); g.globalAlpha = 1;
    g.strokeStyle = sel ? accent : line; g.lineWidth = 1; g.strokeRect(x0 + 1.5, 2.5, Math.max(0, x1 - x0 - 3), TL.strip - 5);
    g.fillStyle = sel ? css('--accent-ink') : fg; g.font = '600 12px ' + css('--f-display');
    var label = r.name, maxW = x1 - x0 - 12;
    if (maxW > 14) { while (g.measureText(label).width > maxW && label.length > 1) label = label.slice(0, -1); if (label !== r.name) label = label.slice(0, -1) + '…'; g.fillText(label, x0 + 7, 20); }
    if (i > 0) { g.strokeStyle = sel || i - 1 === S.sel ? accent : line; g.beginPath(); g.moveTo(x0 + 0.5, TL.strip); g.lineTo(x0 + 0.5, h); g.stroke(); }
  });
  // lanes
  var opk = S.peaks.orig, oMax = 1e-6; if (opk) for (var q = 0; q < opk.mx.length; q++) oMax = Math.max(oMax, opk.mx[q], -opk.mn[q]);
  lanes(h).forEach(function (ln) {
    var pk = S.peaks[ln.k], col = css(ln.k === 'orig' ? '--orig' : '--' + ln.k), mid = ln.y + ln.h / 2;
    g.fillStyle = muted; g.font = '500 10.5px ' + css('--f-mono');
    if (!pk) { g.fillText(ln.k === 'orig' ? 'original' : ln.k + ' · splitting…', 6, mid + 3); return; }
    g.fillStyle = col; var B = pk.mn.length, own = 1e-6; for (var q2 = 0; q2 < B; q2++) own = Math.max(own, pk.mx[q2], -pk.mn[q2]);
    var norm = ln.k === 'orig' ? 1 / oMax : 1 / Math.max(own, oMax * 0.2);
    var muted2 = ln.k !== 'orig';
    for (var px = 0; px < w; px++) {
      var b0 = Math.floor(px / w * B), b1 = Math.max(b0 + 1, Math.floor((px + 1) / w * B)), lo = 0, hi = 0;
      for (var b = b0; b < b1 && b < B; b++) { if (pk.mn[b] < lo) lo = pk.mn[b]; if (pk.mx[b] > hi) hi = pk.mx[b]; }
      if (muted2) { var r = S.recipe.regions[regionAt(px / w * dur)]; g.globalAlpha = r && r.stems[ln.k].mute ? 0.18 : 0.9; }
      var amp = ln.h * 0.46 * norm; g.fillRect(px, mid - hi * amp, 1, Math.max(1, (hi - lo) * amp));
    }
    g.globalAlpha = 1;
    g.fillStyle = muted; g.fillText(ln.k === 'orig' ? 'original' : ln.k, 6, ln.y + 11);
  });
  // beats ticks under strip
  if (S.song.analysis) { g.fillStyle = line; S.song.analysis.beats.forEach(function (bt, i) { if (i % 4 === 0) g.fillRect(x(bt), TL.strip, 1, 4); }); }
  // playhead
  var ph = x(currentPos()); g.fillStyle = accent; g.fillRect(ph - 1, TL.strip, 2, h - TL.strip);
}
var specImg = null, specFor = null;
function spectroColor() {
  var stops = [[0, css('--panel-2')], [0.25, '#2a1b5c'], [0.5, '#8a2f8f'], [0.72, '#e2573f'], [0.88, '#f6a531'], [1, '#fdf0a6']];
  function hex(c) { if (c[0] === '#') { var v = parseInt(c.slice(1), 16); return [v >> 16 & 255, v >> 8 & 255, v & 255]; } var m = c.match(/\d+/g); return m ? m.slice(0, 3).map(Number) : [0, 0, 0]; }
  var lut = new Uint8ClampedArray(256 * 3), cs = stops.map(function (s) { return [s[0], hex(s[1])]; });
  for (var i = 0; i < 256; i++) { var t = i / 255, j = 0; while (j < cs.length - 2 && t > cs[j + 1][0]) j++; var a = cs[j], b = cs[j + 1], f = (t - a[0]) / (b[0] - a[0]); for (var k = 0; k < 3; k++) lut[i * 3 + k] = a[1][k] + (b[1][k] - a[1][k]) * f; }
  return lut;
}
function drawSpec() {
  var cv = $('specCv'); if (!cv.offsetParent) return;
  var o = setupCanvas(cv), g = o.g, w = o.w, h = o.h; g.clearRect(0, 0, w, h);
  var a = S.song && S.song.analysis; if (!a) { msg(g, w, h, S.song ? 'Analysing…' : ''); return; }
  var theme = css('--panel-2');
  if (specFor !== a || !specImg || specImg.theme !== theme) {
    var lut = spectroColor(), oc = document.createElement('canvas'); oc.width = a.cols; oc.height = a.rows;
    var og = oc.getContext('2d'), id = og.createImageData(a.cols, a.rows);
    for (var c = 0; c < a.cols; c++) for (var r = 0; r < a.rows; r++) { var v = a.spec[c * a.rows + r], p = ((a.rows - 1 - r) * a.cols + c) * 4; id.data[p] = lut[v * 3]; id.data[p + 1] = lut[v * 3 + 1]; id.data[p + 2] = lut[v * 3 + 2]; id.data[p + 3] = 255; }
    og.putImageData(id, 0, 0); specImg = oc; specImg.theme = theme; specFor = a;
  }
  var left = 44, plotW = w - left - 8, plotH = h - 22;
  specGeom = { left: left, top: 4, w: plotW, h: plotH, fmin: a.fmin, fmax: a.fmax, dur: S.song.duration };
  g.imageSmoothingEnabled = true; g.drawImage(specImg, left, 4, plotW, plotH);
  g.fillStyle = css('--muted'); g.font = '10.5px ' + css('--f-mono'); g.textAlign = 'right';
  [50, 100, 250, 500, 1000, 2500, 5000, 10000].forEach(function (f) {
    if (f < a.fmin || f > a.fmax) return; var y = 4 + plotH * (1 - Math.log(f / a.fmin) / Math.log(a.fmax / a.fmin));
    g.fillText(f >= 1000 ? f / 1000 + 'k' : String(f), left - 6, y + 3); g.fillRect(left - 3, y, 3, 1);
  });
  g.textAlign = 'left';
  var dur = S.song.duration; g.fillStyle = css('--muted');
  var step = dur > 240 ? 60 : dur > 90 ? 30 : 10;
  for (var t = 0; t <= dur; t += step) { var xx = left + t / dur * plotW; g.fillText(fmt(t, 0), xx + 2, h - 6); g.fillRect(xx, h - 18, 1, 4); }
  g.strokeStyle = css('--fg'); g.globalAlpha = 0.5; g.setLineDash([3, 4]);
  a.sections.forEach(function (sg, i) { if (!i) return; var xx = left + sg.start / dur * plotW; g.beginPath(); g.moveTo(xx + 0.5, 4); g.lineTo(xx + 0.5, 4 + plotH); g.stroke(); });
  g.setLineDash([]); g.globalAlpha = 1;
  if (amode === 'control') drawZones(g);
  g.fillStyle = css('--accent'); g.fillRect(left + currentPos() / dur * plotW - 1, 4, 2, plotH);
}
function msg(g, w, h, t) { g.fillStyle = css('--muted'); g.font = '13px ' + css('--f-body'); g.textAlign = 'center'; g.fillText(t, w / 2, h / 2); g.textAlign = 'left'; }
var BAND_COL = ['--bass', '--vocals', '--warn', '--other', '--drums', '--accent'];
function drawBands() {
  var cv = $('bandsCv'); if (!cv.offsetParent) return;
  var o = setupCanvas(cv), g = o.g, w = o.w, h = o.h; g.clearRect(0, 0, w, h);
  var a = S.song && S.song.analysis; if (!a) { msg(g, w, h, S.song ? 'Analysing…' : ''); return; }
  var ctrlW = amode === 'control' ? Math.min(250, Math.max(170, w * 0.3)) : 0, left = 40, top = 24, pw = w - left - 10 - ctrlW, phh = h - top - 24, mx = -1e9;
  for (var i = 0; i < a.bands.length; i++) if (a.bands[i] > mx) mx = a.bands[i];
  var lo = mx - 60, y = function (db) { return top + phh * (1 - clamp((db - lo) / 60, 0, 1)); };
  g.strokeStyle = css('--line'); g.fillStyle = css('--muted'); g.font = '10.5px ' + css('--f-mono'); g.lineWidth = 1;
  for (var d = 0; d <= 60; d += 20) { var yy = y(lo + d); g.beginPath(); g.moveTo(left, yy + 0.5); g.lineTo(w - 10, yy + 0.5); g.stroke(); g.textAlign = 'right'; g.fillText((d - 60) + ' dB', left - 4, yy + 3); }
  g.textAlign = 'left';
  var smoothW = Math.max(1, Math.round(a.cols / pw * 3));
  DSP.BANDS.forEach(function (b, bi) {
    g.strokeStyle = css(BAND_COL[bi]); g.lineWidth = 1.6; g.beginPath();
    for (var c = 0; c < a.cols; c += Math.max(1, Math.floor(a.cols / pw))) {
      var s = 0, n = 0; for (var k = Math.max(0, c - smoothW); k <= Math.min(a.cols - 1, c + smoothW); k++) { s += a.bands[k * 6 + bi]; n++; }
      var xx = left + c / a.cols * pw, yy = y(s / n); if (c === 0) g.moveTo(xx, yy); else g.lineTo(xx, yy);
    }
    g.stroke();
  });
  var lx = left; g.font = '500 11.5px ' + css('--f-body');
  DSP.BANDS.forEach(function (b, bi) { g.fillStyle = css(BAND_COL[bi]); g.fillRect(lx, 8, 10, 3); g.fillStyle = css('--fg'); var t = b.name + ' ' + (b.lo >= 1000 ? b.lo / 1000 + 'k' : b.lo) + '–' + (b.hi >= 1000 ? b.hi / 1000 + 'k' : b.hi); g.fillText(t, lx + 14, 13); lx += g.measureText(t).width + 28; });
  g.fillStyle = css('--accent'); g.fillRect(left + currentPos() / S.song.duration * pw - 1, top, 2, phh);
  bandsGeom = { left: left, top: top, w: pw, h: phh, lo: lo, cols: a.cols, smoothW: smoothW, ctrlX: left + pw + 18, ctrlW: ctrlW - 18 };
  if (amode === 'control') drawBandControls(g, a, y);
}
function dynText(D) {
  if (!D || !D.drops) return '';
  var big = D.builds.filter(function (b) { return b.peak >= 0.6; }), out = [];
  if (big.length) out.push('Build-ups: ' + big.map(function (b) { return fmt(Math.round(b.start), 0) + '–' + fmt(Math.round(b.end), 0) + (b.into ? ' (into a ' + (D.drops.filter(function (d) { return d.t === b.into; })[0] || {}).kind + ')' : ''); }).join(', '));
  if (D.breakdowns.length) out.push('Breakdowns: ' + D.breakdowns.map(function (b) { return fmt(Math.round(b.start), 0) + '–' + fmt(Math.round(b.end), 0); }).join(', '));
  var dr = D.drops.filter(function (d) { return d.kind === 'drop'; }); if (dr.length) out.push('Drops: ' + dr.map(function (d) { return fmt(d.t, 1) + (d.main ? ' (main)' : ''); }).join(', '));
  return out.length ? ' ' + out.join('. ') + '.' : '';
}
function drawStruct() {
  var a = S.song && S.song.analysis;
  var cv = $('ssmCv'); if (!cv.offsetParent) return;
  var o = setupCanvas(cv), g = o.g; g.clearRect(0, 0, o.w, o.h);
  var cv2 = $('structCv'), o2 = setupCanvas(cv2), g2 = o2.g, w = o2.w, h = o2.h; g2.clearRect(0, 0, w, h);
  if (!a) { msg(g2, w, h, S.song ? 'Analysing…' : ''); return; }
  var D = a.ssmSize, oc = document.createElement('canvas'); oc.width = D; oc.height = D;
  var og = oc.getContext('2d'), id = og.createImageData(D, D), lut = spectroColor();
  for (var i = 0; i < D * D; i++) { var v = a.ssm[i]; v = Math.round(clamp((v - 128) * 2, 0, 255)); id.data[i * 4] = lut[v * 3]; id.data[i * 4 + 1] = lut[v * 3 + 1]; id.data[i * 4 + 2] = lut[v * 3 + 2]; id.data[i * 4 + 3] = 255; }
  og.putImageData(id, 0, 0); g.imageSmoothingEnabled = false; g.drawImage(oc, 0, 0, o.w, o.h);
  var dur = S.song.duration, pp = currentPos() / dur;
  g.strokeStyle = css('--accent'); g.lineWidth = 1.5; g.strokeRect(pp * o.w - 3, pp * o.h - 3, 6, 6);
  // right: sections bar, onset + beats, chroma
  var left = 10, pw = w - 20, y0 = 10;
  structGeom = { left: left, w: pw, barTop: y0 + 16, barH: 22, timeBottom: y0 + 58 + 90 + 12 };
  g2.font = '600 11px ' + css('--f-display'); g2.fillStyle = css('--muted'); g2.fillText('SECTIONS', left, y0 + 9);
  var labels = {}, cats = ['--vocals', '--drums', '--bass', '--other', '--accent', '--warn'];
  a.sections.forEach(function (sg) { if (!(sg.label in labels)) labels[sg.label] = Object.keys(labels).length; var x0 = left + sg.start / dur * pw, x1 = left + sg.end / dur * pw;
    g2.fillStyle = css(cats[labels[sg.label] % cats.length]); g2.globalAlpha = 0.85; g2.fillRect(x0 + 1, y0 + 16, x1 - x0 - 2, 22); g2.globalAlpha = 1;
    g2.fillStyle = css('--bg'); g2.font = '600 12px ' + css('--f-display'); if (x1 - x0 > 16) g2.fillText(sg.label, x0 + 6, y0 + 32); });
  var oy = y0 + 58, oh = 90; g2.fillStyle = css('--muted'); g2.font = '600 11px ' + css('--f-display'); g2.fillText('ONSETS AND BEATS · ' + a.bpm.toFixed(1) + ' BPM', left, oy - 4);
  var omx = 0; for (i = 0; i < a.onset.length; i++) if (a.onset[i] > omx) omx = a.onset[i];
  g2.fillStyle = css('--orig'); for (i = 0; i < a.onset.length; i++) { var vh = a.onset[i] / (omx || 1) * oh; g2.fillRect(left + i / a.onset.length * pw, oy + oh - vh, Math.max(1, pw / a.onset.length), vh); }
  g2.fillStyle = css('--accent'); a.beats.forEach(function (bt) { g2.fillRect(left + bt / dur * pw, oy + oh + 2, 1, 6); });
  var DY = a.dynamics; // build-up tension over the onsets, breakdowns shaded, drops marked
  if (DY && DY.tension) {
    DY.breakdowns.forEach(function (b) { g2.fillStyle = '#4d7cff'; g2.globalAlpha = 0.16; g2.fillRect(left + b.start / dur * pw, oy, (b.end - b.start) / dur * pw, oh); g2.globalAlpha = 1; });
    g2.strokeStyle = css('--accent'); g2.lineWidth = 2; g2.beginPath();
    for (i = 0; i < DY.tension.length; i++) { var tx = left + i / DY.rate / dur * pw, ty = oy + oh - DY.tension[i] * oh; if (!i) g2.moveTo(tx, ty); else g2.lineTo(tx, ty); } g2.stroke();
    DY.drops.forEach(function (d) { var dx = left + d.t / dur * pw; g2.fillStyle = css('--fg'); g2.globalAlpha = d.kind === 'drop' ? 1 : 0.5; g2.fillRect(dx - 1, oy - 2, 2, oh + 4); g2.font = '700 10px ' + css('--f-mono'); g2.fillText(d.kind === 'drop' ? (d.main ? 'DROP' : 'drop') : 'lift', dx + 3, oy + 9); g2.globalAlpha = 1; });
    g2.fillStyle = css('--muted'); g2.font = '600 11px ' + css('--f-display'); g2.textAlign = 'right'; g2.fillText('BUILD-UP TENSION ─  BREAKDOWN ▮', left + pw, oy - 4); g2.textAlign = 'left';
  }
  var cy = oy + oh + 34, chH = h - cy - 22; g2.fillStyle = css('--muted'); g2.fillText('PITCH CLASSES · KEY ' + a.key.toUpperCase(), left, cy - 6);
  var names = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'], bw = pw / 12;
  for (i = 0; i < 12; i++) { var bh = a.chroma[i] * chH; g2.fillStyle = css('--bass'); g2.fillRect(left + i * bw + 3, cy + chH - bh, bw - 6, bh); g2.fillStyle = css('--muted'); g2.font = '10.5px ' + css('--f-mono'); g2.textAlign = 'center'; g2.fillText(names[i], left + i * bw + bw / 2, h - 8); g2.textAlign = 'left'; }
  $('structNote').textContent = a.sections.length + ' sections detected (' + a.sections.map(function (s) { return s.label + ' ' + fmt(s.start, 0); }).join(', ') + '). Same letter = similar sound. Key estimate confidence ' + Math.round(a.keyScore * 100) + '%.' + dynText(a.dynamics);
}
var eqLast = -1;
function drawEq(force) {
  var cv = $('eqCv'); if (!cv.offsetParent) return;
  if (!S.song) return;
  var t = currentPos(); if (!force && Math.abs(t - eqLast) < 0.15 && S.playing) return; eqLast = t;
  var srcK = $('eqSrc').value, buf = srcK === 'orig' ? S.song.orig : (S.song.stems ? S.song.stems[srcK] : null);
  var o = setupCanvas(cv), g = o.g, w = o.w, h = o.h; g.clearRect(0, 0, w, h);
  if (!buf) { msg(g, w, h, 'Stems are still being prepared.'); return; }
  var sr = buf.sampleRate, N = 4096, c0 = Math.round(t * sr) - N / 2, L = buf.getChannelData(0), R = buf.getChannelData(1), seg = new Float32Array(N);
  for (var i = 0; i < N; i++) { var p = c0 + i; seg[i] = p >= 0 && p < L.length ? 0.5 * (L[p] + R[p]) : 0; }
  var P = DSP.partials(seg, sr, +$('eqN').value), pmax = Math.max.apply(null, P.map(function (q) { return q.amp; }).concat([0]));
  P = P.filter(function (q) { return q.amp > pmax * 0.003; });
  $('eqAt').textContent = 'at ' + fmt(t);
  var el = $('eqText'); el.innerHTML = ''; el.classList.toggle('control', amode === 'control');
  var head = document.createElement('span'); head.className = 'x'; head.textContent = 'x(t) ≈ '; el.appendChild(head);
  if (!P.length) el.append('0  (silence)');
  P.forEach(function (q, k) {
    var ph = ((q.phase % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    var s = document.createElement(amode === 'control' ? 'button' : 'span'); s.className = 'term' + (eqSel && Math.abs(eqSel.f - q.freq) < 0.5 ? ' on' : ''); if (amode === 'control') { s.type = 'button'; s.title = 'Tune ' + q.freq.toFixed(1) + ' Hz'; s.onclick = function () { eqSel = { f: q.freq, amp: q.amp }; renderEqCtrl(); drawEq(true); }; } s.textContent = (k ? ' + ' : '') + (q.amp >= 0.01 ? q.amp.toFixed(3) : q.amp.toPrecision(2)) + '·sin(2π·' + q.freq.toFixed(1) + 't + ' + ph.toFixed(2) + ')';
    if (amode === 'control' && k) { el.append(' + '); s.textContent = s.textContent.replace(/^ \+ /, ''); }
    el.appendChild(s); if (k % 2 === 1 && k < P.length - 1) el.appendChild(document.createElement('br'));
  });
  // waveform vs reconstruction, 25 ms window centred on playhead
  var win = Math.round(0.025 * sr), a0 = Math.floor(N / 2 - win / 2), mx = 1e-6;
  for (i = 0; i < win; i++) mx = Math.max(mx, Math.abs(seg[a0 + i]));
  var topH = h * 0.62, mid = topH / 2 + 6, sc = (topH / 2 - 10) / mx;
  g.strokeStyle = css('--line'); g.beginPath(); g.moveTo(0, mid + 0.5); g.lineTo(w, mid + 0.5); g.stroke();
  g.strokeStyle = css('--orig'); g.globalAlpha = 0.55; g.lineWidth = 2.5; g.beginPath();
  for (i = 0; i < win; i++) { var xx = i / win * w, yy = mid - seg[a0 + i] * sc; if (!i) g.moveTo(xx, yy); else g.lineTo(xx, yy); } g.stroke(); g.globalAlpha = 1;
  g.strokeStyle = css('--accent'); g.lineWidth = 1.5; g.beginPath();
  for (i = 0; i < win; i++) { var tt = (a0 + i - N / 2) / sr, v = 0; P.forEach(function (q) { v += q.amp * Math.sin(2 * Math.PI * q.freq * tt + q.phase); }); xx = i / win * w; yy = mid - v * sc; if (!i) g.moveTo(xx, yy); else g.lineTo(xx, yy); } g.stroke();
  g.fillStyle = css('--muted'); g.font = '10.5px ' + css('--f-mono'); g.fillText('−12.5 ms', 4, topH + 2); g.textAlign = 'right'; g.fillText('+12.5 ms', w - 4, topH + 2); g.textAlign = 'center'; g.fillText('playhead', w / 2, topH + 2); g.textAlign = 'left';
  // partial amplitudes on a log-frequency axis
  var by = topH + 14, bh = h - by - 18, fmin = 20, fmax = sr / 2, amx = Math.max.apply(null, P.map(function (q) { return q.amp; }).concat([1e-6]));
  var fx = function (f) { return 8 + (w - 16) * Math.log(f / fmin) / Math.log(fmax / fmin); };
  g.fillStyle = css('--muted');
  [50, 100, 1000, 10000].forEach(function (f) { g.fillText(f >= 1000 ? f / 1000 + 'k Hz' : f + ' Hz', fx(f) - 10, h - 4); g.fillRect(fx(f), by + bh, 1, 4); });
  P.forEach(function (q) { var x2 = fx(q.freq), hh = q.amp / amx * bh; g.fillStyle = css('--accent'); g.fillRect(x2 - 2, by + bh - hh, 4, hh); });
}
var fpView = null;
function drawFp() {
  var cv = $('fpCv'); if (!cv.offsetParent) return;
  var o = setupCanvas(cv), g = o.g, w = o.w, h = o.h; g.clearRect(0, 0, w, h);
  var fp = S.song && S.song.fp; if (!fp) { msg(g, w, h, S.song ? 'Fingerprinting…' : ''); return; }
  var t = currentPos(), span = 6, f0 = Math.max(0, (t - span / 2) * fp.fps), f1 = f0 + span * fp.fps;
  var left = 44, pw = w - left - 8, ph = h - 26, maxBin = 512;
  var X = function (fr) { return left + (fr - f0) / (f1 - f0) * pw; }, Y = function (b) { return 4 + ph * (1 - b / maxBin); };
  g.strokeStyle = css('--line'); g.fillStyle = css('--muted'); g.font = '10.5px ' + css('--f-mono'); g.textAlign = 'right';
  [0, 1000, 2000, 3000, 4000, 5000].forEach(function (f) { var y = Y(f / fp.binHz); g.beginPath(); g.moveTo(left, y + 0.5); g.lineTo(w - 8, y + 0.5); g.stroke(); g.fillText(f ? f / 1000 + 'k' : '0', left - 6, y + 3); });
  g.textAlign = 'left';
  var idx = [];
  for (var i = 0; i < fp.peakT.length; i++) if (fp.peakT[i] >= f0 && fp.peakT[i] <= f1) idx.push(i);
  // pair lines for a few anchors
  g.strokeStyle = css('--drums'); g.globalAlpha = 0.5; g.lineWidth = 1;
  var anchors = idx.filter(function (_, k) { return k % 37 === 5; }).slice(0, 6);
  anchors.forEach(function (ai) {
    var got = 0; for (var j = ai + 1; j < fp.peakT.length && got < 6; j++) { var dt = fp.peakT[j] - fp.peakT[ai]; if (dt < 1) continue; if (dt > 63) break; if (Math.abs(fp.peakF[j] - fp.peakF[ai]) > 120) continue;
      g.beginPath(); g.moveTo(X(fp.peakT[ai]), Y(fp.peakF[ai])); g.lineTo(X(fp.peakT[j]), Y(fp.peakF[j])); g.stroke(); got++; }
  });
  g.globalAlpha = 1;
  idx.forEach(function (k) { g.fillStyle = anchors.indexOf(k) >= 0 ? css('--drums') : css('--accent'); g.beginPath(); g.arc(X(fp.peakT[k]), Y(fp.peakF[k]), anchors.indexOf(k) >= 0 ? 4 : 2.2, 0, 7); g.fill(); });
  g.fillStyle = css('--accent'); g.fillRect(X(t * fp.fps) - 0.5, 4, 1, ph);
  g.fillStyle = css('--muted'); g.fillText(fmt(f0 / fp.fps) + '  ·  ' + idx.length + ' peaks in view  ·  ' + fp.hashes.length.toLocaleString() + ' hashes for the song', left, h - 6);
}
function drawHist(r) {
  var cv = $('histCv'), o = setupCanvas(cv), g = o.g, w = o.w, h = o.h; g.clearRect(0, 0, w, h);
  if (!r || !r.hist) { msg(g, w, h, 'Run a test to see the vote spike'); return; }
  var arr = []; r.hist.forEach(function (v, k) { arr.push([k, v]); });
  var mn = Infinity, mxk = -Infinity, mv = 0; arr.forEach(function (a) { mn = Math.min(mn, a[0]); mxk = Math.max(mxk, a[0]); mv = Math.max(mv, a[1]); });
  if (mxk === mn) mxk = mn + 1;
  g.fillStyle = css('--muted'); arr.forEach(function (a) { var x = 6 + (a[0] - mn) / (mxk - mn) * (w - 12), hh = a[1] / mv * (h - 26); g.fillStyle = a[1] === mv ? css('--good') : css('--faint'); g.fillRect(x - 1, h - 16 - hh, 2, Math.max(1, hh)); });
  g.fillStyle = css('--muted'); g.font = '10.5px ' + css('--f-mono'); g.fillText('offset 0:00', 6, h - 4); g.textAlign = 'right'; g.fillText(fmt(mxk / (r.fps || 43)), w - 6, h - 4); g.textAlign = 'left';
}
function drawMeter() {
  var cv = $('meter'), o = setupCanvas(cv), g = o.g, w = o.w, h = o.h; g.clearRect(0, 0, w, h);
  var bars = Math.max(24, Math.min(64, Math.floor(w / 9))), bw = w / bars;
  var data = null, sr = ctx ? ctx.sampleRate : 48000;
  if (analyser) { data = new Float32Array(analyser.frequencyBinCount); analyser.getFloatFrequencyData(data); }
  var acc = css('--accent'), dim = css('--line');
  for (var b = 0; b < bars; b++) {
    var fA = 30 * Math.pow(16000 / 30, b / bars), fB = 30 * Math.pow(16000 / 30, (b + 1) / bars), v = -100;
    if (data) { var kA = Math.floor(fA / (sr / 2) * data.length), kB = Math.max(kA + 1, Math.ceil(fB / (sr / 2) * data.length)); for (var k = kA; k < kB && k < data.length; k++) if (data[k] > v) v = data[k]; }
    var lvl = clamp((v + 90) / 80, 0, 1), segs = 14, on = Math.round(lvl * segs);
    for (var s = 0; s < segs; s++) { g.fillStyle = s < on ? (s >= segs - 2 ? css('--bad') : s >= segs - 5 ? css('--warn') : acc) : dim; g.globalAlpha = s < on ? 1 : 0.5; g.fillRect(b * bw + 1.5, h - 6 - (s + 1) * ((h - 10) / segs) + 1.5, bw - 3, (h - 10) / segs - 3); }
  }
  g.globalAlpha = 1;
}
function drawAll() { if (typeof drawVideo === 'function' && VID.view === 'video') drawVideo(); drawSpace(); drawMotionTl(); drawOverview(); drawZoom(); drawTimeline(); drawSpec(); drawBands(); drawStruct(); drawEq(true); drawFp(); drawMeter(); updateTime(); }
function updateTime() {
  var t = currentPos(); $('timeNow').textContent = fmt(t);
  if (!S.song) return;
  $('timeLeft').textContent = '-' + fmt(S.song.duration - t);
  var a = S.song.analysis, bb = '—';
  if (a && a.beats.length) { var lo = 0, hi = a.beats.length - 1, i = -1; while (lo <= hi) { var m = (lo + hi) >> 1; if (a.beats[m] <= t + 0.02) { i = m; lo = m + 1; } else hi = m - 1; } bb = i < 0 ? '0.0' : (Math.floor(i / 4) + 1) + '.' + (i % 4 + 1); }
  $('barBeat').textContent = bb;
}
var raf = 0;
function tick() {
  cancelAnimationFrame(raf);
  var fr = 0;
  (function loop() {
    if (!S.playing && !renderPlayer) { drawMeter(); return; }
    updateTime(); drawZoom(); drawOverview(); drawMeter(); drawVideo();
    if (VID.view === 'studio') { drawTimeline(); drawSpace(); }
    if (fr % 6 === 0) drawMotionTl();
    if (++fr % 6 === 0) { drawSpec(); drawBands(); drawEq(false); drawFp(); }
    if (S.playing) { var ri = regionAt(currentPos()); if (ri !== S.sel && !S.loop && followRegion) { S.sel = ri; renderRack(); } }
    raf = requestAnimationFrame(loop);
  })();
}
function meterLoop() { tick(); }
var followRegion = true;

// ---------- timeline interaction ----------
(function () {
  var cv = $('timeline'), drag = null;
  function tAt(e) { var r = cv.getBoundingClientRect(); return clamp((e.clientX - r.left) / r.width, 0, 1) * (S.song ? S.song.duration : 0); }
  function edgeAt(e) {
    if (!S.song) return -1; var r = cv.getBoundingClientRect(), x = e.clientX - r.left;
    for (var i = 1; i < S.recipe.regions.length; i++) { var bx = S.recipe.regions[i].start / S.song.duration * r.width; if (Math.abs(bx - x) < 6) return i; }
    return -1;
  }
  cv.addEventListener('pointermove', function (e) {
    if (drag) { var rs = S.recipe.regions, i = drag.i, t = clamp(tAt(e), rs[i - 1].start + 0.5, rs[i].end - 0.5); rs[i - 1].end = t; rs[i].start = t; drawTimeline(); renderRackTimes(); return; }
    var y = e.clientY - cv.getBoundingClientRect().top;
    cv.style.cursor = edgeAt(e) > 0 ? 'ew-resize' : (y < TL.strip ? 'pointer' : 'crosshair');
  });
  cv.addEventListener('pointerdown', function (e) {
    if (!S.song) return;
    var ei = edgeAt(e); if (ei > 0) { drag = { i: ei }; cv.setPointerCapture(e.pointerId); return; }
    var y = e.clientY - cv.getBoundingClientRect().top, t = tAt(e);
    if (y < TL.strip) { S.sel = regionAt(t); followRegion = false; renderRack(); drawTimeline(); if (S.loop && S.playing) play(S.recipe.regions[S.sel].start); }
    else { followRegion = true; seek(t); }
  });
  cv.addEventListener('pointerup', function () { if (drag) { drag = null; liveUpdateFix(); } });
})();
function renderRackTimes() { var reg = S.recipe.regions[S.sel]; $('regTime').textContent = fmt(reg.start) + ' – ' + fmt(reg.end); }
function splitAt() {
  var t = currentPos(), rs = S.recipe.regions, i = regionAt(t), r = rs[i];
  if (t - r.start < 0.5 || r.end - t < 0.5) { toast('Move the playhead at least half a second inside a region to split it.'); return; }
  var nr = { id: uid(), name: r.name + ' (b)', start: t, end: r.end, stems: JSON.parse(JSON.stringify(r.stems)), bands: (r.bands || freshBands()).slice() };
  r.end = t; rs.splice(i + 1, 0, nr); S.sel = i + 1; renderRack(); drawTimeline(); liveUpdateFix();
}
function mergeNext() {
  var rs = S.recipe.regions, i = S.sel; if (i >= rs.length - 1) { toast('This is the last region; pick an earlier one to merge.'); return; }
  rs[i].end = rs[i + 1].end; rs.splice(i + 1, 1); renderRack(); drawTimeline(); liveUpdateFix();
}

// ---------- clip identification ----------
function showId(r, expected) {
  var el = $('idResult'); el.innerHTML = '';
  var d = document.createElement('div'); d.className = 'result ' + (r.match ? 'ok' : 'no');
  var t1 = document.createElement('div'); t1.style.fontWeight = '600';
  t1.textContent = r.match ? 'Match: ' + r.match.title : 'No confident match';
  var t2 = document.createElement('div'); t2.className = 'mono muted'; t2.style.fontSize = '12px';
  t2.textContent = r.best ? ('clip starts at ' + fmt(r.offset) + (expected != null ? ' (true ' + fmt(expected) + ')' : '') + ' · ' + r.votes + ' aligned votes of ' + r.total + ' hashes · runner-up ' + r.runnerUp) : (r.total + ' hashes, none found in the library');
  d.appendChild(t1); d.appendChild(t2); el.appendChild(d);
  drawHist(r);
}
function testClip() {
  var s = S.song; if (!s || !s.fp) return;
  var len = Math.min(8, s.duration - 0.5), start = Math.random() * Math.max(0, s.duration - len), sr = s.sr, n = Math.round(len * sr), a = Math.round(start * sr);
  var clip = new Float32Array(n), snr = +$('snr').value, e = 0;
  for (var i = 0; i < n; i++) { clip[i] = s.mono[a + i] * 0.7; e += clip[i] * clip[i]; }
  if (snr < 90) { var rms = Math.sqrt(e / n), nr = rms / Math.pow(10, snr / 20) * Math.sqrt(3); for (i = 0; i < n; i++) clip[i] += (Math.random() * 2 - 1) * nr; }
  $('idResult').innerHTML = '<div class="muted" style="font-size:13px">Fingerprinting the clip…</div>';
  run('fingerprint', { mono: clip, sr: sr }, [clip.buffer]).then(function (fp) { showId(matchHashes(fp), start); });
}
function identifyFile(file) {
  if (!file) return;
  $('idResult').innerHTML = '<div class="muted" style="font-size:13px">Decoding and fingerprinting…</div>';
  decodeFile(file).then(function (buf) {
    var L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L, m = new Float32Array(buf.length);
    for (var i = 0; i < m.length; i++) m[i] = 0.5 * (L[i] + R[i]);
    return run('fingerprint', { mono: m, sr: buf.sampleRate }, [m.buffer]);
  }).then(function (fp) { showId(matchHashes(fp)); }).catch(function (e) { $('idResult').textContent = e.message; });
}

// ---------- AI split (HTDemucs in the browser, or a self-hosted server) ----------
var ORT_VER = '1.20.1', ORT_BASE = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@' + ORT_VER + '/dist/';
var aiWorker = null, aiBusy = false;
function aiUI(running) {
  $('aiRun').hidden = !running; $('aiStart').disabled = running || !S.song;
  $('aiCancel').textContent = running ? 'Cancel' : 'Close';
  $('aiGpu').disabled = running; $('srvUrl').disabled = running; $('srvToken').disabled = running;
}
function aiProgress(p, text) { $('aiBar').style.width = Math.round(p * 100) + '%'; $('aiText').textContent = text; status(text, p); }
function fmtMin(sec) { sec = Math.max(0, Math.round(sec)); return sec < 90 ? sec + ' s' : Math.round(sec / 60) + ' min'; }
function aiEstimate() {
  if (!S.song) return '';
  var gpu = $('aiGpu').checked && !!navigator.gpu, d = S.song.duration;
  return 'Rough time for this ' + fmt(d, 0) + ' song: ' + (gpu ? 'about ' + fmtMin(d * 0.6) + ' to ' + fmtMin(d * 2.5) + ' with WebGPU' : 'about ' + fmtMin(d * 1.5) + ' to ' + fmtMin(d * 4) + ' on the CPU') + '. The exact estimate appears after the first chunk.';
}
function openAI() {
  $('aiPanel').hidden = false; $('aiEstimate').textContent = aiEstimate(); aiUI(aiBusy);
  if (!navigator.gpu) $('aiGpu').parentElement.lastChild.textContent = ' Use the graphics chip (WebGPU) when available — not available in this browser';
  $('aiPanel').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
function resampleTo(buf, rate) {
  if (buf.sampleRate === rate) return Promise.resolve(buf);
  var oc = new OfflineAudioContext(buf.numberOfChannels, Math.ceil(buf.duration * rate), rate), s = oc.createBufferSource();
  s.buffer = buf; s.connect(oc.destination); s.start(); return oc.startRendering();
}
function stemsFromParts(parts) { // parts: {drums:[L,R], bass, vocals} at 44.1 kHz -> setStems at song rate with exact residual
  var c = getCtx(), sr0 = 44100, names = ['drums', 'bass', 'vocals'];
  return Promise.all(names.map(function (n) {
    var b = c.createBuffer(2, parts[n][0].length, sr0); b.copyToChannel(parts[n][0], 0); b.copyToChannel(parts[n][1], 1); return resampleTo(b, S.song.sr);
  })).then(function (bufs) {
    var len = S.song.orig.length, st = {}, oL = S.song.orig.getChannelData(0), oR = S.song.orig.getChannelData(1);
    var rL = new Float32Array(len), rR = new Float32Array(len); rL.set(oL); rR.set(oR);
    bufs.forEach(function (b, i) {
      var L = new Float32Array(len), R = new Float32Array(len), bl = b.getChannelData(0), br = b.getChannelData(1), n = Math.min(len, b.length);
      L.set(bl.subarray(0, n)); R.set(br.subarray(0, n));
      for (var k = 0; k < len; k++) { rL[k] -= L[k]; rR[k] -= R[k]; }
      st[names[i]] = [L, R];
    });
    st.other = [rL, rR];
    return st;
  });
}
function runServer(url, token) {
  url = url.replace(/\/+$/, '');
  aiProgress(0.05, 'Uploading to ' + url + '…');
  var wav = wavBlob(S.song.orig), fd = new FormData();
  fd.append('file', new Blob([wav], { type: 'audio/wav' }), 'song.wav');
  var headers = {}; if (token) headers.Authorization = 'Bearer ' + token;
  var ctrl = new AbortController(); aiWorker = { terminate: function () { ctrl.abort(); } };
  return fetch(url + '/separate', { method: 'POST', body: fd, headers: headers, signal: ctrl.signal }).then(function (r) {
    if (!r.ok) return r.text().then(function (t) { throw new Error('Server said ' + r.status + ': ' + t.slice(0, 160)); });
    aiProgress(0.8, 'Receiving stems…'); return r.arrayBuffer();
  }).then(function (ab) {
    var files = unzip(new Uint8Array(ab)), parts = {};
    return Promise.all(['drums', 'bass', 'vocals'].map(function (n) {
      var f = files.find(function (x) { return x.name.indexOf(n) >= 0; }); if (!f) throw new Error('The server reply has no ' + n + ' stem');
      return getCtx().decodeAudioData(f.data.slice().buffer).then(function (b) { return resampleTo(b, 44100); }).then(function (b) { parts[n] = [b.getChannelData(0), b.getChannelData(1)]; });
    })).then(function () { return parts; });
  }).catch(function (e) {
    if (e.name === 'AbortError') throw new Error('cancelled');
    if (e instanceof TypeError) throw new Error('Could not reach ' + url + '. Check the server is running and allows this page (CORS). Pages opened on claude.ai cannot reach outside servers.');
    throw e;
  });
}
function unzip(u8) { // stored or deflated entries are listed; the server writes stored entries
  var v = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), out = [], p = 0, dec = new TextDecoder();
  while (p + 30 <= u8.length && v.getUint32(p, true) === 0x04034b50) {
    var method = v.getUint16(p + 8, true), csize = v.getUint32(p + 18, true), nlen = v.getUint16(p + 26, true), xlen = v.getUint16(p + 28, true);
    var name = dec.decode(u8.subarray(p + 30, p + 30 + nlen)), start = p + 30 + nlen + xlen;
    if (method !== 0) throw new Error('Compressed zip entries are not supported; the server should store files uncompressed.');
    out.push({ name: name.toLowerCase(), data: u8.subarray(start, start + csize) }); p = start + csize;
  }
  return out;
}
function runBrowser(gpu) {
  return fetch('model/manifest.json').then(function (r) { if (!r.ok) throw new Error('The AI model files are not published next to this page (model/manifest.json missing).'); return r.json(); }).then(function (manifest) {
    return resampleTo(S.song.orig, 44100).then(function (b) {
      var L = new Float32Array(b.getChannelData(0)), R = new Float32Array(b.getChannelData(1));
      var src = $('ai-src').textContent, w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      aiWorker = w;
      var threads = self.crossOriginIsolated ? Math.min(8, navigator.hardwareConcurrency || 4) : 1;
      return new Promise(function (res, rej) {
        w.onmessage = function (e) {
          var d = e.data;
          if (d.stage === 'download') aiProgress(d.p * 0.15, 'Downloading the AI model… ' + Math.round(d.p * 100) + '% (first time only)');
          else if (d.stage === 'prepare') aiProgress(0.16, 'Preparing the model…');
          else if (d.stage === 'ready') aiProgress(0.18, 'Separating on ' + (d.ep === 'webgpu' ? 'WebGPU' : 'the CPU' + (d.threads > 1 ? ' (' + d.threads + ' threads)' : '')) + '…');
          else if (d.stage === 'note') toast(d.text);
          else if (d.stage === 'split') aiProgress(0.18 + d.p * 0.8, 'Separating on ' + (d.ep === 'webgpu' ? 'WebGPU' : 'CPU' + (threads > 1 ? ' ×' + threads : '')) + ' · ' + Math.round(d.p * 100) + '% · about ' + fmtMin(d.eta) + ' left');
          else if (d.stage === 'done') { w.terminate(); aiWorker = null; res(d.stems); }
          else if (d.stage === 'error') { w.terminate(); aiWorker = null; rej(new Error(d.message)); }
        };
        w.onerror = function (e) { rej(new Error(e.message || 'The AI worker failed to start')); };
        var base = new URL('model/', location.href).href;
        w.postMessage({ type: 'run', manifest: manifest, base: base, ortUrl: ORT_BASE + 'ort.webgpu.min.js', ortBase: ORT_BASE, threads: threads, gpu: gpu, L: L, R: R }, [L.buffer, R.buffer]);
      });
    });
  });
}
function startAI() {
  if (!S.song || aiBusy) return;
  var token0 = loadToken, url = $('srvUrl').value.trim(), t0 = Date.now();
  aiBusy = true; aiUI(true); aiProgress(0.01, 'Starting…');
  var job = url ? runServer(url, $('srvToken').value.trim()) : runBrowser($('aiGpu').checked);
  job.then(function (parts) {
    if (token0 !== loadToken) return;
    aiProgress(0.99, 'Building stems…');
    return stemsFromParts(parts).then(function (st) {
      stop(true); setStems(st, 'AI · HTDemucs'); renderRack();
      var took = (Date.now() - t0) / 1000;
      aiProgress(1, 'Done in ' + fmtMin(took) + '. Stems: AI · HTDemucs');
      toast('AI stems ready'); setTimeout(function () { status('Ready', 0); }, 3000);
    });
  }).catch(function (e) {
    if (e.message === 'cancelled') { aiProgress(0, 'Cancelled'); return; }
    console.error(e); aiProgress(0, 'AI split failed: ' + e.message);
  }).then(function () { aiBusy = false; aiUI(false); });
}
function cancelAI() {
  if (aiBusy && aiWorker) { aiWorker.terminate(); aiWorker = null; aiBusy = false; aiUI(false); aiProgress(0, 'Cancelled'); return; }
  $('aiPanel').hidden = true;
}

// ---------- AI stems import ----------
function importStems(files) {
  if (!S.song) { toast('Open the song first, then load its stems.'); return; }
  var map = {};
  Array.prototype.forEach.call(files, function (f) { var n = f.name.toLowerCase(); STEMS.forEach(function (s) { if (n.indexOf(s) >= 0 && !map[s]) map[s] = f; }); if (!map.other && /(accomp|instrum|no_vocals|rest)/.test(n)) map.other = f; });
  var missing = STEMS.filter(function (s) { return !map[s]; });
  if (missing.length) { toast('Missing a file for: ' + missing.join(', ') + '. Name files with the stem in them, e.g. song_vocals.wav.'); return; }
  status('Loading AI stems…', 0.3);
  Promise.all(STEMS.map(function (s) { return decodeFile(map[s]); })).then(function (bufs) {
    var len = S.song.orig.length, st = {};
    bufs.forEach(function (b, i) { var L = new Float32Array(len), R = new Float32Array(len), bl = b.getChannelData(0), br = b.numberOfChannels > 1 ? b.getChannelData(1) : bl; L.set(bl.subarray(0, len)); R.set(br.subarray(0, len)); st[STEMS[i]] = [L, R]; });
    stop(true); setStems(st, 'Imported stem files'); status('Ready', 0); toast('AI stems loaded');
  }).catch(function (e) { status(e.message, 0); });
}

// ---------- wiring ----------
$('fileIn').onchange = function (e) { openFile(e.target.files[0]); e.target.value = ''; };
$('demoBtn').onclick = function () { loadBuffer(makeDemo(), 'Demo groove (synthesized)'); };
$('playBtn').onclick = function () { if (S.playing) stop(true); else { followRegion = true; play(); } drawAll(); };
$('stopBtn').onclick = function () { stop(false); S.pos = 0; drawAll(); };
$('abA').onclick = function () { setAB('A'); };
$('abB').onclick = function () { setAB('B'); };
$('loopBtn').onclick = function () { S.loop = !S.loop; $('loopBtn').classList.toggle('on', S.loop); if (S.playing) play(S.loop ? S.recipe.regions[S.sel].start : currentPos()); };
$('splitBtn').onclick = splitAt;
$('modePads').onclick = function () { rackMode = 'pads'; try { localStorage.setItem('rl-mode', rackMode); } catch (e) {} renderRack(); };
$('modeSliders').onclick = function () { rackMode = 'sliders'; try { localStorage.setItem('rl-mode', rackMode); } catch (e) {} renderRack(); };
$('zoomIn').onclick = function () { setZoom(zoomSpan / 2); };
$('zoomOut').onclick = function () { setZoom(zoomSpan * 2); };
$('mergeBtn').onclick = mergeNext;
$('resetRegBtn').onclick = function () { seedRegions(); renderRack(); drawTimeline(); liveUpdateFix(); };
$('copyAllBtn').onclick = function () { var src = S.recipe.regions[S.sel].stems; var srcB = (S.recipe.regions[S.sel].bands || freshBands()).slice(); S.recipe.regions.forEach(function (r) { r.stems = JSON.parse(JSON.stringify(src)); r.bands = srcB.slice(); }); drawTimeline(); liveUpdateFix(); toast('Copied to all ' + S.recipe.regions.length + ' regions'); };
$('resetRegionBtn').onclick = function () { S.recipe.regions[S.sel].stems = freshStems(); S.recipe.regions[S.sel].bands = freshBands(); renderRack(); drawTimeline(); liveUpdateFix(); };
$('regName').oninput = function () { S.recipe.regions[S.sel].name = this.value || 'Region'; drawTimeline(); };
$('saveVerBtn').onclick = saveVersion;
$('exportJsonBtn').onclick = function () { var n = $('verName').value.trim() || currentVersionName || 'recipe'; saveFile(safeName(S.song.title) + '-' + safeName(n) + '.json', recipeJSON(n)); };
$('jsonIn').onchange = function (e) { var f = e.target.files[0]; e.target.value = ''; if (!f || !S.song) return; f.text().then(function (t) { var rc = JSON.parse(t); applyRecipe(rc, rc.name); }).catch(function () { toast('That file is not a valid recipe.'); }); };
$('renderBtn').onclick = function () { doRender(false); };
$('renderKeepBtn').onclick = function () { doRender(true); };
$('testClipBtn').onclick = testClip;
$('clipIn').onchange = function (e) { identifyFile(e.target.files[0]); e.target.value = ''; };
$('aiBtn').onclick = openAI;
$('aiStart').onclick = startAI;
$('aiCancel').onclick = cancelAI;
$('aiGpu').onchange = function () { $('aiEstimate').textContent = aiEstimate(); };
$('stemIn').onchange = function (e) { importStems(e.target.files); e.target.value = ''; };
$('eqSrc').onchange = function () { eqSel = null; drawEq(true); renderEqCtrl(); };
$('eqN').onchange = function () { drawEq(true); };
document.querySelectorAll('.tabs button').forEach(function (b) {
  b.onclick = function () {
    document.querySelectorAll('.tabs button').forEach(function (x) { x.classList.toggle('on', x === b); });
    document.querySelectorAll('.view').forEach(function (v) { v.classList.toggle('on', v.id === 'v-' + b.dataset.v); });
    drawAll();
  };
});
document.addEventListener('keydown', function (e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  if (e.key === ' ') { e.preventDefault(); $('playBtn').click(); }
  else if (e.key === 'a' || e.key === 'A') setAB('A');
  else if (e.key === 'b' || e.key === 'B') setAB('B');
  else if (e.key === '+' || e.key === '=') setZoom(zoomSpan / 2);
  else if (e.key === '-' || e.key === '_') setZoom(zoomSpan * 2);
});
var dragDepth = 0;
window.addEventListener('dragenter', function (e) { e.preventDefault(); dragDepth++; $('dropOverlay').hidden = false; });
window.addEventListener('dragleave', function () { if (--dragDepth <= 0) { dragDepth = 0; $('dropOverlay').hidden = true; } });
window.addEventListener('dragover', function (e) { e.preventDefault(); });
window.addEventListener('drop', function (e) { e.preventDefault(); dragDepth = 0; $('dropOverlay').hidden = true; var f = e.dataTransfer.files[0]; if (f) openFile(f); });
var rzT; window.addEventListener('resize', function () { clearTimeout(rzT); rzT = setTimeout(function () { drawAll(); Object.keys(padCanvases).forEach(drawPad); }, 120); });
try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { specImg = null; ovImg = null; drawAll(); renderRack(); }); } catch (e) {}
new MutationObserver(function () { specImg = null; ovImg = null; drawAll(); renderRack(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

// ---------- deck: 3-band colour waveform ----------
function waveColors(buf) {
  var sr = buf.sampleRate, L = buf.getChannelData(0), R = buf.getChannelData(1), n = buf.length, B = 256, nb = Math.ceil(n / B);
  var lo = new Float32Array(nb), mi = new Float32Array(nb), hi = new Float32Array(nb);
  var a1 = Math.exp(-2 * Math.PI * 200 / sr), a2 = Math.exp(-2 * Math.PI * 3500 / sr), l1 = 0, l2 = 0, h1 = 0, h2 = 0;
  for (var i = 0; i < n; i++) {
    var x = 0.5 * (L[i] + R[i]);
    l1 = a1 * l1 + (1 - a1) * x; l2 = a1 * l2 + (1 - a1) * l1;
    h1 = a2 * h1 + (1 - a2) * x; h2 = a2 * h2 + (1 - a2) * h1;
    var b = (i / B) | 0, vl = Math.abs(l2), vm = Math.abs(h2 - l2), vh = Math.abs(x - h2);
    if (vl > lo[b]) lo[b] = vl; if (vm > mi[b]) mi[b] = vm; if (vh > hi[b]) hi[b] = vh;
  }
  function norm(a) { var c = Array.prototype.slice.call(a).sort(function (p, q) { return p - q; }), ref = c[Math.floor(c.length * 0.995)] || 1; for (var k = 0; k < a.length; k++) a[k] = Math.min(1, a[k] / ref); }
  norm(lo); norm(mi); norm(hi);
  return { lo: lo, mi: mi, hi: hi, bps: sr / B, n: nb };
}
var BAND_LAYERS = [['lo', '--wf-low', 1], ['mi', '--wf-mid', 0.72], ['hi', '--wf-high', 0.42]];
function bandMax(arr, b0, b1) { var v = 0; if (b1 <= b0) b1 = b0 + 1; for (var b = Math.max(0, b0); b < b1 && b < arr.length; b++) if (arr[b] > v) v = arr[b]; return v; }
var zoomSpan = 8;
function setZoom(s) { zoomSpan = clamp(s, 2, 64); drawZoom(); toastZoom(); }
function toastZoom() { toast('Zoom: ' + zoomSpan + ' s across the deck'); }
function regionHue(i) { return ['--vocals', '--drums', '--bass', '--other', '--accent', '--warn'][i % 6]; }
function drawZoom() {
  var cv = $('zoomWave'), o = setupCanvas(cv), g = o.g, w = o.w, h = o.h; g.clearRect(0, 0, w, h);
  if (!S.song || !S.wc) return;
  var wc = S.wc, pos = currentPos(), span = zoomSpan, t0 = pos - span / 2, top = 16, mid = top + (h - top) / 2, amp = (h - top) / 2 - 3;
  // beat grid
  var a = S.song.analysis;
  if (a) {
    g.font = '500 10px ' + css('--f-mono');
    a.beats.forEach(function (bt, i) {
      if (bt < t0 || bt > t0 + span) return;
      var x = (bt - t0) / span * w, bar = i % 4 === 0;
      g.fillStyle = css(bar ? '--faint' : '--line'); g.fillRect(Math.round(x), top, bar ? 1.5 : 1, h - top);
      if (bar && span <= 32) { g.fillStyle = css('--muted'); g.fillText(String(i / 4 + 1), x + 3, 11); }
    });
  }
  // layered bands
  var cols = BAND_LAYERS.map(function (L) { return css(L[1]); });
  BAND_LAYERS.forEach(function (L, li) {
    var arr = wc[L[0]], sc = L[2]; g.fillStyle = cols[li];
    for (var px = 0; px < w; px++) {
      var ta = t0 + px / w * span, tb = t0 + (px + 1) / w * span; if (tb < 0 || ta > S.song.duration) continue;
      var v = bandMax(arr, Math.floor(ta * wc.bps), Math.floor(tb * wc.bps)) * sc * amp;
      if (v > 0.3) g.fillRect(px, mid - v, 1, 2 * v);
    }
  });
  // regions: boundary flags
  S.recipe.regions.forEach(function (r, i) {
    if (r.start < t0 || r.start > t0 + span) return;
    var x = (r.start - t0) / span * w; g.fillStyle = css(i === S.sel ? '--accent' : regionHue(i)); g.fillRect(x - 1, 0, 2, h);
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 8, 0); g.lineTo(x, 8); g.fill();
    g.font = '600 11px ' + css('--f-display'); g.fillText(r.name, x + 10, 11);
  });
  // played half dimmed, playhead
  g.fillStyle = css('--panel-2'); g.globalAlpha = 0.38; g.fillRect(0, top, w / 2, h - top); g.globalAlpha = 1;
  g.fillStyle = css('--accent'); g.fillRect(w / 2 - 1, 0, 2, h);
  g.beginPath(); g.moveTo(w / 2 - 6, 0); g.lineTo(w / 2 + 6, 0); g.lineTo(w / 2, 7); g.fill();
  g.beginPath(); g.moveTo(w / 2 - 6, h); g.lineTo(w / 2 + 6, h); g.lineTo(w / 2, h - 7); g.fill();
}
var ovImg = null;
function drawOverview() {
  var cv = $('overview'), o = setupCanvas(cv), g = o.g, w = o.w, h = o.h; g.clearRect(0, 0, w, h);
  if (!S.song || !S.wc) return;
  var dur = S.song.duration, wc = S.wc, stripH = 6, mid = (h - stripH) / 2, amp = mid - 2, key = w + '|' + css('--wf-low') + '|' + css('--panel-2');
  if (!ovImg || ovImg.key !== key || ovImg.wc !== wc) {
    var dpr = window.devicePixelRatio || 1, oc = document.createElement('canvas'); oc.width = Math.round(w * dpr); oc.height = Math.round(h * dpr);
    var og = oc.getContext('2d'); og.setTransform(dpr, 0, 0, dpr, 0, 0);
    BAND_LAYERS.forEach(function (L) {
      og.fillStyle = css(L[1]); var arr = wc[L[0]];
      for (var px = 0; px < w; px++) { var v = bandMax(arr, Math.floor(px / w * wc.n), Math.floor((px + 1) / w * wc.n)) * L[2] * amp; if (v > 0.3) og.fillRect(px, mid - v, 1, 2 * v); }
    });
    ovImg = oc; ovImg.key = key; ovImg.wc = wc;
  }
  g.drawImage(ovImg, 0, 0, w, h);
  var DY = S.song.analysis && S.song.analysis.dynamics;
  if (DY && DY.tension) { // build-ups as a rising orange curve, breakdowns shaded blue, drops as white lines
    var top = h - stripH;
    DY.breakdowns.forEach(function (b) { g.fillStyle = '#4d7cff'; g.globalAlpha = 0.14; g.fillRect(b.start / dur * w, 0, (b.end - b.start) / dur * w, top); });
    g.globalAlpha = 0.9; g.fillStyle = 'rgba(255,255,255,0.22)'; g.strokeStyle = '#fff'; g.lineWidth = 1;
    DY.builds.forEach(function (b) {
      if (b.peak < 0.45) return; var i0 = Math.floor(b.start * DY.rate), i1 = Math.min(DY.tension.length - 1, Math.ceil(b.end * DY.rate));
      g.beginPath(); g.moveTo(b.start / dur * w, top);
      for (var i = i0; i <= i1; i++) g.lineTo(i / DY.rate / dur * w, top - DY.tension[i] * top * 0.9);
      g.lineTo(i1 / DY.rate / dur * w, top); g.closePath(); g.fill(); g.stroke();
    });
    DY.drops.forEach(function (d) {
      var x = d.t / dur * w; g.globalAlpha = d.kind === 'drop' ? 1 : 0.5; g.fillStyle = css('--fg'); g.fillRect(x - (d.main ? 1 : 0.5), 0, d.main ? 2 : 1, top);
      g.beginPath(); g.moveTo(x - 5, 0); g.lineTo(x + 5, 0); g.lineTo(x, 7); g.closePath(); g.fill();
    });
    g.globalAlpha = 1;
  }
  S.recipe.regions.forEach(function (r, i) {
    var x0 = r.start / dur * w, x1 = r.end / dur * w;
    g.fillStyle = css(i === S.sel ? '--accent' : regionHue(i)); g.globalAlpha = i === S.sel ? 1 : 0.55; g.fillRect(x0 + 1, h - stripH, x1 - x0 - 2, stripH - 1); g.globalAlpha = 1;
    if (i) { g.fillStyle = css('--fg'); g.globalAlpha = 0.5; g.fillRect(x0, 0, 1, h - stripH); g.globalAlpha = 1; }
  });
  var px2 = currentPos() / dur * w;
  g.fillStyle = css('--panel-2'); g.globalAlpha = 0.5; g.fillRect(0, 0, px2, h - stripH); g.globalAlpha = 1;
  g.fillStyle = css('--accent'); g.fillRect(px2 - 1, 0, 2, h);
  var lw = zoomSpan / dur * w; g.strokeStyle = css('--accent'); g.globalAlpha = 0.6; g.strokeRect(px2 - lw / 2, 0.5, lw, h - stripH - 1); g.globalAlpha = 1;
}
(function () {
  var ov = $('overview'), zw = $('zoomWave'), drag = null;
  function ovSeek(e) { if (!S.song) return; var r = ov.getBoundingClientRect(); followRegion = true; seek(clamp((e.clientX - r.left) / r.width, 0, 1) * S.song.duration); }
  ov.addEventListener('pointerdown', function (e) { ov.setPointerCapture(e.pointerId); drag = 'ov'; ovSeek(e); });
  ov.addEventListener('pointermove', function (e) { if (drag === 'ov') ovSeek(e); });
  ov.addEventListener('pointerup', function () { drag = null; });
  zw.addEventListener('pointerdown', function (e) {
    if (!S.song) return; zw.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, p: currentPos(), was: S.playing }; if (S.playing) stop(true);
  });
  zw.addEventListener('pointermove', function (e) {
    if (!drag || drag === 'ov') return; var w = zw.getBoundingClientRect().width;
    S.pos = clamp(drag.p - (e.clientX - drag.x) / w * zoomSpan, 0, S.song.duration); drawZoom(); drawOverview(); drawTimeline(); updateTime();
  });
  zw.addEventListener('pointerup', function () { if (!drag || drag === 'ov') return; var was = drag.was; drag = null; followRegion = true; if (was) play(S.pos); else drawAll(); });
  zw.addEventListener('wheel', function (e) { if (!e.ctrlKey) return; e.preventDefault(); setZoom(zoomSpan * (e.deltaY > 0 ? 1.25 : 0.8)); }, { passive: false });
})();

// ---------- touch pads ----------
var padTrails = {}, padCanvases = {};
function paramDef(scope, k) { return (scope === 'master' ? MPARAMS : PARAMS).find(function (p) { return p.k === k; }); }
function padApply(scope, st, x, y) {
  var pm = PADMAP[scope], acc = {};
  [['x', x], ['y', y]].forEach(function (ax) { var map = pm[ax[0]].map, v = ax[1]; Object.keys(map).forEach(function (k) { acc[k] = (acc[k] || 0) + (v < 0 ? -v * map[k][0] : v * map[k][1]); }); });
  Object.keys(acc).forEach(function (k) { var p = paramDef(scope, k), v = clamp(p.def + acc[k], p.min, p.max); st[k] = Math.round(v / p.step) * p.step; });
}
function padReadout(scope, st) {
  var pm = PADMAP[scope], keys = Object.keys(Object.assign({}, pm.x.map, pm.y.map)), parts = [];
  keys.forEach(function (k) {
    var p = paramDef(scope, k), v = st[k]; if (Math.abs(v - p.def) < 1e-6) return;
    var txt = k === 'decay' ? (v < 34 ? 'short' : v < 67 ? 'medium' : 'long') : ((v > 0 && p.unit === ' dB' ? '+' : '') + (+v.toFixed(1)) + p.unit);
    parts.push(p.label + ' <b>' + txt + '</b>');
  });
  return parts.length ? parts.join(' · ') : 'Centre: untouched sound';
}
function drawPad(scope) {
  var cv = padCanvases[scope]; if (!cv || !cv.isConnected) return;
  var st = scope === 'master' ? S.recipe.master : S.recipe.regions[S.sel].stems[scope], pm = PADMAP[scope];
  var o = setupCanvas(cv), g = o.g, w = o.w, h = o.h, col = css(scope === 'master' ? '--accent' : '--' + scope);
  g.clearRect(0, 0, w, h);
  var pad = st.pad || { x: 0, y: 0 }, px = (pad.x + 1) / 2 * w, py = (1 - pad.y) / 2 * h;
  var grd = g.createRadialGradient(px, py, 4, px, py, w * 0.75); grd.addColorStop(0, col); grd.addColorStop(1, 'transparent');
  g.globalAlpha = 0.16; g.fillStyle = grd; g.fillRect(0, 0, w, h); g.globalAlpha = 1;
  g.strokeStyle = css('--line'); g.lineWidth = 1;
  for (var i = 1; i < 4; i++) { var gx = Math.round(i * w / 4) + 0.5, gy = Math.round(i * h / 4) + 0.5; g.beginPath(); g.moveTo(gx, 0); g.lineTo(gx, h); g.moveTo(0, gy); g.lineTo(w, gy); g.stroke(); }
  g.strokeStyle = css('--faint'); g.beginPath(); g.arc(w / 2, h / 2, 6, 0, 7); g.stroke();
  g.fillStyle = css('--muted'); g.font = '600 10.5px ' + css('--f-display'); g.textAlign = 'center';
  g.fillText(pm.y.pos.toUpperCase(), w / 2, 14); g.fillText(pm.y.neg.toUpperCase(), w / 2, h - 7);
  g.save(); g.translate(11, h / 2); g.rotate(-Math.PI / 2); g.fillText(pm.x.neg.toUpperCase(), 0, 3); g.restore();
  g.save(); g.translate(w - 11, h / 2); g.rotate(Math.PI / 2); g.fillText(pm.x.pos.toUpperCase(), 0, 3); g.restore();
  g.textAlign = 'left';
  var tr = padTrails[scope] || [];
  for (i = 1; i < tr.length; i++) { g.strokeStyle = col; g.globalAlpha = i / tr.length * 0.6; g.lineWidth = 2; g.beginPath(); g.moveTo((tr[i - 1].x + 1) / 2 * w, (1 - tr[i - 1].y) / 2 * h); g.lineTo((tr[i].x + 1) / 2 * w, (1 - tr[i].y) / 2 * h); g.stroke(); }
  g.globalAlpha = 0.25; g.fillStyle = col; g.beginPath(); g.arc(px, py, 18, 0, 7); g.fill(); g.globalAlpha = 1;
  g.beginPath(); g.arc(px, py, 10, 0, 7); g.fill(); g.strokeStyle = css('--fg'); g.lineWidth = 2; g.stroke();
}
var luPending = false;
function liveSoon() { if (luPending) return; luPending = true; requestAnimationFrame(function () { luPending = false; liveUpdateFix(); }); }
function renderPads() {
  var el = $('rack'); el.innerHTML = ''; padCanvases = {};
  if (!S.recipe) return;
  var reg = S.recipe.regions[S.sel];
  $('regName').value = reg.name; $('regTime').textContent = fmt(reg.start) + ' – ' + fmt(reg.end);
  STEMS.concat(['master']).forEach(function (scope) {
    var isM = scope === 'master', st = isM ? S.recipe.master : reg.stems[scope];
    if (!st.pad) st.pad = { x: 0, y: 0 };
    var strip = document.createElement('div'); strip.className = 'strip' + (isM ? ' master' : '') + (!isM && st.mute ? ' dim' : '');
    if (!isM) strip.style.setProperty('--c', 'var(--' + scope + ')');
    var h = document.createElement('h3'); h.textContent = isM ? 'Master' : STEM_LABEL[scope];
    if (!isM) {
      var ms = document.createElement('div'); ms.className = 'ms';
      var mb = document.createElement('button'); mb.className = 'm' + (st.mute ? ' on' : ''); mb.textContent = 'M'; mb.title = 'Mute in this region'; mb.setAttribute('aria-pressed', st.mute);
      mb.onclick = function () { st.mute = !st.mute; renderRack(); liveUpdateFix(); drawTimeline(); };
      var sb = document.createElement('button'); sb.className = 's' + (S.solo[scope] ? ' on' : ''); sb.textContent = 'S'; sb.title = 'Solo while listening'; sb.setAttribute('aria-pressed', !!S.solo[scope]);
      sb.onclick = function () { S.solo[scope] = !S.solo[scope]; renderRack(); liveUpdateFix(); };
      ms.appendChild(mb); ms.appendChild(sb); h.appendChild(ms);
    } else { var sm = document.createElement('span'); sm.className = 'label'; sm.textContent = 'whole song'; h.appendChild(sm); }
    strip.appendChild(h);
    var cv = document.createElement('canvas'); cv.className = 'pad'; cv.setAttribute('role', 'slider'); cv.tabIndex = 0;
    cv.setAttribute('aria-label', (isM ? 'Master' : STEM_LABEL[scope]) + ' pad: left ' + PADMAP[scope].x.neg + ', right ' + PADMAP[scope].x.pos + ', down ' + PADMAP[scope].y.neg + ', up ' + PADMAP[scope].y.pos);
    strip.appendChild(cv); padCanvases[scope] = cv;
    var ro = document.createElement('div'); ro.className = 'readout'; ro.innerHTML = padReadout(scope, st); strip.appendChild(ro);
    var lvl = isM ? MPARAMS.find(function (p) { return p.k === 'out'; }) : Object.assign({}, PARAMS[0], { label: 'Level' });
    var lvlRow = ctl((isM ? 'm-' : scope + '-') + (isM ? 'out' : 'gain'), lvl, isM ? st.out : st.gain, function (v) { if (isM) st.out = v; else st.gain = v; liveSoon(); });
    strip.appendChild(lvlRow);
    if (isM) {
      var lw = document.createElement('label'); lw.className = 'row'; lw.style.fontSize = '12.5px'; lw.style.gap = '6px';
      var cb = document.createElement('input'); cb.type = 'checkbox'; cb.id = 'm-limiter'; cb.checked = st.limiter; cb.onchange = function () { st.limiter = cb.checked; liveUpdateFix(); };
      lw.appendChild(cb); lw.append('Limiter (stops clipping)'); strip.appendChild(lw);
    }
    function setFrom(e) {
      var r = cv.getBoundingClientRect(), x = clamp((e.clientX - r.left) / r.width * 2 - 1, -1, 1), y = clamp(1 - (e.clientY - r.top) / r.height * 2, -1, 1);
      if (Math.abs(x) < 0.05) x = 0; if (Math.abs(y) < 0.05) y = 0;
      move(x, y);
    }
    function move(x, y) {
      st.pad = { x: +x.toFixed(3), y: +y.toFixed(3) }; padApply(scope, st, x, y);
      var tr = padTrails[scope] || (padTrails[scope] = []); tr.push({ x: x, y: y }); if (tr.length > 24) tr.shift();
      ro.innerHTML = padReadout(scope, st); drawPad(scope); liveSoon(); if (isM) { var lv = $('m-out'); if (lv) { lv.value = st.out; lv.dispatchEvent(new Event('sync')); } }
    }
    var dragging = false, lastTap = 0;
    cv.addEventListener('pointerdown', function (e) {
      e.preventDefault(); followRegion = false; dragging = true; cv.setPointerCapture(e.pointerId);
      var now = Date.now(); if (now - lastTap < 300) { padTrails[scope] = []; move(0, 0); dragging = false; return; } lastTap = now;
      padTrails[scope] = []; setFrom(e);
    });
    cv.addEventListener('pointermove', function (e) { if (dragging) setFrom(e); });
    cv.addEventListener('pointerup', function () { dragging = false; setTimeout(function () { padTrails[scope] = []; drawPad(scope); }, 900); });
    cv.addEventListener('pointercancel', function () { dragging = false; });
    cv.addEventListener('keydown', function (e) {
      var d = e.shiftKey ? 0.2 : 0.05, p = st.pad, k = e.key;
      if (k === 'ArrowLeft') move(clamp(p.x - d, -1, 1), p.y); else if (k === 'ArrowRight') move(clamp(p.x + d, -1, 1), p.y);
      else if (k === 'ArrowUp') move(p.x, clamp(p.y + d, -1, 1)); else if (k === 'ArrowDown') move(p.x, clamp(p.y - d, -1, 1));
      else if (k === 'Home') move(0, 0); else return;
      e.preventDefault();
    });
    el.appendChild(strip);
  });
  requestAnimationFrame(function () { Object.keys(padCanvases).forEach(drawPad); });
}

// ---------- analysis views as controls ----------
var amode = 'insight', specGeom = null, bandsGeom = null, structGeom = null, eqSel = null, selZone = null;
try { var _am = localStorage.getItem('rl-amode'); if (_am === 'control' || _am === 'insight') amode = _am; } catch (e) {}
var NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
function noteName(f) { var m = Math.round(69 + 12 * Math.log2(f / 440)); return NOTE_NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1); }
function fmtHz(f) { return f >= 1000 ? (f / 1000).toFixed(f >= 10000 ? 0 : 1) + ' kHz' : Math.round(f) + ' Hz'; }
function fmtDb(v) { return (v > 0 ? '+' : '') + (+v).toFixed(1) + ' dB'; }
function targetLabel(t) { return !t || t === 'mix' ? 'whole mix' : STEM_LABEL[t].toLowerCase(); }
function setAMode(m) {
  amode = m; try { localStorage.setItem('rl-amode', m); } catch (e) {}
  $('modeInsight').classList.toggle('on', m === 'insight'); $('modeControl').classList.toggle('on', m === 'control');
  document.querySelectorAll('.view').forEach(function (v) { v.classList.toggle('control', m === 'control'); });
  ['specCtrl', 'bandsCtrl', 'structCtrl', 'eqCtrl'].forEach(function (id) { $(id).hidden = m !== 'control'; });
  $('specNote').textContent = m === 'control' ? 'Drag across the picture to box an area of time × pitch, then set how much to boost or cut it. Drag a box to move it, drag its edges to resize. Select a box and press Delete to remove it.' : 'Time runs left to right, pitch runs bottom (30 Hz) to top (16 kHz). Brightness is loudness over an 80 dB range. Kick drums sit at the bottom, hi-hats at the top, voices as stacked horizontal lines in between.';
  $('bandsNote').textContent = m === 'control' ? 'Click the chart to pick a region. Drag the six faders on the right to rebalance its bands; the solid lines show the new balance, dashed the original. Double-click a fader to reset it.' : 'Energy in six bands across the song, in dB. Where a line drops, that range thins out; that is where EQ moves matter most.';
  renderControls(); drawAll();
}
function renderControls() { if (amode !== 'control') return; renderSpecCtrl(); renderBandsCtrl(); renderStructCtrl(); renderEqCtrl(); }
function zoneById(id) { return (S.recipe.zones || []).find(function (z) { return z.id === id; }); }
function addZone(z) {
  var list = S.recipe.zones || (S.recipe.zones = []), t = z.target || 'mix';
  if (list.filter(function (x) { return (x.target || 'mix') === t; }).length >= ZONE_SLOTS[t]) { toast('Up to ' + ZONE_SLOTS[t] + ' zones on the ' + targetLabel(t) + '. Delete one first.'); return null; }
  z.id = uid(); list.push(z); return z;
}
function zonesChanged() { liveSoon(); drawSpec(); renderControls(); }
// spectrogram geometry helpers
function sx(t) { var G = specGeom; return G.left + t / G.dur * G.w; }
function sy(f) { var G = specGeom; return G.top + G.h * (1 - Math.log(f / G.fmin) / Math.log(G.fmax / G.fmin)); }
function stime(x) { var G = specGeom; return clamp((x - G.left) / G.w, 0, 1) * G.dur; }
function sfreq(y) { var G = specGeom; return G.fmin * Math.pow(G.fmax / G.fmin, clamp(1 - (y - G.top) / G.h, 0, 1)); }
function zoneRect(z) { if (z.kind === 'note') { var y = sy(z.f); return { x0: sx(z.start), x1: sx(z.end), y0: y - 3, y1: y + 3 }; } return { x0: sx(z.start), x1: sx(z.end), y0: sy(z.fHi), y1: sy(z.fLo) }; }
function drawZones(g) {
  if (!specGeom) return;
  (S.recipe.zones || []).forEach(function (z) {
    var r = zoneRect(z), on = selZone === z.id, col = css(z.gain >= 0 ? '--good' : '--bad');
    g.globalAlpha = 0.12 + Math.min(0.35, Math.abs(z.gain) / 40); g.fillStyle = col; g.fillRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0); g.globalAlpha = 1;
    g.strokeStyle = on ? css('--accent') : col; g.lineWidth = on ? 2 : 1.25; g.strokeRect(r.x0 + 0.5, r.y0 + 0.5, r.x1 - r.x0 - 1, r.y1 - r.y0 - 1);
    var label = fmtDb(z.gain) + (z.target && z.target !== 'mix' ? ' · ' + z.target : '') + (z.kind === 'note' ? ' · ' + noteName(z.f) : '');
    g.font = '600 11px ' + css('--f-mono'); var tw = g.measureText(label).width;
    var ly = z.kind === 'note' ? r.y0 - 4 : r.y0 + 13;
    g.fillStyle = css('--panel'); g.globalAlpha = 0.85; g.fillRect(r.x0 + 3, ly - 11, tw + 6, 14); g.globalAlpha = 1;
    g.fillStyle = css('--fg'); g.fillText(label, r.x0 + 6, ly);
    if (on && z.kind !== 'note') { g.fillStyle = css('--accent'); [[r.x0, r.y0], [r.x1, r.y0], [r.x0, r.y1], [r.x1, r.y1]].forEach(function (p) { g.fillRect(p[0] - 3, p[1] - 3, 6, 6); }); }
  });
}
(function () {
  var cv = $('specCv'), drag = null;
  function pos(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function hit(p) {
    var zs = (S.recipe.zones || []).slice().reverse(), E = 6;
    if (selZone) { var sz = zoneById(selZone); if (sz) zs.unshift(sz); }
    for (var i = 0; i < zs.length; i++) {
      var z = zs[i], r = zoneRect(z);
      if (p.x < r.x0 - E || p.x > r.x1 + E || p.y < r.y0 - E || p.y > r.y1 + E) continue;
      if (z.kind === 'note') return { z: z, mode: 'move' };
      var m = '';
      if (Math.abs(p.y - r.y0) < E) m += 't'; else if (Math.abs(p.y - r.y1) < E) m += 'b';
      if (Math.abs(p.x - r.x0) < E) m += 'l'; else if (Math.abs(p.x - r.x1) < E) m += 'r';
      return { z: z, mode: m || 'move' };
    }
    return null;
  }
  cv.addEventListener('pointermove', function (e) {
    if (amode !== 'control' || !specGeom || !S.song) return;
    var p = pos(e);
    if (!drag) { var h = hit(p); cv.style.cursor = !h ? 'crosshair' : h.mode === 'move' ? 'move' : /[lr]/.test(h.mode) && /[tb]/.test(h.mode) ? 'nwse-resize' : /[lr]/.test(h.mode) ? 'ew-resize' : 'ns-resize'; return; }
    if (drag.mode === 'new') { drag.x1 = p.x; drag.y1 = p.y; drawSpec(); var g = cv.getContext('2d'); g.strokeStyle = css('--accent'); g.setLineDash([4, 3]); g.strokeRect(Math.min(drag.x0, p.x), Math.min(drag.y0, p.y), Math.abs(p.x - drag.x0), Math.abs(p.y - drag.y0)); g.setLineDash([]); return; }
    var z = drag.z, dt = stime(p.x) - stime(drag.p.x), o = drag.orig, ratio = sfreq(p.y) / sfreq(drag.p.y), dur = S.song.duration;
    if (drag.mode === 'move') {
      var len = o.end - o.start, st = clamp(o.start + dt, 0, dur - len); z.start = st; z.end = st + len;
      if (z.kind === 'note') z.f = clamp(o.f * ratio, 25, 16000);
      else { var r2 = clamp(ratio, specGeom.fmin / o.fLo, specGeom.fmax / o.fHi); z.fLo = o.fLo * r2; z.fHi = o.fHi * r2; }
    } else {
      if (drag.mode.indexOf('l') >= 0) z.start = clamp(o.start + dt, 0, o.end - 0.2);
      if (drag.mode.indexOf('r') >= 0) z.end = clamp(o.end + dt, o.start + 0.2, dur);
      if (drag.mode.indexOf('t') >= 0) z.fHi = clamp(o.fHi * ratio, o.fLo * 1.12, specGeom.fmax);
      if (drag.mode.indexOf('b') >= 0) z.fLo = clamp(o.fLo * ratio, specGeom.fmin, o.fHi / 1.12);
    }
    drawSpec(); renderSpecCtrl();
  });
  cv.addEventListener('pointerdown', function (e) {
    if (amode !== 'control' || !specGeom || !S.song) return;
    cv.setPointerCapture(e.pointerId); var p = pos(e), h = hit(p);
    if (h) { selZone = h.z.id; drag = { z: h.z, mode: h.mode, p: p, orig: JSON.parse(JSON.stringify(h.z)) }; drawSpec(); renderSpecCtrl(); }
    else drag = { mode: 'new', x0: p.x, y0: p.y, x1: p.x, y1: p.y };
  });
  cv.addEventListener('pointerup', function () {
    if (!drag) return; var d = drag; drag = null;
    if (d.mode === 'new') {
      if (Math.abs(d.x1 - d.x0) < 6 || Math.abs(d.y1 - d.y0) < 6) { selZone = null; seek(stime(d.x0)); renderSpecCtrl(); return; }
      var t0 = stime(Math.min(d.x0, d.x1)), t1 = stime(Math.max(d.x0, d.x1)), fHi = sfreq(Math.min(d.y0, d.y1)), fLo = sfreq(Math.max(d.y0, d.y1));
      if (fHi / fLo < 1.12) fHi = fLo * 1.12;
      var z = addZone({ kind: 'box', start: t0, end: Math.max(t1, t0 + 0.2), fLo: fLo, fHi: fHi, gain: -4, target: 'mix' });
      if (z) selZone = z.id;
    }
    zonesChanged();
  });
  cv.tabIndex = 0;
  cv.addEventListener('keydown', function (e) {
    if (amode !== 'control' || !selZone) return; var z = zoneById(selZone); if (!z) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { S.recipe.zones = S.recipe.zones.filter(function (x) { return x !== z; }); selZone = null; }
    else if (e.key === 'ArrowUp') z.gain = clamp(z.gain + 0.5, -18, 12); else if (e.key === 'ArrowDown') z.gain = clamp(z.gain - 0.5, -18, 12); else return;
    e.preventDefault(); zonesChanged();
  });
})();
function zoneSummary(z) { return fmt(z.start, 0) + '–' + fmt(z.end, 0) + ' · ' + (z.kind === 'note' ? noteName(z.f) + ' ' + fmtHz(z.f) : fmtHz(z.fLo) + '–' + fmtHz(z.fHi)) + ' · ' + fmtDb(z.gain); }
function targetSelect(id, value, onChange) {
  var sel = document.createElement('select'); sel.className = 'text-in'; sel.id = id; sel.setAttribute('aria-label', 'Applies to');
  [['mix', 'Whole mix']].concat(STEMS.map(function (s) { return [s, STEM_LABEL[s]]; })).forEach(function (o) { var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; sel.appendChild(op); });
  sel.value = value || 'mix'; sel.onchange = function () { onChange(sel.value); }; return sel;
}
function renderSpecCtrl() {
  var el = $('specCtrl'); if (amode !== 'control' || !S.recipe) return; el.innerHTML = '';
  var zs = S.recipe.zones || [], z = selZone && zoneById(selZone);
  var head = document.createElement('div'); head.className = 'row';
  var lb = document.createElement('span'); lb.className = 'label'; lb.textContent = 'Spectral zones (' + zs.length + ')'; head.appendChild(lb);
  zs.forEach(function (x, i) { var c = document.createElement('button'); c.className = 'zchip' + (x === z ? ' on' : ''); c.textContent = (i + 1) + ' · ' + zoneSummary(x); c.onclick = function () { selZone = x.id; drawSpec(); renderSpecCtrl(); }; head.appendChild(c); });
  if (!zs.length) { var hint = document.createElement('span'); hint.className = 'muted'; hint.textContent = 'None yet: drag across the spectrogram to make one.'; head.appendChild(hint); }
  el.appendChild(head);
  if (!z) return;
  var row = document.createElement('div'); row.className = 'row';
  var info = document.createElement('b'); info.className = 'mono'; info.textContent = zoneSummary(z); row.appendChild(info);
  row.appendChild(ctl('zoneGain', { k: 'zgain', label: z.gain >= 0 ? 'Boost' : 'Cut', min: -18, max: 12, step: 0.5, def: 0, unit: ' dB' }, z.gain, function (v) { z.gain = v; liveSoon(); drawSpec(); info.textContent = zoneSummary(z); }));
  row.appendChild(targetSelect('zoneTarget', z.target, function (v) {
    var prev = z.target; z.target = v;
    if ((S.recipe.zones || []).filter(function (x) { return (x.target || 'mix') === v; }).length > ZONE_SLOTS[v]) { z.target = prev; toast('That target already has ' + ZONE_SLOTS[v] + ' zones.'); renderSpecCtrl(); return; }
    zonesChanged();
  }));
  var del = document.createElement('button'); del.className = 'btn small'; del.textContent = 'Delete zone';
  del.onclick = function () { S.recipe.zones = zs.filter(function (x) { return x !== z; }); selZone = null; zonesChanged(); };
  var lp = document.createElement('button'); lp.className = 'btn small'; lp.textContent = 'Play from here';
  lp.onclick = function () { followRegion = true; play(Math.max(0, z.start - 1)); };
  row.appendChild(lp); row.appendChild(del); el.appendChild(row);
}
// frequency bands: faders for the selected region
var BAND_SHORT = ['Sub', 'Bass', 'Lo-mid', 'Mid', 'Pres', 'Air'];
function bandFaderGeom() { var G = bandsGeom, n = 6, lw = G.ctrlW / n; return { x: function (i) { return G.ctrlX + lw * (i + 0.5); }, y: function (db) { return G.top + 22 + (G.h - 44) * (1 - (db + 12) / 24); }, db: function (y) { return clamp(Math.round((12 - (y - G.top - 22) / (G.h - 44) * 24) * 2) / 2, -12, 12); }, lw: lw }; }
function drawBandControls(g, a, y) {
  var G = bandsGeom, reg = S.recipe.regions[S.sel], bands = reg.bands || freshBands(), dur = S.song.duration;
  var x0 = G.left + reg.start / dur * G.w, x1 = G.left + reg.end / dur * G.w;
  g.fillStyle = css('--accent-soft'); g.fillRect(x0, G.top, x1 - x0, G.h);
  g.fillStyle = css('--accent'); g.font = '600 11px ' + css('--f-display'); g.fillText(reg.name, x0 + 4, G.top - 6);
  var c0 = Math.max(0, Math.floor(reg.start / dur * a.cols)), c1 = Math.min(a.cols, Math.ceil(reg.end / dur * a.cols)), step = Math.max(1, Math.floor(a.cols / G.w));
  DSP.BANDS.forEach(function (b, bi) {
    if (!bands[bi]) return;
    g.strokeStyle = css(BAND_COL[bi]); g.lineWidth = 2.6; g.beginPath(); var first = true;
    for (var c = c0; c < c1; c += step) { var s2 = 0, n = 0; for (var k = Math.max(0, c - G.smoothW); k <= Math.min(a.cols - 1, c + G.smoothW); k++) { s2 += a.bands[k * 6 + bi]; n++; }
      var xx = G.left + c / a.cols * G.w, yy = y(s2 / n + bands[bi]); if (first) { g.moveTo(xx, yy); first = false; } else g.lineTo(xx, yy); }
    g.stroke();
  });
  var F = bandFaderGeom();
  g.fillStyle = css('--panel-2'); g.fillRect(G.ctrlX - 8, G.top - 18, G.ctrlW + 12, G.h + 40);
  g.strokeStyle = css('--line'); g.strokeRect(G.ctrlX - 7.5, G.top - 17.5, G.ctrlW + 11, G.h + 39);
  var zy = F.y(0); g.fillStyle = css('--faint'); g.fillRect(G.ctrlX, zy, G.ctrlW - 4, 1);
  g.textAlign = 'center';
  for (var i = 0; i < 6; i++) {
    var xx = F.x(i), col = css(BAND_COL[i]);
    g.fillStyle = css('--line'); g.fillRect(xx - 1.5, F.y(12), 3, F.y(-12) - F.y(12));
    g.fillStyle = col; var yv = F.y(bands[i]); g.fillRect(xx - 1.5, Math.min(zy, yv), 3, Math.abs(yv - zy));
    g.beginPath(); g.arc(xx, yv, 8, 0, 7); g.fill(); g.strokeStyle = css('--fg'); g.lineWidth = 1.5; g.stroke();
    g.fillStyle = css('--fg'); g.font = '500 10.5px ' + css('--f-mono'); g.fillText((bands[i] > 0 ? '+' : '') + bands[i], xx, G.top - 4);
    g.fillStyle = css('--muted'); g.font = '600 10px ' + css('--f-display'); g.fillText(BAND_SHORT[i].toUpperCase(), xx, G.top + G.h + 16);
  }
  g.textAlign = 'left';
}
(function () {
  var cv = $('bandsCv'), drag = null;
  function pos(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function faderAt(p) { if (!bandsGeom || p.x < bandsGeom.ctrlX - 8) return -1; var F = bandFaderGeom(); for (var i = 0; i < 6; i++) if (Math.abs(p.x - F.x(i)) < F.lw / 2) return i; return -1; }
  function setBand(i, y) { var reg = S.recipe.regions[S.sel]; if (!reg.bands) reg.bands = freshBands(); reg.bands[i] = bandFaderGeom().db(y); liveSoon(); drawBands(); renderBandsCtrl(); }
  cv.addEventListener('pointerdown', function (e) {
    if (amode !== 'control' || !S.song || !S.song.analysis) return;
    var p = pos(e), i = faderAt(p);
    if (i >= 0) { cv.setPointerCapture(e.pointerId); drag = i; followRegion = false; setBand(i, p.y); return; }
    if (p.x >= bandsGeom.left && p.x <= bandsGeom.left + bandsGeom.w) { followRegion = false; S.sel = regionAt((p.x - bandsGeom.left) / bandsGeom.w * S.song.duration); renderRack(); drawAll(); renderControls(); }
  });
  cv.addEventListener('pointermove', function (e) { if (amode !== 'control') return; var p = pos(e); if (drag != null) setBand(drag, p.y); else cv.style.cursor = faderAt(p) >= 0 ? 'ns-resize' : 'pointer'; });
  cv.addEventListener('pointerup', function () { drag = null; });
  cv.addEventListener('dblclick', function (e) { if (amode !== 'control') return; var i = faderAt(pos(e)); if (i >= 0) { S.recipe.regions[S.sel].bands[i] = 0; liveSoon(); drawBands(); renderBandsCtrl(); } });
})();
function renderBandsCtrl() {
  var el = $('bandsCtrl'); if (amode !== 'control' || !S.recipe) return; el.innerHTML = '';
  var reg = S.recipe.regions[S.sel], b = reg.bands || freshBands(), row = document.createElement('div'); row.className = 'row';
  var t = document.createElement('span'); t.innerHTML = '<span class="label">' + reg.name.replace(/</g, '&lt;') + '</span> ' + DSP.BANDS.map(function (x, i) { return x.name + ' <b class="mono">' + fmtDb(b[i]) + '</b>'; }).join(' · ');
  row.appendChild(t);
  var r1 = document.createElement('button'); r1.className = 'btn small'; r1.textContent = 'Reset bands'; r1.onclick = function () { reg.bands = freshBands(); liveSoon(); drawBands(); renderBandsCtrl(); };
  var r2 = document.createElement('button'); r2.className = 'btn small'; r2.textContent = 'Copy bands to all regions'; r2.onclick = function () { S.recipe.regions.forEach(function (r) { r.bands = b.slice(); }); liveSoon(); toast('Band balance copied to all ' + S.recipe.regions.length + ' regions'); };
  row.appendChild(r1); row.appendChild(r2); el.appendChild(row);
}
// structure: act on sections
function regionLabel(r) {
  var a = S.song && S.song.analysis; if (!a) return null; var mid = (r.start + r.end) / 2;
  var sg = a.sections.find(function (x) { return mid >= x.start && mid < x.end; }) || a.sections[a.sections.length - 1]; return sg.label;
}
function similarRegions() { var reg = S.recipe.regions[S.sel], lab = regionLabel(reg); return S.recipe.regions.filter(function (r) { return r !== reg && regionLabel(r) === lab; }); }
function pickTime(t) { followRegion = false; S.sel = regionAt(t); renderRack(); seek(t); renderControls(); drawAll(); }
(function () {
  $('structCv').addEventListener('pointerdown', function (e) {
    if (amode !== 'control' || !structGeom || !S.song || !S.song.analysis) return;
    var r = this.getBoundingClientRect(), x = e.clientX - r.left; if (e.clientY - r.top > structGeom.timeBottom) return;
    pickTime(clamp((x - structGeom.left) / structGeom.w, 0, 1) * S.song.duration);
  });
  $('ssmCv').addEventListener('pointerdown', function (e) {
    if (amode !== 'control' || !S.song || !S.song.analysis) return;
    var r = this.getBoundingClientRect(); pickTime(clamp((e.clientX - r.left) / r.width, 0, 1) * S.song.duration);
  });
})();
function renderStructCtrl() {
  var el = $('structCtrl'); if (amode !== 'control' || !S.recipe) return; el.innerHTML = '';
  var reg = S.recipe.regions[S.sel], lab = regionLabel(reg), sim = similarRegions();
  var p = document.createElement('div');
  p.innerHTML = '<span class="label">Selected</span> <b>' + reg.name.replace(/</g, '&lt;') + '</b> ' + (lab ? 'sounds like section <b>' + lab + '</b>' : '') + (lab ? (sim.length ? ', like ' + sim.map(function (r) { return r.name.replace(/</g, '&lt;'); }).join(', ') + '.' : '. No other region sounds like it.') : '');
  el.appendChild(p);
  var row = document.createElement('div'); row.className = 'row';
  var cp = document.createElement('button'); cp.className = 'btn small primary'; cp.disabled = !sim.length; cp.textContent = sim.length ? 'Copy settings to ' + sim.length + ' similar region' + (sim.length > 1 ? 's' : '') : 'No similar regions';
  cp.onclick = function () { sim.forEach(function (r) { r.stems = JSON.parse(JSON.stringify(reg.stems)); r.bands = (reg.bands || freshBands()).slice(); }); liveSoon(); drawTimeline(); toast('Copied to ' + sim.length + ' similar region' + (sim.length > 1 ? 's' : '')); };
  var nx = document.createElement('button'); nx.className = 'btn small'; nx.disabled = !sim.length; nx.textContent = 'Jump to next similar';
  nx.onclick = function () { var all = S.recipe.regions.filter(function (r) { return r === reg || sim.indexOf(r) >= 0; }); var i = all.indexOf(reg), nxt = all[(i + 1) % all.length]; followRegion = false; S.sel = S.recipe.regions.indexOf(nxt); renderRack(); seek(nxt.start); renderControls(); drawAll(); };
  var lp = document.createElement('button'); lp.className = 'btn small' + (S.loop ? ' on' : ''); lp.textContent = S.loop ? 'Looping this region' : 'Loop this region';
  lp.onclick = function () { $('loopBtn').click(); renderStructCtrl(); };
  row.appendChild(cp); row.appendChild(nx); row.appendChild(lp); el.appendChild(row);
  var hint = document.createElement('div'); hint.className = 'muted'; hint.textContent = 'Click the section bar, the onset chart or the similarity map to pick that moment.'; el.appendChild(hint);
}
// equation: tune a note
function renderEqCtrl() {
  var el = $('eqCtrl'); if (amode !== 'control' || !S.recipe) return; el.innerHTML = '';
  var src = $('eqSrc').value, target = src === 'orig' ? 'mix' : src, reg = S.recipe.regions[S.sel];
  var notes = (S.recipe.zones || []).filter(function (z) { return z.kind === 'note'; });
  var row = document.createElement('div'); row.className = 'row';
  if (!eqSel) { var h = document.createElement('span'); h.className = 'muted'; h.textContent = 'Click any term of the equation to boost or tame exactly that frequency.'; row.appendChild(h); }
  else {
    var t = document.createElement('b'); t.textContent = 'Tune ' + noteName(eqSel.f) + ' · ' + eqSel.f.toFixed(1) + ' Hz'; row.appendChild(t);
    var gainRow = ctl('noteGain', { k: 'ngain', label: 'Amount', min: -18, max: 12, step: 0.5, def: 0, unit: ' dB' }, -6, function () {}); row.appendChild(gainRow);
    var scope = document.createElement('select'); scope.className = 'text-in'; scope.id = 'noteScope'; scope.setAttribute('aria-label', 'Where');
    [['region', 'In ' + reg.name], ['song', 'Whole song']].forEach(function (o) { var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; scope.appendChild(op); });
    row.appendChild(scope);
    var tg = targetSelect('noteTarget', target, function () {}); row.appendChild(tg);
    var add = document.createElement('button'); add.className = 'btn small primary'; add.textContent = 'Apply';
    add.onclick = function () {
      var whole = scope.value === 'song', z = addZone({ kind: 'note', f: eqSel.f, start: whole ? 0 : reg.start, end: whole ? S.song.duration : reg.end, gain: +$('noteGain').value, target: tg.value });
      if (z) { toast('Tuned ' + noteName(z.f) + ' (' + fmtDb(z.gain) + ') on the ' + targetLabel(z.target)); zonesChanged(); }
    };
    row.appendChild(add);
  }
  el.appendChild(row);
  if (notes.length) {
    var list = document.createElement('div'); list.className = 'row';
    var lb = document.createElement('span'); lb.className = 'label'; lb.textContent = 'Tuned notes'; list.appendChild(lb);
    notes.forEach(function (z) {
      var c = document.createElement('button'); c.className = 'zchip'; c.title = 'Remove'; c.textContent = noteName(z.f) + ' ' + fmtDb(z.gain) + ' · ' + targetLabel(z.target) + ' · ' + fmt(z.start, 0) + '–' + fmt(z.end, 0) + '  ✕';
      c.onclick = function () { S.recipe.zones = S.recipe.zones.filter(function (x) { return x !== z; }); zonesChanged(); };
      list.appendChild(c);
    });
    el.appendChild(list);
  }
}
if (/[?&]selftest\b/.test(location.search)) window.__rlTest = { get VID() { return VID; }, S: S, buildGraph: buildGraph, schedule: schedule, scheduleMotion: scheduleMotion, renderOffline: renderOffline, addZone: addZone, liveSoon: liveSoon, applySpacePreset: applySpacePreset, motionCurves: motionCurves, stageShow: stageShow, seek: seek, drawVideo: drawVideo, get stageOpts() { return stageOpts; }, get STAGE() { return STAGE; } };
$('modeInsight').onclick = function () { setAMode('insight'); };
$('modeControl').onclick = function () { setAMode('control'); };

// ---------- space UI ----------
var SPACE_PRESETS = {
  classic: { depth: 100, room: 30, focus: 0, ears: 70, all: { mode: 'orbit', period: 16, sync: 0, dir: 1, width: 70, elev: 0, react: 0 }, offsets: [0, 0, 0, 0] },
  swirl: { depth: 100, room: 25, focus: 55, ears: 55, all: { mode: 'orbit', period: 12, sync: 0, width: 70, elev: 0, react: 70 }, offsets: [0, 90, 180, 270], dirs: [1, -1, 1, -1] },
  stage: { depth: 85, room: 20, focus: 20, ears: 30, per: { vocals: { mode: 'place', offset: 0, elev: 5 }, drums: { mode: 'swing', offset: 0, width: 35, period: 32, react: 30 }, bass: { mode: 'place', offset: 0, elev: -10 }, other: { mode: 'orbit', offset: 120, period: 40, react: 20, elev: 10 } } },
  pendulum: { depth: 100, room: 20, focus: 0, ears: 80, all: { mode: 'swing', sync: 4, width: 90, elev: 0, react: 0 }, offsets: [0, 0, 0, 0], dirs: [1, 1, 1, 1] },
  drums: { depth: 100, room: 20, focus: 0, ears: 60, per: { drums: { mode: 'orbit', sync: 2, react: 50 }, vocals: { mode: 'off' }, bass: { mode: 'off' }, other: { mode: 'off' } } },
  off: { off: true }
};
function applySpacePreset(name) {
  var P = SPACE_PRESETS[name], M = S.recipe.motion = S.recipe.motion || defMotion();
  if (P.off) STEMS.forEach(function (s) { M.stems[s].mode = 'off'; });
  else {
    M.depth = P.depth; M.room = P.room; M.focus = P.focus; M.ears = P.ears;
    STEMS.forEach(function (s, i) {
      var st = M.stems[s] = defMotionStem(i);
      if (P.all) { Object.assign(st, P.all); st.offset = P.offsets[i]; if (P.dirs) st.dir = P.dirs[i]; }
      if (P.per && P.per[s]) Object.assign(st, P.per[s]);
      if (st.mode === 'place') st.mode = 'fixed';
    });
  }
  motionCache = {}; renderSpace(); liveUpdateFix(); toast(name === 'off' ? 'Space motion off' : 'Space preset applied: ' + document.querySelector('[data-preset=' + name + ']').textContent);
}
var MODE_OPTS = [['off', 'Still'], ['orbit', 'Orbit'], ['swing', 'Swing'], ['fixed', 'Place']];
function spaceChanged(full) { motionCache = {}; liveSoon(); drawSpace(); drawMotionTl(); if (full) renderSpace(); }
function renderSpace() {
  if (!S.recipe) return; var M = S.recipe.motion || (S.recipe.motion = defMotion());
  var gl = $('spaceGlobals'); gl.innerHTML = '';
  [['depth', 'Depth', 0, 100, '%', 'How much of each moving stem goes through the 3D effect'], ['ears', 'Ear-to-ear', 0, 100, '%', 'Extra left–right push on top of the binaural cues, like YouTube 8D tracks'], ['room', 'Room', 0, 100, '%', 'Reverb around the moving sounds'], ['focus', 'Focus', 0, 100, '%', 'Pull the loudest instrument toward the front']].forEach(function (g) {
    if (M[g[0]] == null) M[g[0]] = g[0] === 'ears' ? 50 : 0;
    var row = ctl('sp-' + g[0], { k: g[0], label: g[1], min: g[2], max: g[3], step: 1, def: g[0] === 'depth' ? 100 : g[0] === 'ears' ? 50 : 0, unit: g[4] }, M[g[0]], function (v) { M[g[0]] = v; spaceChanged(false); });
    row.title = g[5]; row.style.setProperty('--c', 'var(--accent)'); gl.appendChild(row);
  });
  var tb = $('spaceRows'); tb.innerHTML = '';
  var bpm = S.song && S.song.analysis ? S.song.analysis.bpm : 0;
  STEMS.forEach(function (s) {
    var st = M.stems[s], tr = document.createElement('tr'); tr.style.setProperty('--c', 'var(--' + s + ')');
    function cell(node) { var td = document.createElement('td'); if (typeof node === 'string') td.textContent = node; else td.appendChild(node); tr.appendChild(td); return td; }
    cell(STEM_LABEL[s]).className = 'stem';
    var mode = document.createElement('select'); mode.className = 'text-in'; mode.id = 'sp-mode-' + s; mode.setAttribute('aria-label', STEM_LABEL[s] + ' motion');
    MODE_OPTS.forEach(function (o) { var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; mode.appendChild(op); }); mode.value = st.mode;
    mode.onchange = function () { st.mode = mode.value; spaceChanged(true); }; cell(mode);
    function slider(key, min, max, step, fmtv, disabled) {
      var wrap = document.createElement('span'), r = document.createElement('input'), v = document.createElement('span');
      r.type = 'range'; r.min = min; r.max = max; r.step = step; r.value = st[key]; r.id = 'sp-' + key + '-' + s; r.disabled = !!disabled; r.setAttribute('aria-label', STEM_LABEL[s] + ' ' + key);
      v.className = 'val'; v.textContent = fmtv(st[key]);
      r.oninput = function () { st[key] = +r.value; v.textContent = fmtv(st[key]); spaceChanged(false); };
      wrap.appendChild(r); wrap.appendChild(v); return wrap;
    }
    var off = st.mode === 'off';
    cell(slider('period', 1, 40, 0.5, function (v) { return v + ' s'; }, off || st.mode === 'fixed' || st.sync));
    var sync = document.createElement('select'); sync.className = 'text-in'; sync.id = 'sp-sync-' + s; sync.setAttribute('aria-label', STEM_LABEL[s] + ' lock to beat');
    [[0, 'Free'], [1, '1 bar'], [2, '2 bars'], [4, '4 bars'], [8, '8 bars'], [16, '16 bars']].forEach(function (o) { var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; if (o[0] && bpm) op.title = (o[0] * 240 / bpm).toFixed(1) + ' s'; sync.appendChild(op); });
    sync.value = st.sync; sync.disabled = off || st.mode === 'fixed' || !bpm; sync.onchange = function () { st.sync = +sync.value; spaceChanged(true); }; cell(sync);
    var db = document.createElement('button'); db.className = 'dirbtn'; db.textContent = st.dir >= 0 ? '↻' : '↺'; db.title = st.dir >= 0 ? 'Clockwise: front → right → behind' : 'Anticlockwise: front → left → behind'; db.disabled = off || st.mode === 'fixed';
    db.onclick = function () { st.dir = -(st.dir || 1); spaceChanged(true); }; cell(db);
    cell(slider('width', 0, 100, 1, function (v) { return v + '%'; }, st.mode !== 'swing'));
    cell(slider('elev', -30, 60, 1, function (v) { return (v > 0 ? '+' : '') + v + '°'; }, off));
    cell(slider('react', 0, 100, 1, function (v) { return v + '%'; }, off));
    tb.appendChild(tr);
  });
  drawSpace(); drawMotionTl();
}
function spaceAzimuth(s, t) { // current angle (radians) for drawing
  var M = S.recipe.motion, st = M.stems[s];
  if (st.mode === 'off' || !S.song || !S.env) return null;
  var cv = motionCurves(s), i = Math.min(cv.AZ.length - 1, Math.max(0, Math.round(t * MOTION_RATE)));
  return { az: cv.AZ[i], el: Math.atan2(cv.Y[i], Math.hypot(cv.X[i], cv.Z[i])), r: Math.hypot(cv.X[i], cv.Y[i], cv.Z[i]), cv: cv, i: i };
}
function drawSpace() {
  var cv = $('spaceMap'); if (!cv.offsetParent) return;
  var o = setupCanvas(cv), g = o.g, w = o.w, h = o.h, cx = w / 2, cy = h / 2, R = w * 0.36;
  g.clearRect(0, 0, w, h);
  g.strokeStyle = css('--line'); g.lineWidth = 1;
  [1, 0.66, 0.33].forEach(function (k) { g.beginPath(); g.arc(cx, cy, R * k, 0, 7); g.stroke(); });
  g.beginPath(); g.moveTo(cx - R, cy); g.lineTo(cx + R, cy); g.moveTo(cx, cy - R); g.lineTo(cx, cy + R); g.stroke();
  g.fillStyle = css('--muted'); g.font = '600 10.5px ' + css('--f-display'); g.textAlign = 'center';
  g.fillText('FRONT', cx, cy - R - 8); g.fillText('BEHIND', cx, cy + R + 16); g.fillText('L', cx - R - 12, cy + 4); g.fillText('R', cx + R + 12, cy + 4);
  // head
  g.fillStyle = css('--panel'); g.strokeStyle = css('--faint'); g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, 16, 0, 7); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(cx - 5, cy - 15); g.lineTo(cx, cy - 23); g.lineTo(cx + 5, cy - 15); g.stroke();
  g.fillStyle = css('--faint'); g.fillRect(cx - 19, cy - 4, 3, 8); g.fillRect(cx + 16, cy - 4, 3, 8);
  if (!S.recipe || !S.recipe.motion) return;
  var t = currentPos();
  STEMS.forEach(function (s, si) {
    var col = css('--' + s), p = spaceAzimuth(s, t);
    if (!p) { g.fillStyle = col; g.globalAlpha = 0.35; g.beginPath(); g.arc(cx - 9 + si * 6, cy + 26, 3, 0, 7); g.fill(); g.globalAlpha = 1; return; }
    // trail: last 2 s
    g.strokeStyle = col; g.lineWidth = 2;
    for (var k = 1; k <= 40; k++) {
      var i1 = p.i - k * 2, i2 = i1 + 2; if (i1 < 0) break;
      var a1 = p.cv.AZ[i1], a2 = p.cv.AZ[i2], r1 = Math.hypot(p.cv.X[i1], p.cv.Z[i1]) / 1.5 * R, r2 = Math.hypot(p.cv.X[i2], p.cv.Z[i2]) / 1.5 * R;
      g.globalAlpha = (1 - k / 40) * 0.5; g.beginPath(); g.moveTo(cx + r1 * Math.sin(a1), cy - r1 * Math.cos(a1)); g.lineTo(cx + r2 * Math.sin(a2), cy - r2 * Math.cos(a2)); g.stroke();
    }
    g.globalAlpha = 1;
    var rr = Math.hypot(p.cv.X[p.i], p.cv.Z[p.i]) / 1.5 * R, x = cx + rr * Math.sin(p.az), y = cy - rr * Math.cos(p.az), size = 8 + 5 * Math.sin(p.el);
    g.fillStyle = col; g.beginPath(); g.arc(x, y, size, 0, 7); g.fill(); g.strokeStyle = css('--fg'); g.lineWidth = 1.5; g.stroke();
    g.fillStyle = css('--fg'); g.font = '600 10.5px ' + css('--f-display'); g.fillText(STEM_LABEL[s].toUpperCase(), x, y - size - 5);
  });
  g.textAlign = 'left';
}
function drawMotionTl() {
  var cv = $('motionTl'); if (!cv.offsetParent) return;
  var o = setupCanvas(cv), g = o.g, w = o.w, h = o.h; g.clearRect(0, 0, w, h);
  if (!S.song || !S.recipe || !S.recipe.motion) return;
  var left = 54, pw = w - left - 8, top = 8, ph = h - 26, dur = S.song.duration;
  var yA = function (az) { var a = ((az % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI; return top + ph / 2 - a / Math.PI * ph / 2; };
  g.strokeStyle = css('--line'); g.fillStyle = css('--muted'); g.font = '10.5px ' + css('--f-mono'); g.textAlign = 'right';
  [[0, 'front'], [Math.PI / 2, 'right'], [-Math.PI / 2, 'left'], [Math.PI * 0.999, 'behind']].forEach(function (p) { var y = yA(p[0]); g.beginPath(); g.moveTo(left, y + 0.5); g.lineTo(w - 8, y + 0.5); g.stroke(); g.fillText(p[1], left - 6, y + 3); });
  g.textAlign = 'left';
  if (!motionOn()) { g.fillText('Pick a preset or set a stem to Orbit, Swing or Place to see its path here.', left + 8, top + 14); return; }
  STEMS.forEach(function (s) {
    if (S.recipe.motion.stems[s].mode === 'off' || !S.env) return;
    var c = motionCurves(s), n = c.AZ.length, step = Math.max(1, Math.floor(n / (pw * 2)));
    g.strokeStyle = css('--' + s); g.lineWidth = 1.5; g.beginPath(); var prev = null;
    for (var i = 0; i < n; i += step) { var x = left + i / MOTION_RATE / dur * pw, y = yA(c.AZ[i]); if (prev === null || Math.abs(y - prev) > ph * 0.5) g.moveTo(x, y); else g.lineTo(x, y); prev = y; }
    g.stroke();
  });
  g.fillStyle = css('--accent'); g.fillRect(left + currentPos() / dur * pw - 1, top, 2, ph);
  g.fillStyle = css('--muted'); g.fillText('0:00', left, h - 4); g.textAlign = 'right'; g.fillText(fmt(dur, 0), w - 8, h - 4); g.textAlign = 'left';
}
(function () {
  var cv = $('spaceMap'), drag = null;
  function ang(e) { var r = cv.getBoundingClientRect(), x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2; return { a: Math.atan2(x, -y), d: Math.hypot(x, y) / r.width }; }
  cv.addEventListener('pointerdown', function (e) {
    if (!S.recipe || !S.recipe.motion) return;
    var p = ang(e), t = currentPos(), best = null, bd = 0.12;
    STEMS.forEach(function (s) { var q = spaceAzimuth(s, t); if (!q) return; var r = cv.getBoundingClientRect(), R = r.width * 0.36, rr = Math.hypot(q.cv.X[q.i], q.cv.Z[q.i]) / 1.5 * R;
      var dx = (r.width / 2 + rr * Math.sin(q.az)) - (e.clientX - r.left), dy = (r.height / 2 - rr * Math.cos(q.az)) - (e.clientY - r.top), dd = Math.hypot(dx, dy) / r.width; if (dd < bd) { bd = dd; best = s; } });
    if (!best) { toast('Drag a coloured dot. Stems set to Still have no dot; pick a motion for them first.'); return; }
    drag = { s: best, a0: p.a, off0: S.recipe.motion.stems[best].offset, az0: spaceAzimuth(best, t).az }; cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing';
  });
  cv.addEventListener('pointermove', function (e) {
    if (!drag) return; var p = ang(e), st = S.recipe.motion.stems[drag.s];
    var delta = (p.a - drag.a0) * 180 / Math.PI; st.offset = Math.round(((drag.off0 + delta) % 360 + 360) % 360);
    motionCache = {}; drawSpace(); drawMotionTl();
  });
  cv.addEventListener('pointerup', function () { if (drag) { drag = null; cv.style.cursor = 'grab'; spaceChanged(false); } });
})();
document.querySelectorAll('[data-preset]').forEach(function (b) { b.onclick = function () { if (!S.song || !S.song.stems) { toast('Wait for the stems to finish splitting.'); return; } applySpacePreset(b.dataset.preset); }; });

// ---------- video: a music video drawn from the song ----------
var VID = { scene: 'auto', view: 'studio', rings: [], shock: [], trails: {}, caps: [], prevActive: {}, lastT: -1, lastSec: -1, secShownAt: -99, curScene: 'layers', fadeFrom: null, fadeAt: 0, rec: null };
var VCOL = { vocals: '#ff7b6b', drums: '#5cc8ff', bass: '#b48cff', other: '#8fd39f', mix: '#e9e7e2', accent: '#f0a43a', bg: '#06070a', dim: '#5d6370' };
var SCENE_ORDER = ['layers', 'orbit', 'tunnel', 'equation'];
function setView(v) {
  VID.view = v; document.body.classList.toggle('view-video', v === 'video');
  $('videoPanel').hidden = v !== 'video'; $('viewStudio').classList.toggle('on', v === 'studio'); $('viewVideo').classList.toggle('on', v === 'video');
  try { localStorage.setItem('rl-view', v); } catch (e) {}
  if (v === 'video') { drawVideo(); window.scrollTo(0, 0); } else drawAll();
}
function vSeg(buf, t, n) { // mono samples centred on t
  var sr = buf.sampleRate, a = Math.round(t * sr) - (n >> 1), L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L, out = new Float32Array(n);
  for (var i = 0; i < n; i++) { var p = a + i; out[i] = p >= 0 && p < L.length ? 0.5 * (L[p] + R[p]) : 0; }
  return out;
}
function vEnv(s, t) { var E = S.env && S.env[s]; if (!E) return { e: 0, o: 0 }; var i = Math.max(0, Math.min(E.env.length - 1, Math.round(t * MOTION_RATE))); return { e: E.env[i], o: E.onset[i] }; }
function vSpectrum(t, bands) {
  var N = 2048, buf = S.song.orig, x = vSeg(buf, t, N), f = DSP.getFFT(N), w = DSP.hann(N), re = new Float64Array(N), im = new Float64Array(N), sr = buf.sampleRate, out = new Float32Array(bands);
  for (var i = 0; i < N; i++) re[i] = x[i] * w[i];
  f.transform(re, im, false);
  for (var b = 0; b < bands; b++) {
    var f0 = 40 * Math.pow(16000 / 40, b / bands), f1 = 40 * Math.pow(16000 / 40, (b + 1) / bands), k0 = Math.floor(f0 / sr * N), k1 = Math.max(k0 + 1, Math.ceil(f1 / sr * N)), m = 0;
    for (var k = k0; k < k1 && k < N / 2; k++) m = Math.max(m, Math.hypot(re[k], im[k]));
    out[b] = Math.max(0, Math.min(1, (20 * Math.log10(m + 1e-9) + 10) / 60));
  }
  return out;
}
function vSection(t) { var a = S.song && S.song.analysis; if (!a) return null; for (var i = 0; i < a.sections.length; i++) if (t < a.sections[i].end) return { i: i, s: a.sections[i] }; return { i: a.sections.length - 1, s: a.sections[a.sections.length - 1] }; }
function vBeat(t) { var a = S.song && S.song.analysis; if (!a || !a.beats.length) return null; var lo = 0, hi = a.beats.length - 1, k = -1; while (lo <= hi) { var m = (lo + hi) >> 1; if (a.beats[m] <= t) { k = m; lo = m + 1; } else hi = m - 1; } if (k < 0) return null; var len = (a.beats[k + 1] || a.beats[k] + 60 / a.bpm) - a.beats[k]; return { k: k, frac: (t - a.beats[k]) / len, bar: k % 4 === 0 }; }
function sceneFor(t) {
  if (VID.scene !== 'auto') return VID.scene;
  var sec = vSection(t); if (!sec) return 'layers';
  var sh = stageShow(); if (sh && sh.cues.length > 1 && sec.s.label === sh.peakLabel) return 'stage'; // the biggest part of the song gets the light show
  var labels = []; S.song.analysis.sections.forEach(function (x) { if ((!sh || x.label !== sh.peakLabel) && labels.indexOf(x.label) < 0) labels.push(x.label); });
  return SCENE_ORDER[Math.max(0, labels.indexOf(sec.s.label)) % SCENE_ORDER.length];
}
function vCaption(text, col, t) { VID.caps.push({ text: text, col: col || VCOL.mix, born: performance.now() }); if (VID.caps.length > 4) VID.caps.shift(); }
function vUpdateEvents(t) {
  if (!S.song || !S.song.stems || !S.env) return;
  var jumped = Math.abs(t - VID.lastT) > 0.5; VID.lastT = t;
  STEMS.forEach(function (s) {
    var v = vEnv(s, t), was = VID.prevActive[s], on = was ? v.e > 0.12 : v.e > 0.3;
    if (!jumped && was !== undefined && on !== was) vCaption(STEM_LABEL[s] + (/s$/.test(STEM_LABEL[s]) ? (on ? ' come in' : ' drop out') : (on ? ' comes in' : ' drops out')), VCOL[s], t);
    VID.prevActive[s] = on;
    if (s === 'drums' && v.o > 0.45 && !jumped) VID.shock.push({ r: 0, a: Math.min(1, v.o), born: t });
  });
  var sec = vSection(t);
  if (sec && sec.i !== VID.lastSec) {
    if (VID.lastSec >= 0 && !jumped) {
      var prev = S.song.analysis.sections.slice(0, sec.i).some(function (x) { return x.label === sec.s.label; });
      vCaption('New section ' + sec.s.label + (prev ? ' (heard before)' : ''), VCOL.accent, t);
      var nxt = sceneFor(t); if (nxt !== VID.curScene) { VID.fadeFrom = VID.curScene; VID.fadeAt = performance.now(); }
    }
    VID.lastSec = sec.i; VID.secShownAt = performance.now();
  }
  VID.shock = VID.shock.filter(function (k) { return t - k.born < 1.6 && t >= k.born; });
}
// ---- scenes: each draws into ctx g at 1280x720 for song time t
function sceneLayers(g, t, W, H) {
  var lanes = S.song.stems ? STEMS : ['mix'], n = 1536;
  lanes.forEach(function (s, i) {
    var y = H * (0.27 + 0.56 * (lanes.length === 1 ? 0.5 : i / (lanes.length - 1))), buf = s === 'mix' ? S.song.orig : S.song.stems[s], x = vSeg(buf, t, n), v = s === 'mix' ? { e: 0.6 } : vEnv(s, t);
    var mx = 1e-4; for (var k = 0; k < n; k++) mx = Math.max(mx, Math.abs(x[k]));
    var amp = H * 0.11 * Math.min(1, 0.25 + v.e) / Math.max(mx, 0.05) * Math.min(mx, 0.6);
    g.strokeStyle = VCOL[s]; g.lineWidth = 1.2 + 4 * v.e; g.shadowColor = VCOL[s]; g.shadowBlur = 8 + 26 * v.e; g.globalAlpha = 0.25 + 0.75 * Math.min(1, v.e * 1.6);
    g.beginPath(); for (k = 0; k < n; k += 2) { var px = W * 0.08 + k / n * W * 0.84, py = y - x[k] * amp; if (!k) g.moveTo(px, py); else g.lineTo(px, py); } g.stroke();
    g.shadowBlur = 0; g.globalAlpha = 0.35 + 0.65 * Math.min(1, v.e * 2); g.fillStyle = VCOL[s]; g.font = '600 15px ' + css('--f-display'); g.fillText((s === 'mix' ? 'MIX' : STEM_LABEL[s].toUpperCase()), W * 0.08, y - H * 0.075); g.globalAlpha = 1;
  });
}
function sceneOrbit(g, t, W, H) {
  var cx = W / 2, cy = H / 2, R = H * 0.33, M = S.recipe.motion;
  var bass = S.song.stems ? vEnv('bass', t).e : 0.4;
  var core = H * (0.05 + 0.09 * bass), grd = g.createRadialGradient(cx, cy, 0, cx, cy, core * 3);
  grd.addColorStop(0, VCOL.bass); grd.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = grd; g.globalAlpha = 0.9; g.beginPath(); g.arc(cx, cy, core * 3, 0, 7); g.fill(); g.globalAlpha = 1;
  g.strokeStyle = 'rgba(255,255,255,0.07)'; g.lineWidth = 1; [1, 0.66].forEach(function (k) { g.beginPath(); g.arc(cx, cy, R * k, 0, 7); g.stroke(); });
  VID.shock.forEach(function (k) { var age = t - k.born, r = core + age * H * 0.55; g.strokeStyle = VCOL.drums; g.globalAlpha = Math.max(0, k.a * (1 - age / 1.6)); g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke(); }); g.globalAlpha = 1;
  if (!S.song.stems) return;
  STEMS.forEach(function (s, i) {
    if (s === 'bass') return;
    var p = spaceAzimuth(s, t), az = p ? p.az : (i * Math.PI / 2 + t * 0.15), v = vEnv(s, t), rr = R * (p ? Math.min(1.1, p.r / 1.5) : 0.85);
    var x = cx + rr * Math.sin(az), y = cy - rr * Math.cos(az) * 0.8;
    var tr = VID.trails[s] || (VID.trails[s] = []); tr.push([x, y]); if (tr.length > 40) tr.shift();
    g.strokeStyle = VCOL[s]; g.lineWidth = 2 + 6 * v.e; g.globalAlpha = 0.5;
    g.beginPath(); tr.forEach(function (q, k) { if (!k) g.moveTo(q[0], q[1]); else g.lineTo(q[0], q[1]); }); g.stroke(); g.globalAlpha = 1;
    var size = 6 + 26 * v.e; g.shadowColor = VCOL[s]; g.shadowBlur = 30 * v.e + 6; g.fillStyle = VCOL[s]; g.beginPath(); g.arc(x, y, size, 0, 7); g.fill(); g.shadowBlur = 0;
    if (s === 'other') for (var k = 0; k < Math.round(30 * v.e); k++) { var a2 = k * 2.399 + t * 0.6, r2 = size + 8 + (k * 7.3) % 60; g.globalAlpha = 0.5; g.fillRect(x + r2 * Math.cos(a2), y + r2 * Math.sin(a2), 2, 2); } g.globalAlpha = 1;
  });
}
function sceneEquation(g, t, W, H) {
  var seg = vSeg(S.song.orig, t, 4096), P = DSP.partials(seg, S.song.sr, 7);
  if (!P.length) return;
  P.sort(function (a, b) { return b.amp - a.amp; });
  var f0 = Math.min.apply(null, P.map(function (q) { return q.freq; })), amx = P[0].amp, scale = H * 0.17 / amx;
  var cx = W * 0.3, cy = H * 0.48, x = cx, y = cy, clock = performance.now() / 1000;
  P.forEach(function (q, i) {
    var r = Math.max(3, q.amp * scale), ang = q.phase + clock * 1.2 * (q.freq / f0), nx = x + r * Math.cos(ang), ny = y + r * Math.sin(ang);
    g.strokeStyle = 'rgba(255,255,255,' + (0.18 + 0.1 * (i === 0)) + ')'; g.lineWidth = 1; g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke();
    g.strokeStyle = VCOL.accent; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(nx, ny); g.stroke(); x = nx; y = ny;
  });
  var tr = VID.trails.eq || (VID.trails.eq = []); tr.unshift(y); if (tr.length > 300) tr.pop();
  g.strokeStyle = VCOL.accent; g.setLineDash([3, 4]); g.beginPath(); g.moveTo(x, y); g.lineTo(W * 0.55, tr[0]); g.stroke(); g.setLineDash([]);
  g.strokeStyle = VCOL.mix; g.lineWidth = 2; g.shadowColor = VCOL.accent; g.shadowBlur = 10; g.beginPath(); tr.forEach(function (yy, k) { var xx = W * 0.55 + k * (W * 0.4 / 300); if (!k) g.moveTo(xx, yy); else g.lineTo(xx, yy); }); g.stroke(); g.shadowBlur = 0;
  g.fillStyle = VCOL.dim; g.font = '500 16px ' + css('--f-mono'); g.textAlign = 'center';
  var terms = P.slice(0, 4).map(function (q) { return q.amp.toFixed(2) + '·sin(2π·' + Math.round(q.freq) + 't)'; }).join(' + ');
  g.fillText('x(t) ≈ ' + terms + (P.length > 4 ? ' + …' : ''), W / 2, H * 0.86); g.font = '500 13px ' + css('--f-body'); g.fillText(P.length + ' sine waves at this moment · each circle is one, spinning at its own frequency', W / 2, H * 0.9); g.textAlign = 'left';
}
function sceneTunnel(g, t, W, H) {
  var cx = W / 2, cy = H / 2, sp = vSpectrum(t, 48);
  var dom = 'mix', best = 0; if (S.song.stems) STEMS.forEach(function (s) { var e = vEnv(s, t).e; if (e > best) { best = e; dom = s; } });
  if (VID.lastTunnelT !== t || S.playing) { VID.rings.unshift({ sp: sp, col: VCOL[dom] }); if (VID.dy && VID.dy.lift > 0.4) VID.rings.unshift({ sp: sp, col: VCOL[dom] }); } VID.lastTunnelT = t; // builds double the speed
  if (VID.rings.length > 34) VID.rings.length = 34;
  for (var k = VID.rings.length - 1; k >= 0; k--) {
    var ring = VID.rings[k], z = 1 - k / 34, base = H * 0.06 + Math.pow(z, 2.2) * H * 0.62;
    g.strokeStyle = ring.col; g.globalAlpha = 0.08 + 0.85 * Math.pow(z, 2); g.lineWidth = 0.5 + 2.5 * z; g.beginPath();
    for (var b = 0; b <= ring.sp.length; b++) { var bi = b % ring.sp.length, a = bi / ring.sp.length * Math.PI * 2 - Math.PI / 2, r = base * (1 + 0.35 * ring.sp[bi]); var x = cx + r * Math.cos(a) * 1.25, y = cy + r * Math.sin(a); if (!b) g.moveTo(x, y); else g.lineTo(x, y); }
    g.closePath(); g.stroke();
  }
  g.globalAlpha = 1;
}
// ---- stage: an arena light show, designed and run the way a touring lighting designer works.
// The rig: a band-shell arch of lamp ribs, a round screen with a ring of lights, perimeter beam lights used as
// static "architecture", four pods on trolleys that ride to the soloist, FOH searchlights and follow spots,
// thick-beam lasers (static webs first, sweeps later), a mirror ball saved for the climax, pyro for the biggest hit.
// The song is planned first (a cue per section and an arc for the whole song), then rendered in 3D with haze and bloom.
var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var stageOpts = { colours: 'classic', strobe: reducedMotion ? 'off' : 'safe', lasers: true, haze: true, screen: true, desk: true, camera: 'auto' };
try { var so = JSON.parse(localStorage.getItem('rl-stage') || 'null'); if (so) Object.keys(stageOpts).forEach(function (k) { if (so[k] !== undefined) stageOpts[k] = so[k]; }); } catch (e) {}
if (reducedMotion && stageOpts.strobe === 'full') stageOpts.strobe = 'safe';
var STAGE = { show: null, lastStrobe: -99, flashAt: -99, flashA: 0, lastT: -1, lastCue: -1, crowd: null };
var STROBE = { off: null, safe: { gap: 1 / 3, a: 0.32 }, full: { gap: 0.11, a: 0.85 } }; // safe: at most 3 flashes a second
// Timings measured frame by frame from the Pulse concert film (Earls Court 1994, Another Brick in the Wall Part 2).
// docs/stage-lighting.md has the method and the numbers behind each one.
var PULSE = {
  snapOn: 0.083,     // a light bump reaches full in two video frames (median 10-90% rise)
  decay: 0.17,       // and falls about twice as slowly in solos and the finale (s)
  decayBody: 0.5,    // in verses the fall is half a beat (beats)
  follow: 0.35,      // verses hold their look; beat bumps are weak there and full in solos/finale
  loudFollow: 0.25,  // overall brightness follows loudness only a little (r = 0.27): the cue sets the level
  revealAt: 0.2,     // the arch reveal waits until at least 20% of the song (25% in the film)
  revealBlack: 4,    // beats of near-black right before the reveal
  revealTau: 0.25,   // the reveal snaps to a blown-out peak and settles (90% in 0.58 s)
  colourBeats: 16,   // verses: one look change every 4 bars
  soloBeats: 4,      // solos: a new colour every bar
  soloHues: [320, 190, 120, 0, 272, 48], // magenta, cyan, green, red, violet, yellow: the solo colours in the film
  cutJitter: 0.15,   // s: the editor cuts near the bar, not on the beat (cuts were no closer to beats than chance)
  shotBars: { intro: [4, 3, 4], body: [1, 1, 0.5, 1.5, 1, 2], solo: [1, 1.5, 1, 1.25, 2, 1], climax: [1, 0.5, 1, 1.5], finale: [2.5, 4.5, 6] }
};
var HUE_NAMES = ['red', 'orange', 'yellow', 'lime', 'green', 'teal', 'cyan', 'azure', 'blue', 'violet', 'magenta', 'pink'];
function hueName(h) { return HUE_NAMES[Math.round((((h % 360) + 360) % 360) / 30) % 12]; }
function hsla(h, s, l, a) { return 'hsla(' + Math.round(h) + ',' + Math.round(s) + '%,' + Math.round(l) + '%,' + Math.max(0, Math.min(1, a)).toFixed(3) + ')'; }
function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
function smooth01(x) { x = clamp01(x); return x * x * (3 - 2 * x); }
function lerpHue(a, b, k) { var d = ((b - a + 540) % 360) - 180; return a + d * k; }
function seeded(i) { var x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
// tiny 3D kit
function vsub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function vadd(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function vmul(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }
function vdot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function vcross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function vnorm(a) { var l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
function vlerp(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
function makeCam(C, T, fov, W, H) { var f = vnorm(vsub(T, C)), r = vnorm(vcross(f, [0, 1, 0])), u = vcross(r, f); return { C: C, f: f, r: r, u: u, focal: H / 2 / Math.tan(fov * Math.PI / 360), W: W, H: H }; }
function proj(cam, p) { var d = vsub(p, cam.C), z = vdot(d, cam.f); if (z < 0.3) return null; var k = cam.focal / z; return { x: cam.W / 2 + vdot(d, cam.r) * k, y: cam.H / 2 - vdot(d, cam.u) * k, s: k, z: z }; }
function clipNear(cam, a, b) { // clip a 3D segment to the camera's near plane; returns [a', b', ka, kb] or null
  var za = vdot(vsub(a, cam.C), cam.f), zb = vdot(vsub(b, cam.C), cam.f), n = 0.6;
  if (za < n && zb < n) return null;
  var ka = 0, kb = 1; if (za < n) ka = (n - za) / (zb - za); if (zb < n) kb = (n - za) / (zb - za);
  return [vlerp(a, b, ka), vlerp(a, b, kb), ka, kb];
}
// the rig, in metres: x to stage right, y up, z toward the audience; the stage lip is z = 0
var STEM_HSL = { vocals: [6, 100, 71], drums: [200, 100, 68], bass: [263, 100, 77], other: [134, 46, 69] };
var RIG = {
  ribs: [0, 1, 2, 3, 4].map(function (k) { return { r: 15 - k * 1.25, z: -5.5 - k * 0.9 }; }),
  screen: { c: [0, 7.2, -8.6], r: 3.6, ring: 4.25 },
  cast: { drums: [0, 0.6, -5.2], bass: [-5.5, 0, -2.6], other: [5.5, 0, -2.6], vocals: [0, 0, -1.4] },
  podY: 11.2, podZ: -2.2,
  search: [[-9, 7, 20], [9, 7, 20], [-16, 6, 12], [16, 6, 12]],
  follow: [[-2.6, 9, 23], [2.6, 9, 23]],
  laserSrc: [[-9, 1.4, -1], [9, 1.4, -1]],
  pyro: [[-10, 0, -0.4], [-6, 0, -0.4], [6, 0, -0.4], [10, 0, -0.4]],
  ball: [0, 10.5, 6]
};
RIG.mirrors = (function () { var m = []; RIG.ribs.forEach(function (rb, k) { if (k % 2) return; [0.18, 0.35, 0.5, 0.65, 0.82].forEach(function (u) { var a = u * Math.PI; m.push([rb.r * Math.cos(a), rb.r * 0.95 * Math.sin(a), rb.z + 0.3]); }); }); m.push([-14, 4, 6], [14, 4, 6], [-12, 9, 14], [12, 9, 14]); return m; })();
// ---- planning: the lighting designer's pass over the whole song
function stageShow() {
  var a = S.song && S.song.analysis; if (!a) return null;
  var id = S.song.title + '|' + S.song.duration + '|' + a.sections.length + '|' + (S.env ? 's' : '');
  if (STAGE.show && STAGE.show.id === id) return STAGE.show;
  var buf = S.song.orig, sr = buf.sampleRate, hop = Math.round(sr / MOTION_RATE), L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L, n = Math.ceil(L.length / hop), raw = new Float32Array(n);
  for (var i = 0; i < n; i++) { var p0 = i * hop, p1 = Math.min(L.length, p0 + hop), acc = 0, c = 0; for (var k = p0; k < p1; k += 4) { var v = 0.5 * (L[k] + R[k]); acc += v * v; c++; } raw[i] = Math.sqrt(acc / Math.max(1, c)); }
  var srt = Array.prototype.slice.call(raw).sort(function (x, y) { return x - y; }), ref = srt[Math.floor(n * 0.95)] || 1;
  var env = new Float32Array(n), on = new Float32Array(n), slow = 0, fast = 0, omx = 1e-6;
  for (i = 0; i < n; i++) { var x = Math.min(1.2, raw[i] / ref); fast += (x - fast) * 0.5; slow += (x - slow) * 0.06; env[i] = slow; on[i] = Math.max(0, fast - slow); if (on[i] > omx) omx = on[i]; }
  for (i = 0; i < n; i++) on[i] /= omx;
  var dur = S.song.duration, secs = a.sections.length ? a.sections : [{ start: 0, end: dur, label: 'A' }];
  function mean(arr, sc) { var i0 = Math.floor(sc.start * MOTION_RATE), i1 = Math.max(i0 + 1, Math.min(arr.length, Math.floor(sc.end * MOTION_RATE))), m = 0; for (var j = i0; j < i1; j++) m += arr[j]; return m / (i1 - i0); }
  var energy = secs.map(function (sc) { return mean(env, sc); });
  var stemMean = secs.map(function (sc) { var o = {}; STEMS.forEach(function (s) { o[s] = S.env ? mean(S.env[s].env, sc) * S.env[s].ref : 0; }); return o; });
  var lo = Math.min.apply(null, energy), hi = Math.max.apply(null, energy), span = hi - lo;
  var labels = []; secs.forEach(function (sc) { if (labels.indexOf(sc.label) < 0) labels.push(sc.label); });
  var km = /^([A-G][#b]?) (major|minor)$/.exec(a.key || ''), root = km ? ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'].indexOf(km[1]) : 0, minor = km && km[2] === 'minor';
  var baseHue = ((root * 7) % 12) * 30 + (minor ? 200 : 20);
  // the climax: the loudest section after the first 40% of the song (a show is paced to peak late)
  var climax = -1, best = -1; secs.forEach(function (sc, k) { if (sc.start >= dur * 0.4 && energy[k] > best) { best = energy[k]; climax = k; } });
  if (climax < 0) climax = energy.indexOf(hi);
  var bigHit = -1, bj = 0.15; secs.forEach(function (sc, k) { if (k && energy[k] - energy[k - 1] > bj) { bj = energy[k] - energy[k - 1]; bigHit = k; } });
  var cues = secs.map(function (sc, k) {
    var rel = span < 0.08 ? 0.5 : (energy[k] - lo) / span, tier = rel > 0.66 ? 2 : rel > 0.33 ? 1 : 0, sm = stemMean[k], jump = k ? energy[k] - energy[k - 1] : 0;
    var lead = 'vocals'; if (S.env) { var bm = -1; STEMS.forEach(function (s) { var e = sm[s] * (s === 'vocals' ? 1.3 : s === 'drums' ? 0.6 : 1); if (e > bm) { bm = e; lead = s; } }); }
    var role = k === climax && secs.length > 1 ? 'climax' : (S.env && lead === 'other' && tier >= 1 ? 'solo' : k === 0 ? 'intro' : k === secs.length - 1 ? 'finale' : 'body');
    return { start: sc.start, end: sc.end, label: sc.label, li: labels.indexOf(sc.label), tier: tier, energy: energy[k], jump: jump, lead: lead, role: role,
      type: k === 0 ? 'Open' : jump > 0.2 ? 'Hit' : jump < -0.2 ? 'Spot' : 'Change', notes: [] };
  });
  // reveal budget: the arch stays dark ("black box") until the music first lifts, and (as in the film) not before
  // 20% of the song. Inside the black box the order is the film's: searchlights, then a laser web over a blue stage.
  // Later big sections escalate the lasers; the mirror ball and the grating are saved for the climax.
  var reveal = cues.findIndex(function (c, k) { return k && c.tier >= 1 && c.start >= dur * PULSE.revealAt; });
  if (reveal < 0) reveal = cues.findIndex(function (c, k) { return k && c.tier >= 1; }); if (reveal < 0) reveal = Math.min(1, cues.length - 1);
  if (reveal === climax && reveal > 1) reveal--; // never spend the reveal and the climax on the same cue
  var laserSeq = ['web', 'search', 'scan'], li2 = reveal > 1 ? 1 : 0, lastBig = -1;
  cues.forEach(function (c, k) {
    c.pre = k < reveal;
    if (c.pre && k && c.role !== 'climax') { c.role = 'dark'; }
    c.arch = k < reveal ? 'dark' : k === reveal ? 'reveal' : c.role === 'climax' ? 'fill' : c.tier === 0 ? 'stars' : c.tier === 1 ? 'chase' : 'pulse';
    c.beams = k < reveal ? 'off' : c.tier === 0 ? 'columns' : c.role === 'climax' ? 'cathedral' : c.tier === 1 ? (c.li % 2 ? 'fan' : 'columns') : (c.li % 2 ? 'cross' : 'sunburst');
    c.ring = c.tier === 0 ? 'iris' : c.tier === 1 ? 'flower' : 'sun';
    c.pods = c.pre ? 'park' : c.role === 'solo' || c.role === 'climax' ? 'track' : c.tier === 0 ? 'park' : 'sweep';
    c.laser = c.role === 'climax' ? 'grating' : c.role === 'dark' ? 'web' : c.tier === 2 ? laserSeq[Math.min(li2++, laserSeq.length - 1)] : null;
    c.search = c.role === 'intro' || (c.role === 'finale' && c.tier === 2);
    c.ball = c.role === 'climax' && c.end - c.start > 4;
    c.pyro = k === bigHit && k >= reveal;
    if (c.tier === 2 && k > reveal) lastBig = k;
    c.haze = c.pre ? 0.95 : [0.95, 0.75, 0.6][c.tier];
    c.speed = [0.25, 0.5, 1][c.tier];
    c.level = c.pre ? 0.4 : [0.7, 0.85, 1][c.tier]; // the cue's own brightness: dark box ~1/3 of the lit show in the film
  });
  if (!cues.some(function (c) { return c.laser; })) cues[climax].laser = 'web';
  // strobe and blinders never fire before the reveal (none did in the film's first quarter)
  // the film opened its first big section on white specials only and snapped the arch on 8 bars in, after a dark bar
  var bar = 240 / (a.bpm || 120), rc = cues[reveal], nbar = Math.floor((rc.end - rc.start) / bar);
  rc.hold = nbar >= 6 ? Math.min(8, Math.floor(nbar * 0.6)) * bar : 0; rc.revealT = rc.start + rc.hold; rc.laser = null; rc.pyro = false;
  cues.forEach(function (c, k) { c.strobe = k > reveal && c.tier === 2 && (k === lastBig || c.role === 'finale'); c.buildInto = !!(cues[k + 1] && cues[k + 1].type === 'Hit' && k + 1 > reveal); });
  var shots = stagePlanShots(cues, reveal, a.bpm || 120);
  // guitar (or loudest melodic) notes inside each laser-web cue: each one adds a beam to the web
  if (S.env) cues.forEach(function (c) {
    if (c.laser !== 'web') return; var O = S.env.other.onset, last = -9;
    for (var j = Math.floor(c.start * MOTION_RATE); j < Math.min(O.length, c.end * MOTION_RATE); j++) if (O[j] > 0.35 && O[j] >= (O[j - 1] || 0) && O[j] >= (O[j + 1] || 0) && j / MOTION_RATE - last > 0.4) { last = j / MOTION_RATE; c.notes.push(last); }
  });
  cues.forEach(function (c) { c.look = stageLookText(c); });
  STAGE.show = { id: id, env: env, on: on, cues: cues, shots: shots, peakLabel: cues[climax].label, climax: climax, reveal: reveal, bigHit: bigHit, baseHue: baseHue };
  return STAGE.show;
}
function stagePalette(c, beats) { // [main hue, accent hue, saturation]
  var m = stageOpts.colours, li = c.li;
  if (m === 'classic') { // as measured in the film: cool blue in the black box, amber and gold once the arch is revealed,
    // a new saturated colour every bar in the solos, and white beams over amber with a blue rim on the arch at the peak
    var blk = Math.floor(beats / PULSE.colourBeats) % 2;
    if (c.pre) return [[228, 214][li % 2], 214, 88];
    if (c.role === 'solo') { var sh0 = PULSE.soloHues, si = Math.floor(beats / PULSE.soloBeats) + li; return [sh0[si % sh0.length], sh0[(si + 3) % sh0.length], 92]; }
    if (c.arch === 'reveal') return [38, 22, 82];
    if (c.role === 'climax' || (c.role === 'finale' && c.tier === 2)) return [40, 232, 70];
    if (c.tier === 0) return [[226, 252][li % 2], 196, 88];
    if (c.tier === 1) { var am = [[36, 8], [42, 24], [30, 352]][li % 3]; return blk ? [am[1], am[0], 88] : [am[0], am[1], 88]; }
    return [[40, 34, 44][li % 3], [28, 22, 30][li % 3], 75]; // amber lamps; the big-section beams themselves are white
  }
  if (m === 'warm') return [[30, 15, 350, 42][li % 4], [330, 48, 20, 300][li % 4], 88];
  if (m === 'ice') return [[200, 185, 222, 172][li % 4], [262, 192, 240, 160][li % 4], 85];
  if (m === 'rainbow') { var h = (Math.floor(beats) * 30) % 360; return [h, (h + 180) % 360, 90]; }
  var sh = STAGE.show, hA = ((sh ? sh.baseHue : 0) + li * 137.5) % 360; return [hA, (hA + (c.tier === 2 ? 180 : 45)) % 360, c.tier === 2 ? 92 : 80];
}
function stageLookText(c) {
  var p = stagePalette(c, 0), col = p[2] < 50 ? 'white' : hueName(p[0]);
  return col + ' · arch ' + c.arch + ' · beams ' + c.beams + (c.pods === 'track' ? ' · pods on ' + (STEM_LABEL[c.lead] || c.lead).toLowerCase() : '') + (c.laser ? ' · laser ' + c.laser : '') + (c.ball ? ' · mirror ball' : '') + (c.pyro ? ' · pyro' : '');
}
function stageCueAt(sh, t) { for (var i = 0; i < sh.cues.length; i++) if (t < sh.cues[i].end) return i; return sh.cues.length - 1; }
function beatsAt(t, bpm) { var b = vBeat(t); return b ? b.k + b.frac : t * bpm / 60; }
// ---- camera: concert-film shots, cut the way the Pulse film was cut. Shots average a bar (median 2.4 s at 103 BPM)
// but vary from half a bar to two; cuts sit near the bar without snapping to the beat; the black-box intro and the
// finale hold long wide shots (the light show is the subject); solos live in close-ups of the player; the reveal and
// every hit cut to wide; a new section always starts on a new shot.
var SHOT_SEQ = { intro: ['high', 'wide'], dark: ['wide', 'high', 'crowd'], solo: ['close', 'close', 'side', 'close', 'crowd', 'close'], climax: ['crowd', 'wide', 'close', 'high'], finale: ['wide', 'side', 'high'], big: ['wide', 'close', 'crowd', 'side'], body: ['wide', 'close', 'side', 'close', 'high', 'crowd'] };
function stagePlanShots(cues, reveal, bpm) {
  var bar = 240 / bpm, shots = [];
  cues.forEach(function (c, k) {
    var kind = c.pre ? 'intro' : c.role === 'solo' || c.role === 'climax' ? c.role : c.role === 'finale' && c.tier === 2 ? 'finale' : 'body';
    var seqKey = c.role === 'intro' || c.role === 'dark' || c.role === 'solo' || c.role === 'climax' ? c.role : kind === 'finale' ? 'finale' : c.tier === 2 ? 'big' : 'body';
    var segs = c.hold ? [[c.start, c.revealT, 'intro', 'dark', false], [c.revealT, c.end, kind, seqKey, true]] : [[c.start, c.end, kind, seqKey, c.type === 'Hit' || k === reveal]];
    segs.forEach(function (sg, si) {
      var pat = PULSE.shotBars[sg[2]], seq = SHOT_SEQ[sg[3]], at = 0, j = 0;
      while (true) {
        var t0 = sg[0] + at * bar + (j ? (seeded(k * 31 + j * 7 + si) - 0.5) * 2 * PULSE.cutJitter : 0);
        var name = j === 0 && sg[4] ? 'wide' : seq[(j + k) % seq.length];
        if (j && shots.length && shots[shots.length - 1].name === name) name = seq[(j + k + 1) % seq.length];
        shots.push({ t: t0, name: name, cue: k });
        at += pat[(j + k * 3) % pat.length]; j++;
        if (sg[0] + at * bar > sg[1] - 0.5 * bar) break;
      }
    });
  });
  return shots;
}
function stageShot(sh, cue, t) {
  var mode = stageOpts.camera, name = mode !== 'auto' ? mode : null, u = t, lead = RIG.cast[cue.lead] || RIG.cast.vocals;
  if (!name) { var S0 = sh.shots, lo = 0, hi = S0.length - 1, k = 0; while (lo <= hi) { var m = (lo + hi) >> 1; if (S0[m].t <= t) { k = m; lo = m + 1; } else hi = m - 1; } name = S0[k].name; u = t - S0[k].t; }
  switch (name) {
    case 'high': return { name: name, C: [-7 + 3 * Math.sin(u * 0.05), 15, 25 - 0.2 * Math.min(u, 20)], T: [0, 4.5, -4], fov: 50 };
    case 'crowd': return { name: name, C: [-2.5 + 0.12 * Math.min(u, 30), 2.4, 13], T: [0.5, 6.2, -6], fov: 66 };
    case 'side': return { name: name, C: [17 - 0.1 * Math.min(u, 30), 5, 5], T: [-2, 4.2, -4], fov: 46 };
    case 'close': return { name: name, C: [lead[0] * 0.55 + 1.6, 2.6, lead[2] + 8.5 - 0.08 * Math.min(u, 20)], T: [lead[0], 2.1, lead[2]], fov: 34 };
    default: return { name: 'wide', C: [2 * Math.sin(u * 0.06), 4.4, 29 - 0.12 * Math.min(u, 30)], T: [0, 6.6, -5], fov: 56 };
  }
}
// ---- drawing helpers
function stageBuffers() {
  if (STAGE.sc) return;
  function cv(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  STAGE.sc = cv(1280, 720); STAGE.lb = cv(640, 360); STAGE.bb = cv(160, 90); STAGE.bb2 = cv(40, 23); STAGE.mask = cv(320, 180); STAGE.scr = cv(320, 180);
  var hz = STAGE.haze = cv(320, 180), g = hz.getContext('2d');
  for (var i = 0; i < 90; i++) { var x = seeded(i) * 320, y = seeded(i + 99) * 180, r = 18 + seeded(i + 7) * 70, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,' + (0.18 + seeded(i + 3) * 0.3) + ')'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
  var people = [];
  for (i = 0; i < 640; i++) { var z = 1.6 + Math.pow(seeded(i * 3 + 1), 0.8) * 30, w = 9 + z * 0.45; people.push({ x: (seeded(i * 3 + 2) * 2 - 1) * w, z: z, h: 1.55 + seeded(i * 3) * 0.3, hands: seeded(i + 500) < 0.35, phone: seeded(i + 900) < 0.12, ph: seeded(i + 77) * 6.28 }); }
  people.sort(function (p, q) { return q.z - p.z; }); STAGE.crowd = people;
}
function beam3(lg, cam, o, d, len, r0, r1, h, s, l, a, one) { // a soft volumetric beam, faded along its length
  var facing = vdot(d, cam.f); if (facing < -0.3) a *= 1 - 0.85 * clamp01((-facing - 0.3) / 0.6); // beams aimed into the lens would white out the frame
  if (a < 0.004) return null;
  var e = vadd(o, vmul(d, len)), cl = clipNear(cam, o, e); if (!cl) return null;
  var A = proj(cam, cl[0]), B = proj(cam, cl[1]); if (!A || !B) return null;
  var ra = r0 + (r1 - r0) * cl[2], rb = r0 + (r1 - r0) * cl[3], wa = Math.min(160, Math.max(0.8, ra * A.s)), wb = Math.min(380, Math.max(1.2, rb * B.s));
  var dx = B.x - A.x, dy = B.y - A.y, ll = Math.hypot(dx, dy) || 1, nx = -dy / ll, ny = dx / ll, fadeA = 1 - cl[2], fadeB = Math.max(0, 1 - cl[3]);
  var gr = lg.createLinearGradient(A.x, A.y, B.x, B.y); gr.addColorStop(0, hsla(h, s, l + 18, a * fadeA)); gr.addColorStop(0.35, hsla(h, s, l, a * (0.35 + 0.65 * fadeA) * 0.6)); gr.addColorStop(1, hsla(h, s, l, a * fadeB * 0.15));
  lg.fillStyle = gr;
  (one ? [[0.7, 0.75]] : [[1, 0.35], [0.45, 0.85]]).forEach(function (L2) { var k = L2[0]; lg.globalAlpha = L2[1]; lg.beginPath(); lg.moveTo(A.x + nx * wa * k, A.y + ny * wa * k); lg.lineTo(B.x + nx * wb * k, B.y + ny * wb * k); lg.lineTo(B.x - nx * wb * k, B.y - ny * wb * k); lg.lineTo(A.x - nx * wa * k, A.y - ny * wa * k); lg.closePath(); lg.fill(); });
  lg.globalAlpha = 1;
  if (d[1] < -0.05) { var sh = -o[1] / d[1]; if (sh > 0 && sh <= len) { var hit = proj(cam, vadd(o, vmul(d, sh))); if (hit) { var rr = (r0 + (r1 - r0) * sh / len) * hit.s * 1.4; glow2(lg, hit.x, hit.y, Math.min(500, rr + 4), h, s, l + 10, a * 0.7, 0.32); } } }
  return A;
}
var GLOWS = {};
function glowSprite(h, s, l) { // cached soft dot per colour: far cheaper than a gradient per lamp
  h = ((Math.round(h / 6) * 6) % 360 + 360) % 360; s = Math.round(s / 10) * 10; l = Math.round(l / 10) * 10;
  var key = h + '|' + s + '|' + l; if (GLOWS[key]) return GLOWS[key];
  var c = document.createElement('canvas'); c.width = c.height = 64; var g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, hsla(h, s, l, 1)); gr.addColorStop(0.25, hsla(h, s, l, 0.55)); gr.addColorStop(1, hsla(h, s, l, 0)); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return (GLOWS[key] = c);
}
function glow2(g, x, y, r, h, s, l, a, sy) { if (r < 0.5 || a < 0.004) return; var ga = g.globalAlpha; g.globalAlpha = ga * Math.min(1, a); sy = sy || 1; g.drawImage(glowSprite(h, s, l), x - r, y - r * sy, 2 * r, 2 * r * sy); g.globalAlpha = ga; }
function laser3(g, lg, cam, a, b, h, alpha, thick) { // crisp core on the frame, glow in the light buffer
  var cl = clipNear(cam, a, b); if (!cl || alpha < 0.01) return;
  var A = proj(cam, cl[0]), B = proj(cam, cl[1]); if (!A || !B) return;
  var w = Math.max(1.1, Math.min(6, (thick || 0.05) * Math.min(A.s, 200)));
  lg.strokeStyle = hsla(h, 100, 55, alpha * 0.5); lg.lineWidth = w * 5; lg.beginPath(); lg.moveTo(A.x, A.y); lg.lineTo(B.x, B.y); lg.stroke();
  g.strokeStyle = hsla(h, 100, 72, alpha); g.lineWidth = w; g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(B.x, B.y); g.stroke();
}
function stagePerson(g, s, x, y, k) { // silhouette with its instrument; y = feet
  g.beginPath(); g.arc(x, y - 64 * k, 9 * k, 0, 7);
  g.moveTo(x - 15 * k, y - 50 * k); g.lineTo(x + 15 * k, y - 50 * k); g.lineTo(x + 11 * k, y - 22 * k); g.lineTo(x + 9 * k, y); g.lineTo(x + 2 * k, y); g.lineTo(x, y - 18 * k); g.lineTo(x - 2 * k, y); g.lineTo(x - 9 * k, y); g.lineTo(x - 11 * k, y - 22 * k); g.closePath(); g.fill();
  g.lineWidth = 3 * k;
  if (s === 'vocals') { g.beginPath(); g.moveTo(x + 22 * k, y); g.lineTo(x + 22 * k, y - 46 * k); g.lineTo(x + 8 * k, y - 58 * k); g.stroke(); }
  if (s === 'bass' || s === 'other') { g.beginPath(); g.ellipse(x - 2 * k, y - 32 * k, 13 * k, 8 * k, -0.4, 0, 7); g.fill(); g.beginPath(); g.moveTo(x + 6 * k, y - 36 * k); g.lineTo(x + (s === 'bass' ? 44 : 36) * k, y - 54 * k); g.stroke(); }
  if (s === 'drums') { g.beginPath(); g.arc(x, y - 14 * k, 16 * k, 0, 7); g.arc(x - 30 * k, y - 26 * k, 9 * k, 0, 7); g.arc(x + 30 * k, y - 26 * k, 9 * k, 0, 7); g.fill(); g.beginPath(); g.moveTo(x - 58 * k, y - 50 * k); g.lineTo(x - 30 * k, y - 46 * k); g.moveTo(x + 30 * k, y - 50 * k); g.lineTo(x + 60 * k, y - 46 * k); g.stroke(); }
}
function beamLookDir(look, i, n, o) { // the perimeter beam lights: static architecture, one shape per cue
  var u = i / (n - 1), a = u * Math.PI;
  if (look === 'columns') return vnorm([0, 1, 0.12]);
  if (look === 'sunburst') return vnorm([Math.cos(a) * 1.2, Math.sin(a) * 1.2, 0.45]);
  if (look === 'cathedral') return vnorm(vsub([0, 30, 8], o));
  if (look === 'cross') return vnorm(vsub([(i % 2 ? -1 : 1) * 12, 13, 9], o)); // crossing overhead
  return vnorm(vsub([o[0] * 1.3, 0, 18], o)); // fan onto the audience
}
// ---- the show, per frame
function sceneStage(g0, t, W, H) {
  var sh = stageShow(); if (!sh) return;
  stageBuffers();
  var SK = STAGE.skip || {}, sc = STAGE.sc, g = sc.getContext('2d'), lbc = STAGE.lb, lg = lbc.getContext('2d');
  var bpm = S.song.analysis.bpm || 120, bt = vBeat(t), beats = bt ? bt.k + bt.frac : t * bpm / 60, beatLen = 60 / bpm;
  var ci = stageCueAt(sh, t), cue = sh.cues[ci], prev = sh.cues[ci - 1] || cue;
  // beat bumps: on in two frames, off about twice as slowly; strong in solos and big sections, weak in verses
  var hot = cue.role === 'solo' || cue.role === 'climax' || cue.role === 'finale' || cue.tier === 2, bs = bt ? bt.frac * beatLen : 9;
  var pulse = (bs < PULSE.snapOn ? bs / PULSE.snapOn : Math.exp(-(bs - PULSE.snapOn) / (hot ? PULSE.decay : beatLen * PULSE.decayBody))) * (hot ? 1 : PULSE.follow);
  var jumped = Math.abs(t - STAGE.lastT) > 0.5 || t < STAGE.lastT; STAGE.lastT = t; if (jumped) STAGE.lastStrobe = -99;
  if (ci !== STAGE.lastCue) { if (STAGE.lastCue >= 0 && !jumped && S.playing && VID.curScene === 'stage') vCaption('Lights Q' + (ci + 1) + (cue.type === 'Hit' ? ' (hit)' : cue.type === 'Spot' ? ' (drop to spot)' : '') + ': ' + cue.look, hsla(stagePalette(cue, beats)[0], 85, 65, 1), t); STAGE.lastCue = ci; }
  // cue changes snap on the section boundary (the film: within a frame or two of it); only the black box crossfades slowly
  var fadeDur = cue.type === 'Hit' ? 0.06 : cue.pre || prev.pre && ci !== sh.reveal ? beatLen * 4 : PULSE.decay, mixK = smooth01((t - cue.start) / fadeDur);
  var mi = Math.max(0, Math.min(sh.env.length - 1, Math.round(t * MOTION_RATE))), E = sh.env[mi], O = sh.on[mi];
  var buildLen = Math.min(beatLen * 16, (cue.end - cue.start) * 0.5), build = cue.buildInto ? clamp01((t - (cue.end - buildLen)) / buildLen) : 0;
  var inHold = cue.arch === 'reveal' && t < cue.revealT, toReveal = cue.arch === 'reveal' ? cue.revealT - t : ci === sh.reveal - 1 && !sh.cues[sh.reveal].hold ? cue.end - t : -1;
  var preReveal = toReveal > 0 && toReveal < beatLen * PULSE.revealBlack; // a bar of near-black before the reveal
  var blackout = preReveal || (cue.buildInto && cue.end - t < beatLen * 0.5) ? 0.06 : 1;
  var since = t - cue.start, hit = cue.type === 'Hit' && !cue.pre && !inHold ? Math.exp(-since * 2.5) * (since < 2 ? 1 : 0) : 0;
  var dy = dynAt(t), dropHit = 0; // detected build-ups and drops (analysis) sharpen the section-level guesses
  if (dy && !cue.pre && !inHold) {
    if (dy.build) build = Math.max(build, dy.tension);
    if (dy.next && dy.next.kind === 'drop' && dy.toDrop <= beatLen * 0.5) blackout = 0.06;
    if (dy.drop && dy.drop.kind === 'drop' && dy.since < 2) { dropHit = Math.exp(-dy.since * 2.5); hit = Math.max(hit, dropHit); }
  }
  var revealK = cue.arch === 'reveal' && !inHold ? Math.exp(-(t - cue.revealT) / PULSE.revealTau) : 0; // the snap overshoots, then settles
  var dim = ((cue.level || 1) * (1 - PULSE.loudFollow) + PULSE.loudFollow * Math.min(1, E)) * blackout * clamp01(t / 2) * clamp01((S.song.duration - t) / 2.5);
  if (cue.tier === 0 && !cue.pre) dim *= 0.85 + 0.15 * Math.sin(t * Math.PI / 2);
  if (inHold) dim *= 0.6; // white specials only
  var pA = stagePalette(cue, beats), pP = stagePalette(prev, beats), h1 = lerpHue(pP[0], pA[0], mixK), h2 = lerpHue(pP[1], pA[1], mixK), sat = (pP[2] + (pA[2] - pP[2]) * mixK) * (1 - 0.7 * build), lit = 55 + 20 * build;
  var stem = function (s) { return S.song.stems ? vEnv(s, t) : { e: E, o: O }; };
  var drums = stem('drums'), bass = stem('bass'), oth = stem('other');
  var shot = stageShot(sh, cue, t), cam = makeCam(shot.C, shot.T, shot.fov, W, H);
  // the finale alternates its looks on the beat grid (eighths in the film; quarters on Safe; never with strobe off)
  var stx = STROBE[stageOpts.strobe], alt = cue.strobe && stx && !reducedMotion ? (Math.floor(beats * (stageOpts.strobe === 'full' ? 2 : 1)) % 2 ? 1 : 0) : -1;
  var archOn = cue.arch === 'dark' || inHold ? 0.22 : 1; // the dark arch still shows faint stars, as the pre-show did
  // ---------- background: black box, arch structure lit only once revealed
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.fillStyle = '#020204'; g.fillRect(0, 0, W, H);
  lg.setTransform(1, 0, 0, 1, 0, 0); lg.globalCompositeOperation = 'source-over'; lg.clearRect(0, 0, 640, 360); lg.setTransform(0.5, 0, 0, 0.5, 0, 0); lg.globalCompositeOperation = 'lighter';
  // floor
  var fl = [[-14, 0, -11], [14, 0, -11], [14, 0, 0], [-14, 0, 0]].map(function (p) { return proj(cam, p); });
  if (fl.every(Boolean)) { g.fillStyle = '#0a0b0f'; g.beginPath(); fl.forEach(function (p, i) { if (!i) g.moveTo(p.x, p.y); else g.lineTo(p.x, p.y); }); g.closePath(); g.fill(); }
  var amb = archOn * dim * 0.5;
  RIG.ribs.forEach(function (rb, k) {
    var pts = []; for (var j = 0; j <= 40; j++) { var a = j / 40 * Math.PI, p = proj(cam, [rb.r * Math.cos(a), rb.r * 0.95 * Math.sin(a), rb.z]); if (p) pts.push(p); }
    if (pts.length < 2) return;
    g.strokeStyle = hsla(h1, 20, 8 + 14 * amb, 1); g.lineWidth = Math.max(1.5, 0.35 * pts[20 > pts.length - 1 ? 0 : 20].s); g.beginPath(); pts.forEach(function (p, i) { if (!i) g.moveTo(p.x, p.y); else g.lineTo(p.x, p.y); }); g.stroke();
  });
  // ---------- round screen with its ring of lights
  var scr = proj(cam, RIG.screen.c);
  if (stageOpts.screen && scr) {
    var rpx = RIG.screen.r * scr.s;
    g.save(); g.beginPath(); g.arc(scr.x, scr.y, rpx, 0, 7); g.clip(); g.fillStyle = '#010205'; g.fillRect(scr.x - rpx, scr.y - rpx, 2 * rpx, 2 * rpx);
    var sv = STAGE.scr, sg = sv.getContext('2d'); sg.setTransform(1, 0, 0, 1, 0, 0); sg.globalAlpha = 1; sg.globalCompositeOperation = 'source-over'; sg.fillStyle = '#010205'; sg.fillRect(0, 0, 320, 180); sg.scale(0.25, 0.25);
    (cue.tier === 0 ? sceneOrbit : sceneTunnel)(sg, t, W, H);
    var k2 = 2.2 * rpx / H; g.globalAlpha = 0.3 + 0.6 * Math.max(dim, 0.4); g.drawImage(sv, scr.x - W * k2 / 2, scr.y - H * k2 / 2, W * k2, H * k2); g.restore(); g.globalAlpha = 1;
    g.strokeStyle = '#000'; g.lineWidth = Math.max(2, 0.25 * scr.s); g.beginPath(); g.arc(scr.x, scr.y, rpx * 1.04, 0, 7); g.stroke();
  }
  // ---------- performers, back-lit in their stem colour
  var castOrder = ['drums', 'bass', 'other', 'vocals'], leadNow = cue.lead, lb = -1;
  if (S.song.stems && cue.pods !== 'track') castOrder.forEach(function (s) { var e = stem(s).e * (s === 'vocals' ? 1.4 : s === 'drums' ? 0.7 : 1); if (e > lb) { lb = e; leadNow = s; } });
  castOrder.forEach(function (s) {
    var P = RIG.cast[s], f = proj(cam, P); if (!f) return; var e = stem(s).e, kk = 1.8 * f.s / 73;
    var shs = STEM_HSL[s]; glow2(lg, f.x, f.y - 40 * kk, 120 * kk, shs[0], shs[1], shs[2], 0.1 + 0.45 * e * Math.max(dim, 0.3));
  });
  if (cue.role === 'dark') { var wc = proj(cam, [0, 0.5, -3]); if (wc) glow2(lg, wc.x, wc.y, Math.max(80, 14 * wc.s), 234, 95, 45, 0.5 * dim * mixK, 0.45); } // deep blue stage wash under the laser web
  // ---------- arch lamps (crisp on the frame, glow in the light buffer)
  if (archOn > 0 && !SK.lamps) RIG.ribs.forEach(function (rb, k) {
    var N = 44;
    for (var j = 0; j < N; j++) {
      var u = (j + 0.5) / N, a = u * Math.PI, p = proj(cam, [rb.r * Math.cos(a), rb.r * 0.95 * Math.sin(a), rb.z + 0.15]); if (!p) continue;
      var v, pat = inHold ? 'dark' : cue.arch;
      if (pat === 'stars' || pat === 'dark') v = 0.12 + 0.28 * Math.max(0, Math.sin(t * (0.6 + seeded(k * 50 + j) * 1.5) + seeded(j + k * 9) * 9));
      else if (pat === 'reveal') v = Math.min(1.6, 0.85 + 0.15 * pulse + 0.75 * revealK); // every lamp at once, blown out, then held
      else if (pat === 'chase') { var cpos = (beats / 8) % 1, dd = Math.min(Math.abs(u - cpos), Math.abs(u - (1 - cpos))); v = 0.15 + 0.85 * Math.exp(-dd * dd * 120); }
      else if (pat === 'pulse') { var ring = (bt ? bt.frac : 0) * 6; v = 0.15 + 0.85 * Math.exp(-Math.pow(k - ring, 2) * 1.5); }
      else v = 0.6 + 0.4 * pulse;
      v *= archOn * Math.max(0.15, dim) * (cue.arch === 'stars' || cue.arch === 'dark' ? 1 : 0.7 + 0.3 * Math.max(pulse, bass.o * (hot ? 1 : PULSE.follow)));
      if (alt === 0) v = k % 2 ? Math.max(v, 0.45) : v * 0.2; // off-beat: only the blue rim of the arch
      if (v < 0.03) continue;
      var hh = k % 2 ? h2 : h1, rr = Math.max(1, 0.11 * p.s);
      if (cue.pre || inHold) hh = 214; // the black box: cool pinpoints only
      g.fillStyle = hsla(hh, sat * 0.7, Math.min(97, 60 + 35 * v), clamp01(v * 1.4)); g.beginPath(); g.arc(p.x, p.y, rr, 0, 7); g.fill();
      if (v > 0.25) glow2(lg, p.x, p.y, rr * 7, hh, sat, 60, Math.min(0.6, v * 0.35));
    }
  });
  // ---------- haze-filled beams
  var hazeK = stageOpts.haze ? 1 : 0.5;
  // perimeter beam lights along the outer rib: static shapes, crossfaded between cues
  var outer = RIG.ribs[0], NB = 24, beamA = ((cue.beams === 'off' ? 0 : 1) * mixK + (prev.beams === 'off' ? 0 : 1) * (1 - mixK)) * (alt === 0 ? 0.15 : 1) * (inHold ? 0 : 1 + 0.6 * revealK);
  if (beamA > 0.01 && !SK.beams) for (var i = 0; i < NB; i++) {
    var a = (0.06 + 0.88 * i / (NB - 1)) * Math.PI, o = [outer.r * Math.cos(a), outer.r * 0.95 * Math.sin(a), outer.z + 0.4];
    var d = vnorm(vlerp(beamLookDir(prev.beams === 'off' ? cue.beams : prev.beams, i, NB, o), beamLookDir(cue.beams === 'off' ? prev.beams : cue.beams, i, NB, o), mixK));
    var chase = cue.tier === 1 && cue.beams === 'fan' ? (i % 2 === (bt ? bt.k % 2 : 0) ? 1 : 0.3) : 1;
    var bw = cue.tier === 2 ? 0 : 1; // big sections: hard white "telescan" beams; elsewhere colour
    beam3(lg, cam, o, d, 42, 0.15, 1.5, i % 2 ? h2 : h1, sat * (bw ? 1 : 0.35), lit + (bw ? 0 : 10), (bw ? 0.42 : 0.3) * beamA * dim * chase * hazeK * (cue.tier ? 1 : 0.6));
  }
  // the screen's ring of lights: iris (converging), flower (spun in colour), sun (rays)
  if (stageOpts.screen && cue.arch !== 'dark' && !inHold && !SK.ring) {
    var sc0 = RIG.screen, NR = 28, spin = beats * (cue.tier === 2 ? 0.08 : 0.03);
    for (i = 0; i < NR; i++) {
      var aa = i / NR * Math.PI * 2, o2 = [sc0.c[0] + sc0.ring * Math.cos(aa), sc0.c[1] + sc0.ring * Math.sin(aa), sc0.c[2] + 0.2], d2;
      if (cue.ring === 'iris') d2 = vnorm(vsub([sc0.c[0] + 2 * Math.cos(aa + 1.2 + spin), sc0.c[1] + 2 * Math.sin(aa + 1.2 + spin), 9], o2));
      else if (cue.ring === 'flower') d2 = vnorm([Math.cos(aa + (i % 2 ? 0.5 : -0.5) + spin), Math.sin(aa + (i % 2 ? 0.5 : -0.5) + spin), 0.9]);
      else d2 = vnorm([Math.cos(aa), Math.sin(aa), 0.25]);
      var hr = cue.ring === 'flower' ? (h1 + (i / NR) * 120 + beats * 10) % 360 : i % 2 ? h2 : h1;
      var ia = archOn * dim * (cue.ring === 'sun' ? 0.5 + 0.5 * pulse : 0.65) * hazeK;
      var A2 = beam3(lg, cam, o2, d2, cue.ring === 'sun' ? 9 : 16, 0.08, cue.ring === 'iris' ? 0.5 : 1.0, hr, sat, lit, 0.32 * ia, true);
      var lp = proj(cam, o2); if (lp) { g.fillStyle = hsla(hr, sat * 0.6, 80, clamp01(0.3 + ia)); g.beginPath(); g.arc(lp.x, lp.y, Math.max(1.2, 0.16 * lp.s), 0, 7); g.fill(); }
    }
  }
  // pods: four trolleys on the upstage truss; they ride to the soloist and keep their lights on them
  var podX = function (c) { var L2 = RIG.cast[c.lead] || RIG.cast.vocals; return c.pods === 'track' ? [-3, -1, 1, 3].map(function (q) { return L2[0] + q * 1.3; }) : c.pods === 'park' ? [-10, -4, 4, 10] : [-8, -2.7, 2.7, 8]; };
  var pxA = podX(prev), pxB = podX(cue), travel = smooth01(since / (beatLen * 8)), podPh = beats / 4 * cue.speed * (1 + 2 * build);
  var tr1 = proj(cam, [-13, RIG.podY + 0.5, RIG.podZ]), tr2 = proj(cam, [13, RIG.podY + 0.5, RIG.podZ]);
  if (tr1 && tr2) { g.strokeStyle = '#23262d'; g.lineWidth = Math.max(1.5, 0.3 * tr1.s); g.beginPath(); g.moveTo(tr1.x, tr1.y); g.lineTo(tr2.x, tr2.y); g.stroke(); }
  for (var q = 0; q < (SK.pods ? 0 : 4); q++) {
    var px = pxA[q] + (pxB[q] - pxA[q]) * travel, po = [px, RIG.podY, RIG.podZ], pp = proj(cam, po);
    if (pp) { g.fillStyle = '#15171c'; g.beginPath(); g.ellipse(pp.x, pp.y, 1.2 * pp.s, 0.45 * pp.s, 0, 0, 7); g.fill(); }
    var podA = (cue.pods === 'park' ? 0.25 : 1) * dim * hazeK * (cue.type === 'Spot' || inHold ? 0.35 : 1);
    for (var m = 0; m < 6; m++) {
      var ang = m / 6 * Math.PI * 2, oo = [px + 0.9 * Math.cos(ang), RIG.podY - 0.2, RIG.podZ + 0.35 * Math.sin(ang)], tgt;
      if (cue.pods === 'track') { var Lp = RIG.cast[cue.lead] || RIG.cast.vocals; tgt = [Lp[0] + 0.6 * Math.cos(ang + beats * 0.2), 0, Lp[2] + 0.6 * Math.sin(ang + beats * 0.2)]; }
      else { var sw = Math.sin(2 * Math.PI * podPh + q * 1.1 + m * 0.4); tgt = [px + sw * 5 * (cue.tier ? 1 : 0.3), 0, 3 * Math.cos(2 * Math.PI * podPh * 0.5 + m)]; }
      beam3(lg, cam, oo, vnorm(vsub(tgt, oo)), 15, 0.1, 0.9, m % 2 ? h2 : h1, sat, lit, 0.3 * podA, true);
    }
  }
  // searchlights from the FOH towers, slow sweeps over the crowd and the stage
  if (cue.search || prev.search) {
    var sA = (cue.search ? mixK : 1 - mixK) * hazeK * (cue.role === 'intro' ? 0.8 : dim);
    RIG.search.forEach(function (o3, j) {
      var tg = [11 * Math.sin(t * 0.21 + j * 1.7), 3 + 5 * seeded(j), 4 + 9 * Math.sin(t * 0.13 + j * 2.3)];
      beam3(lg, cam, o3, vnorm(vsub(tg, o3)), 45, 0.2, 0.9, 210, 15, 90, 0.18 * sA); // cool white xenon, as filmed
      var lp3 = proj(cam, o3); if (lp3) glow2(lg, lp3.x, lp3.y, Math.max(4, 0.6 * lp3.s), 210, 20, 92, 0.8 * sA);
    });
  }
  // follow spots on the lead (and on the soloist when the pods track)
  var fsA = Math.max(0.3, dim) * blackout * (cue.type === 'Spot' || inHold ? 1.6 : 1);
  RIG.follow.forEach(function (o4, j) {
    var who = j === 0 ? (cue.pods === 'track' ? cue.lead : leadNow) : 'vocals'; if (j === 1 && who === (cue.pods === 'track' ? cue.lead : leadNow)) return;
    var P4 = vadd(RIG.cast[who], [0, 1.0, 0]), dd4 = vsub(P4, o4), len4 = Math.hypot(dd4[0], dd4[1], dd4[2]) + 1.2;
    beam3(lg, cam, o4, vnorm(dd4), len4, 0.12, 1.1, 40, 25, 88, 0.22 * fsA * (j ? 0.6 : 1) * hazeK);
  });
  // lasers: thick architectural beams (green 511 nm, yellow 578 nm, lime, and red); webs grow with the guitar notes
  var lz = stageOpts.lasers ? (mixK < 1 && prev.laser && !cue.laser ? prev.laser : cue.laser) : null;
  if (lz && blackout === 1) {
    var lA = (cue.laser ? mixK : 1 - mixK) * Math.min(1, 0.3 + dim);
    var yel = 55, grn = 120, lime = 80, red = 2;
    if (lz === 'web') {
      var notes = cue.notes.filter(function (x) { return x <= t; }).length, nb = Math.min(14, 3 + notes), lh = cue.pre ? 28 : since > (cue.end - cue.start) / 2 ? lime : yel; // the black-box web read amber-orange on film
      for (var w = 0; w < nb; w++) { var src = RIG.laserSrc[w % 2], m1 = RIG.mirrors[(w * 5 + 2) % RIG.mirrors.length], m2 = RIG.mirrors[(w * 7 + 5) % RIG.mirrors.length], m3 = RIG.mirrors[(w * 3 + 11) % RIG.mirrors.length];
        var la = lA * (w >= nb - 1 && notes ? clamp01((t - cue.notes[Math.min(notes, cue.notes.length) - 1]) * 6) : 1);
        laser3(g, lg, cam, src, m1, lh, la, 0.05); laser3(g, lg, cam, m1, m2, lh, la * 0.85, 0.05); laser3(g, lg, cam, m2, m3, lh, la * 0.7, 0.05); }
    } else if (lz === 'search') {
      for (w = 0; w < 4; w++) { var s5 = RIG.laserSrc[w % 2], yaw = 0.7 * Math.sin(t * 0.3 + w * 1.9); laser3(g, lg, cam, s5, vadd(s5, vmul(vnorm([Math.sin(yaw) - s5[0] / 30, 0.1 + 0.05 * Math.sin(t * 0.5 + w), Math.cos(yaw)]), 60)), grn, lA * (0.6 + 0.4 * pulse), 0.06); }
    } else if (lz === 'scan') {
      var s6 = [0, 11.5, -7], yS = 3 + 3 * (0.5 + 0.5 * Math.sin(beats * Math.PI / 8));
      for (w = 0; w < 26; w++) laser3(g, lg, cam, s6, [-35 + 70 * w / 25, yS + 2 * Math.sin(w * 0.5 + beats * 0.3), 45], w % 2 ? grn : yel, lA * 0.55, 0.04);
    } else { // grating: a rotating cone of beams from the screen, lime with red
      var s7 = vadd(RIG.screen.c, [0, 0, 0.6]), half = 0.32 + 0.08 * Math.sin(beats * Math.PI / 8);
      for (w = 0; w < 30; w++) { var aw = w / 30 * Math.PI * 2 + t * 0.35; laser3(g, lg, cam, s7, vadd(s7, vmul([Math.sin(half) * Math.cos(aw), Math.sin(half) * Math.sin(aw) + 0.08, Math.cos(half)], 70)), w % 3 === 0 ? red : lime, lA * (0.55 + 0.45 * Math.max(pulse, oth.o)), 0.05); }
    }
  }
  // blinders on a hit, from the pod truss into the audience
  if (hit > 0.01) for (i = 0; i < 6; i++) { var bp = proj(cam, [-10 + i * 4, RIG.podY - 0.8, RIG.podZ + 0.5]); if (bp) glow2(lg, bp.x, bp.y, Math.max(40, 3 * bp.s), 38, 90, 75, 0.7 * hit); }
  // pyro: once, on the biggest hit of the song
  var D0 = S.song.analysis.dynamics, mainDrop = D0 && D0.drops.filter(function (d) { return d.main && d.kind === 'drop'; })[0];
  var pyroAge = mainDrop ? (t >= mainDrop.t ? t - mainDrop.t : -1) : cue.pyro ? since : -1;
  if (pyroAge >= 0 && pyroAge < 2.6) RIG.pyro.forEach(function (o5, j) {
    var fp = proj(cam, o5); if (fp && pyroAge < 0.4) glow2(lg, fp.x, fp.y - 1.5 * fp.s, Math.max(60, 5 * fp.s) * (1 - pyroAge), 35, 100, 70, 0.9 * (1 - pyroAge / 0.4));
    for (var sp = 0; sp < 36; sp++) { var vx = (seeded(j * 100 + sp) - 0.5) * 4, vy = 9 + seeded(j * 100 + sp + 50) * 7, vz = (seeded(j * 100 + sp + 25) - 0.5) * 3;
      var pt = proj(cam, [o5[0] + vx * pyroAge, vy * pyroAge - 4.9 * pyroAge * pyroAge, o5[2] + vz * pyroAge]); if (!pt || pt.y > H) continue;
      g.fillStyle = hsla(38 + 20 * seeded(sp), 100, 75, clamp01(1 - pyroAge / 2.6)); g.fillRect(pt.x, pt.y, Math.max(1.2, 0.06 * pt.s), Math.max(1.2, 0.06 * pt.s)); }
  });
  // the reveal: the whole arch snaps on at once and blows out the camera, settling within about half a second
  if (revealK > 0.02) { var ac = proj(cam, [0, 6, -7]); if (ac) glow2(lg, ac.x, ac.y, Math.max(W * 0.45, 20 * ac.s), 40, 70, 80, (stageOpts.strobe === 'off' ? 0.35 : 0.8) * revealK, 0.75); }
  // ---------- haze breaks up the beams, then the light buffer goes on the frame with bloom
  lg.setTransform(1, 0, 0, 1, 0, 0);
  if (stageOpts.haze) {
    var mk = STAGE.mask, mg = mk.getContext('2d'), dr = (t * 9) % 320, dens = 0.5 + 0.35 * (cue.haze || 0.6);
    mg.globalCompositeOperation = 'source-over'; mg.clearRect(0, 0, 320, 180); mg.fillStyle = 'rgba(0,0,0,' + (dens - 0.25) + ')'; mg.fillRect(0, 0, 320, 180);
    mg.drawImage(STAGE.haze, -dr, 0); mg.drawImage(STAGE.haze, 320 - dr, 0); mg.globalAlpha = 0.6; mg.drawImage(STAGE.haze, (dr * 0.6) % 320, 20, 320, 160); mg.drawImage(STAGE.haze, (dr * 0.6) % 320 - 320, 20, 320, 160); mg.globalAlpha = 1;
    lg.globalCompositeOperation = 'destination-in'; lg.drawImage(mk, 0, 0, 640, 360); lg.globalCompositeOperation = 'source-over';
  }
  if (!SK.bloom) { // bloom: shrink the light, blur by scaling, add it back at half resolution
    var bg = STAGE.bb.getContext('2d'), bg2 = STAGE.bb2.getContext('2d');
    bg.clearRect(0, 0, 160, 90); bg.drawImage(lbc, 0, 0, 160, 90); bg2.clearRect(0, 0, 40, 23); bg2.drawImage(STAGE.bb, 0, 0, 40, 23);
    lg.globalCompositeOperation = 'lighter'; lg.globalAlpha = 0.5; lg.drawImage(STAGE.bb, 0, 0, 640, 360); lg.globalAlpha = 0.6; lg.drawImage(STAGE.bb2, 0, 0, 640, 360); lg.globalAlpha = 1; lg.globalCompositeOperation = 'source-over';
  }
  g.globalCompositeOperation = 'lighter'; g.drawImage(lbc, 0, 0, W, H); g.globalCompositeOperation = 'source-over';
  // performers in front of the light they stand in (silhouettes with a rim in their stem colour)
  castOrder.forEach(function (s) {
    var f = proj(cam, RIG.cast[s]); if (!f) return; var kk = 1.8 * f.s / 73, e = stem(s).e, shs = STEM_HSL[s];
    if (s === 'drums') { var r1 = proj(cam, [-2.2, 0.6, -6.2]), r2 = proj(cam, [2.2, 0, -4.2]); if (r1 && r2) { g.fillStyle = '#060608'; g.fillRect(Math.min(r1.x, r2.x), r1.y, Math.abs(r2.x - r1.x), r2.y - r1.y); } }
    g.save(); g.shadowColor = hsla(shs[0], shs[1], shs[2], clamp01(0.25 + 0.6 * e)); g.shadowBlur = Math.min(40, 4 + 18 * e * kk); g.fillStyle = '#050506'; g.strokeStyle = '#050506'; stagePerson(g, s, f.x, f.y, kk); g.restore();
  });
  // ---------- mirror ball: rises from the crowd at the climax, opens its petals, throws light across the hall
  if (cue.ball) {
    var bars = since / (beatLen * 4), rise = smooth01(bars / 4), open = smooth01((bars - 2) / 3), bc = [RIG.ball[0], 2 + (RIG.ball[1] - 2) * rise, RIG.ball[2]], bpz = proj(cam, bc);
    if (bpz) {
      var br = 1.5 * bpz.s;
      for (var pe = 0; pe < 6; pe++) { var pa = pe / 6 * Math.PI * 2 + t * 0.1, spread = br * (1 + 1.6 * open);
        g.fillStyle = '#1b1d22'; g.beginPath(); g.moveTo(bpz.x + Math.cos(pa - 0.35) * br * 0.7, bpz.y + Math.sin(pa - 0.35) * br * 0.7); g.lineTo(bpz.x + Math.cos(pa) * spread * 1.3, bpz.y + Math.sin(pa) * spread * 1.3); g.lineTo(bpz.x + Math.cos(pa + 0.35) * br * 0.7, bpz.y + Math.sin(pa + 0.35) * br * 0.7); g.fill();
        if (open > 0.1) { g.fillStyle = hsla(42, 90, 85, open * dim); g.beginPath(); g.arc(bpz.x + Math.cos(pa) * spread * 0.95, bpz.y + Math.sin(pa) * spread * 0.95, Math.max(1.5, 0.12 * bpz.s), 0, 7); g.fill(); } }
      var gb = g.createRadialGradient(bpz.x - br * 0.3, bpz.y - br * 0.3, br * 0.1, bpz.x, bpz.y, br); gb.addColorStop(0, '#e9ecf2'); gb.addColorStop(1, '#4a4f5a'); g.fillStyle = gb; g.beginPath(); g.arc(bpz.x, bpz.y, br, 0, 7); g.fill();
      g.globalCompositeOperation = 'lighter';
      for (var fct = 0; fct < 40; fct++) { var fa = seeded(fct) * 6.28 + t * 0.3, fr = Math.sqrt(seeded(fct + 40)) * br * 0.9; if (Math.cos(fa) > 0.2) { g.fillStyle = 'rgba(255,255,255,' + (0.6 * Math.cos(fa)) + ')'; g.fillRect(bpz.x + Math.sin(fa) * fr, bpz.y + (seeded(fct + 80) * 2 - 1) * fr, 2, 2); } }
      var nsp = Math.round(700 * open);
      for (var spt = 0; spt < nsp; spt++) { // reflections on a 30 m sphere around the ball, turning with it
        var th = Math.acos(1 - 2 * seeded(spt + 3)), phi = seeded(spt + 600) * 6.28 + t * 0.22, R5 = 30;
        var sp3 = proj(cam, [bc[0] + R5 * Math.sin(th) * Math.cos(phi), Math.max(0.2, bc[1] + R5 * Math.cos(th) * 0.6), bc[2] + R5 * Math.sin(th) * Math.sin(phi)]); if (!sp3) continue;
        var sz = Math.max(1.5, Math.min(7, 0.3 * sp3.s)); g.fillStyle = 'rgba(255,248,230,' + (0.65 * open * Math.max(dim, 0.5)) + ')'; g.fillRect(sp3.x, sp3.y, sz, sz);
      }
      g.globalCompositeOperation = 'source-over';
    }
  }
  // ---------- the crowd, between the camera and the stage
  var nod = bt ? Math.sin(bt.frac * Math.PI) : 0, handsUp = hit > 0.2 || cue.role === 'climax' || (cue.tier === 2 && E > 0.75);
  if (!SK.crowd) { // drawn far to near; each row is batched into a few paths
    var phones = cue.tier === 0 || cue.ball, rim = hsla(h1, sat, 60, 0.3 * dim), crowd = STAGE.crowd, j0 = 0;
    while (j0 < crowd.length) {
      var j1 = Math.min(crowd.length, j0 + 60), body = new Path2D(), arms = new Path2D(), rims = new Path2D(), armW = 1;
      g.fillStyle = 'rgba(255,248,230,0.9)';
      for (var j = j0; j < j1; j++) {
        var p = crowd[j], hp = proj(cam, [p.x, p.h + 0.05 * nod * (j % 3 ? 0.5 : 1), p.z]); if (!hp || hp.z < (shot.name === "close" ? 7 : 3) || hp.x < -60 || hp.x > W + 60 || hp.y > H + 80) continue;
        var r = 0.12 * hp.s; body.moveTo(hp.x + r, hp.y); body.arc(hp.x, hp.y, r, 0, 7); body.moveTo(hp.x + r * 2.2, hp.y + r * 2.4); body.ellipse(hp.x, hp.y + r * 2.4, r * 2.2, r * 1.6, 0, 0, 7);
        if (handsUp && p.hands) { armW = Math.max(armW, r * 0.55); arms.moveTo(hp.x - r, hp.y + r); arms.lineTo(hp.x - r * 1.7, hp.y - r * 3.2 - nod * r); arms.moveTo(hp.x + r, hp.y + r); arms.lineTo(hp.x + r * 1.6, hp.y - r * 3 - nod * r); }
        if (phones && p.phone) g.fillRect(hp.x + r * 1.2 + Math.sin(t * 0.8 + p.ph) * r, hp.y - r * 3, Math.max(1, r * 0.35), Math.max(1.5, r * 0.6));
        if (r > 3) { rims.moveTo(hp.x + r * Math.cos(Math.PI * 1.15), hp.y + r * Math.sin(Math.PI * 1.15)); rims.arc(hp.x, hp.y, r, Math.PI * 1.15, Math.PI * 1.85); }
      }
      g.fillStyle = '#000'; g.fill(body); g.strokeStyle = '#000'; g.lineWidth = armW; g.stroke(arms); g.strokeStyle = rim; g.lineWidth = 1; g.stroke(rims);
      j0 = j1;
    }
  }
  // ---------- strobe: rate-limited (Safe: at most 3 flashes in any second)
  var st = STROBE[stageOpts.strobe];
  if (st && S.playing && blackout === 1 && !cue.pre && !inHold) {
    // the film's finale flashed on the eighth notes (one every 0.29 s at 103 BPM); Full follows that grid, Safe still caps at 3 a second
    var onGrid = bt && (bt.frac * 2) % 1 < 0.2, gap = stageOpts.strobe === 'full' ? Math.max(st.gap, beatLen * 0.45) : st.gap;
    var want = (cue.strobe && onGrid && E > 0.45) || (ci > sh.reveal && cue.type === 'Hit' && cue.tier === 2 && since < beatLen * 2) || (dropHit > 0 && dy.since < beatLen * 2) || (build > 0.85 && bt && bt.frac < 0.1);
    if (want && t - STAGE.lastStrobe >= gap) { STAGE.lastStrobe = t; STAGE.flashAt = t; STAGE.flashA = st.a; }
  }
  var fla = t - STAGE.flashAt; if (fla >= 0 && fla < 0.07) { g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,255,255,' + STAGE.flashA * (1 - fla / 0.07) + ')'; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over'; }
  if (stageOpts.desk) stageDesk(g, sh, ci, t, W, H, beatLen, dim, shot.name, { strobe: fla >= 0 && fla < 0.07, laser: !!lz, ball: !!cue.ball, pyro: pyroAge >= 0 && pyroAge < 2.6, spot: cue.type === 'Spot' || inHold, build: build > 0 });
  g0.drawImage(sc, 0, 0, W, H);
}
function stageDesk(g, sh, ci, t, W, H, beatLen, dim, shotName, lamps) {
  var cue = sh.cues[ci], nx = sh.cues[ci + 1], x = W - 372, y = H - 236, w = 342, h = 206;
  g.fillStyle = 'rgba(6,7,10,0.78)'; g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1; g.beginPath(); g.rect(x, y, w, h); g.fill(); g.stroke();
  g.font = '600 11px ' + css('--f-mono'); g.fillStyle = VCOL.dim; g.fillText('LIGHTING DESK', x + 12, y + 20); g.textAlign = 'right'; g.fillText('CUE ' + (ci + 1) + '/' + sh.cues.length + ' · CAM ' + shotName.toUpperCase(), x + w - 12, y + 20); g.textAlign = 'left';
  g.font = '700 20px ' + css('--f-display'); g.fillStyle = hsla(stagePalette(cue, 0)[0], 85, 68, 1); g.fillText('Q' + (ci + 1) + ' · ' + cue.label + ' · ' + cue.type.toUpperCase() + (cue.role !== 'body' ? ' · ' + cue.role.toUpperCase() : ''), x + 12, y + 46);
  g.font = '500 11px ' + css('--f-mono'); g.fillStyle = VCOL.mix; var lk = cue.look; g.fillText(lk.slice(0, 52), x + 12, y + 65); if (lk.length > 52) g.fillText(lk.slice(52, 104), x + 12, y + 79);
  g.fillStyle = VCOL.dim; g.fillText(nx ? 'NEXT Q' + (ci + 2) + ' ' + nx.label + ' ' + nx.type.toLowerCase() + ' in ' + Math.max(0, Math.ceil((nx.start - t) / beatLen)) + ' beats' : 'LAST CUE', x + 12, y + 96);
  // the arc of the whole show: one bar per cue (height = energy), with where each big effect is spent
  var ax = x + 12, aw = w - 24, ay = y + 152, ah = 38, dur = S.song.duration, emax = Math.max.apply(null, sh.cues.map(function (c) { return c.energy; })) || 1;
  sh.cues.forEach(function (c, k) {
    var x0 = ax + aw * c.start / dur, x1 = ax + aw * c.end / dur, hh = ah * c.energy / emax;
    g.fillStyle = hsla(stagePalette(c, 0)[0], k === ci ? 85 : 40, k === ci ? 60 : 35, 1); g.fillRect(x0 + 1, ay - hh, Math.max(1, x1 - x0 - 2), hh);
    var mk = (k === sh.reveal ? 'R' : '') + (c.laser && (k === 0 || !sh.cues[k - 1].laser) ? 'L' : '') + (c.ball ? 'B' : '') + (c.pyro ? 'P' : '');
    if (mk) { g.fillStyle = VCOL.accent; g.font = '700 10px ' + css('--f-mono'); g.fillText(mk, x0 + 2, ay - hh - 3); }
  });
  g.fillStyle = VCOL.mix; g.fillRect(ax + aw * t / dur, ay - ah - 6, 1.5, ah + 8);
  g.font = '500 10px ' + css('--f-mono'); g.fillStyle = VCOL.dim; g.fillText('MASTER', x + 12, y + 172); g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(x + 64, y + 165, w - 76, 7); g.fillStyle = VCOL.accent; g.fillRect(x + 64, y + 165, (w - 76) * clamp01(dim), 7);
  ['strobe', 'laser', 'ball', 'pyro', 'spot', 'build'].forEach(function (k, i) { var lx = x + 12 + i * 54, on = lamps[k]; g.fillStyle = on ? VCOL.accent : 'rgba(255,255,255,0.08)'; g.fillRect(lx, y + 180, 49, 16); g.fillStyle = on ? '#111' : VCOL.dim; g.font = '600 10px ' + css('--f-mono'); g.textAlign = 'center'; g.fillText(k.toUpperCase(), lx + 24.5, y + 192); g.textAlign = 'left'; });
}
var SCENES = { layers: sceneLayers, orbit: sceneOrbit, equation: sceneEquation, tunnel: sceneTunnel, stage: sceneStage };
// ---- build-ups, breakdowns and drops (from the analysis) drive every scene
function dynAt(t) {
  var a = S.song && S.song.analysis, D = a && a.dynamics; if (!D || !D.tension) return null;
  var i = Math.max(0, Math.min(D.tension.length - 1, Math.round(t * D.rate)));
  var r = { tension: D.tension[i], bass: D.bass[i], build: null, breakdown: null, next: null, toDrop: Infinity, drop: null, since: Infinity };
  D.builds.forEach(function (b) { if (t >= b.start && t < b.end + 0.05 && b.peak >= 0.45) r.build = b; });
  D.breakdowns.forEach(function (b) { if (t >= b.start && t < b.end) r.breakdown = b; });
  D.drops.forEach(function (d) { if (d.t > t && d.t - t < r.toDrop) { r.toDrop = d.t - t; r.next = d; } if (d.t <= t && t - d.t < r.since) { r.since = t - d.t; r.drop = d; } });
  r.lift = r.build ? r.tension : r.tension * 0.35; // how much the picture should tighten and brighten
  return r;
}
function vDynEvents(t, dy, jumped) {
  if (!dy || jumped || !S.playing) { VID.dynLast = { build: dy && dy.build, breakdown: dy && dy.breakdown, drop: dy && dy.drop }; return; }
  var L = VID.dynLast || {};
  if (dy.build && dy.build !== L.build) vCaption(dy.build.into ? 'Build-up: it is heading for a drop' : 'Build-up', VCOL.accent, t);
  if (dy.breakdown && dy.breakdown !== L.breakdown && !dy.build) vCaption('Breakdown: the bass drops out', '#7aa7ff', t);
  if (dy.drop && dy.drop !== L.drop && dy.since < 0.5) vCaption(dy.drop.kind === 'drop' ? (dy.drop.main ? 'THE DROP' : 'Drop') : 'The bass is back', dy.drop.kind === 'drop' ? '#ffffff' : VCOL.bass, t);
  VID.dynLast = { build: dy.build, breakdown: dy.breakdown, drop: dy.drop };
}
function vDynOverlay(g, t, W, H, dy, beatLen, stage) { // drawn over any scene (the Stage only gets the countdown; it lights its own drops)
  if (!dy) return;
  if (stage) dy = { next: dy.next, build: dy.build, toDrop: dy.toDrop, lift: 0 };
  var soft = reducedMotion;
  if (dy.lift > 0.05) { // tension: the frame closes in and heats up, sparks rise
    var vg = g.createRadialGradient(W / 2, H / 2, H * (0.75 - 0.4 * dy.lift), W / 2, H / 2, H * 1.05); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,' + (0.75 * dy.lift) + ')'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter'; var nsp = Math.round(60 * dy.lift);
    for (var i = 0; i < nsp; i++) { var sx = seeded(i) * W, sp = 0.3 + seeded(i + 50) * (0.7 + 2.5 * dy.lift), sy = H - ((t * sp * 220 + seeded(i + 9) * H) % (H + 40)); g.fillStyle = 'rgba(255,' + Math.round(200 - 120 * dy.lift) + ',90,' + (0.25 + 0.6 * dy.lift) + ')'; g.fillRect(sx, sy, 2, 6 + 18 * dy.lift); }
    g.globalCompositeOperation = 'source-over';
  }
  if (dy.breakdown && !dy.build) { g.fillStyle = 'rgba(10,20,50,0.25)'; g.fillRect(0, 0, W, H); }
  var nx = dy.next;
  if (nx && nx.kind === 'drop' && dy.build && dy.toDrop <= beatLen * 4 + 0.02 && dy.toDrop > beatLen * 0.5) { // countdown in beats
    var c = Math.ceil(dy.toDrop / beatLen - 0.5), fr = 1 - ((dy.toDrop / beatLen) % 1);
    g.globalAlpha = 0.35 + 0.5 * (1 - fr); g.fillStyle = '#fff'; g.font = '800 ' + Math.round(140 + 80 * (1 - fr)) + 'px ' + css('--f-display'); g.textAlign = 'center'; g.fillText(String(Math.max(1, c)), W / 2, H / 2 + 50); g.textAlign = 'left'; g.globalAlpha = 1;
  }
  if (!stage && nx && nx.kind === 'drop' && dy.toDrop <= beatLen * 0.5) { g.fillStyle = 'rgba(0,0,0,0.88)'; g.fillRect(0, 0, W, H); } // the breath before the drop
  if (dy.drop && dy.since < 1.2) {
    var k = dy.drop.kind === 'drop' ? (dy.drop.main ? 1 : 0.75) : 0.4, s = dy.since;
    g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,255,255,' + (k * (soft ? 0.25 : 0.6) * Math.exp(-s * 9)) + ')'; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(255,255,255,' + (k * (1 - s / 1.2)) + ')'; g.lineWidth = 6 * (1 - s / 1.2) + 1; g.beginPath(); g.arc(W / 2, H / 2, 40 + s * W * 0.7, 0, 7); g.stroke();
    g.globalCompositeOperation = 'source-over';
    if (dy.drop.kind === 'drop' && s < 0.9) { g.globalAlpha = Math.min(1, (0.9 - s) * 3); g.fillStyle = '#fff'; g.font = '800 96px ' + css('--f-display'); g.textAlign = 'center'; g.fillText(dy.drop.main ? 'DROP' : 'DROP', W / 2, H * 0.22); g.textAlign = 'left'; g.globalAlpha = 1; }
  }
}
function vShake(dy) { if (!dy || reducedMotion || !dy.drop || dy.drop.kind !== 'drop' || dy.since > 0.6) return [0, 0]; var a = 14 * (dy.drop.main ? 1 : 0.6) * (1 - dy.since / 0.6); return [(Math.random() * 2 - 1) * a, (Math.random() * 2 - 1) * a]; }
function drawVideo() {
  var cv = $('videoCv'); if (VID.view !== 'video' && !VID.rec) return;
  var g = cv.getContext('2d'), W = cv.width, H = cv.height;
  g.fillStyle = VCOL.bg; g.fillRect(0, 0, W, H);
  $('videoHint').hidden = S.playing || !!VID.rec;
  if (!S.song) return;
  var t = currentPos(); var jmp = Math.abs(t - VID.lastT) > 0.5; vUpdateEvents(t);
  var dy = dynAt(t); VID.dy = dy; vDynEvents(t, dy, jmp);
  var b = vBeat(t), sh = vShake(dy); g.save(); g.translate(sh[0], sh[1]);
  if ($('vBeats').checked && b) { var pulse = Math.max(0, 1 - b.frac * 2.5) * (b.bar ? 0.12 : 0.05); if (pulse > 0) { g.fillStyle = VCOL.accent; g.globalAlpha = pulse; g.fillRect(0, 0, W, H); g.globalAlpha = 1; } }
  var scene = sceneFor(t); if (scene !== VID.curScene && !VID.fadeFrom) { VID.fadeFrom = VID.curScene; VID.fadeAt = performance.now(); }
  VID.curScene = scene;
  var fade = VID.fadeFrom ? Math.min(1, (performance.now() - VID.fadeAt) / 900) : 1;
  if (VID.fadeFrom && fade < 1) { g.globalAlpha = 1 - fade; SCENES[VID.fadeFrom](g, t, W, H); g.globalAlpha = 1; }
  else VID.fadeFrom = null;
  g.save(); g.globalAlpha = fade; SCENES[scene](g, t, W, H); g.restore(); g.globalAlpha = 1;
  vDynOverlay(g, t, W, H, dy, 60 / ((S.song.analysis && S.song.analysis.bpm) || 120), scene === 'stage' && !VID.fadeFrom); g.restore();
  // overlays
  var a = S.song.analysis, sec = vSection(t);
  if ($('vInfo').checked) {
    g.fillStyle = VCOL.mix; g.globalAlpha = 0.85; g.font = '700 22px ' + css('--f-display'); g.fillText(S.song.title.slice(0, 60), 36, 48);
    g.globalAlpha = 0.6; g.font = '500 14px ' + css('--f-mono'); g.fillText((a ? a.bpm.toFixed(0) + ' BPM · ' + a.key + ' · ' : '') + fmt(t, 0) + ' / ' + fmt(S.song.duration, 0) + (S.recipe && S.recipe.motion && motionOn() ? ' · 8D' : ''), 36, 72);
    if (b) { for (var q = 0; q < 4; q++) { g.globalAlpha = q === b.k % 4 ? 0.95 : 0.25; g.fillStyle = q === b.k % 4 ? VCOL.accent : VCOL.mix; g.beginPath(); g.arc(W - 96 + q * 18, 44, 5, 0, 7); g.fill(); } }
    g.globalAlpha = 1;
  }
  if (sec && performance.now() - VID.secShownAt < 2600 && S.playing) {
    var age = (performance.now() - VID.secShownAt) / 2600; g.globalAlpha = Math.min(1, 4 * (1 - age)) * Math.min(1, age * 6);
    g.fillStyle = VCOL.mix; g.font = '700 54px ' + css('--f-display'); g.textAlign = 'center'; g.fillText('SECTION ' + sec.s.label, W / 2, H * 0.16); g.textAlign = 'left'; g.globalAlpha = 1;
  }
  if ($('vCaptions').checked) {
    var now = performance.now(); VID.caps = VID.caps.filter(function (c) { return now - c.born < 3500; });
    VID.caps.forEach(function (c, i) { var age = (now - c.born) / 3500; g.globalAlpha = Math.min(1, (1 - age) * 3); g.fillStyle = c.col; g.font = '600 18px ' + css('--f-body'); g.fillText(c.text, 36, H - 40 - (VID.caps.length - 1 - i) * 28); });
    g.globalAlpha = 1;
  }
}
// recording: canvas + the mix you hear -> .webm
function toggleRecord() {
  if (VID.rec) { VID.rec.stop(); return; }
  if (!window.MediaRecorder || !$('videoCv').captureStream) { toast('This browser cannot record video.'); return; }
  if (!S.song || !S.song.stems) { toast('Wait for the stems to finish splitting.'); return; }
  var c = getCtx(); ensureMonitor();
  var dest = c.createMediaStreamDestination(); monitor.connect(dest);
  var stream = new MediaStream($('videoCv').captureStream(30).getVideoTracks().concat(dest.stream.getAudioTracks()));
  var type = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(function (m) { return MediaRecorder.isTypeSupported(m); });
  var chunks = [], rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 6e6 });
  rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
  rec.onstop = function () {
    try { monitor.disconnect(dest); } catch (e) {}
    VID.rec = null; $('vRec').classList.remove('recording'); $('vRec').textContent = 'Record video';
    var blob = new Blob(chunks, { type: 'video/webm' });
    saveFile(safeName(S.song.title) + '-video.webm', blob);
  };
  VID.rec = rec; rec.start(500); $('vRec').classList.add('recording'); $('vRec').textContent = 'Stop and save';
  if (!S.playing) play();
  toast('Recording. Press Stop and save when done; it also stops at the end of the song.');
}
$('viewStudio').onclick = function () { setView('studio'); };
$('viewVideo').onclick = function () { setView('video'); };
document.querySelectorAll('#sceneSeg button').forEach(function (b) { b.onclick = function () { VID.scene = b.dataset.scene; document.querySelectorAll('#sceneSeg button').forEach(function (x) { x.classList.toggle('on', x === b); }); VID.fadeFrom = null; syncStageUI(); drawVideo(); }; });
$('vFull').onclick = function () { var w = $('videoWrap'); if (document.fullscreenElement) document.exitFullscreen(); else if (w.requestFullscreen) w.requestFullscreen().catch(function () { toast('Fullscreen is not available here.'); }); };
$('vRec').onclick = toggleRecord;
function syncStageUI() {
  $('stageBar').hidden = !(VID.scene === 'stage' || VID.scene === 'auto');
  ['colours', 'strobe', 'camera'].forEach(function (k) { document.querySelectorAll('#st' + k[0].toUpperCase() + k.slice(1) + ' button').forEach(function (b) { b.classList.toggle('on', b.dataset.v === stageOpts[k]); }); });
  ['lasers', 'haze', 'screen', 'desk'].forEach(function (k) { $('st' + k[0].toUpperCase() + k.slice(1)).checked = !!stageOpts[k]; });
}
function setStage(k, v) { stageOpts[k] = v; try { localStorage.setItem('rl-stage', JSON.stringify(stageOpts)); } catch (e) {} syncStageUI(); drawVideo(); }
['colours', 'strobe', 'camera'].forEach(function (k) { document.querySelectorAll('#st' + k[0].toUpperCase() + k.slice(1) + ' button').forEach(function (b) { b.onclick = function () {
  if (k === 'strobe' && b.dataset.v === 'full') toast('Full strobe flashes up to 9 times a second. It can trigger seizures in people with photosensitive epilepsy.');
  setStage(k, b.dataset.v); }; }); });
['lasers', 'haze', 'screen', 'desk'].forEach(function (k) { $('st' + k[0].toUpperCase() + k.slice(1)).onchange = function (e) { setStage(k, e.target.checked); }; });
syncStageUI();

// ---------- boot ----------
if (window.claude && window.claude.use) window.claude.use('downloads').then(function (d) { downloads = d; }).catch(function () {});
Store.all('songs').then(function (songs) { S.library = songs || []; rebuildIndex(); renderSongList(); })
  .then(function () { return Store.all('renders'); }).then(function (r) { S.renders = (r || []).sort(function (a, b) { return b.created - a.created; }); renderRenderList(); })
  .catch(function () {})
  .then(function () { renderRack(); drawAll(); drawHist(null); setAMode(amode); try { if (localStorage.getItem('rl-view') === 'video') setView('video'); } catch (e) {} loadBuffer(makeDemo(), 'Demo groove (synthesized)'); });
})();
