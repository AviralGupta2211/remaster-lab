// ===== AI stem separation: HTDemucs (Meta, MIT) running through onnxruntime-web =====
// The ONNX graph holds the neural network only. The STFT, the iSTFT and the chunked
// overlap-add are done here, mirroring demucs.apply_model + HTDemucs._spec/_ispec.
var AISplit = (function () {
  var SR = 44100, SEG = 343980, NFFT = 4096, HOP = 1024, NB = 2048, T = 336, SOURCES = ['drums', 'bass', 'other', 'vocals'];
  var fftN = null, win = null;
  function fft() {
    if (fftN) return fftN;
    var N = NFFT, lev = 12, rev = new Uint32Array(N), cs = new Float64Array(N / 2), sn = new Float64Array(N / 2), i;
    for (i = 0; i < N; i++) { var r = 0, x = i; for (var b = 0; b < lev; b++) { r = (r << 1) | (x & 1); x >>= 1; } rev[i] = r; }
    for (i = 0; i < N / 2; i++) { cs[i] = Math.cos(2 * Math.PI * i / N); sn[i] = Math.sin(2 * Math.PI * i / N); }
    function tr(re, im, inv) {
      var i, j, t;
      for (i = 0; i < N; i++) { j = rev[i]; if (j > i) { t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
      for (var size = 2; size <= N; size <<= 1) {
        var half = size >> 1, step = N / size;
        for (i = 0; i < N; i += size) for (j = 0; j < half; j++) {
          var k = j * step, a = i + j, b2 = a + half, wr = cs[k], wi = inv ? sn[k] : -sn[k];
          var xr = re[b2] * wr - im[b2] * wi, xi = re[b2] * wi + im[b2] * wr;
          re[b2] = re[a] - xr; im[b2] = im[a] - xi; re[a] += xr; im[a] += xi;
        }
      }
    }
    win = new Float64Array(N); for (i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N); // periodic Hann
    return (fftN = tr);
  }
  function reflectIndex(i, n) { // numpy/torch 'reflect' (edge not repeated)
    var p = 2 * (n - 1); i = ((i % p) + p) % p; return i < n ? i : p - i;
  }
  // mag input [1, 4, 2048, 336]: channels L.re, L.im, R.re, R.im
  function spec(L, R) {
    var tr = fft(), pad = HOP / 2 * 3, le = Math.ceil(SEG / HOP), P = SEG + pad + pad + le * HOP - SEG; // padded length
    var mag = new Float32Array(4 * NB * T), re = new Float64Array(NFFT), im = new Float64Array(NFFT), norm = 1 / Math.sqrt(NFFT);
    // padded signal index q in [0, P) maps to SEG index via reflect of (q - pad); stft adds centre reflect pad NFFT/2 on P
    for (var f = 0; f < T; f++) {
      var frame = f + 2, start = frame * HOP - NFFT / 2;
      for (var n = 0; n < NFFT; n++) {
        var q = reflectIndex(start + n, P), s = reflectIndex(q - pad, SEG);
        re[n] = L[s] * win[n]; im[n] = R[s] * win[n];
      }
      tr(re, im, false);
      for (var k = 0; k < NB; k++) {
        var nk = (NFFT - k) % NFFT;
        var lr = 0.5 * (re[k] + re[nk]), li = 0.5 * (im[k] - im[nk]), rr = 0.5 * (im[k] + im[nk]), ri = -0.5 * (re[k] - re[nk]);
        mag[(0 * NB + k) * T + f] = lr * norm; mag[(1 * NB + k) * T + f] = li * norm;
        mag[(2 * NB + k) * T + f] = rr * norm; mag[(3 * NB + k) * T + f] = ri * norm;
      }
    }
    return mag;
  }
  // spec output [1, 4 sources, 4, 2048, 336] -> time signals added into outL/outR (length SEG)
  function ispec(sp, src, outL, outR) {
    var tr = fft(), frames = T + 4, pad = HOP / 2 * 3, total = NFFT + (frames - 1) * HOP;
    var accL = new Float64Array(total), accR = new Float64Array(total), env = new Float64Array(total);
    var re = new Float64Array(NFFT), im = new Float64Array(NFFT), sq = Math.sqrt(NFFT), base = src * 4 * NB * T, k, n;
    for (var f = 0; f < frames; f++) {
      var t = f - 2; re.fill(0); im.fill(0);
      if (t >= 0 && t < T) {
        for (k = 0; k < NB; k++) {
          var Lr = sp[base + (0 * NB + k) * T + t], Li = sp[base + (1 * NB + k) * T + t], Rr = sp[base + (2 * NB + k) * T + t], Ri = sp[base + (3 * NB + k) * T + t];
          // Y = ZL + i ZR, Hermitian-completed
          if (k === 0) { re[0] = Lr; im[0] = Rr; continue; } // irfft ignores the DC imaginary part
          re[k] = Lr - Ri; im[k] = Li + Rr;
          re[NFFT - k] = Lr + Ri; im[NFFT - k] = -Li + Rr;
        }
        tr(re, im, true);
      }
      var o = f * HOP;
      for (n = 0; n < NFFT; n++) { var w = win[n]; accL[o + n] += re[n] / NFFT * sq * w; accR[o + n] += im[n] / NFFT * sq * w; env[o + n] += w * w; }
    }
    var off = NFFT / 2 + pad;
    for (n = 0; n < SEG; n++) { var e = env[off + n]; if (e > 1e-11) { outL[n] += accL[off + n] / e; outR[n] += accR[off + n] / e; } }
  }
  function weights() {
    var w = new Float32Array(SEG), h = SEG >> 1, i;
    for (i = 0; i < h; i++) w[i] = i + 1;
    for (i = h; i < SEG; i++) w[i] = SEG - i;
    var mx = 0; for (i = 0; i < SEG; i++) if (w[i] > mx) mx = w[i];
    for (i = 0; i < SEG; i++) w[i] /= mx; return w;
  }
  // session: an ort.InferenceSession; L, R: Float32Array at 44.1 kHz
  async function separate(ort, session, L, R, onProgress, isCancelled, keep) {
    keep = keep || SOURCES;
    var len = L.length, i, s;
    var mean = 0; for (i = 0; i < len; i++) mean += 0.5 * (L[i] + R[i]); mean /= len;
    var vr = 0; for (i = 0; i < len; i++) { var d = 0.5 * (L[i] + R[i]) - mean; vr += d * d; } var std = Math.sqrt(vr / (len - 1)) || 1;
    var out = SOURCES.map(function (n) { return keep.indexOf(n) >= 0 ? [new Float32Array(len), new Float32Array(len)] : null; }), sumW = new Float32Array(len), W = weights();
    var stride = Math.floor(0.75 * SEG), offsets = []; for (var o = 0; o < len; o += stride) offsets.push(o);
    var cL = new Float32Array(SEG), cR = new Float32Array(SEG), mix = new Float32Array(2 * SEG), t0 = Date.now();
    for (var ci = 0; ci < offsets.length; ci++) {
      if (isCancelled && isCancelled()) throw new Error('cancelled');
      var off = offsets[ci], clen = Math.min(SEG, len - off), delta = SEG - clen, st = off - Math.floor(delta / 2);
      for (i = 0; i < SEG; i++) { var p = st + i, a = p >= 0 && p < len; cL[i] = a ? (L[p] - mean) / std : 0; cR[i] = a ? (R[p] - mean) / std : 0; }
      mix.set(cL, 0); mix.set(cR, SEG);
      var mag = spec(cL, cR);
      var res = await session.run({ mix: new ort.Tensor('float32', mix, [1, 2, SEG]), mag: new ort.Tensor('float32', mag, [1, 4, NB, T]) });
      var sp = res.spec.data, wave = res.wave.data;
      var trim = Math.floor(delta / 2);
      for (s = 0; s < 4; s++) {
        if (!out[s]) continue;
        var yL = new Float32Array(SEG), yR = new Float32Array(SEG);
        ispec(sp, s, yL, yR);
        var wb = s * 2 * SEG, oL = out[s][0], oR = out[s][1];
        for (i = 0; i < clen; i++) {
          var j = i + trim, w = W[i];
          oL[off + i] += w * (yL[j] + wave[wb + j]); oR[off + i] += w * (yR[j] + wave[wb + SEG + j]);
        }
      }
      for (i = 0; i < clen; i++) sumW[off + i] += W[i];
      if (res.spec.dispose) { res.spec.dispose(); res.wave.dispose(); }
      if (onProgress) { var el = (Date.now() - t0) / 1000; onProgress((ci + 1) / offsets.length, el / (ci + 1) * (offsets.length - ci - 1)); }
    }
    var result = {};
    SOURCES.forEach(function (name, si) { var o2 = out[si]; if (!o2) return; for (i = 0; i < len; i++) { var k = std / sumW[i]; o2[0][i] = o2[0][i] * k + mean; o2[1][i] = o2[1][i] * k + mean; } result[name] = o2; });
    return result;
  }
  function f16to32(u16) { // IEEE half -> float
    var out = new Float32Array(u16.length), tbl = new Float32Array(65536);
    for (var h = 0; h < 65536; h++) {
      var s = (h & 0x8000) ? -1 : 1, e = (h >> 10) & 31, m = h & 1023;
      tbl[h] = e === 0 ? s * Math.pow(2, -14) * (m / 1024) : e === 31 ? (m ? NaN : s * Infinity) : s * Math.pow(2, e - 15) * (1 + m / 1024);
    }
    for (var i = 0; i < u16.length; i++) out[i] = tbl[u16[i]];
    return out;
  }
  return { SR: SR, SEG: SEG, SOURCES: SOURCES, separate: separate, spec: spec, ispec: ispec, f16to32: f16to32 };
})();
if (typeof module !== 'undefined') module.exports = AISplit;
