FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1
WORKDIR /app

# If you put a requirements.txt inside backend/worker, copy it here:
COPY requirements.txt ./

RUN pip install --no-cache-dir -r requirements.txt

# system libs required by opencv (cv2) and other packages
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*

# copy worker sources
COPY worker/worker.py ./
COPY worker/agent.py ./

# Ensure top-level backend modules are importable
ENV PYTHONPATH=/app

# Use direct tool execution to bypass Strands framework
ENV WORKER_DIRECT_MODE=1
ENV WORKER_TEST_MODE=0

# Run the worker script
CMD ["python", "-u", "worker.py"]