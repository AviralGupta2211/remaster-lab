# CPU image. For an NVIDIA GPU, start from pytorch/pytorch:2.4.0-cuda12.1-cudnn9-runtime and drop the torch line.
FROM python:3.11-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN pip install --no-cache-dir torch torchaudio --index-url https://download.pytorch.org/whl/cpu
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# Download the model weights at build time so the first request is fast
RUN python -c "from demucs.pretrained import get_model; get_model('htdemucs')"
COPY app.py .
RUN useradd -m appuser
USER appuser
EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
