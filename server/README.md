# Remaster Lab separation server

A small HTTP server that runs [Demucs](https://github.com/facebookresearch/demucs) on a song and returns the stems. Use it when you want AI stems in under a minute (with a GPU) instead of waiting for the in-browser split.

## Run it

**With Docker (CPU):**

```bash
cd server
docker build -t remaster-lab-server .
docker run --rm -p 8000:8000 --env-file .env remaster-lab-server
```

**Without Docker:**

```bash
cd server
pip install torch torchaudio            # pick the right build for your machine: https://pytorch.org/get-started/locally/
pip install -r requirements.txt
cp .env.example .env                    # then edit it
set -a; . ./.env; set +a
uvicorn app:app --host 127.0.0.1 --port 8000
```

`ffmpeg` must be installed (`brew install ffmpeg`, `apt install ffmpeg`). The first request downloads the Demucs weights (about 80 MB) unless you used the Docker image.

Check it is up: `curl http://localhost:8000/health`.

## Connect the app

In Remaster Lab, click **Split with AI**, open **Use a separation server instead**, enter `http://localhost:8000` and your token (if you set one), then **Start AI split**.

Pages opened on claude.ai cannot reach outside servers; this works with your own copy of the app (see the main README), served from an origin listed in `REMASTER_LAB_ORIGINS`.

## API

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/health` | none | `{"ok": true, "device": "cuda", "models": [...], "auth": true}` |
| POST | `/separate?model=htdemucs` | multipart form, field `file` (any audio ffmpeg can read) | zip (stored, uncompressed) of `drums.flac`, `bass.flac`, `other.flac`, `vocals.flac`, 24-bit, 44.1 kHz |

`model` can be `htdemucs` (default), `htdemucs_ft` (fine-tuned, slower, slightly better) or `htdemucs_6s` (adds `guitar.flac` and `piano.flac`; the app currently folds those into "other").

Send `Authorization: Bearer <token>` when `REMASTER_LAB_TOKEN` is set.

## Configuration

All settings are environment variables (see `.env.example`). Nothing secret is stored in code.

| Variable | Default | Meaning |
| --- | --- | --- |
| `REMASTER_LAB_TOKEN` | empty | Access token. Set it whenever anyone else can reach the server. |
| `REMASTER_LAB_ORIGINS` | local dev origins | Web origins allowed by CORS, comma-separated. |
| `REMASTER_LAB_MAX_MB` | `200` | Largest accepted upload. |

Before exposing the server to the internet: set a token, serve it over HTTPS (for example behind Caddy or nginx), and limit `REMASTER_LAB_ORIGINS` to where your copy of the app lives.
