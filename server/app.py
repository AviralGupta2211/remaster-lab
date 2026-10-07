"""Remaster Lab separation server.

Runs Demucs (Meta AI, MIT licence) on an uploaded song and returns the stems
as a zip of FLAC files. The web app calls POST /separate when you enter this
server's address in the "Use a separation server" box.

Configuration is read from environment variables only. Nothing secret lives in
this file or in the repository:

  REMASTER_LAB_TOKEN    optional access token; when set, requests must send
                        "Authorization: Bearer <token>". Set it whenever the
                        server is reachable by anyone other than you.
  REMASTER_LAB_ORIGINS  comma-separated list of web origins allowed to call the
                        server (CORS). Defaults to local development origins.
  REMASTER_LAB_MAX_MB   largest accepted upload in MB (default 200).
"""
import io
import os
import secrets
import subprocess
import zipfile

import numpy as np
import soundfile as sf
import torch
from demucs.apply import apply_model
from demucs.pretrained import get_model
from fastapi import FastAPI, File, Header, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

TOKEN = os.environ.get("REMASTER_LAB_TOKEN", "")
ORIGINS = [o.strip() for o in os.environ.get(
    "REMASTER_LAB_ORIGINS", "http://localhost:8080,http://127.0.0.1:8080,http://localhost:5173").split(",") if o.strip()]
MAX_BYTES = int(os.environ.get("REMASTER_LAB_MAX_MB", "200")) * 1024 * 1024
SAMPLE_RATE = 44100
ALLOWED_MODELS = ("htdemucs", "htdemucs_ft", "htdemucs_6s")

if torch.cuda.is_available():
    DEVICE = "cuda"
elif getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
    DEVICE = "mps"
else:
    DEVICE = "cpu"

_models = {}


def load_model(name: str):
    if name not in _models:
        bag = get_model(name)
        bag.eval()
        _models[name] = bag.to(DEVICE)
    return _models[name]


def decode_audio(data: bytes) -> np.ndarray:
    """Decode any format ffmpeg understands to float32 stereo at 44.1 kHz, shape (2, n)."""
    proc = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", "pipe:0", "-f", "f32le", "-ac", "2", "-ar", str(SAMPLE_RATE), "pipe:1"],
        input=data, capture_output=True, check=False)
    if proc.returncode != 0 or not proc.stdout:
        raise HTTPException(400, "Could not decode the uploaded audio.")
    return np.frombuffer(proc.stdout, dtype=np.float32).reshape(-1, 2).T.copy()


app = FastAPI(title="Remaster Lab separation server", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=ORIGINS, allow_methods=["GET", "POST"], allow_headers=["Authorization"])


@app.get("/health")
def health():
    return {"ok": True, "device": DEVICE, "models": list(ALLOWED_MODELS), "auth": bool(TOKEN)}


@app.post("/separate")
def separate(file: UploadFile = File(...),
             model: str = Query("htdemucs"),
             authorization: str | None = Header(default=None)):
    if TOKEN and not secrets.compare_digest(authorization or "", f"Bearer {TOKEN}"):
        raise HTTPException(401, "Missing or wrong access token.")
    if model not in ALLOWED_MODELS:
        raise HTTPException(400, f"Unknown model. Use one of: {', '.join(ALLOWED_MODELS)}.")
    data = file.file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "File too large.")

    mix = torch.from_numpy(decode_audio(data))
    ref = mix.mean(0)
    mean, std = ref.mean(), ref.std() + 1e-8
    bag = load_model(model)
    with torch.no_grad():
        out = apply_model(bag, ((mix - mean) / std)[None].to(DEVICE), shifts=0, split=True, overlap=0.25)[0]
    out = (out * std + mean).cpu().numpy()

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_STORED) as z:  # stored: the browser reads it without a library
        for name, stem in zip(bag.sources, out):
            flac = io.BytesIO()
            sf.write(flac, np.clip(stem.T, -1, 1), SAMPLE_RATE, format="FLAC", subtype="PCM_24")
            z.writestr(f"{name}.flac", flac.getvalue())
    return Response(buf.getvalue(), media_type="application/zip",
                    headers={"Content-Disposition": 'attachment; filename="stems.zip"'})
