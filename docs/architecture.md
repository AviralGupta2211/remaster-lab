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

## Analysis views as controls

The analysis panel has an *Insight* / *Control* toggle. In Control mode:

- **Spectrogram → zones.** Dragging a box creates `{kind: "box", start, end, fLo, fHi, gain, target}`. A peaking filter at `f = √(fLo·fHi)`, `Q = f / (fHi − fLo)` (clamped 0.3–12) sits on the target (mix: 12 slots, each stem: 6). Its gain is 0 dB outside the zone and ramps to the zone gain over 20 ms at the zone edges.
- **Equation → notes.** Clicking a term creates `{kind: "note", f, …}` with Q 18, for the selected region or the whole song, on the mix or on the stem the equation is showing.
- **Bands → per-region 6-band EQ** on the mix bus, scheduled at region edges like every other setting.
- **Structure → sections.** Each region takes the label of the detected section under its midpoint; "copy to similar" copies stem settings and band balance to every region with the same label.

Zones and band balances are saved in the recipe JSON (`zones`, `regions[].bands`).

## Space (8D motion)

Each stem's path through the remaster engine splits after its fader into a **dry** path and a **3D** path: `PannerNode (HRTF, mono in) → StereoPanner → wet gain → mix`, with a send from the wet gain to the 1.8 s reverb (*Room*). *Depth* crossfades dry and wet; a stem set to *Still* stays fully dry, so with motion off the output is unchanged.

Trajectories are computed ahead of time at 50 points per second and scheduled with `setValueCurveAtTime` on `positionX/Y/Z` and on the stereo pan, so live playback and offline renders match:

```
speed(t)   = max(0.15, 1 + follow · (2.2 · env(t) − 0.7))
phase(t)  += ω · speed(t) / 50 + follow · 0.5 · onset(t)            (onset > 0.35)
orbit:     az = offset + dir · phase
swing:     az = offset + dir · width · π/2 · sin(phase)
place:     az = offset + follow · 0.5 · sin(phase / 2) · env
focus:     az → lerp(az, front, focus · dominance(t))
elevation  = height + follow · 18° · (env − 0.3);  distance = 1.5 − 0.6 · follow · env
stereo pan = sin(az) · cos(el) · ear-to-ear · 0.85
```

`env` is the stem's RMS envelope smoothed over ~0.3 s and normalised to its 95th percentile; `onset` is the positive difference between a fast and a slow envelope. *Beat lock* sets the period to N bars from the detected tempo.

## Video

The *Video* view hides the studio panels and draws one canvas (1280×720, scaled to fit, or full screen) every animation frame. It adds no new analysis; every visual is driven by data the app already computed:

| Scene | Driven by |
| --- | --- |
| Layers | a window of each stem's samples around the playhead; line width, glow and opacity follow that stem's loudness envelope |
| Orbit | the Space (8D) trajectory of each stem (`spaceAzimuth`), so what you see matches where you hear it; the bass swells the core, drum onsets launch shockwaves |
| Equation | `partials()` at the playhead drawn as epicycles (one rotating circle per sine term), tracing the waveform, with the formula underneath |
| Tunnel | the spectrogram column at the playhead as rings rushing toward the viewer, coloured low to high |
| Stage | a cue list built from the song (below), then the beat grid, the mix loudness and onsets, and each stem's loudness |


### Stage: the light show

The Stage scene has its own design document: [stage-lighting.md](stage-lighting.md). In short, `stageShow()` plans the song (cues, climax, reveal, effect budget, and a shot list from `stagePlanShots()`), `stageShot()` looks up the camera, and `sceneStage()` renders the 3D rig with a light buffer, haze mask and bloom.

*Auto* picks a scene per section (sections with the same label share a scene) and crossfades over 0.9 s. Beat pulses come from the beat grid. Captions are generated from events: a stem comes in or drops out (loudness envelope with hysteresis, on above 0.3, off below 0.12, ignored right after a seek), and a new section starts (noting when its label was heard before).

**Recording**: `canvas.captureStream(30)` and the monitor bus routed into a `MediaStreamAudioDestinationNode` are combined into one `MediaRecorder` stream (VP9 + Opus WebM when supported). It stops at the end of the song and is saved as `<title>-video.webm`.

**Ideas for v2**: lighting cues you can edit and save with a version, DMX/Art-Net output to drive real lights from the cue list, visuals that follow what the song means as well as how it sounds (lyrics, mood, themes), scene presets users can save and share, and per-region scene choices on the timeline.
