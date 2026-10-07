"""Build the in-browser AI model for Remaster Lab.

Exports Demucs v4 (HTDemucs, Meta AI, MIT licence) to ONNX with the STFT/iSTFT
left out (the browser does those in web/src/aisplit.js), stores the weights as
float16 to halve the download, and writes web/dist/model/ with a manifest.

    pip install torch demucs onnx onnxscript onnxruntime numpy
    python3 tools/build_model.py               # raw binary parts, for your own hosting
    python3 tools/build_model.py --base64      # base64 text parts, for hosts that only serve text data
    python3 tools/build_model.py --verify      # also check the ONNX model against PyTorch

The ONNX Runtime WebAssembly binary is downloaded from the public npm CDN.
"""
import argparse, base64, json, pathlib, urllib.request

import numpy as np
import onnx
import torch
from demucs.pretrained import get_model

ORT_VERSION = "1.20.1"
ORT_WASM = f"https://cdn.jsdelivr.net/npm/onnxruntime-web@{ORT_VERSION}/dist/ort-wasm-simd-threaded.jsep.wasm"
PART = 10_500_000


class Core(torch.nn.Module):
    """HTDemucs.forward without the STFT/iSTFT and the complex masking."""

    def __init__(self, m):
        super().__init__()
        self.m = m

    def forward(self, mix, mag):
        self_ = self.m
        x = mag
        B, C, Fq, T = x.shape
        mean = x.mean(dim=(1, 2, 3), keepdim=True)
        std = x.std(dim=(1, 2, 3), keepdim=True)
        x = (x - mean) / (1e-5 + std)
        xt = mix
        meant = xt.mean(dim=(1, 2), keepdim=True)
        stdt = xt.std(dim=(1, 2), keepdim=True)
        xt = (xt - meant) / (1e-5 + stdt)
        saved, saved_t, lengths, lengths_t = [], [], [], []
        for idx, encode in enumerate(self_.encoder):
            lengths.append(x.shape[-1])
            inject = None
            if idx < len(self_.tencoder):
                lengths_t.append(xt.shape[-1])
                tenc = self_.tencoder[idx]
                xt = tenc(xt)
                if not tenc.empty:
                    saved_t.append(xt)
                else:
                    inject = xt
            x = encode(x, inject)
            if idx == 0 and self_.freq_emb is not None:
                frs = torch.arange(x.shape[-2], device=x.device)
                emb = self_.freq_emb(frs).t()[None, :, :, None].expand_as(x)
                x = x + self_.freq_emb_scale * emb
            saved.append(x)
        if self_.crosstransformer:
            if self_.bottom_channels:
                b, c, f, t = x.shape
                x = self_.channel_upsampler(x.reshape(b, c, f * t)).reshape(b, -1, f, t)
                xt = self_.channel_upsampler_t(xt)
            x, xt = self_.crosstransformer(x, xt)
            if self_.bottom_channels:
                b, c, f, t = x.shape
                x = self_.channel_downsampler(x.reshape(b, c, f * t)).reshape(b, -1, f, t)
                xt = self_.channel_downsampler_t(xt)
        for idx, decode in enumerate(self_.decoder):
            skip = saved.pop(-1)
            x, pre = decode(x, skip, lengths.pop(-1))
            offset = self_.depth - len(self_.tdecoder)
            if idx >= offset:
                tdec = self_.tdecoder[idx - offset]
                length_t = lengths_t.pop(-1)
                if tdec.empty:
                    xt, _ = tdec(pre[:, :, 0], None, length_t)
                else:
                    xt, _ = tdec(xt, saved_t.pop(-1), length_t)
        S = len(self_.sources)
        x = x.view(B, S, -1, Fq, T) * std[:, None] + mean[:, None]
        xt = xt.view(B, S, -1, mix.shape[-1]) * stdt[:, None] + meant[:, None]
        return x, xt


def write_parts(data: bytes, out: pathlib.Path, prefix: str, b64: bool):
    names, total = [], 0
    for i in range(0, len(data), PART):
        chunk = data[i:i + PART]
        if b64:
            chunk = base64.b64encode(chunk)
        name = f"{prefix}.part{i // PART}.{'b64.txt' if b64 else 'bin'}"
        (out / name).write_bytes(chunk)
        names.append(name)
        total += len(chunk)
    return names, total


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base64", action="store_true")
    ap.add_argument("--verify", action="store_true")
    ap.add_argument("--out", default=str(pathlib.Path(__file__).resolve().parent.parent / "web" / "dist" / "model"))
    args = ap.parse_args()
    out = pathlib.Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    work = out / "_work"
    work.mkdir(exist_ok=True)

    m = get_model("htdemucs").models[0].eval()
    L = int(m.segment * m.samplerate)
    core = Core(m).eval()
    mix = torch.randn(1, 2, L) * 0.1
    z = m._spec(mix)
    mag = m._magnitude(z)
    torch.onnx.export(core, (mix, mag), str(work / "full.onnx"), input_names=["mix", "mag"],
                      output_names=["spec", "wave"], opset_version=17, dynamo=False)
    model = onnx.load(str(work / "full.onnx"))
    onnx.save_model(model, str(work / "htdemucs.onnx"), save_as_external_data=True, all_tensors_to_one_file=True,
                    location="htdemucs.weights", size_threshold=1024)
    weights = np.fromfile(work / "htdemucs.weights", dtype=np.float32).astype(np.float16).tobytes()

    if args.verify:
        import onnxruntime as ort
        with torch.no_grad():
            ref = m(mix)
            sess = ort.InferenceSession(str(work / "full.onnx"))
            spec, wave = sess.run(None, {"mix": mix.numpy(), "mag": mag.numpy()})
            full = m._ispec(m._mask(z, torch.from_numpy(spec)), L).view(1, 4, 2, L) + torch.from_numpy(wave)
        err = (full - ref).pow(2).sum() / ref.pow(2).sum()
        print("ONNX vs PyTorch SNR: %.1f dB" % (-10 * np.log10(float(err))))

    print("downloading", ORT_WASM)
    wasm = urllib.request.urlopen(ORT_WASM).read()
    g, gb = write_parts((work / "htdemucs.onnx").read_bytes(), out, "htdemucs.graph", args.base64)
    w, wb = write_parts(weights, out, "htdemucs.f16", args.base64)
    wa, wab = write_parts(wasm, out, f"ort-{ORT_VERSION}-jsep.wasm", args.base64)
    manifest = {"model": "htdemucs", "source": "Demucs v4 (Meta AI, MIT licence) exported to ONNX", "sampleRate": 44100,
                "encoding": "base64" if args.base64 else "none", "graph": g, "externalDataName": "htdemucs.weights",
                "weights": w, "wasm": wa, "totalBytes": gb + wb + wab}
    (out / "manifest.json").write_text(json.dumps(manifest, indent=1))
    for f in work.iterdir():
        f.unlink()
    work.rmdir()
    print(f"wrote {out} ({manifest['totalBytes'] / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
