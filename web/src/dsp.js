// ===== DSP core: shared by the page and its Web Worker =====
var DSP = (function () {
  var fftCache = {};
  function getFFT(N) {
    if (fftCache[N]) return fftCache[N];
    var lev = Math.round(Math.log2(N)), rev = new Uint32Array(N), i;
    for (i = 0; i < N; i++) { var r = 0, x = i; for (var b = 0; b < lev; b++) { r = (r << 1) | (x & 1); x >>= 1; } rev[i] = r; }
    var cs = new Float64Array(N / 2), sn = new Float64Array(N / 2);
    for (i = 0; i < N / 2; i++) { cs[i] = Math.cos(2 * Math.PI * i / N); sn[i] = Math.sin(2 * Math.PI * i / N); }
    function transform(re, im, inv) {
      var i, j, t;
      for (i = 0; i < N; i++) { j = rev[i]; if (j > i) { t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
      for (var size = 2; size <= N; size <<= 1) {
        var half = size >> 1, step = N / size;
        for (i = 0; i < N; i += size) {
          for (j = 0; j < half; j++) {
            var k = j * step, a = i + j, b2 = a + half;
            var wr = cs[k], wi = inv ? sn[k] : -sn[k];
            var xr = re[b2] * wr - im[b2] * wi, xi = re[b2] * wi + im[b2] * wr;
            re[b2] = re[a] - xr; im[b2] = im[a] - xi; re[a] += xr; im[a] += xi;
          }
        }
      }
      if (inv) for (i = 0; i < N; i++) { re[i] /= N; im[i] /= N; }
    }
    return (fftCache[N] = { N: N, transform: transform });
  }
  function hann(N) { var w = new Float64Array(N); for (var i = 0; i < N; i++) w[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N); return w; }

  var BANDS = [
    { name: 'Sub', lo: 20, hi: 60 }, { name: 'Bass', lo: 60, hi: 250 }, { name: 'Low-mid', lo: 250, hi: 500 },
    { name: 'Mid', lo: 500, hi: 2000 }, { name: 'Presence', lo: 2000, hi: 6000 }, { name: 'Air', lo: 6000, hi: 20000 }
  ];
  var KEYS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  var MAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
  var MIN = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

  function corr(a, b) {
    var n = a.length, ma = 0, mb = 0, i; for (i = 0; i < n; i++) { ma += a[i]; mb += b[i]; } ma /= n; mb /= n;
    var s = 0, sa = 0, sb = 0; for (i = 0; i < n; i++) { var x = a[i] - ma, y = b[i] - mb; s += x * y; sa += x * x; sb += y * y; }
    return s / Math.sqrt(sa * sb + 1e-12);
  }

  // ---------- full-song analysis ----------
  function analyze(mono, sr, progress) {
    var N = 2048, H = 512, nb = N / 2 + 1, fft = getFFT(N), w = hann(N);
    var frames = Math.max(1, Math.floor((mono.length - N) / H) + 1);
    var fps = sr / H;
    var cols = Math.min(frames, 2400), ROWS = 256;
    var fmin = 30, fmax = Math.min(16000, sr / 2);
    var rowLo = new Float64Array(ROWS + 1);
    for (var r = 0; r <= ROWS; r++) rowLo[r] = fmin * Math.pow(fmax / fmin, r / ROWS) / sr * N;
    var spec = new Float32Array(cols * ROWS);
    var bandFr = new Float32Array(frames * 6);
    var bandBin = BANDS.map(function (b) { return [Math.max(1, Math.round(b.lo / sr * N)), Math.min(nb - 1, Math.round(b.hi / sr * N))]; });
    var flux = new Float32Array(frames);
    var pcOf = new Int8Array(nb).fill(-1);
    for (var k = 1; k < nb; k++) { var f = k * sr / N; if (f >= 55 && f <= 5000) { var midi = 69 + 12 * Math.log2(f / 440); pcOf[k] = ((Math.round(midi) % 12) + 12) % 12; } }
    var BL = 43, blocks = Math.max(1, Math.ceil(frames / BL));
    var feat = new Float64Array(blocks * 18);
    var gChroma = new Float64Array(12);
    var re = new Float64Array(N), im = new Float64Array(N), mag = new Float32Array(nb), prevLog = new Float32Array(nb);
    var t, i;
    for (t = 0; t < frames; t++) {
      var off = t * H;
      for (i = 0; i < N; i++) { re[i] = mono[off + i] * w[i]; im[i] = 0; }
      fft.transform(re, im, false);
      var fl = 0;
      for (k = 0; k < nb; k++) {
        var m = Math.sqrt(re[k] * re[k] + im[k] * im[k]); mag[k] = m;
        var lg = Math.log(1 + 100 * m); var d = lg - prevLog[k]; if (d > 0) fl += d; prevLog[k] = lg;
      }
      flux[t] = fl;
      var col = Math.floor(t * cols / frames), base = col * ROWS;
      for (r = 0; r < ROWS; r++) {
        var a = rowLo[r], b = rowLo[r + 1], v;
        if (b - a < 1) { var ai = Math.floor(a), fr = a - ai; v = mag[ai] * (1 - fr) + mag[Math.min(nb - 1, ai + 1)] * fr; }
        else { v = 0; for (var q = Math.floor(a); q < Math.ceil(b) && q < nb; q++) if (mag[q] > v) v = mag[q]; }
        if (v > spec[base + r]) spec[base + r] = v;
      }
      var blk = Math.floor(t / BL), fb = blk * 18;
      for (var bi = 0; bi < 6; bi++) {
        var e = 0; for (k = bandBin[bi][0]; k <= bandBin[bi][1]; k++) e += mag[k] * mag[k];
        bandFr[t * 6 + bi] = e; feat[fb + 12 + bi] += e;
      }
      for (k = 1; k < nb; k++) { var p = pcOf[k]; if (p >= 0) { feat[fb + p] += mag[k]; gChroma[p] += mag[k]; } }
      if (progress && t % 500 === 0) progress(t / frames);
    }
    // spectrogram to bytes (80 dB range)
    var mx = 1e-9; for (i = 0; i < spec.length; i++) if (spec[i] > mx) mx = spec[i];
    var specB = new Uint8Array(spec.length);
    for (i = 0; i < spec.length; i++) { var db = 20 * Math.log10(spec[i] / mx + 1e-12); specB[i] = Math.max(0, Math.min(255, Math.round((db + 80) / 80 * 255))); }
    // bands per column (dB)
    var bands = new Float32Array(cols * 6), cnt = new Float32Array(cols);
    for (t = 0; t < frames; t++) { var c2 = Math.floor(t * cols / frames); cnt[c2]++; for (bi = 0; bi < 6; bi++) bands[c2 * 6 + bi] += bandFr[t * 6 + bi]; }
    for (var c = 0; c < cols; c++) for (bi = 0; bi < 6; bi++) bands[c * 6 + bi] = 10 * Math.log10(bands[c * 6 + bi] / (cnt[c] || 1) + 1e-10);
    // tempo
    var on = new Float32Array(frames), win = Math.round(fps);
    var cs = new Float64Array(frames + 1); for (t = 0; t < frames; t++) cs[t + 1] = cs[t] + flux[t];
    for (t = 0; t < frames; t++) { var lo = Math.max(0, t - win), hi = Math.min(frames, t + win); var mean = (cs[hi] - cs[lo]) / (hi - lo); on[t] = Math.max(0, flux[t] - mean); }
    var minLag = Math.floor(60 / 200 * fps), maxLag = Math.ceil(60 / 60 * fps), best = -1, bestLag = minLag, ac = new Float64Array(maxLag + 2);
    for (var L = minLag - 1; L <= maxLag + 1; L++) { var s = 0; for (t = L; t < frames; t++) s += on[t] * on[t - L]; ac[L] = s; }
    for (L = minLag; L <= maxLag; L++) {
      var bpm = 60 * fps / L, pr = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 120) / 0.9, 2));
      var sc = ac[L] * pr; if (sc > best) { best = sc; bestLag = L; }
    }
    var y0 = ac[bestLag - 1], y1 = ac[bestLag], y2 = ac[bestLag + 1], den = y0 - 2 * y1 + y2;
    var lagF = bestLag + (den !== 0 ? 0.5 * (y0 - y2) / den : 0);
    var tempo = 60 * fps / lagF;
    var bestPh = 0, bestPs = -1;
    for (var ph = 0; ph < lagF; ph++) { var ps = 0; for (var x = ph; x < frames; x += lagF) ps += on[Math.round(x)] || 0; if (ps > bestPs) { bestPs = ps; bestPh = ph; } }
    var beats = []; for (x = bestPh; x < frames; x += lagF) beats.push(x / fps);
    // key
    var bestK = { score: -2 };
    for (var root = 0; root < 12; root++) {
      var rot = []; for (i = 0; i < 12; i++) rot.push(gChroma[(i + root) % 12]);
      var cM = corr(rot, MAJ), cm = corr(rot, MIN);
      if (cM > bestK.score) bestK = { score: cM, name: KEYS[root] + ' major' };
      if (cm > bestK.score) bestK = { score: cm, name: KEYS[root] + ' minor' };
    }
    // sections: feature normalisation
    for (blk = 0; blk < blocks; blk++) {
      fb = blk * 18; var sum = 0; for (i = 0; i < 12; i++) sum += feat[fb + i]; for (i = 0; i < 12; i++) feat[fb + i] /= (sum || 1);
      for (i = 12; i < 18; i++) feat[fb + i] = Math.log10(feat[fb + i] + 1e-9);
    }
    for (i = 0; i < 18; i++) {
      var mu = 0, sd = 0; for (blk = 0; blk < blocks; blk++) mu += feat[blk * 18 + i]; mu /= blocks;
      for (blk = 0; blk < blocks; blk++) { var dd = feat[blk * 18 + i] - mu; sd += dd * dd; } sd = Math.sqrt(sd / blocks) || 1;
      for (blk = 0; blk < blocks; blk++) feat[blk * 18 + i] = (feat[blk * 18 + i] - mu) / sd;
    }
    for (blk = 0; blk < blocks; blk++) { var nn = 0; for (i = 0; i < 18; i++) nn += feat[blk * 18 + i] * feat[blk * 18 + i]; nn = Math.sqrt(nn) || 1; for (i = 0; i < 18; i++) feat[blk * 18 + i] /= nn; }
    function sim(a, b) { var s = 0; for (var i = 0; i < 18; i++) s += feat[a * 18 + i] * feat[b * 18 + i]; return s; }
    var Kh = Math.min(16, Math.max(2, Math.floor(blocks / 6)));
    var nov = new Float64Array(blocks);
    for (i = 0; i < blocks; i++) {
      var sN = 0;
      for (var aa = -Kh; aa < Kh; aa++) for (var bb = -Kh; bb < Kh; bb++) {
        var ia = i + aa, ib = i + bb; if (ia < 0 || ib < 0 || ia >= blocks || ib >= blocks) continue;
        var sg = ((aa < 0) === (bb < 0)) ? 1 : -1, g = Math.exp(-((aa + 0.5) * (aa + 0.5) + (bb + 0.5) * (bb + 0.5)) / (2 * Kh * Kh * 0.25));
        sN += sg * g * sim(ia, ib);
      }
      nov[i] = sN;
    }
    var nm = 0, nsd = 0; for (i = 0; i < blocks; i++) nm += nov[i]; nm /= blocks; for (i = 0; i < blocks; i++) nsd += (nov[i] - nm) * (nov[i] - nm); nsd = Math.sqrt(nsd / blocks);
    var minSeg = Math.max(4, Math.round(8 * fps / BL)), bounds = [0];
    var cand = [];
    for (i = Kh; i < blocks - Kh; i++) {
      var isMax = true; for (var j = Math.max(0, i - minSeg); j <= Math.min(blocks - 1, i + minSeg); j++) if (nov[j] > nov[i]) { isMax = false; break; }
      if (isMax && nov[i] > nm + 0.3 * nsd) cand.push(i);
    }
    cand.forEach(function (ci) { if (ci - bounds[bounds.length - 1] >= minSeg) bounds.push(ci); });
    if (blocks - bounds[bounds.length - 1] < minSeg && bounds.length > 1) bounds.pop();
    var segs = [];
    for (i = 0; i < bounds.length; i++) {
      var s0 = bounds[i], s1 = i + 1 < bounds.length ? bounds[i + 1] : blocks, mv = new Float64Array(18);
      for (blk = s0; blk < s1; blk++) for (j = 0; j < 18; j++) mv[j] += feat[blk * 18 + j];
      var mn = 0; for (j = 0; j < 18; j++) mn += mv[j] * mv[j]; mn = Math.sqrt(mn) || 1; for (j = 0; j < 18; j++) mv[j] /= mn;
      segs.push({ start: s0 * BL / fps, end: Math.min(s1 * BL, frames) / fps, vec: mv });
    }
    segs[segs.length - 1].end = mono.length / sr;
    var reps = [];
    segs.forEach(function (sg) {
      var bestL = -1, bestS = 0.8;
      reps.forEach(function (rp, ri) { var s = 0; for (var j = 0; j < 18; j++) s += rp[j] * sg.vec[j]; if (s > bestS) { bestS = s; bestL = ri; } });
      if (bestL < 0) { reps.push(sg.vec); bestL = reps.length - 1; }
      sg.label = String.fromCharCode(65 + Math.min(bestL, 25)); delete sg.vec;
    });
    var D = Math.min(blocks, 240), ssm = new Uint8Array(D * D);
    for (i = 0; i < D; i++) for (j = 0; j < D; j++) { var bi2 = Math.floor(i * blocks / D), bj2 = Math.floor(j * blocks / D); ssm[i * D + j] = Math.round((sim(bi2, bj2) + 1) / 2 * 255); }
    var onC = new Float32Array(cols); for (t = 0; t < frames; t++) { c2 = Math.floor(t * cols / frames); if (on[t] > onC[c2]) onC[c2] = on[t]; }
    var chroma = Array.prototype.slice.call(gChroma); var cmx = Math.max.apply(null, chroma) || 1; chroma = chroma.map(function (v) { return v / cmx; });
    if (progress) progress(1);
    return { cols: cols, rows: ROWS, fmin: fmin, fmax: fmax, spec: specB, bands: bands, bpm: tempo, beats: beats, key: bestK.name, keyScore: bestK.score,
      chroma: chroma, sections: segs, ssm: ssm, ssmSize: D, onset: onC };
  }

  // ---------- stem separation (spectral masks) ----------
  function median(buf, n) { // insertion sort of first n
    for (var i = 1; i < n; i++) { var v = buf[i], j = i - 1; while (j >= 0 && buf[j] > v) { buf[j + 1] = buf[j]; j--; } buf[j + 1] = v; }
    return buf[n >> 1];
  }
  function separate(L, R, sr, progress) {
    var N = 2048, H = 512, nb = N / 2 + 1, M = 8, F = 8, RING = 2 * M + 1, fft = getFFT(N), w = hann(N);
    var len = L.length, frames = Math.ceil((len + N) / H) + 1;
    var Zr = [], Zi = [], S = [], C = [];
    for (var s = 0; s < RING; s++) { Zr.push(new Float64Array(N)); Zi.push(new Float64Array(N)); S.push(new Float32Array(nb)); C.push(new Float32Array(nb)); }
    var out = { vocals: [new Float32Array(len), new Float32Array(len)], drums: [new Float32Array(len), new Float32Array(len)], bass: [new Float32Array(len), new Float32Array(len)] };
    var names = ['vocals', 'drums', 'bass'];
    var wB = new Float32Array(nb), wV = new Float32Array(nb), k;
    for (k = 0; k < nb; k++) {
      var f = k * sr / N;
      wB[k] = f < 110 ? 1 : f > 220 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * (f - 110) / 110);
      var lo = f < 120 ? 0 : f > 220 ? 1 : 0.5 - 0.5 * Math.cos(Math.PI * (f - 120) / 100);
      var hi = f < 7000 ? 1 : f > 10000 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * (f - 7000) / 3000);
      wV[k] = lo * hi;
    }
    var buf = new Float64Array(2 * Math.max(M, F) + 1), mask = [new Float32Array(nb), new Float32Array(nb), new Float32Array(nb)];
    var Hm = new Float32Array(nb), Pm = new Float32Array(nb), yr = new Float64Array(N), yi = new Float64Array(N);
    var norm = 1 / 1.5; // sum of hann^2 at hop N/4
    for (var t = 0; t < frames + M; t++) {
      if (t < frames) {
        var slot = t % RING, zr = Zr[slot], zi = Zi[slot], st = t * H - N / 2, i;
        for (i = 0; i < N; i++) { var p = st + i; if (p >= 0 && p < len) { zr[i] = L[p] * w[i]; zi[i] = R[p] * w[i]; } else { zr[i] = 0; zi[i] = 0; } }
        fft.transform(zr, zi, false);
        var Sx = S[slot], Cx = C[slot];
        for (k = 0; k < nb; k++) {
          var nk = (N - k) % N;
          var lr = 0.5 * (zr[k] + zr[nk]), li = 0.5 * (zi[k] - zi[nk]);
          var rr = 0.5 * (zi[k] + zi[nk]), ri = -0.5 * (zr[k] - zr[nk]);
          var ml = Math.sqrt(lr * lr + li * li), mr = Math.sqrt(rr * rr + ri * ri);
          Sx[k] = 0.5 * (ml + mr);
          var sr2 = lr + rr, si2 = li + ri;
          Cx[k] = Math.sqrt(sr2 * sr2 + si2 * si2) / (ml + mr + 1e-12);
        }
      }
      var c = t - M; if (c < 0) continue;
      if (c >= frames) break;
      var cs = c % RING, Sc = S[cs], Cc = C[cs];
      var t0 = Math.max(0, c - M), t1 = Math.min(frames - 1, c + M), n = t1 - t0 + 1;
      for (k = 0; k < nb; k++) {
        for (var q = 0; q < n; q++) buf[q] = S[(t0 + q) % RING][k];
        Hm[k] = median(buf, n);
      }
      for (k = 0; k < nb; k++) {
        var k0 = Math.max(0, k - F), k1 = Math.min(nb - 1, k + F), m2 = k1 - k0 + 1;
        for (q = 0; q < m2; q++) buf[q] = Sc[k0 + q];
        Pm[k] = median(buf, m2);
      }
      for (k = 0; k < nb; k++) {
        var h2 = Hm[k] * Hm[k], p2 = Pm[k] * Pm[k], mh = (h2 + 1e-18) / (h2 + p2 + 2e-18), mp = 1 - mh;
        var cen = Math.pow(Math.min(1, Cc[k]), 4);
        mask[2][k] = mh * wB[k];                 // bass
        mask[0][k] = mh * (1 - wB[k]) * wV[k] * cen; // vocals
        mask[1][k] = mp;                          // drums
      }
      var zr2 = Zr[cs], zi2 = Zi[cs], st2 = c * H - N / 2;
      for (var si = 0; si < 3; si++) {
        var mk = mask[si];
        for (k = 0; k < N; k++) { var kk = k <= N / 2 ? k : N - k; yr[k] = zr2[k] * mk[kk]; yi[k] = zi2[k] * mk[kk]; }
        fft.transform(yr, yi, true);
        var oL = out[names[si]][0], oR = out[names[si]][1];
        for (i = 0; i < N; i++) { var pp = st2 + i; if (pp >= 0 && pp < len) { oL[pp] += yr[i] * w[i] * norm; oR[pp] += yi[i] * w[i] * norm; } }
      }
      if (progress && c % 400 === 0) progress(c / frames);
    }
    var oL2 = new Float32Array(len), oR2 = new Float32Array(len);
    for (var j = 0; j < len; j++) {
      oL2[j] = L[j] - out.vocals[0][j] - out.drums[0][j] - out.bass[0][j];
      oR2[j] = R[j] - out.vocals[1][j] - out.drums[1][j] - out.bass[1][j];
    }
    out.other = [oL2, oR2];
    if (progress) progress(1);
    return out;
  }

  // ---------- fingerprinting (constellation hashes) ----------
  var FP_SR = 11025, FP_N = 1024, FP_H = 256;
  function resample(x, sr) {
    var ratio = sr / FP_SR, outLen = Math.floor(x.length / ratio), y = new Float32Array(outLen);
    var taps = 31, h = new Float64Array(2 * taps + 1), fc = 0.45 / ratio, sum = 0, j;
    for (j = -taps; j <= taps; j++) { var v = j === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * j) / (Math.PI * j); v *= 0.54 + 0.46 * Math.cos(Math.PI * j / taps); h[j + taps] = v; sum += v; }
    for (j = 0; j < h.length; j++) h[j] /= sum;
    if (ratio < 1.01 && ratio > 0.99) { y.set(x.subarray(0, outLen)); return y; }
    for (var n = 0; n < outLen; n++) {
      var c = Math.round(n * ratio), acc = 0;
      for (j = -taps; j <= taps; j++) { var p = c + j; if (p >= 0 && p < x.length) acc += h[j + taps] * x[p]; }
      y[n] = acc;
    }
    return y;
  }
  function fingerprint(mono, sr) {
    var x = resample(mono, sr), N = FP_N, H = FP_H, nb = N / 2, fft = getFFT(N), w = hann(N);
    var frames = Math.max(0, Math.floor((x.length - N) / H) + 1);
    var S = new Float32Array(frames * nb), re = new Float64Array(N), im = new Float64Array(N), t, k, i;
    for (t = 0; t < frames; t++) {
      for (i = 0; i < N; i++) { re[i] = x[t * H + i] * w[i]; im[i] = 0; }
      fft.transform(re, im, false);
      for (k = 0; k < nb; k++) S[t * nb + k] = Math.log(1e-7 + Math.sqrt(re[k] * re[k] + im[k] * im[k]));
    }
    var TW = 6, FW = 12, tmax = new Float32Array(frames * nb);
    for (t = 0; t < frames; t++) for (k = 0; k < nb; k++) {
      var m = -1e9; for (var u = Math.max(0, t - TW); u <= Math.min(frames - 1, t + TW); u++) { var v = S[u * nb + k]; if (v > m) m = v; }
      tmax[t * nb + k] = m;
    }
    var fps = FP_SR / H, chunk = Math.round(fps), perChunk = 25, peaks = [];
    for (var c0 = 0; c0 < frames; c0 += chunk) {
      var cand = [];
      for (t = c0; t < Math.min(frames, c0 + chunk); t++) {
        for (k = 3; k < nb - 1; k++) {
          var val = S[t * nb + k]; if (val < -9) continue;
          var isMax = true;
          for (var kk = Math.max(0, k - FW); kk <= Math.min(nb - 1, k + FW); kk++) if (tmax[t * nb + kk] > val) { isMax = false; break; }
          if (isMax) cand.push([t, k, val]);
        }
      }
      cand.sort(function (a, b) { return b[2] - a[2]; });
      for (i = 0; i < Math.min(perChunk, cand.length); i++) peaks.push(cand[i]);
    }
    peaks.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    var hashes = [], times = [];
    for (i = 0; i < peaks.length; i++) {
      var got = 0;
      for (var j = i + 1; j < peaks.length && got < 6; j++) {
        var dt = peaks[j][0] - peaks[i][0]; if (dt < 1) continue; if (dt > 63) break;
        if (Math.abs(peaks[j][1] - peaks[i][1]) > 120) continue;
        hashes.push(((peaks[i][1] & 511) << 15) | ((peaks[j][1] & 511) << 6) | dt); times.push(peaks[i][0]); got++;
      }
    }
    var pt = new Uint32Array(peaks.length), pf = new Uint16Array(peaks.length);
    for (i = 0; i < peaks.length; i++) { pt[i] = peaks[i][0]; pf[i] = peaks[i][1]; }
    return { hashes: new Uint32Array(hashes), times: new Uint32Array(times), peakT: pt, peakF: pf, fps: fps, binHz: FP_SR / N, frames: frames };
  }

  // ---------- equation view: top partials at a moment ----------
  function partials(seg, sr, count) {
    var N = seg.length, fft = getFFT(N), w = hann(N), re = new Float64Array(N), im = new Float64Array(N), i, ws = 0;
    for (i = 0; i < N; i++) { var j = (i + N / 2) % N; re[j] = seg[i] * w[i]; ws += w[i]; } // centred: phase refers to the window centre
    fft.transform(re, im, false);
    var nb = N / 2, mag = new Float64Array(nb);
    for (i = 0; i < nb; i++) mag[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
    var pk = [];
    for (i = 2; i < nb - 2; i++) if (mag[i] > mag[i - 1] && mag[i] >= mag[i + 1] && mag[i] > 1e-6) pk.push(i);
    pk.sort(function (a, b) { return mag[b] - mag[a]; });
    var res = [];
    for (i = 0; i < pk.length && res.length < count; i++) {
      var k = pk[i]; if (res.some(function (r) { return Math.abs(r.bin - k) < 3; })) continue;
      var a = Math.log(mag[k - 1] + 1e-12), b = Math.log(mag[k] + 1e-12), c = Math.log(mag[k + 1] + 1e-12), d = 0.5 * (a - c) / (a - 2 * b + c);
      if (!isFinite(d)) d = 0;
      var amp = 2 * Math.exp(b - 0.25 * (a - c) * d) / ws;
      var phc = Math.atan2(im[k], re[k]); // centred Hann is zero-phase: no slope correction needed
      res.push({ bin: k, freq: (k + d) * sr / N, amp: amp, phase: phc + Math.PI / 2 }); // sin form
    }
    res.sort(function (x, y) { return x.freq - y.freq; });
    return res;
  }

  return { getFFT: getFFT, hann: hann, analyze: analyze, separate: separate, fingerprint: fingerprint, partials: partials, BANDS: BANDS, FP_SR: FP_SR };
})();

