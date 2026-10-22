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

// a synthetic dance track: full 0-16 s, breakdown 16-24 s (pad only), build-up 24-32 s (noise riser sweeping up,
// snare roll speeding up, no sub-bass), drop at 32 s (everything back)
test('finds the breakdown, the build-up and the drop', () => {
  const D = 44, N2 = sr * D, y = new Float32Array(N2), R2 = rnd(11);
  let lp = 0;
  for (let i = 0; i < N2; i++) {
    const t = i / sr, bt = t % 0.5, full = t < 16 || t >= 32, build = t >= 24 && t < 32;
    let v = 0.06 * Math.sin(2 * Math.PI * 220 * t) + 0.04 * Math.sin(2 * Math.PI * 277 * t); // pad
    if (full) { v += 0.7 * Math.sin(2 * Math.PI * (50 + 80 * Math.exp(-bt * 30)) * bt) * Math.exp(-bt * 10) + 0.3 * Math.sin(2 * Math.PI * 45 * t); if ((t % 0.5) > 0.25 && (t % 0.5) < 0.28) v += 0.15 * (R2() * 2 - 1); }
    if (build) {
      const u = (t - 24) / 8, cut = 0.02 + 0.6 * u * u; lp += cut * ((R2() * 2 - 1) - lp); v += (0.05 + 0.25 * u) * ((R2() * 2 - 1) - lp); // noise riser: high-passed, opening upward
      const div = u < 0.5 ? 0.25 : u < 0.75 ? 0.125 : 0.0625, st = t % div; if (st < 0.03) v += (0.15 + 0.2 * u) * (R2() * 2 - 1) * Math.exp(-st * 80); // snare roll
    }
    y[i] = v;
  }
  const d = DSP.analyze(y, sr).dynamics;
  const drop = d.drops.find(x => x.main);
  assert(drop && Math.abs(drop.t - 32) < 0.4, 'main drop ' + JSON.stringify(d.drops));
  const b = d.builds.find(x => x.end > 30 && x.start < 30);
  assert(b && b.start > 22 && b.start < 29 && b.peak > 0.6, 'build ' + JSON.stringify(d.builds));
  assert(d.breakdowns.some(x => x.start < 18 && x.end > 22), 'breakdown ' + JSON.stringify(d.breakdowns));
  assert(!d.drops.some(x => x.kind === 'drop' && x.t > 2 && Math.abs(x.t - 32) > 1), 'no false drops ' + JSON.stringify(d.drops));
});

