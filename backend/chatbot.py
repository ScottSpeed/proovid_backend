"""
AI ChatBot mit Retrieval Augmented Generation (RAG)
Ermöglicht natürliche Sprache Anfragen über Video-Inhalte
"""

import json
import logging
from typing import List, Dict, Any, Optional
import os
from datetime import datetime

logger = logging.getLogger(__name__)

class VideoRAGChatBot:
    """
    ChatBot mit RAG für semantische Video-Suche
    Beantwortet Fragen wie: "Zeig mir Videos mit Autos" oder "Welche Videos haben Text mit BMW?"
    """
    
    def __init__(self, vector_db, llm_provider: str = "anthropic"):
        self.vector_db = vector_db
        self.llm_provider = llm_provider.lower()
        self.client = None
        self._init_llm()
    
    def _init_llm(self):
        """Initialize LLM client based on provider"""
        if self.llm_provider == "anthropic":
            self._init_anthropic()
        elif self.llm_provider == "openai":
            self._init_openai()
        elif self.llm_provider == "aws_bedrock":
            self._init_bedrock()
        else:
            raise ValueError(f"Unsupported LLM provider: {self.llm_provider}")
    
    def _init_anthropic(self):
        """Initialize Anthropic Claude"""
        try:
            import anthropic
            
            api_key = os.environ.get("ANTHROPIC_API_KEY")
            if not api_key:
                raise ValueError("ANTHROPIC_API_KEY environment variable required")
            
            self.client = anthropic.Anthropic(api_key=api_key)
            logger.info("Anthropic Claude initialized")
            
        except ImportError:
            logger.error("Anthropic not installed. Run: pip install anthropic")
            raise
    
    def _init_openai(self):
        """Initialize OpenAI GPT"""
        try:
            import openai
            
            api_key = os.environ.get("OPENAI_API_KEY")
            if not api_key:
                raise ValueError("OPENAI_API_KEY environment variable required")
            
            self.client = openai.OpenAI(api_key=api_key)
            logger.info("OpenAI GPT initialized")
            
        except ImportError:
            logger.error("OpenAI not installed. Run: pip install openai")
            raise
    
    def _init_bedrock(self):
        """Initialize AWS Bedrock"""
        try:
            import boto3
            
            self.client = boto3.client(
                'bedrock-runtime',
                region_name=os.environ.get("AWS_DEFAULT_REGION", "eu-central-1")
            )
            logger.info("AWS Bedrock initialized")
            
        except Exception as e:
            logger.error(f"Failed to initialize Bedrock: {e}")
            raise
    
    def chat(self, user_query: str, context_limit: int = 5) -> Dict[str, Any]:
        """
        Process user query and return response with video recommendations
        
        Args:
            user_query: Natural language question about videos
            context_limit: Maximum number of videos to include in context
            
        Returns:
            Dict with response, matched videos, and metadata
        """
        try:
            # Step 1: Perform vector search to find relevant videos
            search_results = self.vector_db.semantic_search(user_query, limit=context_limit)
            
            if not search_results:
                return {
                    "response": "Entschuldigung, ich konnte keine Videos finden, die zu Ihrer Anfrage passen. Möglicherweise wurden noch keine Videos analysiert oder die Suche ergab keine Treffer.",
                    "matched_videos": [],
                    "context_used": [],
                    "query": user_query,
                    "timestamp": datetime.now().isoformat()
                }
            
            # Step 2: Build context from search results
            context_videos = []
            for result in search_results:
                metadata = result.get("metadata", {})
                
                # Extract semantic tags if available
                semantic_tags = []
                if "semantic_tags" in metadata:
                    try:
                        tags_data = metadata["semantic_tags"]
                        if isinstance(tags_data, str):
                            semantic_tags = json.loads(tags_data)
                        elif isinstance(tags_data, list):
                            semantic_tags = tags_data
                    except (json.JSONDecodeError, TypeError):
                        pass
                
                video_info = {
                    "job_id": result["job_id"],
                    "video_key": metadata.get("video_key", ""),
                    "bucket": metadata.get("bucket", ""),
                    "similarity_score": round(result["score"], 3),
                    "analysis_type": metadata.get("analysis_type", "unknown"),
                    "semantic_tags": semantic_tags,
                    "has_labels": metadata.get("has_labels", False),
                    "has_text": metadata.get("has_text", False),
                    "has_blackframes": metadata.get("has_blackframes", False)
                }
                
                context_videos.append(video_info)
            
            # Step 3: Generate response using LLM
            response_text = self._generate_llm_response(user_query, context_videos)
            
            return {
                "response": response_text,
                "matched_videos": context_videos,
                "context_used": len(context_videos),
                "query": user_query,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Chat processing failed: {e}")
            return {
                "response": f"Entschuldigung, bei der Verarbeitung Ihrer Anfrage ist ein Fehler aufgetreten: {str(e)}",
                "matched_videos": [],
                "context_used": 0,
                "query": user_query,
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    def _generate_llm_response(self, user_query: str, context_videos: List[Dict]) -> str:
        """Generate LLM response based on query and context"""
        
        # Build context string
        context_text = "Verfügbare Video-Informationen:\n\n"
        
        for i, video in enumerate(context_videos, 1):
            video_name = video["video_key"].split("/")[-1] if "/" in video["video_key"] else video["video_key"]
            context_text += f"{i}. Video: {video_name}\n"
            context_text += f"   - Ähnlichkeit: {video['similarity_score']}\n"
            
            if video["semantic_tags"]:
                context_text += f"   - Inhalte: {', '.join(video['semantic_tags'][:10])}\n"
            
            if video["has_text"]:
                context_text += f"   - Enthält Text-Erkennungen\n"
                
            if video["has_blackframes"]:
                context_text += f"   - Enthält Blackframes (technische Probleme)\n"
            
            context_text += f"   - Job ID: {video['job_id'][:8]}...\n\n"
        
        # Create system prompt
        system_prompt = """Du bist ein KI-Assistent, der bei der Suche nach Videos hilft. 
        Du erhältst eine Benutzeranfrage und relevante Video-Informationen aus einer semantischen Suche.
        
        Deine Aufgaben:
        1. Beantworte die Benutzeranfrage basierend auf den verfügbaren Video-Informationen
        2. Empfehle die relevantesten Videos
        3. Erkläre, warum diese Videos zur Anfrage passen
        4. Sei hilfsreich und präzise
        5. Falls keine passenden Videos gefunden wurden, erkläre das höflich
        
        Antworte auf Deutsch und strukturiere deine Antwort übersichtlich."""
        
        user_prompt = f"""Benutzeranfrage: "{user_query}"

{context_text}

Bitte beantworte die Anfrage basierend auf den verfügbaren Video-Informationen."""
        
        # Generate response based on LLM provider
        if self.llm_provider == "anthropic":
            return self._generate_anthropic_response(system_prompt, user_prompt)
        elif self.llm_provider == "openai":
            return self._generate_openai_response(system_prompt, user_prompt)
        elif self.llm_provider == "aws_bedrock":
            return self._generate_bedrock_response(system_prompt, user_prompt)
        
        return "LLM response generation failed."
    
    def _generate_anthropic_response(self, system_prompt: str, user_prompt: str) -> str:
        """Generate response using Anthropic Claude"""
        try:
            response = self.client.messages.create(
                model="claude-3-sonnet-20240229",
                max_tokens=1000,
                temperature=0.7,
                system=system_prompt,
                messages=[
                    {"role": "user", "content": user_prompt}
                ]
            )
            
            return response.content[0].text
            
        except Exception as e:
            logger.error(f"Anthropic API error: {e}")
            return f"Fehler bei der KI-Antwort-Generierung: {str(e)}"
    
    def _generate_openai_response(self, system_prompt: str, user_prompt: str) -> str:
        """Generate response using OpenAI GPT"""
        try:
            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                max_tokens=1000,
                temperature=0.7,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ]
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            logger.error(f"OpenAI API error: {e}")
            return f"Fehler bei der KI-Antwort-Generierung: {str(e)}"
    
    def _generate_bedrock_response(self, system_prompt: str, user_prompt: str) -> str:
        """Generate response using AWS Bedrock"""
        try:
            import json
            
            # Use Claude 3 on Bedrock
            body = json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 1000,
                "temperature": 0.7,
                "system": system_prompt,
                "messages": [
                    {"role": "user", "content": user_prompt}
                ]
            })
            
            response = self.client.invoke_model(
                modelId="anthropic.claude-3-sonnet-20240229-v1:0",
                body=body
            )
            
            response_body = json.loads(response['body'].read())
            return response_body['content'][0]['text']
            
        except Exception as e:
            logger.error(f"Bedrock API error: {e}")
            return f"Fehler bei der KI-Antwort-Generierung: {str(e)}"
    
    def get_suggestions(self) -> List[str]:
        """Get example queries that users can ask"""
        return [
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
    
    def get_stats(self) -> Dict[str, Any]:
        """Get database statistics"""
        total_videos = self.vector_db.get_video_count()
        
        return {
            "total_videos": total_videos,
            "database_type": self.vector_db.db_type,
            "llm_provider": self.llm_provider,
            "available": total_videos > 0,
            "last_updated": datetime.now().isoformat()
        }


# Helper function to get configured chatbot instance
_chatbot_instance = None

def get_chatbot():
    """Get singleton chatbot instance"""
    global _chatbot_instance
    
    if _chatbot_instance is None:
        from .vector_db import get_vector_db
        
        vector_db = get_vector_db()
        llm_provider = os.environ.get("LLM_PROVIDER", "anthropic")
        
        _chatbot_instance = VideoRAGChatBot(vector_db=vector_db, llm_provider=llm_provider)
    
    return _chatbot_instance