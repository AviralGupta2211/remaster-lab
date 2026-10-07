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
  S.recipe = { master: defMaster(), regions: [{ id: uid(), name: 'Whole song', start: 0, end: buf.duration, stems: freshStems() }] };
  S.sel = 0; S.pos = 0; S.solo = {}; S.peaks = { orig: peaksOf(buf) }; S.wc = waveColors(buf); ovImg = null;
  $('songTitle').textContent = title;
  renderChips(); renderRack(); drawAll(); enableUI();
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
  S.song.stemSource = label;
  $('stemSrc').textContent = 'Stems: ' + label;
  enableUI(); drawTimeline(); renderChips();
}
function freshStems() { var o = {}; STEMS.forEach(function (s) { o[s] = defStem(); }); return o; }
function seedRegions() {
  var a = S.song.analysis; if (!a) return;
  var count = {};
  S.recipe.regions = a.sections.map(function (sg) {
    count[sg.label] = (count[sg.label] || 0) + 1;
    return { id: uid(), name: 'Section ' + sg.label + (count[sg.label] > 1 ? count[sg.label] : ''), start: sg.start, end: sg.end, stems: freshStems() };
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
  mIn.connect(mL); mL.connect(mM); mM.connect(mH); mH.connect(lim); lim.connect(out); out.connect(dest);
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
    var clean = c.createGain(), pre = c.createGain(), sh = c.createWaveShaper(), wet = c.createGain(), sum = c.createGain();
    sh.curve = SHAPER; sh.oversample = '4x';
    hi.connect(clean); clean.connect(sum); hi.connect(pre); pre.connect(sh); sh.connect(wet); wet.connect(sum);
    var comp = c.createDynamicsCompressor(); comp.attack.value = 0.008; comp.release.value = 0.16; comp.knee.value = 6;
    var fader = c.createGain();
    sum.connect(comp); comp.connect(fader); fader.connect(mIn);
    var sends = revs.map(function (cv) { var sg = c.createGain(); fader.connect(sg); sg.connect(cv); return sg; });
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
  var mt = masterTargets(S.recipe.master);
  Object.keys(g.master).forEach(function (k) { g.master[k].forEach(function (ap) { if (live) { ap.cancelScheduledValues(now); ap.setTargetAtTime(mt[k], now, 0.015); } else ap.setValueAtTime(mt[k], ctxAt); }); });
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
  g.sources[0].onended = function () { if (S.graph === g && !loop) { S.playing = false; S.pos = 0; $('playBtn').textContent = 'Play'; } };
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
    regions: S.recipe.regions.map(function (r) { return { id: r.id, name: r.name, start: +r.start.toFixed(3), end: +r.end.toFixed(3), stems: r.stems }; }) }, null, 2);
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
    return { id: r.id || uid(), name: r.name || 'Region', start: +r.start, end: Math.min(dur, +r.end), stems: st };
  }).sort(function (a, b) { return a.start - b.start; });
  if (!regs.length) { toast('That recipe has no regions for this song.'); return; }
  regs[0].start = 0; regs[regs.length - 1].end = dur;
  for (var i = 1; i < regs.length; i++) regs[i].start = regs[i - 1].end;
  S.recipe = { master: Object.assign(defMaster(), rc.master || {}), regions: regs };
  S.sel = 0; currentVersionName = name || ''; $('verName').value = name || '';
  renderRack(); drawTimeline(); liveUpdateFix(); toast('Loaded "' + (name || 'recipe') + '"');
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
  g.fillStyle = css('--accent'); g.fillRect(left + currentPos() / dur * plotW - 1, 4, 2, plotH);
}
function msg(g, w, h, t) { g.fillStyle = css('--muted'); g.font = '13px ' + css('--f-body'); g.textAlign = 'center'; g.fillText(t, w / 2, h / 2); g.textAlign = 'left'; }
var BAND_COL = ['--bass', '--vocals', '--warn', '--other', '--drums', '--accent'];
function drawBands() {
  var cv = $('bandsCv'); if (!cv.offsetParent) return;
  var o = setupCanvas(cv), g = o.g, w = o.w, h = o.h; g.clearRect(0, 0, w, h);
  var a = S.song && S.song.analysis; if (!a) { msg(g, w, h, S.song ? 'Analysing…' : ''); return; }
  var left = 40, top = 24, pw = w - left - 10, phh = h - top - 24, mx = -1e9;
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
  g2.font = '600 11px ' + css('--f-display'); g2.fillStyle = css('--muted'); g2.fillText('SECTIONS', left, y0 + 9);
  var labels = {}, cats = ['--vocals', '--drums', '--bass', '--other', '--accent', '--warn'];
  a.sections.forEach(function (sg) { if (!(sg.label in labels)) labels[sg.label] = Object.keys(labels).length; var x0 = left + sg.start / dur * pw, x1 = left + sg.end / dur * pw;
    g2.fillStyle = css(cats[labels[sg.label] % cats.length]); g2.globalAlpha = 0.85; g2.fillRect(x0 + 1, y0 + 16, x1 - x0 - 2, 22); g2.globalAlpha = 1;
    g2.fillStyle = css('--bg'); g2.font = '600 12px ' + css('--f-display'); if (x1 - x0 > 16) g2.fillText(sg.label, x0 + 6, y0 + 32); });
  var oy = y0 + 58, oh = 90; g2.fillStyle = css('--muted'); g2.font = '600 11px ' + css('--f-display'); g2.fillText('ONSETS AND BEATS · ' + a.bpm.toFixed(1) + ' BPM', left, oy - 4);
  var omx = 0; for (i = 0; i < a.onset.length; i++) if (a.onset[i] > omx) omx = a.onset[i];
  g2.fillStyle = css('--orig'); for (i = 0; i < a.onset.length; i++) { var vh = a.onset[i] / (omx || 1) * oh; g2.fillRect(left + i / a.onset.length * pw, oy + oh - vh, Math.max(1, pw / a.onset.length), vh); }
  g2.fillStyle = css('--accent'); a.beats.forEach(function (bt) { g2.fillRect(left + bt / dur * pw, oy + oh + 2, 1, 6); });
  var cy = oy + oh + 34, chH = h - cy - 22; g2.fillStyle = css('--muted'); g2.fillText('PITCH CLASSES · KEY ' + a.key.toUpperCase(), left, cy - 6);
  var names = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'], bw = pw / 12;
  for (i = 0; i < 12; i++) { var bh = a.chroma[i] * chH; g2.fillStyle = css('--bass'); g2.fillRect(left + i * bw + 3, cy + chH - bh, bw - 6, bh); g2.fillStyle = css('--muted'); g2.font = '10.5px ' + css('--f-mono'); g2.textAlign = 'center'; g2.fillText(names[i], left + i * bw + bw / 2, h - 8); g2.textAlign = 'left'; }
  $('structNote').textContent = a.sections.length + ' sections detected (' + a.sections.map(function (s) { return s.label + ' ' + fmt(s.start, 0); }).join(', ') + '). Same letter = similar sound. Key estimate confidence ' + Math.round(a.keyScore * 100) + '%.';
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
  var el = $('eqText'); el.innerHTML = '';
  var head = document.createElement('span'); head.className = 'x'; head.textContent = 'x(t) ≈ '; el.appendChild(head);
  if (!P.length) el.append('0  (silence)');
  P.forEach(function (q, k) {
    var ph = ((q.phase % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    var s = document.createElement('span'); s.className = 'term'; s.textContent = (k ? ' + ' : '') + (q.amp >= 0.01 ? q.amp.toFixed(3) : q.amp.toPrecision(2)) + '·sin(2π·' + q.freq.toFixed(1) + 't + ' + ph.toFixed(2) + ')';
    el.appendChild(s); if (k % 2 === 1 && k < P.length - 1) el.appendChild(document.createElement('br'));
  });
  // waveform vs reconstruction, 25 ms window centred on playhead
  var win = Math.round(0.025 * sr), a0 = N / 2 - win / 2, mx = 1e-6;
  for (i = 0; i < win; i++) mx = Math.max(mx, Math.abs(seg[a0 + i]));
  var topH = h * 0.62, mid = topH / 2 + 6, sc = (topH / 2 - 10) / mx;
  g.strokeStyle = css('--line'); g.beginPath(); g.moveTo(0, mid + 0.5); g.lineTo(w, mid + 0.5); g.stroke();
  g.strokeStyle = css('--orig'); g.globalAlpha = 0.55; g.lineWidth = 2.5; g.beginPath();
  for (i = 0; i < win; i++) { var xx = i / win * w, yy = mid - seg[a0 + i] * sc; if (!i) g.moveTo(xx, yy); else g.lineTo(xx, yy); } g.stroke(); g.globalAlpha = 1;
  g.strokeStyle = css('--accent'); g.lineWidth = 1.5; g.beginPath();
  for (i = 0; i < win; i++) { var tt = (i - win / 2) / sr, v = 0; P.forEach(function (q) { v += q.amp * Math.sin(2 * Math.PI * q.freq * tt + q.phase); }); xx = i / win * w; yy = mid - v * sc; if (!i) g.moveTo(xx, yy); else g.lineTo(xx, yy); } g.stroke();
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
function drawAll() { drawOverview(); drawZoom(); drawTimeline(); drawSpec(); drawBands(); drawStruct(); drawEq(true); drawFp(); drawMeter(); updateTime(); }
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
    updateTime(); drawZoom(); drawOverview(); drawTimeline(); drawMeter();
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
  var nr = { id: uid(), name: r.name + ' (b)', start: t, end: r.end, stems: JSON.parse(JSON.stringify(r.stems)) };
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
          else if (d.stage === 'ready') aiProgress(0.18, 'Separating on ' + (d.ep === 'webgpu' ? 'WebGPU' : 'the CPU') + '…');
          else if (d.stage === 'note') toast(d.text);
          else if (d.stage === 'split') aiProgress(0.18 + d.p * 0.8, 'Separating on ' + (d.ep === 'webgpu' ? 'WebGPU' : 'CPU') + ' · ' + Math.round(d.p * 100) + '% · about ' + fmtMin(d.eta) + ' left');
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
$('copyAllBtn').onclick = function () { var src = S.recipe.regions[S.sel].stems; S.recipe.regions.forEach(function (r) { r.stems = JSON.parse(JSON.stringify(src)); }); drawTimeline(); liveUpdateFix(); toast('Copied to all ' + S.recipe.regions.length + ' regions'); };
$('resetRegionBtn').onclick = function () { S.recipe.regions[S.sel].stems = freshStems(); renderRack(); drawTimeline(); liveUpdateFix(); };
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
$('eqSrc').onchange = function () { drawEq(true); };
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

// ---------- boot ----------
if (window.claude && window.claude.use) window.claude.use('downloads').then(function (d) { downloads = d; }).catch(function () {});
Store.all('songs').then(function (songs) { S.library = songs || []; rebuildIndex(); renderSongList(); })
  .then(function () { return Store.all('renders'); }).then(function (r) { S.renders = (r || []).sort(function (a, b) { return b.created - a.created; }); renderRenderList(); })
  .catch(function () {})
  .then(function () { renderRack(); drawAll(); drawHist(null); loadBuffer(makeDemo(), 'Demo groove (synthesized)'); });
})();
