"""Build web/dist/index.html: one self-contained page (HTML, CSS and all JavaScript inlined).

    python3 web/build.py             # full page with <!doctype html>, for any static host
    python3 web/build.py --site      # the public website (GitHub Pages): adds page metadata, an icon and
                                     # cross-origin isolation so the AI split can use every CPU core
    python3 web/build.py --fragment  # body-only fragment, for hosts that add their own document skeleton

For --site, put the model in web/dist/model/ first (tools/build_model.py) and the ONNX Runtime Web
files in web/dist/model/ort/ (the Pages workflow does both); the manifest is then switched to load
the runtime from the site itself.
"""
import json, pathlib, sys

HERE = pathlib.Path(__file__).parent
SRC = HERE / "src"
OUT = HERE / "dist"
SITE_URL = "https://aviralgupta2211.github.io/remaster-lab/"
DESCRIPTION = ("Open any song, see how it's built, split it into stems with AI and remaster it section by section, "
               "with touch pads, 8D motion and DJ-style waveforms. Free, open source, runs in your browser.")
ICON = ("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 22 22'%3E%3Crect width='22' height='22' rx='5' fill='%23181b21'/%3E"
        "%3Cg fill='%23f0a43a'%3E%3Crect x='3' y='9' width='2.2' height='4' rx='1'/%3E%3Crect x='6.5' y='6' width='2.2' height='10' rx='1'/%3E"
        "%3Crect x='10' y='3' width='2.2' height='16' rx='1'/%3E%3Crect x='13.5' y='7' width='2.2' height='8' rx='1'/%3E%3Crect x='17' y='9' width='2.2' height='4' rx='1'/%3E%3C/g%3E%3C/svg%3E")


def page_body() -> str:
    page = (SRC / "page.html").read_text()
    ai = (SRC / "aisplit.js").read_text() + "\n" + (SRC / "ai-worker.js").read_text()
    return (page.replace("/*AI*/", ai).replace("/*DSP*/", (SRC / "dsp.js").read_text())
            .replace("/*SYNTH*/", (SRC / "synths.js").read_text()).replace("/*APP*/", (SRC / "app.js").read_text()))


def build(mode: str) -> str:
    body = page_body()
    if mode == "fragment":
        return body
    head = ['<meta charset="utf-8">',
            '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">']
    if mode == "site":
        head += [
            # coi-serviceworker adds the headers GitHub Pages can't send, so SharedArrayBuffer
            # (multi-threaded WebAssembly) works. "credentialless" keeps Google Fonts loading.
            '<script>window.coi = { coepCredentialless: function () { return true; }, quiet: true };</script>',
            '<script src="coi-serviceworker.min.js"></script>',
            f'<meta name="description" content="{DESCRIPTION}">',
            '<meta property="og:type" content="website">',
            '<meta property="og:title" content="Remaster Lab">',
            f'<meta property="og:description" content="{DESCRIPTION}">',
            f'<meta property="og:url" content="{SITE_URL}">',
            f'<meta property="og:image" content="{SITE_URL}screenshot.jpg">',
            '<meta name="twitter:card" content="summary_large_image">',
            '<meta name="theme-color" content="#111317">',
            f'<link rel="icon" href="{ICON}">',
        ]
    return ('<!doctype html>\n<html lang="en"><head>' + "".join(head) +
            '<style>html{color-scheme:light dark}body{margin:0}img{max-width:100%}</style></head><body>\n'
            + body + "\n</body></html>\n")


def finish_site():
    """Point the model manifest at the self-hosted runtime and drop the bundled wasm parts."""
    man_path = OUT / "model" / "manifest.json"
    if not man_path.exists():
        print("note: no web/dist/model yet; the AI split will be unavailable on this build")
        return
    if not (OUT / "model" / "ort" / "ort.webgpu.min.js").exists():
        sys.exit("web/dist/model/ort/ is missing the ONNX Runtime Web files")
    man = json.loads(man_path.read_text())
    if not man.get("ort"):
        for name in man.get("wasm", []):
            part = OUT / "model" / name
            if part.exists():
                man["totalBytes"] -= part.stat().st_size
                part.unlink()
        man["wasm"] = []
        man["ort"] = "ort/"
        # the runtime's own wasm is now fetched by onnxruntime-web; count it in the progress total
        wasm = OUT / "model" / "ort" / "ort-wasm-simd-threaded.jsep.wasm"
        if wasm.exists():
            man["totalBytes"] += wasm.stat().st_size
        man_path.write_text(json.dumps(man, indent=1))


if __name__ == "__main__":
    mode = "site" if "--site" in sys.argv else "fragment" if "--fragment" in sys.argv else "page"
    OUT.mkdir(exist_ok=True)
    (OUT / "index.html").write_text(build(mode))
    if mode == "site":
        finish_site()
        shot = HERE.parent / "docs" / "screenshot.jpg"
        if shot.exists():
            (OUT / "screenshot.jpg").write_bytes(shot.read_bytes())
        (OUT / ".nojekyll").write_text("")
    print("wrote", OUT / "index.html", f"({mode})")
