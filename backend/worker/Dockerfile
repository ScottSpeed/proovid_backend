FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1
WORKDIR /app

# Copy worker-specific requirements.txt
COPY worker/requirements.txt ./

RUN pip install --no-cache-dir -r requirements.txt

# system libs required by opencv (cv2) and other packages
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*

# copy ALL backend sources for proper imports
COPY . ./

# Ensure top-level backend modules are importable
ENV PYTHONPATH=/app

# Use direct tool execution to bypass Strands framework
ENV WORKER_DIRECT_MODE=1
ENV WORKER_TEST_MODE=0

# Run the worker script from worker directory
CMD ["python", "-u", "worker/worker.py"]