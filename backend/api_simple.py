from fastapi import FastAPI, Request
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import logging

# Basic logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Proov API Simple", description="Simplified Proovid API for debugging")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://ui.proovid.de", "https://localhost:5173", "https://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

class AgentRequest(BaseModel):
    message: str

@app.get("/")
async def root():
    return {"status": "healthy", "service": "proovid-backend-simple"}

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/ask")
async def ask_agent(request: AgentRequest):
    """Simple ChatBot response without Bedrock"""
    try:
        message = request.message
        # Simple responses based on keywords
        message_lower = message.lower()
        
        if any(word in message_lower for word in ['hello', 'hi', 'help']):
            response = "👋 Hi! I'm your simplified video analysis assistant. Upload videos and analyze them!"
        elif any(word in message_lower for word in ['blackframe', 'black frame', 'dark']):
            response = "🎬 Use our Blackframe Detection to find dark frames in videos!"
        elif any(word in message_lower for word in ['label', 'object', 'detect', 'recognize']):
            response = "🏷️ Our Label Detection uses AWS Rekognition to identify objects in videos!"
        elif any(word in message_lower for word in ['text', 'ocr', 'read']):
            response = "📝 We can extract text from video frames!"
        else:
            response = f"🤖 Thanks for your message: '{message}'. I'm a simplified ChatBot for testing!"
            
        return {"response": response}
    except Exception as e:
        logger.exception("Simple chatbot error")
        return {"response": f"Simple ChatBot error: {str(e)}"}

@app.options("/ask")
async def options_ask(request: Request):
    return Response(
        status_code=200,
        headers={
            "Access-Control-Allow-Origin": request.headers.get("origin", "*"),
            "Access-Control-Allow-Methods": "POST,OPTIONS",
            "Access-Control-Allow-Headers": request.headers.get(
                "access-control-request-headers", "*"
            ),
            "Access-Control-Allow-Credentials": "true",
        },
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)