// ---------- synths ----------
const SY = require('../web/src/synths.js');
test('every synth has presets, and its MIDI knobs and presets only name real controls', () => {
  const extra = { mod: ['cables'] };
  SY.ORDER.forEach(k => {
    const D = SY.DEFS[k], ok = id => id in D.params || (extra[k] || []).includes(id);
    assert(D.presets.length > 0, k + ' has no presets');
    assert(D.cc.length >= 1 && D.cc.length <= 8 && D.cc.every(ok) && ok(D.wheel), k + ' maps a MIDI knob to a missing control');
    D.presets.forEach(p => Object.keys(p.p).forEach(id => assert(ok(id), k + ' preset "' + p.name + '" sets unknown ' + id)));
    Object.entries(D.params).forEach(([id, P]) => { if (P.o) assert(P.o.some(o => o[0] === P.v), k + '.' + id + ' default is not one of its options'); });
  });
});
test('every synth has riffs of 16 steps inside the grid, single notes on mono synths', () => {
  SY.ORDER.forEach(k => {
    const D = SY.DEFS[k];
    assert(D.patterns && D.patterns.length >= 2, k + ' needs riffs');
    D.patterns.forEach(p => {
      assert(p.steps.length === 16 && p.tempo >= 60 && p.tempo <= 180 && p.root >= 24 && p.root <= 72, k + ' ' + p.name);
      p.steps.forEach((st, i) => {
        assert(st.notes.every(n => Number.isInteger(n) && n >= 0 && n <= 12), k + ' ' + p.name + ' step ' + (i + 1) + ' note outside the grid');
        assert(D.poly || st.notes.length <= 1, k + ' ' + p.name + ' step ' + (i + 1) + ' has a chord on a mono synth');
      });
    });
  });
});
test('held chords tie every step but the last', () => {
  const c = SY.chords([[[0, 4, 7], 4, 1], [null, 2]]);
  assert.deepStrictEqual(c.map(s => s.sl), [true, true, true, false, false, false]);
  assert.deepStrictEqual(c.map(s => s.notes.length), [3, 3, 3, 3, 0, 0]);
  assert(c[0].acc && !c[1].acc);
});
test('pads: 8 show controls and 8 key changes; tap tempo averages the gaps and stays in range', () => {
  assert.strictEqual(SY.PADS.length, 16);
  assert.deepStrictEqual(SY.PADS.slice(8).map(p => p.tr), SY.KEY_STEPS);
  assert.strictEqual(SY.bpmFromTaps([0]), null);
  assert.strictEqual(SY.bpmFromTaps([0, 500, 1000, 1500]), 120);
  assert.strictEqual(SY.bpmFromTaps([0, 480, 1010]), 119);
  assert.strictEqual(SY.bpmFromTaps([0, 2000]), 60);
  assert.strictEqual(SY.bpmFromTaps([0, 100]), 180);
});
test('endless knobs: two\'s-complement and offset-64 steps decode to signed deltas', () => {
  assert.deepStrictEqual([1, 3, 127, 125].map(v => SY.relDelta('twos', v)), [1, 3, -1, -3]);
  assert.deepStrictEqual([65, 67, 63, 61].map(v => SY.relDelta('off64', v)), [1, 3, -1, -3]);
});
test('every modular preset patches real jacks, outputs into inputs', () => {
  const D = SY.DEFS.mod, outs = new Set(), ins = new Set();
  D.modules.forEach(m => { m.outs.forEach(o => outs.add(o[0])); m.ins.forEach(i => ins.add(i[0])); });
  D.presets.forEach(p => p.p.cables.forEach(([a, b]) => assert(outs.has(a) && ins.has(b), p.name + ': ' + a + ' → ' + b)));
});
test('FM algorithms: 6 operators, and every one is heard directly or through what it modulates', () => {
  Object.entries(SY.ALGS).forEach(([n, A]) => {
    assert.deepStrictEqual(Object.keys(A.pos).map(Number).sort((a, b) => a - b), [1, 2, 3, 4, 5, 6], 'algorithm ' + n);
    assert(A.c.length > 0 && A.fb >= 1 && A.fb <= 6, 'algorithm ' + n);
    const reaches = op => A.c.includes(op) || A.e.filter(e => e[0] === op).some(e => reaches(e[1]));
    for (let op = 1; op <= 6; op++) assert(reaches(op), 'algorithm ' + n + ': operator ' + op + ' is never heard');
  });
});
test('knob positions round-trip to values, log knobs included', () => {
  [{ min: 20, max: 20000, log: true }, { min: -24, max: 24, step: 1 }, { min: 0, max: 1 }].forEach(P => {
    for (let n = 0; n <= 1; n += 0.125) { const v = SY.fromN(P, n); assert(Math.abs(SY.fromN(P, SY.toN(P, v)) - v) < 1e-6 * Math.max(1, Math.abs(v)), JSON.stringify(P) + ' at ' + n); }
  });
});
test('FM feedback spectrum: Bessel J matches known values', () => {
  assert(Math.abs(SY.besselJ(0, 1) - 0.7651977) < 1e-5 && Math.abs(SY.besselJ(1, 2) - 0.5767248) < 1e-5 && Math.abs(SY.besselJ(3, 5) - 0.3648312) < 1e-5);
});

console.log(failed ? `\n${failed} test(s) failed` : '\nall tests passed');
process.exit(failed ? 1 : 0);
