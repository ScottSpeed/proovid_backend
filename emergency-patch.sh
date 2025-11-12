#!/bin/bash
# Quick patch for backend API - session_id support
# This patches the running container directly (temporary until proper rebuild)

echo "🔧 Emergency Backend Patch - Adding session_id support..."

# The critical changes needed:
# 1. AgentRequest class needs session_id field
# 2. call_bedrock_chatbot needs session_id parameter
# 3. smart_rag_search needs session_id parameter

cat > /tmp/api_patch.py << 'EOF'
# Patch for api.py - session_id support

# Line 958-959: Update AgentRequest
# class AgentRequest(BaseModel):
#     message: str
#     conversation_id: Optional[str] = None
#     session_id: Optional[str] = None

# Line 1049-1057: Update /ask endpoint
#     user_id = current_user.get("user_id", "unknown")
#     session_id = request.session_id
#     logger.info(f"Chat request from user {user_id} with session_id: {session_id}")
#     response = await call_bedrock_chatbot(request.message, user_id, session_id=session_id)

# Line 716: Update call_bedrock_chatbot signature
# async def call_bedrock_chatbot(message: str, user_id: str = None, session_id: str = None) -> str:

# Line 407: Update smart_rag_search signature  
# async def smart_rag_search(query: str, user_id: str = None, session_id: str = None) -> str:

# Line 441: Pass session_id to chatbot.chat
# chat_response = chatbot.chat(query, context_limit=5, user_id=user_id, session_id=session_id)

EOF

echo "✅ Patch file created. Manual deployment required:"
echo "   1. Install Docker Desktop"
echo "   2. Run: docker build -t backend-repo ."
echo "   3. Run: docker tag + docker push to ECR"
echo "   4. ECS will auto-update"