if (typeof self !== 'undefined' && typeof window === 'undefined' && typeof module === 'undefined') {
  self.onmessage = function (e) {
    var d = e.data, id = d.id;
    function prog(p) { self.postMessage({ id: id, progress: p }); }
    try {
      if (d.type === 'analyze') {
        var a = DSP.analyze(d.mono, d.sr, prog);
        var fp = DSP.fingerprint(d.mono, d.sr);
        self.postMessage({ id: id, result: { analysis: a, fp: fp } }, [a.spec.buffer, a.bands.buffer, a.ssm.buffer, a.onset.buffer, fp.hashes.buffer, fp.times.buffer, fp.peakT.buffer, fp.peakF.buffer]);
      } else if (d.type === 'separate') {
        var s = DSP.separate(d.L, d.R, d.sr, prog), tr = [];
        ['vocals', 'drums', 'bass', 'other'].forEach(function (n) { tr.push(s[n][0].buffer, s[n][1].buffer); });
        self.postMessage({ id: id, result: s }, tr);
      } else if (d.type === 'fingerprint') {
        var f = DSP.fingerprint(d.mono, d.sr);
        self.postMessage({ id: id, result: f }, [f.hashes.buffer, f.times.buffer, f.peakT.buffer, f.peakF.buffer]);
      }
    } catch (err) { self.postMessage({ id: id, error: String(err && err.message || err) }); }
  };
}
if (typeof module !== 'undefined') module.exports = DSP;
