from fastapi import FastAPI

# MINIMAL TEST API
app = FastAPI(title="Test API")

@app.get("/api/health")
def api_health():
    return {"status": "ok", "test": "minimal"}

@app.get("/api/test")  
def api_test():
    return {"test": "works", "minimal": True}

@app.get("/health")
def regular_health():
    return {"status": "ok", "regular": True}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)