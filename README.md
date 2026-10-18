# Remaster Lab

**Open any song, see how it's built, pull it apart into stems with AI, and remaster it your way, section by section. Then keep your own version.**

Remaster Lab is a free, open-source audio workstation that runs in your browser. It is made for people who listen closely: you can make the bass in the drop crunchier, shorten the reverb on the vocal in the chorus, or brighten the hats in the intro, and hear the result against the original at the press of a key.

**▶ Try it in your browser: [aviralgupta2211.github.io/remaster-lab](https://aviralgupta2211.github.io/remaster-lab/)**. Nothing to install, and your music never leaves your computer.

![Remaster Lab: the DJ-style deck with the scrolling 3-band waveform, and touch pads for each stem](docs/screenshot.jpg)

## What it does

| | |
| --- | --- |
| **See the song** | Scrolling 3-band waveform with beat grid and bar counter (DJ-software style), full-song overview, spectrogram, six frequency bands, tempo, key and detected sections (intro, verse, chorus…) |
| **Build-ups and drops** | Finds the build-ups (the sound getting brighter, noisier and busier up top, usually with the bass filtered out), breakdowns (bass gone, level down) and drops (sub-bass and level slamming back together, landed on the beat) in any song. They show on the overview and the Structure view, and the Video view plays them out: the picture closes in and heats up during a build, counts down the last four beats, goes black for the half-beat before the drop, then hits with a flash and a shockwave. The Stage lights its own blackout, blinders, strobe and pyro on the real drop |
| **Read the maths** | An *equation view* writes the moment under the playhead as a sum of sine waves, e.g. `0.025·sin(2π·175.1t + 5.30) + …`, and plots it over the real waveform |
| **Recognise songs** | Shazam-style fingerprinting (constellation peaks → hashes). Every song you open goes into a local library; reopen it, even renamed, and it is recognised with its saved versions. Identify short clips too |
| **Split into stems** | Vocals, drums, bass and other, with **HTDemucs** (Meta AI's open-source model) running **on your computer**, on a server you run, or from stem files you already have. A fast built-in DSP split is used until then |
| **Remaster per section** | Regions on a timeline (seeded from the detected sections). Each stem in each region has gain, 3-band EQ, crunch (saturation), punch (compression), stereo width, reverb and decay |
| **Analysis as controls** | Flip the analysis panel from *Insight* to *Control*: draw a box on the spectrogram to boost or cut that time × frequency area, drag six band faders to rebalance a region, copy settings to every section that sounds alike, or click a term of the equation to boost or tame that exact note |
| **Space (8D motion)** | Move each instrument around your head with binaural (HRTF) audio: orbit, swing or place, locked to the beat or free. *Follow the music* lets each stem's own waveform drive its motion (faster when loud, jumps on hits, closer at peaks); *Focus* pulls the loudest instrument to the front; *Ear-to-ear* adds the strong left–right push of classic 8D tracks. Live top-down map with draggable dots and a timeline of every path |
| **Video** | Switch the header from *Studio* to *Video* and the song plays as a generated music video built from its own analysis: *Layers* (one glowing waveform per stem), *Orbit* (each instrument circling you where the 8D Space panel puts it, drums firing shockwaves), *Equation* (the live sine sum drawn as rotating epicycles) and *Tunnel* (the spectrum as rings rushing past) and *Stage*, an arena light show the app designs from the song like a touring lighting designer: a band-shell arch of lamps that stays dark until the music lifts, a round screen ringed with lights, beam lights holding still shapes, light pods that ride to the soloist, thick-beam lasers that start as a static web (a beam per guitar note) and escalate, a mirror ball that opens at the climax, pyro on the biggest hit, a crowd, and concert-film camera cuts. Its timings (how fast lights snap on and fall, when the arch is revealed, how long shots last) were measured frame by frame from the *Pulse* concert film. A lighting-desk readout shows the cue list and the arc of the show. Strobe is limited to 3 soft flashes a second unless you choose otherwise ([design notes](docs/stage-lighting.md)). *Auto* cuts between scenes on section changes and gives the biggest section the light show; captions call out what changes ("Bass comes in", "New section B, heard before"). Full screen, or record it to a `.webm` with the remastered audio |
| **Touch pads** | One 2D pad per stem: a single finger move changes several settings together ("close & dry" → "big & airy", "lean" → "heavy"). Multi-touch, keyboard accessible, with a readout of exactly what changed. Switch to sliders any time |
| **Synths** | Switch the header to *Synths* and play six classic synthesizer architectures from 1964 to 1983, each with its own panel, sound engine and presets: a **modular cabinet** you patch with cords (3 VCOs, noise, LFO, mixer, ladder filter, VCA, two envelopes), a **three-oscillator mono** with an overdriven mixer and ladder filter, a **five-voice poly** with poly-mod, an **acid bass line** with a 16-step sequencer (accent, slide), a **six-voice chorus poly** on faders, and **six-operator FM** with 8 algorithms drawn live. Every synth has a **16-step pattern sequencer** under its panel: pick a starter riff or click out your own (chords on the poly and FM synths), with accent, slide or tie, octave-up, tempo and root, and tweak the sound while it loops. Play from the computer keys, the on-screen keys or a USB MIDI controller (8 knobs on CC 70–77 map to each synth's main controls; MIDI learn remaps). Panels are original designs; the signal flow and controls follow each era's instruments |
| **Compare and keep** | A/B against the original instantly, loop a region, save named versions (recipes), render a lossless WAV faster than real time, keep renders in "My remasters" |

Everything runs locally. In browser mode your audio never leaves your machine.

## The website

The live site is built and deployed by [`.github/workflows/pages.yml`](.github/workflows/pages.yml) on every push to `main`:

1. It builds the browser AI model from the official Demucs weights. This runs only when `tools/build_model.py` changes, about 10 minutes; otherwise it comes from cache.
2. It bundles ONNX Runtime Web next to the model, so everything loads from the same origin.
3. It builds the page with `python3 web/build.py --site` and publishes `web/dist` to GitHub Pages.

The site uses [coi-serviceworker](https://github.com/gzuidhof/coi-serviceworker) to turn on cross-origin isolation, which GitHub Pages can't do with headers. That lets the in-browser AI split use every CPU core: on a 2-core test machine a 36 s song split in 95 s instead of 150 s, and machines with more cores gain more.

To host your own fork: in **Settings → Pages → Build and deployment**, set **Source** to **GitHub Actions**, push to `main`, and the site appears at `https://<you>.github.io/remaster-lab/`. Change `SITE_URL` in `web/build.py` for the social preview card.

## Run it locally

You need Python 3 (to build and serve the page) and a recent Chrome, Edge or Firefox.

```bash
git clone https://github.com/AviralGupta2211/remaster-lab.git
cd remaster-lab
python3 web/build.py                 # builds web/dist/index.html
cd web/dist && python3 -m http.server 8080
```

Open <http://localhost:8080>. A synthesized demo track loads straight away; press **Open song** or drop an MP3, WAV, FLAC or M4A onto the page.

> Opening `index.html` directly from disk (`file://`) mostly works, but the AI split needs the page served over http(s).

### Turn on "Split with AI"

The in-browser AI split needs the model files next to the page. Build them once from the official Demucs weights (about 5 minutes, needs PyTorch):

```bash
pip install torch demucs onnx onnxscript onnxruntime numpy
python3 tools/build_model.py --verify    # writes web/dist/model/ (≈112 MB), checks it against PyTorch
```

The first split in a browser downloads the model; after that it is cached by the browser.

## Three ways to get AI stems

| Route | How | Speed (measured) | Privacy |
| --- | --- | --- | --- |
| **In the browser** | **Split with AI** → **Start AI split** | On the website, all CPU cores are used (about 2.6× the song length on a 2-core VM, faster on laptops with more cores); WebGPU is used when the browser offers it. One thread on other hosts | Audio stays on your computer |
| **Your own server** | Run [`server/`](server/README.md), then enter its address under *Use a separation server* | 30 s of audio in 27 s on the same 2-core CPU; a GPU is far faster | Audio goes only to the server you run |
| **Stem files** | **Load stem files** and pick four files named with *vocals*, *drums*, *bass*, *other* (Demucs output works as is) | Instant | Local |

Whichever route you use, "other" is rebuilt as *original − vocals − drums − bass*. The four stems always add back up to the exact original, so an untouched pad sounds exactly like the source.

## How it works

- **Analysis** (`web/src/dsp.js`, in a Web Worker): one STFT (2048-sample window, 512 hop) drives the spectrogram, band energies, spectral-flux onset curve, tempo (autocorrelation with a tempo prior), key (chroma correlated with Krumhansl profiles) and sections (self-similarity matrix with checkerboard novelty).
- **Build-ups and drops** (`buildDrop` in `web/src/dsp.js`): from the same STFT, about 10 times a second: loudness, sub-bass (20–100 Hz), high band (2–16 kHz), spectral centroid, spectral flatness and high-band onset rate. *Tension* rises when centroid, flatness, high band and onset rate all slope upward over 4 s, weighted by how straight that ramp is (a steady riser, not a single jump) and by how much sub-bass has been filtered out. A *drop* is a 1 s jump of 9 dB or more in sub-bass together with 3 dB or more overall, scored by the size of the jump, the tension before it, whether the bass had been cut and whether it comes back fully, and snapped to the nearest beat. A *breakdown* is 4 s or more with the sub-bass 9 dB under its usual level and the mix 4 dB quieter. On a dance track it found the breakdown at 0:57, the riser into the lift at 1:12, the build from 1:21 and the drop at 1:29.5, matching what the spectrogram shows.
- **Fingerprinting**: audio resampled to 11 025 Hz, local spectral peaks (about 25 per second) paired into 24-bit hashes `f1 | f2 | Δt`; a match is the time offset most hashes agree on.
- **DSP stems**: harmonic/percussive separation by median filtering, a low band for bass and a centre-channel vocal band. The masks sum to one, so the stems sum to the original.
- **AI stems** (`web/src/aisplit.js`, `web/src/ai-worker.js`): HTDemucs exported to ONNX without its STFT/iSTFT, which are reimplemented in JavaScript and match Demucs to ~136 dB. Weights ship as float16 (half the download, ~45–80 dB from full precision). It runs in 7.8 s chunks with 25% triangular overlap-add, exactly like `demucs.apply_model`, via [ONNX Runtime Web](https://onnxruntime.ai/).
- **Analysis controls**: spectrogram boxes and tuned notes become *zones*, peaking filters on the mix or on one stem whose gain is automated on for the zone's time span (box centre = geometric mean of its edges, Q from its width; notes use Q 18). The band faders drive a 6-band EQ on the mix bus (shelves at 60 Hz and 8 kHz, peaks at 150 Hz, 350 Hz, 1 kHz, 3.5 kHz) that changes per region. In offline renders, a −9 dB box measured −8.6 dB inside its area and 0.0 dB after it ends; a −12 dB note at 440 Hz measured −11.5 dB with neighbours within 0.1 dB.
- **Space / 8D**: per stem, a loudness envelope and onset curve (50 per second) drive a trajectory: angular speed `× (1 + follow · (2.2·env − 0.7))`, onset kicks, distance shrinking at peaks, and an optional pull of the dominant stem toward the front. Positions feed a Web Audio `PannerNode` (HRTF) as automation curves, followed by an equal-power stereo pan of `sin(azimuth) · ear-to-ear` and a reverb send. A dry/wet *Depth* crossfade keeps 0% bit-for-bit identical to the stem mix. Measured on renders: an 8 s orbit gives an 8.0 s left–right cycle, ±3.3 dB from HRTF alone and ±10 dB with Ear-to-ear at 70%; with Follow music on, drums move about 2× faster in loud passages than quiet ones.
- **Video** (`web/src/app.js`, *video* section): a 1280×720 canvas redrawn every frame from data the app already has: per-stem sample windows, the 50 Hz loudness/onset envelopes used by Space, the spectrogram, beat grid, sections and `partials()`. Stem entries and exits use hysteresis (on above 0.3, off below 0.12) so captions don't flicker; scene changes crossfade over 0.9 s. Each scene costs about 1–2 ms per frame. The *Stage* scene plans the whole song first: a cue per section from its loudness and lead stem, a climax (the loudest section after 40% of the song), and a budget that spends each big effect once, with timings measured from the *Pulse* film (the `PULSE` constants). It then renders a 3D rig through a moving camera, with soft beams in a half-resolution light buffer, a drifting haze mask and bloom. See [docs/stage-lighting.md](docs/stage-lighting.md). Recording uses `canvas.captureStream(30)` plus the monitor output through a `MediaStreamAudioDestinationNode` into `MediaRecorder` (VP9 + Opus WebM).
- **Synths** (`web/src/synths.js`): rendered into a shadow root so its styles and the app's stay apart, mounted the first time the view opens; leaving the view releases notes, stops the sequencer and suspends its audio context. Each instrument is a definition (parameters, panel sections, presets, MIDI map) plus a `build()` that makes its Web Audio graph. The ladder filter is two cascaded resonant low-pass biquads; envelopes are AudioParam automation (attack ramp, exponential decay to sustain, exponential release). Pulse width modulation compares a sawtooth with an offset through a steep `tanh` shaper. Poly-mod and the modular's patching route audio-rate signals into `detune` and gain params. FM operators modulate each other's `frequency` with depth `index × modulator frequency`; operator feedback uses a precomputed wave with partials `2·Jₙ(nβ)/(nβ)` (the spectrum of feedback FM), since Web Audio can't loop a single sample. The pattern sequencer schedules sixteenth notes 120 ms ahead on the audio clock (every engine's `noteOn`/`noteOff` takes a start time); a slide or tie starts the next notes before releasing the old ones, so mono synths glide instead of retriggering and held chords don't restart. Riffs you write are kept per synth in the browser. Tests check every preset, MIDI map, patch cord and FM algorithm and starter riff against the definitions.
- **Remaster engine** (`web/src/app.js`): one Web Audio graph for both live playback and offline rendering, so what you hear is what you export. Per stem: width (mid/side), 3-band EQ, parallel tanh saturation, compressor, fader, and sends to three shared reverbs (0.6 s, 1.8 s, 4 s) that the decay control crossfades between. Region changes are scheduled as 60 ms parameter ramps.

More detail in [docs/architecture.md](docs/architecture.md).

## Project layout

```
web/src/        page.html, app.js (UI + audio engine), dsp.js (analysis, DSP stems, fingerprints),
                aisplit.js + ai-worker.js (in-browser HTDemucs), synths.js (the Synths view)
web/build.py    inlines everything into web/dist/index.html
tools/          build_model.py (ONNX export + packaging of the browser model)
server/         FastAPI + Demucs separation server, Dockerfile
tests/run.js    dependency-free tests (node tests/run.js)
docs/           architecture notes, screenshot
```

## Roadmap

- 6-stem separation (adds guitar and piano), then more instruments as models allow
- Presets ("warm vinyl", "club bass", "vocal up front") and *match a reference track*
- Space: per-region motion, elevation from brightness, and sharing motion presets
- Loudness targets (LUFS) and a true-peak limiter
- Multi-threaded in-browser AI on hosts that send cross-origin isolation headers
- A small player for listening to your saved remasters
- Video v2: visuals that follow what the song is about (lyrics, mood and themes), not only how it sounds; user-made scene presets

Ideas and pull requests are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md).

## Privacy and security

- No accounts, no analytics, no API keys. Settings, fingerprints, versions and renders live in your browser's storage.
- The server reads its optional access token from the `REMASTER_LAB_TOKEN` environment variable; nothing secret belongs in this repository. CI scans every push for leaked secrets.
- Found a vulnerability? See [SECURITY.md](SECURITY.md).

## A note on music rights

Remaster Lab is for personal listening and learning. Use audio you have the right to use, and don't distribute remastered copies of other people's recordings.

## Credits

- [Demucs](https://github.com/facebookresearch/demucs) by Alexandre Défossez et al., Meta AI (MIT licence). The model weights are Meta's.
- [ONNX Runtime Web](https://github.com/microsoft/onnxruntime) by Microsoft (MIT licence).
- Fingerprinting follows Avery Wang, *An Industrial-Strength Audio Search Algorithm* (ISMIR 2003).
- Fonts: Chakra Petch, IBM Plex Sans and IBM Plex Mono via Google Fonts (SIL Open Font License).

## License

[MIT](LICENSE)
