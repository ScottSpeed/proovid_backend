from fastapi import FastAPI, Request, BackgroundTasks, HTTPException, Query, Depends, APIRouter
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response as StarletteResponse
from pydantic import BaseModel
from typing import List, Dict, Any
import logging
import os
import uuid
import json
import docker
import boto3
import traceback
import time

from botocore.exceptions import ClientError
import pathlib

# Import auth bypass for debugging
from auth_bypass import (
    get_current_user, require_admin, require_user
)
from auth_cognito import (
    LoginRequest, LoginResponse, UserResponse, ChangePasswordRequest
)

# Basic logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import cost-optimized AWS features
try:
    from cost_optimized_aws_vector import get_cost_optimized_vector_db, get_cost_optimized_chatbot
    COST_OPTIMIZED_AWS_AVAILABLE = True
    logger.info("✅ Cost-optimized AWS Vector DB loaded successfully")
except ImportError as e:
    COST_OPTIMIZED_AWS_AVAILABLE = False
    logger.warning(f"⚠️  Cost-optimized AWS Vector DB not available: {e}")

# Import premium AWS features (fallback)
try:
    from aws_vector_db import get_aws_vector_db, get_aws_chatbot
    PREMIUM_AWS_VECTOR_DB_AVAILABLE = True
    logger.info("✅ Premium AWS Vector DB also available")
except ImportError as e:
    PREMIUM_AWS_VECTOR_DB_AVAILABLE = False
    logger.warning(f"⚠️  Premium AWS Vector DB not available: {e}")

# Fallback to local vector DB for development
try:
    from vector_db import get_vector_db, VideoVectorDB
    from chatbot import get_chatbot, VideoRAGChatBot
    LOCAL_VECTOR_DB_AVAILABLE = True
    logger.info("✅ Local Vector DB modules available for development")
except ImportError as e:
    LOCAL_VECTOR_DB_AVAILABLE = False
    logger.warning(f"⚠️  Local Vector DB modules not available: {e}")

# Determine which system to use (prioritize cost-optimized)
VECTOR_DB_AVAILABLE = COST_OPTIMIZED_AWS_AVAILABLE or PREMIUM_AWS_VECTOR_DB_AVAILABLE or LOCAL_VECTOR_DB_AVAILABLE
USE_COST_OPTIMIZED = COST_OPTIMIZED_AWS_AVAILABLE and os.environ.get('USE_COST_OPTIMIZED', 'true').lower() == 'true'
USE_AWS_NATIVE = PREMIUM_AWS_VECTOR_DB_AVAILABLE and os.environ.get('USE_AWS_NATIVE_VECTOR_DB', 'false').lower() == 'true'
# increase opensearch/urllib3 logs for debugging if needed
logging.getLogger("opensearch").setLevel(logging.INFO)
logging.getLogger("urllib3").setLevel(logging.INFO)

app = FastAPI(title="Proov API", description="Enterprise Video Analysis API with JWT Authentication")

# --- CRITICAL: API Routes with /api/ prefix (MUST be first!) ---
@app.get("/api/health")
def api_health():
    return {"status": "ok"}

@app.get("/api/test")
def api_test():
    return {"test": "works"}

# Initialize authentication system on startup
@app.on_event("startup")
async def startup_event():
    """Initialize authentication system"""
    logger.info("🛡️  Initializing Cognito authentication system...")
    logger.info("✅ Cognito authentication system ready!")

# --- Authentication Endpoints ---

