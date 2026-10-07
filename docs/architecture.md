# Architecture

Remaster Lab is a single page with no framework. Heavy work runs in Web Workers; audio runs on the Web Audio API.

```
song file ─► decode (Web Audio) ─┬─► analysis worker (dsp.js) ─► views, tempo, key, sections, fingerprint
                                 ├─► DSP stem split (dsp.js, worker)            ┐
                                 ├─► AI stem split (aisplit.js, ai-worker.js)   ├─► stems ─► remaster engine ─► speakers / WAV
                                 ├─► server split (server/app.py)               │        (regions × stems × settings)
                                 └─► stem files                                 ┘
recipes (JSON) and fingerprints are stored in the browser (IndexedDB) and found again by fingerprint
```

## Analysis

One STFT (N = 2048, hop 512, Hann) over the mono mix:

```
X(m, k) = Σ_n x[n + mH] · w[n] · e^(−i2πkn/N)
```

- **Spectrogram**: log magnitude on a log-frequency axis (30 Hz–16 kHz), 80 dB range.
- **Bands**: energy in sub (20–60 Hz), bass (60–250), low-mid (250–500), mid (500–2k), presence (2k–6k), air (6k–20k).
- **Tempo**: half-wave-rectified spectral flux minus a 1 s moving average, autocorrelated over 60–200 BPM with a log-Gaussian prior centred on 120 BPM; beat phase by comb scoring.
- **Key**: 12-bin chroma (55 Hz–5 kHz) averaged over the song, correlated with the 24 rotated Krumhansl–Schmuckler profiles.
- **Sections**: per 0.5 s block, 12 chroma + 6 band features are z-scored and normalised; a cosine self-similarity matrix is scanned with a Gaussian-tapered checkerboard kernel; novelty peaks at least 8 s apart become boundaries; segments with cosine similarity above 0.8 share a letter.
- **Equation view**: 4096-sample Hann window centred on the playhead (zero-phase), spectral peaks refined by parabolic interpolation, giving `x(t) ≈ Σ A_j sin(2π f_j t + φ_j)`.

## Fingerprinting

Mono, resampled to 11 025 Hz, STFT 1024/256. A bin is a peak if it is the maximum within ±6 frames and ±12 bins; the 25 loudest per second are kept. Each anchor pairs with up to 6 later peaks within 63 frames and 120 bins: `hash = f1 << 15 | f2 << 6 | Δt`. Lookup builds a histogram of `t_song − t_clip` per song; a match needs at least 12 aligned votes and twice the runner-up.

## Stem separation

**DSP (instant, approximate).** STFT 2048/512 of L + iR in one complex FFT. Harmonic and percussive estimates by 17-point medians across time and frequency; soft masks `H²/(H² + P²)`. Bass = harmonic × low band (< 110–220 Hz crossover); vocals = harmonic × 120 Hz–10 kHz band × centre-ness⁴ (`|L + R| / (|L| + |R|)`); drums = percussive; other = residual. The masks sum to one.

**AI (HTDemucs).** The ONNX graph contains only the network. In JavaScript:

1. Standardise the mix by the mean and std of its mono sum.
2. Cut 7.8 s chunks (343 980 samples) at a stride of 75%; the last chunk is padded with context, as in `demucs.apply_model`.
3. Per chunk: reflect-pad, STFT (4096 / 1024, periodic Hann, `normalized=True`), keep 2048 bins × 336 frames, and pass real and imaginary parts as channels (the model uses complex-as-channels).
4. Run the network; iSTFT its spectrogram output and add its time-domain output.
5. Triangular-weighted overlap-add, then undo the standardisation.

The JavaScript STFT/iSTFT match `HTDemucs._spec` / `_ispec` to ~136 dB SNR. Weights ship as float16 and are expanded to float32 in the worker. The end-to-end output matches PyTorch Demucs at 36–70 dB SNR per stem.

## Remaster engine

Per stem: `source → width (mid/side gains) → low shelf 120 Hz → peak 1 kHz → high shelf 6 kHz → [clean + tanh saturation] → compressor → fader → master`, plus post-fader sends to three shared convolution reverbs (0.6 s, 1.8 s, 4 s) crossfaded by *decay*. Master: 3-band EQ, limiter, output gain. Every setting is an `AudioParam`, so region changes are 60 ms ramps scheduled ahead of time. The same graph is built on an `OfflineAudioContext` for export.

## Touch pads

Each pad maps its two axes to several settings at once (`PADMAP` in `app.js`). The centre is neutral; each axis end holds a delta per setting, interpolated linearly: `value = default + |x| · delta(direction)`. Pads and sliders edit the same state.
