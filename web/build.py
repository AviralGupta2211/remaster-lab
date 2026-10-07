"""Build web/dist/index.html: one self-contained page (HTML, CSS and all JavaScript inlined).

    python3 web/build.py            # full page with <!doctype html>, for any static host
    python3 web/build.py --fragment # body-only fragment, for hosts that add their own document skeleton
"""
import pathlib, sys

HERE = pathlib.Path(__file__).parent
SRC = HERE / "src"


def build(fragment: bool) -> str:
    page = (SRC / "page.html").read_text()
    ai = (SRC / "aisplit.js").read_text() + "\n" + (SRC / "ai-worker.js").read_text()
    page = page.replace("/*AI*/", ai).replace("/*DSP*/", (SRC / "dsp.js").read_text()).replace("/*APP*/", (SRC / "app.js").read_text())
    if fragment:
        return page
    return ('<!doctype html>\n<html lang="en"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
            '<style>html{color-scheme:light dark}body{margin:0}img{max-width:100%}</style></head><body>\n'
            + page + "\n</body></html>\n")


if __name__ == "__main__":
    out = HERE / "dist"
    out.mkdir(exist_ok=True)
    (out / "index.html").write_text(build("--fragment" in sys.argv))
    print("wrote", out / "index.html")