@app.get("/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Get current user information"""
    return UserResponse(
        username=current_user["username"],
        email=current_user.get("email", ""),
        role=current_user.get("role", "user"),
        is_active=current_user.get("is_active", True),
        created_at=current_user.get("created_at", "")
    )
    
    return {"message": "Password updated successfully"}


# --- Configuration loader ---
def load_config() -> dict:
    """Load configuration from a JSON file. File path can be overridden with CONFIG_FILE env var.

    Fallback order:
    1. Path from CONFIG_FILE env var
    2. /etc/proov/config.json
    3. <repo>/backend/config.json (next to this file)
    4. empty dict
    """
    candidates = []
    env_path = os.environ.get("CONFIG_FILE")
    if env_path:
        candidates.append(env_path)
    candidates.append("/etc/proov/config.json")
    # config next to this module
    module_dir = pathlib.Path(__file__).resolve().parent
    candidates.append(str(module_dir / "config.json"))

    for p in candidates:
        try:
            if not p:
                continue
            fp = pathlib.Path(p)
            if not fp.exists():
                continue
            with fp.open("r", encoding="utf-8") as fh:
                data = json.load(fh)
                logger.info("Loaded config from %s", str(fp))
                return data if isinstance(data, dict) else {}
        except Exception:
            logger.exception("Failed to load config file %s", p)
            continue
    logger.info("No config file found; falling back to environment variables")
    return {}


# load config at import time
_CONFIG = load_config()


def cfg(key: str, default=None):
    """Helper: read key from JSON config first, then from environment, then default."""
    if key in _CONFIG:
        return _CONFIG.get(key)
    return os.environ.get(key, default)


# --- DynamoDB job table helper ---
import botocore
from botocore.config import Config

# Configure boto3 to use container credentials
boto3_config = Config(
    region_name=os.environ.get("AWS_DEFAULT_REGION", "eu-central-1")
)

def get_dynamodb_resource():
    region = cfg("AWS_DEFAULT_REGION", "eu-central-1")
    
    # Use default AWS SDK behavior - it will automatically use VPC endpoints if configured
    return boto3.resource("dynamodb", region_name=region, config=boto3_config)


def get_s3_client():
    region = cfg("AWS_DEFAULT_REGION", "eu-central-1")
    
    # Check if running in ECS with a VPC endpoint
    if 'ECS_CONTAINER_METADATA_URI_V4' in os.environ:
        try:
            # Try to use VPC endpoint if available, but fallback to default
            return boto3.client("s3", region_name=region, config=boto3_config)
        except Exception as e:
            logger.warning(f"Failed to create S3 client with VPC endpoint: {e}")

    return boto3.client("s3", region_name=region, config=boto3_config)


def ensure_job_table(table_name: str):
    """Create the DynamoDB table if it doesn't exist (on-demand billing)."""
    ddb = get_dynamodb_resource()
    try:
        table = ddb.Table(table_name)
        table.load()
        logger.info("DynamoDB table '%s' exists", table_name)
        return table
    except botocore.exceptions.ClientError as e:
        code = e.response.get("Error", {}).get("Code")
        if code in ("ResourceNotFoundException", "ValidationException", "ResourceNotFound"):
            logger.info("Creating DynamoDB table %s", table_name)
            table = ddb.create_table(
                TableName=table_name,
                KeySchema=[{"AttributeName": "job_id", "KeyType": "HASH"}],
                AttributeDefinitions=[{"AttributeName": "job_id", "AttributeType": "S"}],
                BillingMode="PAY_PER_REQUEST",
            )
            # wait until created
            table.wait_until_exists()
            logger.info("DynamoDB table '%s' created", table_name)
            return table
        else:
            logger.exception("Error checking/creating DynamoDB table %s", table_name)
            raise


JOB_TABLE = cfg("JOB_TABLE", "proov_jobs")
_JOB_TABLE_OBJ = None


def job_table():
    global _JOB_TABLE_OBJ
    if _JOB_TABLE_OBJ is None:
        _JOB_TABLE_OBJ = ensure_job_table(JOB_TABLE)
    return _JOB_TABLE_OBJ


def save_job_entry(job_id: str, status: str, result=None, video=None, created_at=None):
    t = job_table()
    current_time = int(time.time())  # Convert to integer
    
    item = {
        "job_id": job_id, 
        "status": status,
        "created_at": int(created_at) if created_at else current_time,  # Unix timestamp as integer
        "updated_at": current_time  # Also use integer timestamp here
    }
    
    if result is not None:
        # store small results; large blobs should go to S3
        item["result"] = result if isinstance(result, str) else json.dumps(result, ensure_ascii=False)
    if video is not None:
        # Store video as JSON for backward compatibility
        item["video"] = video if isinstance(video, dict) else json.dumps(video, ensure_ascii=False)
        
        # Extract S3 bucket and key as separate fields for worker access
        video_dict = video if isinstance(video, dict) else video
        if hasattr(video_dict, 'bucket') and hasattr(video_dict, 'key'):
            item["s3_bucket"] = video_dict.bucket
            item["s3_key"] = video_dict.key
            item["file_url"] = f"s3://{video_dict.bucket}/{video_dict.key}"
        elif isinstance(video_dict, dict):
            if 'bucket' in video_dict and 'key' in video_dict:
                item["s3_bucket"] = video_dict['bucket']
                item["s3_key"] = video_dict['key']
                item["file_url"] = f"s3://{video_dict['bucket']}/{video_dict['key']}"
            elif 'bucket' in video_dict:
                item["s3_bucket"] = video_dict['bucket']
            elif 'key' in video_dict:
                item["s3_key"] = video_dict['key']
    
    t.put_item(Item=item)


# CORS
# --- CORS robust: unterstützt mehrere Domains, CloudFront und eigene Subdomain ---
import re

frontend_origins = os.environ.get(
    "FRONTEND_ORIGINS",
    "https://proovid.ai,https://ui.proovid.de,https://localhost:5173,https://127.0.0.1:5173"
)
origins_raw = frontend_origins.strip()
if origins_raw == "*":
    allow_origins = ["*"]
else:
    # Splitte an Komma oder Leerzeichen (oder beidem)
    allow_origins = [o.strip() for o in re.split(r"[ ,]+", origins_raw) if o.strip()]
    if not allow_origins:
        allow_origins = [
            "https://proovid.ai",
            "https://ui.proovid.de",
            "https://localhost:5173",
            "https://127.0.0.1:5173"
        ]
logger.info(f"CORS allow_origins: {allow_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://proovid.ai",           # 🔥 NEW COOL DOMAIN! 
        "https://ui.proovid.de",        # Legacy domain
        "https://localhost:5173", 
        "https://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)


# --- Helper: OpenSearch client ---
# OpenSearch client removed: we use DynamoDB for job storage now


# --- Agent import removed: Using Direct AWS Bedrock for ChatBot ---
# from worker.agent import agent  # Removed - agent framework was causing crashes

# --- Direct AWS Bedrock ChatBot Implementation ---
async def call_bedrock_chatbot(message: str, user_id: str = None) -> str:
    """
    Direct AWS Bedrock integration for ChatBot functionality.
    Uses Claude 3 Haiku for cost-optimized AI responses.
    Now includes video analysis data from user's completed jobs!
    """
    try:
        import boto3
        import json
        
        # Initialize clients
        bedrock = boto3.client('bedrock-runtime', region_name='eu-central-1')
        
        # Get user's video analysis results from DynamoDB
        video_context = ""
        try:
            t = job_table()
            resp = t.scan(Limit=100)  # Get recent jobs
            jobs = resp.get("Items", [])
            
            print(f"[DIAGNOSTIC] DynamoDB scan returned {len(jobs)} jobs")
            
            # Filter completed jobs and extract analysis results
            completed_jobs = []
            for job in jobs:
                # Extract values from DynamoDB format {"S": "value"} or direct value
                job_id = job.get('job_id', {}).get('S', job.get('job_id', 'unknown'))
                status = job.get('status', {}).get('S', job.get('status', ''))
                result = job.get('result', {}).get('S', job.get('result', ''))
                
                print(f"[DIAGNOSTIC] Job {job_id}: status='{status}', has_result={bool(result)}")
                
                if status == "done" and result:
                    print(f"[DIAGNOSTIC] Processing completed job: {job_id}")
                    try:
                        # Parse video data - handle both nested and flat structure  
                        video_info_raw = job.get("video_info", job.get("video", {}))
                        print(f"[DIAGNOSTIC] video_info_raw type: {type(video_info_raw)}, value: {video_info_raw}")
                        
                        if isinstance(video_info_raw, dict) and 'M' in video_info_raw:
                            # DynamoDB format: {"M": {"key": {"S": "value"}}}
                            video_info = {}
                            for k, v in video_info_raw['M'].items():
                                if isinstance(v, dict) and 'S' in v:
                                    video_info[k] = v['S']
                                else:
                                    video_info[k] = v
                        elif isinstance(video_info_raw, str):
                            try:
                                video_info = json.loads(video_info_raw)
                            except:
                                video_info = {}
                        elif isinstance(video_info_raw, dict):
                            video_info = video_info_raw
                        else:
                            video_info = {}
                            
                        print(f"[DIAGNOSTIC] video_info after parsing: type={type(video_info)}, value={video_info}")
                        
                        # Parse analysis results
                        if isinstance(result, str):
                            results = json.loads(result)
                        else:
                            results = result
                        
                        # Extract key information for ChatBot
                        s3_key_raw = job.get("s3_key", {})
                        s3_key = s3_key_raw.get('S', s3_key_raw) if isinstance(s3_key_raw, dict) else s3_key_raw
                        
                        # EMERGENCY FIX: Ensure video_info is always a dict
                        if not isinstance(video_info, dict):
                            print(f"[EMERGENCY DEBUG] video_info type: {type(video_info)} - converting to dict")
                            print(f"[EMERGENCY DEBUG] video_info value: {video_info}")
                            video_info = {}  # Reset to empty dict if not parseable
                        
                        video_name = video_info.get("filename", video_info.get("key", s3_key or "Unknown"))
                        labels = []
                        texts = []
                        
                        # Extract labels from our analysis structure
                        if "label_detection" in results and "unique_labels" in results["label_detection"]:
                            for label in results["label_detection"]["unique_labels"][:15]:  # Top 15 labels
                                if label.get("max_confidence", 0) > 70:
                                    labels.append(label["name"])
                        
                        # Extract detected text from our analysis structure
                        if "text_detection" in results and "text_detections" in results["text_detection"]:
                            for text in results["text_detection"]["text_detections"][:10]:  # Top 10 texts
                                if text.get("confidence", 0) > 50:
                                    texts.append(text["text"])
                        
                        completed_jobs.append({
                            "name": video_name,
                            "labels": labels,
                            "texts": texts,
                            "job_id": job_id
                        })
                        print(f"[DIAGNOSTIC] Added job {job_id}: {len(labels)} labels, {len(texts)} texts")
                    except Exception as e:
                        print(f"[DIAGNOSTIC] Error parsing job {job_id}: {e}")
                        continue
            
            # Create context for ChatBot
            if completed_jobs:
                video_context = f"\n\nUSER'S ANALYZED VIDEOS ({len(completed_jobs)} videos):\n"
                for i, video in enumerate(completed_jobs[:5], 1):  # Limit to 5 videos
                    video_context += f"\n{i}. Video: {video['name']}"
                    if video['labels']:
                        video_context += f"\n   Labels detected: {', '.join(video['labels'])}"
                    if video['texts']:
                        video_context += f"\n   Text detected: {', '.join(video['texts'])}"
                    video_context += f"\n   Job ID: {video['job_id']}"
                
                video_context += f"\n\nThe user can ask questions about these {len(completed_jobs)} analyzed videos."
            else:
                video_context = "\n\nUSER'S ANALYZED VIDEOS: No completed video analysis found. User should upload and analyze videos first."
                
        except Exception as e:
            logger.warning(f"Failed to fetch video analysis data: {e}")
            video_context = "\n\nUSER'S ANALYZED VIDEOS: Unable to fetch video data."
        
        print(f"[DIAGNOSTIC] Final video_context length: {len(video_context)} chars")
        print(f"[DIAGNOSTIC] Video context preview: {video_context[:200]}...")
        
        # Create enhanced system prompt with video analysis context
        system_prompt = f"""You are a helpful video analysis assistant for a video processing platform. 

Your capabilities include:
- Blackframe Detection: Finding dark/black frames in videos
- Label Detection: Identifying objects, people, activities in videos using AWS Rekognition  
- Text Recognition: Extracting text from video frames
- Video Analysis: Complete analysis combining multiple detection methods

{video_context}

Users can upload videos and run analysis jobs. Be helpful and answer questions about their analyzed videos.
If users ask about content like cars, objects, or text, refer to their analyzed video data above.
If they have no analyzed videos, explain they need to upload and analyze videos first.
"""

        # Prepare the request for Claude 3 Haiku
        request_body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 150,  # Reduced for faster responses
            "system": system_prompt,
            "messages": [
                {
                    "role": "user",
                    "content": message
                }
            ],
            "temperature": 0.7,
            "top_p": 0.9
        }
        
        # Call Bedrock with timeout protection
        import asyncio
        try:
            # Get timeout from environment variable, default to 20 seconds (Load Balancer safe)
            bedrock_timeout = float(os.getenv('BEDROCK_TIMEOUT', '20.0'))
            
            print(f"[DIAGNOSTIC] Calling Bedrock with {len(video_context)} chars of video context")
            print(f"[DIAGNOSTIC] Message: {message[:100]}...")
            print(f"[DIAGNOSTIC] Using timeout: {bedrock_timeout} seconds")
            
            response = await asyncio.wait_for(
                asyncio.to_thread(
                    bedrock.invoke_model,
                    modelId="anthropic.claude-3-haiku-20240307-v1:0",  # Cost-optimized model
                    body=json.dumps(request_body),
                    contentType="application/json"
                ),
                timeout=bedrock_timeout  # Configurable timeout via environment variable
            )
            print(f"[DIAGNOSTIC] Bedrock responded successfully")
        except asyncio.TimeoutError:
            bedrock_timeout = float(os.getenv('BEDROCK_TIMEOUT', '20.0'))
            logger.error(f"Bedrock request timeout after {bedrock_timeout} seconds")
            print(f"[DIAGNOSTIC] TIMEOUT after {bedrock_timeout}s - video_context length: {len(video_context)}")
            # Intelligent fallback based on message content
            message_lower = message.lower()
            if any(word in message_lower for word in ['video', 'videos', 'autos', 'cars', 'analyse']):
                return "🎬 **Video Analysis Tip:** To find videos with specific content like cars, upload your videos first and run our **Complete Analysis**! This will detect objects, labels, and text in your videos. Then I can help you search through the analyzed content. Try uploading a video via the Dashboard!"
            else:
                return "🤖 **Quick Response:** I'm here to help with video analysis! While I process your request, try these features: **🎬 Video Analysis**, **📊 Blackframe Detection**, or **🔍 Label Recognition**. Upload a video to get started!"
        
        # Parse response
        response_body = json.loads(response['body'].read())
        
        if 'content' in response_body and len(response_body['content']) > 0:
            return response_body['content'][0]['text']
        else:
            return "🤖 I'm here to help with video analysis! Ask me about blackframe detection, label recognition, or text extraction from videos."
            
    except Exception as e:
        logger.error(f"Bedrock ChatBot error: {e}")
        # Graceful fallback to simple responses
        message_lower = message.lower()
        
        if any(word in message_lower for word in ['blackframe', 'black frame', 'dark']):
            return "🎬 Use our Blackframe Detection tool to find dark or black frames in your videos! Upload a video and select 'Detect Blackframes' to get started."
        elif any(word in message_lower for word in ['label', 'object', 'detect', 'recognize']):
            return "🏷️ Our Label Detection uses AWS Rekognition to identify objects, people, and activities in your videos. Upload a video and select 'Analyze Video Complete' for full analysis!"
        elif any(word in message_lower for word in ['text', 'ocr', 'read']):
            return "📝 We can extract text from video frames using AWS Rekognition Text Detection. Upload your video and run a complete analysis to see all detected text!"
        elif any(word in message_lower for word in ['hello', 'hi', 'help']):
            return "👋 Hi! I'm your video analysis assistant. I can help you with:\n• 🎬 Blackframe Detection\n• 🏷️ Object & Label Recognition\n• 📝 Text Extraction\n\nUpload a video to get started!"
        else:
            return f"🤖 I'm your video analysis assistant! I can help with blackframe detection, label recognition, and text extraction. What would you like to analyze? Your question: {message}"


# --- Models ---
class AgentRequest(BaseModel):
    message: str


class VideoJob(BaseModel):
    bucket: str
    key: str
    tool: str


class AnalyzeRequest(BaseModel):
    videos: List[VideoJob]


class AnalyzeResponseJob(BaseModel):
    job_id: str
    video: VideoJob


class AnalyzeResponse(BaseModel):
    jobs: List[AnalyzeResponseJob]


class JobStatusRequest(BaseModel):
    job_ids: List[str]


class JobStatusItem(BaseModel):
    job_id: str
    status: str
    result: str = None


class JobStatusResponse(BaseModel):
    statuses: List[JobStatusItem]


# --- New Models for Vector DB and ChatBot ---
class ChatRequest(BaseModel):
    message: str
    context_limit: int = 5

class ChatResponse(BaseModel):
    response: str
    matched_videos: List[Dict[str, Any]]
    context_used: int
    query: str
    timestamp: str

class SemanticSearchRequest(BaseModel):
    query: str
    limit: int = 10

class SemanticSearchResponse(BaseModel):
    results: List[Dict[str, Any]]
    query: str
    total_results: int

class VectorStatsResponse(BaseModel):
    total_videos: int
    database_type: str
    llm_provider: str = None
    available: bool

@app.get("/")
async def root():
    return {"status": "healthy", "service": "proovid-backend"}

# --- Health ---
@app.get("/health")
async def health():
    return {"status": "ok"}

# CORS preflight for /ask (supports both GET and POST)
@app.options("/ask")
async def options_ask(request: Request):
    return Response(
        status_code=200,
        headers={
            "Access-Control-Allow-Origin": request.headers.get("origin", "*"),
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
            "Access-Control-Allow-Headers": request.headers.get(
                "access-control-request-headers", "*"
            ),
            "Access-Control-Allow-Credentials": "true",
        },
    )


# --- Ask endpoint (synchronous agent call) ---
@app.post("/ask")
async def ask_agent(
    request: AgentRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    try:
        # Direct AWS Bedrock ChatBot implementation with video context
        user_id = current_user.get("user_id", "unknown")
        response = await call_bedrock_chatbot(request.message, user_id)
        return {"response": str(response)}
    except Exception as e:
        logger.exception("bedrock chatbot error")
        # Fallback to placeholder if Bedrock fails
        response = f"🚧 ChatBot temporarily unavailable. Meanwhile, you can use Blackframe Detection! Your question was: {request.message}"
        return {"response": str(response)}

# --- Ask endpoint via GET for CloudFront compatibility ---
@app.get("/ask")
async def ask_agent_get(
    message: str = Query(..., description="Message to ask the agent"),
    current_user: Dict[str, Any] = Depends(get_current_user),
    request: Request = None
):
    try:
        # Direct AWS Bedrock ChatBot implementation with video context
        user_id = current_user.get("user_id", "unknown")
        response = await call_bedrock_chatbot(message, user_id)
        
        # Return response with explicit CORS headers
        return Response(
            content=json.dumps({"response": str(response)}),
            media_type="application/json",
            headers={
                "Access-Control-Allow-Origin": request.headers.get("origin", "*") if request else "*",
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
                "Access-Control-Allow-Headers": "*",
            }
        )
    except Exception as e:
        logger.exception("bedrock chatbot error")
        # Fallback to placeholder if Bedrock fails
        response = f"🚧 ChatBot temporarily unavailable. Meanwhile, you can use Blackframe Detection! Your question was: {message}"
        return Response(
            content=json.dumps({"response": str(response)}),
            media_type="application/json",
            headers={
                "Access-Control-Allow-Origin": request.headers.get("origin", "*") if request else "*",
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Allow-Methods": "GET,POST,OPTIONS", 
                "Access-Control-Allow-Headers": "*",
            }
        )


# --- S3 listing --- 
@app.get("/list-videos")
async def list_videos(
    prefix: str = Query("", description="S3 prefix"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    bucket = cfg("AWS_S3_BUCKET", "christian-aws-development")
    s3 = get_s3_client()
    try:
        resp = s3.list_objects_v2(Bucket=bucket, Prefix=prefix, MaxKeys=100, Delimiter="/")
        items = []
        
        # Add regular files
        for o in resp.get("Contents", []):
            items.append({"bucket": bucket, "key": o["Key"], "size": o["Size"]})
        
        # Add directories from CommonPrefixes
        for cp in resp.get("CommonPrefixes", []):
            items.append({"bucket": bucket, "key": cp["Prefix"], "size": 0, "is_directory": True})
        
        return items
    except ClientError as e:
        logger.exception("list_videos failed")
        raise HTTPException(status_code=500, detail=str(e))


# --- Generate signed URL for video streaming ---
@app.get("/video-url/{bucket}/{key:path}")
async def get_video_url(
    bucket: str,
    key: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Generate a signed URL for video streaming"""
    s3 = get_s3_client()
    try:
        # Generate signed URL valid for 1 hour
        signed_url = s3.generate_presigned_url(
            'get_object',
            Params={'Bucket': bucket, 'Key': key},
            ExpiresIn=3600  # 1 hour
        )
        return {"url": signed_url}
    except ClientError as e:
        logger.exception("get_video_url failed")
        raise HTTPException(status_code=500, detail=str(e))


# --- Agent launcher (direct execution) ---
def store_analysis_in_vector_db(job_id: str, video_metadata: Dict[str, Any], analysis_results: Dict[str, Any]):
    """
    Background task to store video analysis results in vector database
    """
    if not VECTOR_DB_AVAILABLE:
        logger.info("Vector DB not available, skipping vector storage")
        return
    
    try:
        if USE_COST_OPTIMIZED:
            vector_db = get_cost_optimized_vector_db()
            db_type = "cost-optimized AWS"
        elif USE_AWS_NATIVE:
            vector_db = get_aws_vector_db()
            db_type = "premium AWS"
        else:
            vector_db = get_vector_db()
            db_type = "local"
        
        vector_db.store_video_analysis(job_id, video_metadata, analysis_results)
        logger.info(f"Successfully stored job {job_id} in {db_type} vector database")
    except Exception as e:
        logger.error(f"Failed to store job {job_id} in vector DB: {e}")

def start_agent_analysis(bucket: str, key: str, job_id: str, tool: str):
    """
    Startet eine direkte Agent-Analyse ohne Worker/SQS
    """
    try:
        logger.info("Starting direct agent analysis for job %s with tool %s and file s3://%s/%s", job_id, tool, bucket, key)
        
        # Update job status to running
        table = boto3.resource("dynamodb", region_name=cfg("AWS_DEFAULT_REGION", "eu-central-1"), config=boto3_config).Table(cfg("JOB_TABLE", "proov_jobs"))
        current_time = int(time.time())
        table.update_item(
            Key={"job_id": job_id},
            UpdateExpression="SET #status = :status, updated_at = :updated_at",
            ExpressionAttributeNames={"#status": "status"},
            ExpressionAttributeValues={
                ":status": "running",
                ":updated_at": current_time
            }
        )
        
        # Create agent message based on tool
        if tool == "detect_blackframes":
            message = f"Can you find black frames in the video '{key}' from bucket '{bucket}'?"
        elif tool == "rekognition_detect_text":
            message = f"What text can you detect in the video '{key}' from bucket '{bucket}'?"
        elif tool == "rekognition_detect_labels":
            message = f"Can you detect labels and objects in the video '{key}' from bucket '{bucket}' using AWS Rekognition?"
        elif tool == "analyze_video_complete":
            message = f"Can you perform a complete video analysis (blackframes, text detection, and label detection) on video '{key}' from bucket '{bucket}'?"
        else:
            message = f"Can you analyze the video '{key}' from bucket '{bucket}' using tool '{tool}'?"
        
        # Execute agent analysis - placeholder (agent framework removed)
        logger.info("Executing agent with message: %s", message)
        response = f"🚧 Video analysis is being processed by worker. Job ID: {job_id}. Use /jobs endpoint to check status."
        logger.info("Agent placeholder response for job %s", job_id)
        
        # Parse analysis results for vector storage
        try:
            if isinstance(response, str):
                analysis_results = json.loads(response) if response.startswith('{') else {"raw_result": response}
            else:
                analysis_results = response
        except (json.JSONDecodeError, TypeError):
            analysis_results = {"raw_result": str(response)}
        
        # Update job with results
        current_time = int(time.time())
        table.update_item(
            Key={"job_id": job_id},
            UpdateExpression="SET #status = :status, results = :results, updated_at = :updated_at",
            ExpressionAttributeNames={"#status": "status"},
            ExpressionAttributeValues={
                ":status": "completed",
                ":results": str(response),
                ":updated_at": current_time
            }
        )
        
        # Store in vector database for semantic search
        video_metadata = {"bucket": bucket, "key": key, "tool": tool}
        store_analysis_in_vector_db(job_id, video_metadata, analysis_results)
        
        logger.info("Job %s completed successfully with agent", job_id)
        
    except Exception as e:
        logger.exception("Agent analysis failed for job %s: %s", job_id, str(e))
        # Update job status to error
        try:
            current_time = int(time.time())
            table.update_item(
                Key={"job_id": job_id},
                UpdateExpression="SET #status = :status, error = :error, updated_at = :updated_at",
                ExpressionAttributeNames={"#status": "status"},
                ExpressionAttributeValues={
                    ":status": "error",
                    ":error": str(e),
                    ":updated_at": current_time
                }
            )
        except:
            logger.exception("Failed to update job %s error status", job_id)


# --- New Endpoints: Semantic Search & ChatBot ---

@app.post("/chat", response_model=ChatResponse)
async def chat_with_videos(
    request: ChatRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Chat with AI about video content using integrated video analysis
    """
    try:
        # Use our integrated Bedrock ChatBot with video analysis
        user_id = current_user.get("sub", "anonymous")
        response_text = await call_bedrock_chatbot(request.message, user_id)
        
        # For now, return empty matched_videos since we're using integrated analysis
        return ChatResponse(
            response=response_text,
            matched_videos=[],
            context_used=1 if "analyzed videos" in response_text.lower() else 0,
            query=request.message,
            timestamp=time.strftime("%Y-%m-%dT%H:%M:%S.%fZ")
        )
        
    except Exception as e:
        logger.exception("Chat request failed")
        raise HTTPException(status_code=500, detail=f"Chat processing failed: {str(e)}")


@app.post("/semantic-search", response_model=SemanticSearchResponse)
async def semantic_search_videos(
    request: SemanticSearchRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Perform semantic search across video metadata
    """
    if not VECTOR_DB_AVAILABLE:
        raise HTTPException(
            status_code=503, 
            detail="Vector database features are not available"
        )
    
    try:
        if USE_COST_OPTIMIZED:
            vector_db = get_cost_optimized_vector_db()
        elif USE_AWS_NATIVE:
            vector_db = get_aws_vector_db()
        else:
            vector_db = get_vector_db()
        
        results = vector_db.semantic_search(request.query, request.limit)
        
        return SemanticSearchResponse(
            results=results,
            query=request.query,
            total_results=len(results)
        )
        
    except Exception as e:
        logger.exception("Semantic search failed")
        raise HTTPException(status_code=500, detail=f"Semantic search failed: {str(e)}")

# Universal CORS preflight for ALL endpoints
@app.options("/{path:path}")
async def universal_options(request: Request, path: str):
    return Response(status_code=200, headers={
        "Access-Control-Allow-Origin": "https://ui.proovid.de",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Expose-Headers": "*",
        "Access-Control-Allow-Credentials": "true"
    })

# CORS preflight for /chat/suggestions
@app.options("/chat/suggestions")
async def options_chat_suggestions(request: Request):
    return Response(status_code=200, headers={
        "Access-Control-Allow-Origin": "https://ui.proovid.de",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Expose-Headers": "*",
        "Access-Control-Allow-Credentials": "true"
    })

@app.get("/chat/suggestions")
async def get_chat_suggestions(current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    Get example questions users can ask the chatbot
    """
    if not VECTOR_DB_AVAILABLE:
        raise HTTPException(status_code=503, detail="Chatbot features are not available")
    
    try:
        # Provide static suggestions for all AWS implementations
        if USE_COST_OPTIMIZED or USE_AWS_NATIVE:
            suggestions = [
                "Zeig mir Videos mit Autos",
                "Welche Videos haben eine Person in roten Kleidung?", 
                "Finde Videos mit Text-Einblendungen",
                "Gibt es Videos mit Blackframes?",
                "Zeig mir Videos mit Sport-Aktivitäten",
                "Welche Videos enthalten BMW Text?",
                "Finde Videos mit Personen",
                "Gibt es Videos in der Natur?",
                "Zeig mir alle analysierten Videos",
                "Welche Videos haben die meisten Labels?"
            ]
        else:
            chatbot = get_chatbot()
            suggestions = chatbot.get_suggestions()
        return {"suggestions": suggestions}
    except Exception as e:
        logger.exception("Failed to get chat suggestions")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/vector-db/stats", response_model=VectorStatsResponse)
async def get_vector_db_stats(current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    Get vector database statistics
    """
    if not VECTOR_DB_AVAILABLE:
        return VectorStatsResponse(
            total_videos=0,
            database_type="none",
            available=False
        )
    
    try:
        if USE_COST_OPTIMIZED:
            chatbot = get_cost_optimized_chatbot()
        elif USE_AWS_NATIVE:
            chatbot = get_aws_chatbot()
        else:
            vector_db = get_vector_db()
            chatbot = get_chatbot()
        
        stats = chatbot.get_stats()
        
        return VectorStatsResponse(
            total_videos=stats["total_videos"],
            database_type=stats["database_type"],
            llm_provider=stats["llm_provider"],
            available=stats["available"]
        )
        
    except Exception as e:
        logger.exception("Failed to get vector DB stats")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/vector-db/reindex")
async def reindex_existing_jobs(
    background_tasks: BackgroundTasks,
    current_user: Dict[str, Any] = Depends(require_admin)  # Only admins can reindex
):
    """
    Reindex existing completed jobs into vector database
    """
    if not VECTOR_DB_AVAILABLE:
        raise HTTPException(status_code=503, detail="Vector database features are not available")
    
    try:
        # Get all completed jobs from DynamoDB
        table = job_table()
        resp = table.scan()
        items = resp.get("Items", [])
        
        completed_jobs = [
            item for item in items 
            if item.get("status") in ("completed", "done") 
            and item.get("result") or item.get("analysis_results")
        ]
        
        # Start background reindexing
        background_tasks.add_task(reindex_jobs_background, completed_jobs)
        
        return {
            "message": f"Started reindexing {len(completed_jobs)} completed jobs",
            "job_count": len(completed_jobs)
        }
        
    except Exception as e:
        logger.exception("Reindexing failed")
        raise HTTPException(status_code=500, detail=str(e))


def reindex_jobs_background(completed_jobs: List[Dict[str, Any]]):
    """Background task to reindex existing jobs"""
    if not VECTOR_DB_AVAILABLE:
        return
        
    if USE_COST_OPTIMIZED:
        vector_db = get_cost_optimized_vector_db()
    elif USE_AWS_NATIVE:
        vector_db = get_aws_vector_db()
    else:
        vector_db = get_vector_db()
    
    reindexed_count = 0
    
    for job in completed_jobs:
        try:
            job_id = job.get("job_id")
            if not job_id:
                continue
            
            # Extract video metadata
            video_data = job.get("video", {})
            if isinstance(video_data, str):
                try:
                    video_data = json.loads(video_data)
                except json.JSONDecodeError:
                    video_data = {}
            
            video_metadata = {
                "bucket": video_data.get("bucket") or job.get("s3_bucket", ""),
                "key": video_data.get("key") or job.get("s3_key", ""),
                "tool": video_data.get("tool", "unknown")
            }
            
            # Extract analysis results
            result_raw = job.get("analysis_results") or job.get("result", "{}")
            try:
                if isinstance(result_raw, str):
                    analysis_results = json.loads(result_raw) if result_raw.startswith('{') else {"raw_result": result_raw}
                else:
                    analysis_results = result_raw
            except (json.JSONDecodeError, TypeError):
                analysis_results = {"raw_result": str(result_raw)}
            
            # Store in vector database
            vector_db.store_video_analysis(job_id, video_metadata, analysis_results)
            reindexed_count += 1
            
            logger.info(f"Reindexed job {job_id} ({reindexed_count}/{len(completed_jobs)})")
            
        except Exception as e:
            logger.error(f"Failed to reindex job {job.get('job_id', 'unknown')}: {e}")
            continue
    
    logger.info(f"Reindexing completed. Successfully reindexed {reindexed_count}/{len(completed_jobs)} jobs")

# --- Worker launcher (legacy SQS approach) ---
def start_worker_container(bucket: str, key: str, job_id: str, tool: str):
    # Enqueue job to SQS for on-demand worker processing
    # Construct the file_url that the worker expects
    file_url = f"https://{bucket}.s3.eu-central-1.amazonaws.com/{key}"
    
    agent_args = {
        "file_url": file_url,
        "bucket": bucket, 
        "s3_key": key
    }

    # Default SQS URL - use the hardcoded one we know works
    sqs_url = "https://sqs.eu-central-1.amazonaws.com/851725596604/proov-worker-queue"
    
    # Try config first, then fall back to hardcoded
    config_sqs_url = cfg("SQS_QUEUE_URL", "")
    if config_sqs_url:
        sqs_url = config_sqs_url
    elif os.environ.get("SQS_QUEUE_URL"):
        sqs_url = os.environ.get("SQS_QUEUE_URL")

    sqs = boto3.client("sqs", region_name=cfg("AWS_DEFAULT_REGION", "eu-central-1"), config=boto3_config)
    body = {
        "job_id": job_id,
        "tool": tool,
        "agent_args": agent_args,
    }
    logger.info("Enqueuing job %s to SQS %s with tool %s and file_url %s", job_id, sqs_url, tool, file_url)
    try:
        sqs.send_message(QueueUrl=sqs_url, MessageBody=json.dumps(body))
        logger.info("Successfully enqueued job %s to SQS", job_id)
    except Exception as e:
        logger.exception("Failed to send SQS message for job %s: %s", job_id, e)
        raise


# --- Analyze endpoint: start workers in background ---
@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze_videos(
    request: AnalyzeRequest, 
    background_tasks: BackgroundTasks,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    logger.info("=== ANALYZE REQUEST DEBUG ===")
    logger.info(f"Request: {request}")
    logger.info(f"Videos count: {len(request.videos)}")
    for i, video in enumerate(request.videos):
        logger.info(f"Video {i}: bucket={video.bucket}, key={video.key}, tool={video.tool}")
    logger.info("===============================")
    
    jobs: List[AnalyzeResponseJob] = []
    for video in request.videos:
        job_id = str(uuid.uuid4())
        logger.info(f"Creating job {job_id} with tool: {video.tool}")
        # Save job entry to DynamoDB with correct status field
        save_job_entry(job_id, "queued", video=video.dict())
        # Use direct agent analysis for new label detection features
        if video.tool == "rekognition_detect_labels":
            background_tasks.add_task(
                start_agent_analysis, video.bucket, video.key, job_id, video.tool
            )
        else:
            # Use worker for other tools
            background_tasks.add_task(
                start_worker_container, video.bucket, video.key, job_id, video.tool
            )
        jobs.append(AnalyzeResponseJob(job_id=job_id, video=video))
    return AnalyzeResponse(jobs=jobs)


# --- Job status via search (avoid client.get with id, not supported in AOSS) ---
@app.post("/job-status", response_model=JobStatusResponse)
def job_status(request: JobStatusRequest):
    # DynamoDB-backed job status lookup
    t = job_table()
    statuses: List[JobStatusItem] = []
    for job_id in request.job_ids:
        try:
            resp = t.get_item(Key={"job_id": job_id})
            item = resp.get("Item")
            if not item:
                statuses.append(JobStatusItem(job_id=job_id, status="not_found", result=""))
                continue
            result = item.get("result", "")
            # Prefer 'status' field, fallback to 'job_status' for legacy jobs
            status_value = item.get("status") or item.get("job_status", "unknown")
            statuses.append(JobStatusItem(job_id=job_id, status=status_value, result=str(result)))
        except Exception:
            logger.exception("job_status ddb failed for %s", job_id)
            statuses.append(JobStatusItem(job_id=job_id, status="error", result=""))
    return JobStatusResponse(statuses=statuses)


# --- Jobs endpoints for polling (Option B) ---
@app.get("/jobs")
async def list_jobs(current_user: Dict[str, Any] = Depends(get_current_user)):
    # Scan DynamoDB table for job items (small-scale; for large scale use queries with indexes)
    t = job_table()
    try:
        resp = t.scan(Limit=1000)
    except Exception as e:
        logger.exception("list_jobs ddb scan failed")
        raise HTTPException(status_code=500, detail=f"DynamoDB error: {e}")
    items = resp.get("Items", [])
    # normalize items to expected shape
    out = []
    for it in items:
        # Prefer 'status' field, fallback to 'job_status' for legacy jobs
        status_value = it.get("status") or it.get("job_status")
        job_entry = {
            "job_id": it.get("job_id"), 
            "status": status_value, 
            "result": it.get("analysis_results") or it.get("result"),
            "created_at": it.get("created_at"),  # Unix timestamp
            "updated_at": it.get("updated_at"),  # Unix timestamp 
            "latest_doc": it
        }
        
        # Add video information directly to job entry for easier frontend access
        video_data = it.get("video")
        if video_data:
            if isinstance(video_data, str):
                try:
                    video_parsed = json.loads(video_data)
                    job_entry["video"] = video_parsed
                except json.JSONDecodeError:
                    job_entry["video"] = video_data
            else:
                job_entry["video"] = video_data
        
        # Also add s3_key if available
        s3_key = it.get("s3_key")
        if s3_key:
            job_entry["s3_key"] = s3_key
            
        out.append(job_entry)
    return out


@app.get("/jobs/{job_id}/results")
async def get_job_results_formatted(
    job_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Return formatted job results for beautiful frontend display
    Supports both full and partial job IDs
    """
    t = job_table()
    
    # If job_id is short (< 20 chars), scan for matching job
    if len(job_id) < 20:
        try:
            resp = t.scan()
            items = resp.get("Items", [])
            matching_item = None
            for item in items:
                if item.get("job_id", "").startswith(job_id):
                    matching_item = item
                    job_id = item.get("job_id")  # Use full job_id
                    break
            if not matching_item:
                raise HTTPException(status_code=404, detail="Job not found")
            item = matching_item
        except Exception as e:
            logger.exception("get_job_results_formatted scan failed for %s", job_id)
            raise HTTPException(status_code=500, detail=f"DynamoDB error: {e}")
    else:
        # Use direct lookup for full job IDs
        try:
            resp = t.get_item(Key={"job_id": job_id})
            item = resp.get("Item")
            if not item:
                raise HTTPException(status_code=404, detail="Job not found")
        except Exception as e:
            logger.exception("get_job_results_formatted ddb failed for %s", job_id)
            raise HTTPException(status_code=500, detail=f"DynamoDB error: {e}")
    
    status = item.get("status")
    if status not in ("done", "completed"):
        raise HTTPException(status_code=400, detail=f"Job not completed yet (status: {status})")
    
    # Parse the result - check multiple possible fields
    result_raw = item.get("analysis_results") or item.get("result", "{}")
    try:
        if isinstance(result_raw, str):
            result = json.loads(result_raw)
        else:
            result = result_raw
    except json.JSONDecodeError:
        result = {"raw_result": result_raw}
    
    # Extract video information from multiple sources
    video_data = item.get("video", {})
    if isinstance(video_data, str):
        try:
            video_data = json.loads(video_data)
        except json.JSONDecodeError:
            video_data = {}
    
    # Extract bucket/key from multiple sources
    file_url = item.get("file_url", "")
    bucket = item.get("s3_bucket")  # First try direct fields
    key = item.get("s3_key")
    tool_name = item.get("tool", "")
    
    if file_url:
        # Parse S3 URL to extract bucket and key
        if file_url.startswith("s3://"):
            s3_path = file_url[5:]  # Remove s3://
            parts = s3_path.split("/", 1)
            if len(parts) == 2:
                bucket, key = parts
        elif "s3" in file_url and ".amazonaws.com" in file_url:
            # Parse HTTPS S3 URL: https://bucket.s3.region.amazonaws.com/key
            import re
            match = re.match(r'https://([^.]+)\.s3\.[^.]+\.amazonaws\.com/(.+)', file_url)
            if match:
                bucket, key = match.groups()
    
    # If bucket/key still not set, try from video_data
    if not bucket or not key:
        if video_data.get("bucket"):
            bucket = video_data.get("bucket")
        if video_data.get("key"):
            key = video_data.get("key")
    
    # Use video_data for tool if not set
    if video_data.get("tool"):
        tool_name = video_data.get("tool")
    
    # Extract video metadata from result
    video_metadata = {}
    if isinstance(result, dict) and "video_metadata" in result:
        vm = result["video_metadata"]
        video_metadata = {
            "duration": vm.get("duration_seconds"),
            "fps": vm.get("fps"),
            "total_frames": vm.get("total_frames"),
            "filename": key,
            "format": "mp4",  # Default assumption
            "resolution": f"{vm.get('width', 'N/A')}x{vm.get('height', 'N/A')}" if vm.get('width') and vm.get('height') else None
        }
    
    # Format for frontend display
    formatted_result = {
        "job_id": job_id,
        "status": status,
        "video_info": {
            "bucket": bucket,
            "key": key,
            "tool": tool_name,
            "s3_url": file_url,
            "filename": key if key else "Unknown",
            **video_metadata
        },
        "analysis_results": result,
        "has_blackframes": item.get("has_blackframes", False),
        "has_text_detection": item.get("has_text_detection", False),
        "summary": {}
    }
    
    # Get summary from DynamoDB first if available
    ddb_summary = item.get("summary", {})
    if ddb_summary:
        # Handle DynamoDB Map format
        if isinstance(ddb_summary, dict) and 'M' in ddb_summary:
            # DynamoDB Map format - extract values
            summary_map = ddb_summary['M']
            formatted_result["summary"] = {
                "blackframes_count": int(summary_map.get("blackframes_count", {}).get("N", 0)),
                "text_detections_count": int(summary_map.get("text_detections_count", {}).get("N", 0)),
                "analysis_type": summary_map.get("analysis_type", {}).get("S", "basic")
            }
        else:
            # Already processed format
            formatted_result["summary"] = {
                "blackframes_count": ddb_summary.get("blackframes_count", 0),
                "text_detections_count": ddb_summary.get("text_detections_count", 0),
                "analysis_type": ddb_summary.get("analysis_type", "basic")
            }
    else:
        # Fallback to default values
        formatted_result["summary"] = {
            "blackframes_count": 0,
            "text_detections_count": 0,
            "analysis_type": "basic"
        }
    
    # Check if this is a complete analysis result
    if isinstance(result, dict):
        # Handle complete analysis results (from analyze_video_complete tool)
        if "blackframes" in result and "text_detection" in result:
            formatted_result["has_blackframes"] = True
            formatted_result["has_text_detection"] = True
            formatted_result["summary"]["analysis_type"] = "complete"
            
            # Extract blackframes data
            blackframes_data = result.get("blackframes", {})
            if isinstance(blackframes_data, dict):
                formatted_result["summary"]["blackframes_count"] = blackframes_data.get("blackframes_detected", 0)
                black_frames_list = blackframes_data.get("black_frames", [])
                
                formatted_result["blackframes"] = {
                    "count": blackframes_data.get("blackframes_detected", 0),
                    "total_frames": blackframes_data.get("video_metadata", {}).get("total_frames", 0),
                    "frames": [
                        {
                            "frame": bf.get("frame_number"),
                            "timestamp": bf.get("timestamp"),
                            "brightness": bf.get("brightness", 0) * 255  # Convert to 0-255 scale
                        }
                        for bf in black_frames_list
                    ]
                }
            
            # Extract text detection data
            text_data = result.get("text_detection", {})
            if isinstance(text_data, dict):
                text_detections = text_data.get("text_detections", [])
                formatted_result["summary"]["text_detections_count"] = len(text_detections)
                
                formatted_result["text_detection"] = {
                    "count": len(text_detections),
                    "texts": [
                        {
                            "text": td.get("DetectedText", ""),
                            "confidence": td.get("Confidence", 0) / 100.0,  # Convert to 0-1 scale
                            "timestamp": td.get("Timestamp", 0),
                            "boundingBox": td.get("Geometry", {}).get("BoundingBox") if td.get("Geometry") else None
                        }
                        for td in text_detections
                    ]
                }
        
        # Handle blackframes-only results (from detect_blackframes tool)
        elif "count" in result and "frames" in result and "total_frames" in result:
            formatted_result["has_blackframes"] = True
            formatted_result["summary"]["analysis_type"] = "blackframes_only"
            
            blackframes_count = result.get("count", 0)
            black_frames_list = result.get("frames", [])
            formatted_result["summary"]["blackframes_count"] = blackframes_count
            
            # Convert black_frames to frontend format
            formatted_result["blackframes"] = {
                "count": blackframes_count,
                "total_frames": result.get("total_frames", 0),
                "frames": [
                    {
                        "frame": bf.get("frame"),
                        "timestamp": bf.get("timestamp"),
                        "brightness": bf.get("brightness", 0)  # Already in correct scale from agent
                    }
                    for bf in black_frames_list
                ]
            }
        
        # Handle text detection-only results (from rekognition_detect_text tool)  
        elif "texts" in result and "count" in result:
            formatted_result["has_text_detection"] = True
            formatted_result["summary"]["analysis_type"] = "text_only"
            
            text_detections = result.get("texts", [])
            formatted_result["summary"]["text_detections_count"] = len(text_detections)
            
            # Convert text detections to frontend format
            formatted_result["text_detection"] = {
                "count": len(text_detections),
                "texts": [
                    {
                        "text": td.get("text", ""),
                        "confidence": td.get("confidence", 0) / 100.0 if td.get("confidence", 0) > 1 else td.get("confidence", 0),  # Already in 0-1 scale
                        "timestamp": td.get("timestamp", 0),
                        "boundingBox": td.get("bbox") if td.get("bbox") else None
                    }
                    for td in text_detections
                ]
            }
    
    return formatted_result


@app.get("/jobs/{job_id}")
async def get_job(
    job_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Return latest document for a single job_id.
    Supports both full and partial job IDs.
    """
    t = job_table()
    
    # If job_id is short (< 20 chars), scan for matching job
    if len(job_id) < 20:
        try:
            resp = t.scan()
            items = resp.get("Items", [])
            matching_item = None
            for item in items:
                if item.get("job_id", "").startswith(job_id):
                    matching_item = item
                    job_id = item.get("job_id")  # Use full job_id
                    break
            if not matching_item:
                raise HTTPException(status_code=404, detail="Job not found")
            item = matching_item
        except Exception as e:
            logger.exception("get_job scan failed for %s", job_id)
            raise HTTPException(status_code=500, detail=f"DynamoDB error: {e}")
    else:
        # Use direct lookup for full job IDs
        try:
            resp = t.get_item(Key={"job_id": job_id})
            item = resp.get("Item")
            if not item:
                raise HTTPException(status_code=404, detail="Job not found")
        except Exception as e:
            logger.exception("get_job ddb failed for %s", job_id)
            raise HTTPException(status_code=500, detail=f"DynamoDB error: {e}")
    
    return {"job_id": job_id, "status": item.get("status"), "result": item.get("analysis_results") or item.get("result"), "latest_doc": item}


# --- Job Management Endpoints ---
@app.delete("/jobs/{job_id}")
async def delete_job(
    job_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Delete a job from DynamoDB"""
    t = job_table()
    try:
        resp = t.delete_item(Key={"job_id": job_id})
        logger.info(f"Job {job_id} deleted by user {current_user['username']}")
        return {"message": f"Job {job_id} deleted successfully"}
    except Exception as e:
        logger.exception("delete_job failed for %s", job_id)
        raise HTTPException(status_code=500, detail=f"DynamoDB error: {e}")


@app.post("/jobs/{job_id}/restart")
async def restart_job(
    job_id: str,
    background_tasks: BackgroundTasks,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Restart a job by resetting its status and re-enqueueing it"""
    t = job_table()
    try:
        # Get the existing job
        resp = t.get_item(Key={"job_id": job_id})
        item = resp.get("Item")
        if not item:
            raise HTTPException(status_code=404, detail="Job not found")
        
        # Extract video information for restart
        video_data = item.get("video")
        if video_data:
            if isinstance(video_data, str):
                try:
                    video_info = json.loads(video_data)
                except json.JSONDecodeError:
                    raise HTTPException(status_code=400, detail="Invalid video data in job")
            else:
                video_info = video_data
        else:
            raise HTTPException(status_code=400, detail="No video information found in job")
        
        # Reset job status
        save_job_entry(job_id, "queued", video=video_info)
        
        # Re-enqueue the job
        bucket = video_info.get("bucket")
        key = video_info.get("key") 
        tool = video_info.get("tool", "detect_blackframes")
        
        if bucket and key:
            background_tasks.add_task(start_worker_container, bucket, key, job_id, tool)
            logger.info(f"Job {job_id} restarted by user {current_user['username']}")
            return {"message": f"Job {job_id} restarted successfully"}
        else:
            raise HTTPException(status_code=400, detail="Missing bucket or key information")
            
    except Exception as e:
        logger.exception("restart_job failed for %s", job_id)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/jobs/test")
async def create_test_job(
    background_tasks: BackgroundTasks,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Create a test job with a predefined video for testing purposes"""
    job_id = str(uuid.uuid4())
    
    # Test video configuration
    test_video = {
        "bucket": "christian-aws-development",
        "key": "210518_G26M_M2_45Sec_16x9_ENG_Webmix.mp4",
        "tool": "detect_blackframes"
    }
    
    # Save job entry
    save_job_entry(job_id, "queued", video=test_video)
    
    # Start worker
    background_tasks.add_task(
        start_worker_container, 
        test_video["bucket"], 
        test_video["key"], 
        job_id, 
        test_video["tool"]
    )
    
    logger.info(f"Test job {job_id} created by user {current_user['username']}")
    
    return {
        "message": "Test job created successfully",
        "job_id": job_id,
        "video": test_video
    }


# --- ZIP File Processing ---
class UnzipJob(BaseModel):
    bucket: str
    key: str

@app.post("/unzip")
async def unzip_files(
    jobs: List[UnzipJob],
    background_tasks: BackgroundTasks,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Unzip files and upload extracted contents back to S3"""
    if not jobs:
        raise HTTPException(status_code=400, detail="No ZIP files provided")
    
    job_ids = []
    for zip_job in jobs:
        # Validate that the file is a ZIP file
        if not zip_job.key.lower().endswith('.zip'):
            raise HTTPException(status_code=400, detail=f"File {zip_job.key} is not a ZIP file")
        
        # Create unique job ID for this unzip operation
        job_id = str(uuid.uuid4())
        
        # Save job entry with ZIP file info
        zip_info = {
            "bucket": zip_job.bucket,
            "key": zip_job.key,
            "tool": "unzip_files"
        }
        
        # Create job entry with proper fields for frontend display
        table = job_table()
        current_time = int(time.time())
        
        # Extract filename from key for display
        file_name = zip_job.key.split('/')[-1] if '/' in zip_job.key else zip_job.key
        
        job_entry = {
            "job_id": job_id,
            "status": "queued",
            "job_type": "unzip",
            "file_name": file_name,
            "s3_bucket": zip_job.bucket,
            "s3_key": zip_job.key,
            "file_url": f"s3://{zip_job.bucket}/{zip_job.key}",
            "video": zip_info,
            "created_at": current_time,
            "updated_at": current_time
        }
        # Always remove job_status if present (legacy)
        job_entry.pop("job_status", None)
        table.put_item(Item=job_entry)
        
        # Start background task for unzipping
        background_tasks.add_task(process_zip_file, zip_job.bucket, zip_job.key, job_id)
        job_ids.append(job_id)
        
        logger.info(f"Unzip job {job_id} created for {zip_job.key} by user {current_user['username']}")
    
    return {
        "message": f"Started {len(jobs)} unzip job(s)",
        "job_ids": job_ids
    }


def process_zip_file(bucket: str, key: str, job_id: str):
    """Background task to download, unzip, and re-upload ZIP file contents"""
    try:
        # Initialize DynamoDB table
        table = boto3.resource("dynamodb", region_name=cfg("AWS_DEFAULT_REGION", "eu-central-1"), config=boto3_config).Table(cfg("JOB_TABLE", "proov_jobs"))
        
        logger.info(f"Starting unzip process for {key} (job {job_id})")
        
        # Update job status to processing
        current_time = int(time.time())
        table.update_item(
            Key={"job_id": job_id},
            UpdateExpression="SET #status = :status, updated_at = :updated_at REMOVE job_status",
            ExpressionAttributeNames={"#status": "status"},
            ExpressionAttributeValues={
                ":status": "processing",
                ":updated_at": current_time
            }
        )
        
        import tempfile
        import zipfile
        import os
        
        s3 = get_s3_client()
        
        # Create temporary directory for processing
        with tempfile.TemporaryDirectory() as temp_dir:
            zip_path = os.path.join(temp_dir, "archive.zip")
            
            # Download ZIP file from S3
            logger.info(f"Downloading {key} from S3...")
            s3.download_file(bucket, key, zip_path)
            
            # Extract ZIP file
            extract_dir = os.path.join(temp_dir, "extracted")
            os.makedirs(extract_dir, exist_ok=True)
            
            extracted_files = []
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                # Get list of files in the ZIP
                file_list = zip_ref.namelist()
                logger.info(f"ZIP contains {len(file_list)} files")
                
                # Extract all files with password support
                try:
                    zip_ref.extractall(extract_dir)
                except RuntimeError as e:
                    if "password" in str(e).lower() or "encrypted" in str(e).lower():
                        logger.info("ZIP is encrypted, trying with default password")
                        zip_ref.extractall(extract_dir, pwd=b"EdgesG26_2020!")
                    else:
                        raise
                
                # Upload each extracted file back to S3
                for file_name in file_list:
                    if not file_name.endswith('/'):  # Skip directories
                        local_file_path = os.path.join(extract_dir, file_name)
                        
                        # Create S3 key for extracted file in same directory as ZIP
                        key_parts = key.split('/')
                        if key.endswith('.zip'):
                            # Replace .zip with extracted filename
                            key_parts[-1] = file_name
                        else:
                            # Just add filename to directory
                            key_parts.append(file_name)
                        s3_key = '/'.join(key_parts)
                        
                        if os.path.isfile(local_file_path):
                            logger.info(f"Uploading {file_name} to S3 as {s3_key}")
                            s3.upload_file(local_file_path, bucket, s3_key)
                            extracted_files.append(s3_key)
            
            # Update job with results
            result_summary = f"Successfully extracted and uploaded {len(extracted_files)} files: {', '.join(extracted_files[:10])}"
            if len(extracted_files) > 10:
                result_summary += f" and {len(extracted_files) - 10} more..."
            
            current_time = int(time.time())
            table.update_item(
                Key={"job_id": job_id},
                UpdateExpression="SET #status = :status, results = :results, updated_at = :updated_at REMOVE job_status",
                ExpressionAttributeNames={"#status": "status"},
                ExpressionAttributeValues={
                    ":status": "completed",
                    ":results": result_summary,
                    ":updated_at": current_time
                }
            )
            
            logger.info(f"Unzip job {job_id} completed successfully. Extracted {len(extracted_files)} files.")
    
    except Exception as e:
        logger.exception(f"Unzip job {job_id} failed: {str(e)}")
        
        # Update job with error status
        current_time = int(time.time())
        table.update_item(
            Key={"job_id": job_id},
            UpdateExpression="SET #status = :status, results = :results, updated_at = :updated_at REMOVE job_status",
            ExpressionAttributeNames={"#status": "status"},
            ExpressionAttributeValues={
                ":status": "failed",
                ":results": f"Unzip failed: {str(e)}",
                ":updated_at": current_time
            }
        )

# --- FINAL ATTEMPT: API Routes at END of file ---
@app.get("/api/final-test")
def api_final_test():
    return {"final": "test", "location": "end-of-file"}

@app.get("/api/health-final")  
def api_health_final():
    return {"status": "ok", "location": "end-of-file"}