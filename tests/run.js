// Dependency-free tests: node tests/run.js
const assert = require('assert');
const DSP = require('../web/src/dsp.js');
const AI = require('../web/src/aisplit.js');
let failed = 0;
function test(name, fn) { try { fn(); console.log('ok   ', name); } catch (e) { failed++; console.log('FAIL ', name, '\n     ', e.message); } }
function rnd(seed) { let s = seed; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }

// a synthetic 40 s song: 120 BPM kick + hats, sine bass, centred "vocal" line, wide pad; arrangement changes at 20 s
const sr = 44100, dur = 40, n = sr * dur, beat = 0.5, R0 = rnd(7);
const src = { kick: new Float32Array(n), hat: new Float32Array(n), bass: new Float32Array(n), vox: new Float32Array(n), padL: new Float32Array(n), padR: new Float32Array(n) };
for (let b = 0; b * beat < dur; b++) {
  const s0 = Math.round(b * beat * sr);
  for (let i = 0; i < sr * 0.25 && s0 + i < n; i++) { const t = i / sr; src.kick[s0 + i] += 0.8 * Math.sin(2 * Math.PI * (50 + 70 * Math.exp(-t * 30)) * t) * Math.exp(-t * 12); }
  const h0 = Math.round((b + 0.5) * beat * sr);
  for (let i = 0; i < sr * 0.04 && h0 + i < n; i++) src.hat[h0 + i] += 0.2 * (R0() * 2 - 1) * Math.exp(-i / sr * 90);
}
let ph = 0;
for (let i = 0; i < n; i++) {
  const t = i / sr, bar = Math.floor(t / 2), B = t > 20 ? 1 : 0;
  src.bass[i] = 0.35 * Math.sin(2 * Math.PI * [55, 55, 65.4, 49][bar % 4] * t);
  ph += 2 * Math.PI * [440, 494, 523, 392, 440, 587][Math.floor(t / beat) % 6] * (B ? 1.5 : 1) * (1 + 0.006 * Math.sin(2 * Math.PI * 5.5 * t)) / sr;
  src.vox[i] = 0.2 * (Math.sin(ph) + 0.5 * Math.sin(2 * ph) + 0.25 * Math.sin(3 * ph));
  src.padL[i] = (0.05 + 0.08 * B) * Math.sin(2 * Math.PI * 261.6 * t);
  src.padR[i] = (0.05 + 0.08 * B) * Math.sin(2 * Math.PI * 261.6 * 0.997 * t + 1);
}
const L = new Float32Array(n), R = new Float32Array(n), mono = new Float32Array(n);
for (let i = 0; i < n; i++) { const c = src.kick[i] + src.hat[i] + src.bass[i] + src.vox[i]; L[i] = c + src.padL[i]; R[i] = c + src.padR[i]; mono[i] = 0.5 * (L[i] + R[i]); }

const a = DSP.analyze(mono, sr);
test('tempo is detected within 1 BPM', () => assert(Math.abs(a.bpm - 120) < 1, 'got ' + a.bpm));
test('a section boundary is found near 20 s', () => assert(a.sections.some(s => Math.abs(s.start - 20) < 1.5), JSON.stringify(a.sections.map(s => s.start))));

const st = DSP.separate(L, R, sr);
test('DSP stems sum back to the original', () => { let e = 0; for (let i = 0; i < n; i++) e = Math.max(e, Math.abs(st.vocals[0][i] + st.drums[0][i] + st.bass[0][i] + st.other[0][i] - L[i])); assert(e < 1e-5, 'max error ' + e); });
function share(stem, ref) { let num = 0, den = 0; for (let i = sr; i < n - sr; i++) { num += stem[i] * ref[i]; den += ref[i] * ref[i]; } return num / den; }
test('centred melody lands in the vocal stem', () => assert(share(st.vocals[0], src.vox) > 0.9));
test('hi-hats land in the drum stem', () => assert(share(st.drums[0], src.hat) > 0.9));
test('sine bass lands in the bass stem', () => assert(share(st.bass[0], src.bass) > 0.9));

const fp = DSP.fingerprint(mono, sr), idx = new Map();
for (let i = 0; i < fp.hashes.length; i++) { const h = fp.hashes[i]; if (!idx.has(h)) idx.set(h, []); idx.get(h).push(fp.times[i]); }
test('a noisy 8 s excerpt is located within 0.1 s', () => {
  const off = 13.3, len = 8 * sr, clip = new Float32Array(len), R1 = rnd(3);
  for (let i = 0; i < len; i++) clip[i] = 0.6 * mono[Math.round(off * sr) + i] + 0.15 * (R1() * 2 - 1);
  const q = DSP.fingerprint(clip, sr), hist = new Map();
  for (let i = 0; i < q.hashes.length; i++) (idx.get(q.hashes[i]) || []).forEach(t => { const o = t - q.times[i]; hist.set(o, (hist.get(o) || 0) + 1); });
  let best = [0, 0]; hist.forEach((v, k) => { if (v > best[1]) best = [k, v]; });
  assert(Math.abs(best[0] / fp.fps - off) < 0.1, 'offset ' + best[0] / fp.fps);
});

test('equation view recovers frequency, amplitude and phase of sines', () => {
  const seg = new Float32Array(4096); for (let i = 0; i < 4096; i++) { const t = i / sr; seg[i] = 0.5 * Math.sin(2 * Math.PI * 440 * t + 0.3); }
  const p = DSP.partials(seg, sr, 1)[0], tc = 2048 / sr, want = ((2 * Math.PI * 440 * tc + 0.3) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  const got = ((p.phase % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  assert(Math.abs(p.freq - 440) < 1 && Math.abs(p.amp - 0.5) < 0.01 && Math.abs(got - want) < 0.05, JSON.stringify(p));
});

test('AI split STFT/iSTFT round-trips a chunk (away from the edges)', () => {
  const S = AI.SEG, x = new Float32Array(S), y = new Float32Array(S); for (let i = 0; i < S; i++) { x[i] = Math.sin(i * 0.01) * 0.3; y[i] = Math.cos(i * 0.003) * 0.2; }
  const mag = AI.spec(x, y), sp = new Float32Array(4 * mag.length); sp.set(mag, 0);
  const oL = new Float32Array(S), oR = new Float32Array(S); AI.ispec(sp, 0, oL, oR);
  let e = 0; for (let i = 8192; i < S - 8192; i++) e = Math.max(e, Math.abs(oL[i] - x[i]), Math.abs(oR[i] - y[i])); // Demucs drops the edge frames
  assert(e < 1e-4, 'max error ' + e);
});
test('float16 weight decoder', () => { const v = AI.f16to32(new Uint16Array([0x3c00, 0xc000, 0x3555, 0])); assert(v[0] === 1 && v[1] === -2 && Math.abs(v[2] - 0.333) < 1e-3 && v[3] === 0); });

console.log(failed ? `\n${failed} test(s) failed` : '\nall tests passed');
process.exit(failed ? 1 : 0);
