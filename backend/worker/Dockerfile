FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1
WORKDIR /app

# EINFACH: Kopiere alles erst, dann installiere requirements
COPY . ./

# Install from main requirements.txt (same dependencies anyway)
RUN pip install --no-cache-dir -r requirements.txt

# system libs required by opencv (cv2) and other packages
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*

# Use direct tool execution to bypass Strands framework
ENV WORKER_DIRECT_MODE=1
ENV WORKER_TEST_MODE=0
ENV PYTHONPATH=/app

# Run the worker script
CMD ["python", "-u", "worker/worker.py"]