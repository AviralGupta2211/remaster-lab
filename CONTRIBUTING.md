# Contributing to Remaster Lab

Thanks for wanting to help. Remaster Lab is a small project for people who care about how music sounds, and good contributions come in all forms: bug reports, listening tests, better pad mappings, DSP improvements, docs and design.

## Ways to help

- **Report a bug**: open an issue with your browser and OS, what you did, what you expected and what happened. A short audio clip you have the rights to share helps a lot.
- **Suggest a feature**: open an issue describing the sound or workflow you want, not only the control. "I want to tame harsh cymbals in the chorus" is more useful than "add a de-esser".
- **Tune the touch pads**: the mappings live in `PADMAP` in `web/src/app.js`. If a pad doesn't feel musical, propose a new mapping and describe how it sounds on a couple of genres.
- **Improve the DSP or the AI path**: analysis and DSP stems are in `web/src/dsp.js`; the in-browser HTDemucs pipeline is in `web/src/aisplit.js` and `web/src/ai-worker.js`.

## Development setup

```bash
git clone https://github.com/AviralGupta2211/remaster-lab.git
cd remaster-lab
node tests/run.js                    # dependency-free tests
python3 web/build.py                 # builds web/dist/index.html
cd web/dist && python3 -m http.server 8080
```

Optional:

- `python3 tools/build_model.py --verify` builds the in-browser AI model (needs PyTorch and Demucs).
- `server/` holds the separation server; see `server/README.md`.

There is no bundler or framework on purpose: the page is plain HTML, CSS and JavaScript so anyone can read it and the build is one Python script.

## Pull requests

1. Fork, then branch from `main` (`fix/…`, `feat/…`, `docs/…`).
2. Keep each pull request to one change, and explain what it sounds like if it affects audio.
3. Run `node tests/run.js` and make sure it passes. Add a test when you change `dsp.js` or `aisplit.js`.
4. Check the page in both light and dark mode and at phone width (about 400 px).
5. Never commit audio files, model files, `.env` files, tokens or keys. CI runs a secret scan on every push and will fail the build.

## Code style

- Plain JavaScript (ES5-style functions are fine; no build step).
- Colours come from the CSS tokens at the top of `web/src/page.html`; don't hard-code colours that only work in one theme.
- Prefer clear names over comments; comment the maths.

## Licence

By contributing you agree that your contribution is released under the [MIT licence](LICENSE).

Please follow the [Code of Conduct](CODE_OF_CONDUCT.md).
