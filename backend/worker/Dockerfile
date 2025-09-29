FROM python:3.12-slim

# System dependencies first
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy ALL files (includes requirements.txt)
COPY . .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Worker environment
ENV PYTHONUNBUFFERED=1
ENV WORKER_DIRECT_MODE=1
ENV WORKER_TEST_MODE=0
ENV PYTHONPATH=/app

# Run worker
CMD ["python", "-u", "worker/worker.py"]