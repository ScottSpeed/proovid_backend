from fastapi import FastAPI
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

@app.get("/")
async def root():
    return {"status": "ok", "message": "Simple API working"}

@app.get("/health")
async def health():
    logger.info("Health check called")
    return {"status": "healthy", "message": "Container is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)