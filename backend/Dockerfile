FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1
WORKDIR /app

# copy requirements from backend/ (build context must be the backend directory)
COPY requirements.txt ./

# Install system deps needed by some Python packages (e.g. OpenCV's libGL)
RUN apt-get update \
	&& apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
	&& rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir -r requirements.txt

# copy the rest of the backend sources
COPY . .

EXPOSE 8000
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]