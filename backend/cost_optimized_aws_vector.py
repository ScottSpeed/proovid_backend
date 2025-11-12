"""
Kostenoptimierte AWS Vector Database Implementation
Nutzt DynamoDB + S3 statt OpenSearch für minimale Kosten
"""

import json
import logging
import os
from typing import List, Dict, Any, Optional
import boto3
from datetime import datetime
import hashlib
import pickle
import base64

logger = logging.getLogger(__name__)

class CostOptimizedAWSVectorDB:
    """
    Kostenoptimierte AWS Vector Database
    - DynamoDB für Metadata + Simple Search
    - S3 für Vector Storage (falls nötig)  
    - Bedrock nur für Chat, nicht für jede Suche
    - Fallback auf Text-basierte Suche
    """
    
    def __init__(self):
        self.region = os.environ.get('AWS_DEFAULT_REGION', 'eu-central-1')
        self.table_name = os.environ.get('JOB_TABLE', 'proov_jobs')
        self.s3_bucket = os.environ.get('AWS_S3_BUCKET', 'christian-aws-development')
        
        self.dynamodb = boto3.resource('dynamodb', region_name=self.region)
        self.s3_client = boto3.client('s3', region_name=self.region)
        self.bedrock_client = boto3.client('bedrock-runtime', region_name=self.region)
        
        self.table = self.dynamodb.Table(self.table_name)
        self._ensure_search_index()
        
        logger.info("Cost-optimized AWS Vector DB initialized")
    
    def _ensure_search_index(self):
        """Ensure DynamoDB has GSI for searching"""
        try:
            # We'll use the existing table structure
            # Add semantic_tags as a searchable attribute
            logger.info(f"Using existing DynamoDB table: {self.table_name}")
        except Exception as e:
            logger.error(f"Error with DynamoDB table: {e}")
    
    def store_video_analysis(
        self,
        job_id: str,
        video_metadata: Dict[str, Any],
        analysis_results: Dict[str, Any],
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
    ):
        """Store video analysis in DynamoDB with searchable metadata"""
        try:
            # Extract searchable keywords
            search_keywords = []
            semantic_tags = []
            
            # Extract from video metadata
            video_key = video_metadata.get("key", "")
            bucket = video_metadata.get("bucket", "")
            
            # Add filename keywords
            filename_words = video_key.replace('/', ' ').replace('_', ' ').replace('-', ' ').split()
            search_keywords.extend([word.lower() for word in filename_words if len(word) > 2])
            
            # Extract from analysis results
            if "label_detection" in analysis_results:
                labels = analysis_results["label_detection"].get("semantic_tags", [])
                semantic_tags.extend(labels[:30])  # Limit to 30 tags
                search_keywords.extend([tag.lower() for tag in labels])
            
            # Extract text content
            text_content = []
            if "text_detection" in analysis_results:
                texts = analysis_results["text_detection"].get("text_detections", [])
                for text_item in texts:
                    text = text_item.get("text", "").strip()
                    if text:
                        text_content.append(text)
                        # Add text words as keywords
                        text_words = text.lower().split()
                        search_keywords.extend([word for word in text_words if len(word) > 2])
            
            # Create searchable content string
            searchable_content = " ".join(search_keywords[:100])  # Limit size
            
            # Prepare DynamoDB item with search fields
            current_time = int(datetime.now().timestamp())
            
            # Update existing job entry with search metadata
            # Build update with optional user/session persistence (without overwriting existing)
            update_expression = [
                "SET",
                "search_keywords = :keywords",
                "semantic_tags = :tags",
                "searchable_content = :content",
                "has_labels = :has_labels",
                "has_text = :has_text",
                "has_blackframes = :has_blackframes",
                "text_content = :text_content",
                "search_updated_at = :search_time",
            ]

            expression_values = {
                ":keywords": search_keywords[:50],  # DynamoDB list limit
                ":tags": semantic_tags,
                ":content": searchable_content,
                ":has_labels": "label_detection" in analysis_results,
                ":has_text": "text_detection" in analysis_results,
                ":has_blackframes": "blackframes" in analysis_results,
                ":text_content": text_content[:10],  # Limit text items
                ":search_time": current_time,
            }

            # If provided, ensure user/session fields are set (but don't overwrite existing)
            if user_id:
                update_expression.append("user_id = if_not_exists(user_id, :uid)")
                expression_values[":uid"] = user_id
            if session_id:
                update_expression.append("session_id = if_not_exists(session_id, :sid)")
                expression_values[":sid"] = session_id

            self.table.update_item(
                Key={"job_id": job_id},
                UpdateExpression="\n                ".join(update_expression),
                ExpressionAttributeValues=expression_values,
            )
            
            logger.info(f"Stored searchable metadata for job {job_id}")
            
        except Exception as e:
            logger.error(f"Failed to store video analysis: {e}")
            # Don't raise - this is optional functionality
    
    def semantic_search(self, query: str, limit: int = 10, user_id: str = None, session_id: str = None) -> List[Dict[str, Any]]:
        """
        Cost-optimized search using DynamoDB scan with keyword matching
        No embeddings needed - pure keyword/text matching
        
        Args:
            query: Search query
            limit: Maximum results to return
            user_id: Filter results by user_id (for multi-tenant isolation)
            session_id: Filter results by session_id (for session-specific search)
        """
        try:
            # Smart query processing - extract meaningful search terms
            query_lower = query.lower()
            query_words = query_lower.split()

            # Detect common intents up front (improves recall when keywords are generic)
            intent_text = any(w in query_lower for w in ["text", "schrift", "ocr", "kennzeichen", "license plate"])  # "Welcher Text wurde gefunden?"
            intent_blackframes = any(w in query_lower for w in ["blackframe", "black frame", "schwarze", "schwarzen", "dunkle", "dark frame", "blackframes"])  # "Gibt es Blackframes?"

            # Filter out common German question words and focus on content (keep 'text' out of stopwords!)
            stopwords = {"welche", "videos", "enthalten", "zeig", "mir", "mit", "haben", "gibt", "das", "die", "der", "den", "eine", "einen", "sind", "wie", "was", "wo", "wer", "wann", "warum"}
            
            # German-English synonym mapping with plural/singular handling
            synonyms = {
                "autos": ["car", "vehicle", "transportation", "automobile"],
                "auto": ["car", "vehicle", "transportation"], 
                "cars": ["car", "vehicle", "transportation", "automobile"],  # ADD PLURAL
                "car": ["car", "vehicle", "transportation"],
                "fahrzeug": ["car", "vehicle", "transportation"],
                "fahrzeuge": ["car", "vehicle", "transportation"],
                "personen": ["person", "people", "man", "woman", "human", "adult"],
                "person": ["person", "people", "man", "woman", "human", "adult"],
                "persons": ["person", "people", "man", "woman", "human", "adult"],  # ADD PLURAL
                "people": ["person", "people", "man", "woman", "human", "adult"],
                "leute": ["person", "people", "man", "woman", "human", "adult"],
                "menschen": ["person", "people", "man", "woman", "human", "adult"],
                "parfum": ["perfume", "fragrance", "cosmetics", "beauty"],
                "parfüm": ["perfume", "fragrance", "cosmetics", "beauty"],
                "sport": ["sports", "athletic", "fitness"],
                "straße": ["road", "street", "highway", "freeway"],
                "strasse": ["road", "street", "highway", "freeway"],
                "gebäude": ["building", "architecture", "structure"],
                "haus": ["building", "house", "architecture"],
                "natur": ["nature", "outdoors", "landscape"],
                "wasser": ["water", "aquatic", "liquid"],
                "tier": ["animal", "pet", "creature"],
                "tiere": ["animal", "pet", "creature"],
                "kleidung": ["clothing", "coat", "apparel"],
                "logo": ["logo", "emblem", "symbol", "brand"],
                "text": ["text", "writing", "license plate"],
                # Color synonyms (helps queries like 'blaues auto' / 'blue car')
                "blau": ["blue"],
                "blaues": ["blue"],
                "blauer": ["blue"],
                "blauen": ["blue"],
                "blue": ["blue"],
                "rot": ["red"],
                "rotes": ["red"],
                "roter": ["red"],
                "roten": ["red"],
                "red": ["red"],
                "weiß": ["white"],
                "weiss": ["white"],
                "white": ["white"],
                "schwarz": ["black"],
                "black": ["black"],
                "grün": ["green"],
                "gruen": ["green"],
                "green": ["green"]
            }
            
            query_keywords = []
            for word in query_words:
                if len(word) > 2 and word not in stopwords:
                    query_keywords.append(word)
                    # Add synonyms for better matching
                    if word in synonyms:
                        query_keywords.extend(synonyms[word])
            
            # If no meaningful keywords left, fall back to all words > 2 chars  
            if not query_keywords:
                query_keywords = [word for word in query_words if len(word) > 2]
            
            logger.info(f"Original query: '{query}'")
            logger.info(f"Extracted keywords: {query_keywords}")
            
            # Scan DynamoDB for matching jobs
            scan_params = {
                'FilterExpression': None,
                'Limit': 100  # Scan more, then rank
            }
            
            # Build filter expression for keyword matching or intent-specific scan
            if intent_text and not query_keywords:
                # If user asks generally about text, prefer items that actually have text detections
                from boto3.dynamodb.conditions import Attr
                filter_expr = Attr('has_text').eq(True)

                # Multi-tenant filters
                if user_id:
                    filter_expr = filter_expr & Attr('user_id').eq(user_id)
                    logger.info(f"🔒 Filtering search results by user_id: {user_id}")
                if session_id:
                    filter_expr = filter_expr & Attr('session_id').eq(session_id)
                    logger.info(f"🔒 Filtering search results by session_id: {session_id}")

                scan_params = {
                    'FilterExpression': filter_expr,
                    'Limit': 100
                }

            elif intent_blackframes and not query_keywords:
                # If user asks generally about blackframes, look for items where we detected them
                from boto3.dynamodb.conditions import Attr
                filter_expr = Attr('has_blackframes').eq(True)

                if user_id:
                    filter_expr = filter_expr & Attr('user_id').eq(user_id)
                    logger.info(f"🔒 Filtering search results by user_id: {user_id}")
                if session_id:
                    filter_expr = filter_expr & Attr('session_id').eq(session_id)
                    logger.info(f"🔒 Filtering search results by session_id: {session_id}")

                scan_params = {
                    'FilterExpression': filter_expr,
                    'Limit': 100
                }

            elif query_keywords:
                conditions = []
                expression_values = {}
                
                for i, keyword in enumerate(query_keywords[:5]):  # Limit to 5 keywords
                    # Check in searchable_content, semantic_tags, and text_content
                    attr_name = f":keyword{i}"
                    expression_values[attr_name] = keyword
                    
                    conditions.append(f"contains(searchable_content, {attr_name})")
                
            # PROFESSIONAL: Use proper DynamoDB FilterExpression with case-insensitive matching
            if not scan_params.get('FilterExpression') and query_keywords:
                from boto3.dynamodb.conditions import Attr
                
                # Build proper OR condition for all keywords
                filter_expr = None
                logger.info(f"Building professional FilterExpression for keywords: {query_keywords[:5]}")
                
                for keyword in query_keywords[:5]:  # Limit for performance
                    # Professional case-insensitive search using attribute_exists and contains
                    keyword_lower = keyword.lower()
                    keyword_upper = keyword.upper() 
                    keyword_title = keyword.capitalize()
                    
                    # Check searchable_content for all case variations
                    condition = (Attr('searchable_content').contains(keyword_lower) | 
                               Attr('searchable_content').contains(keyword_upper) |
                               Attr('searchable_content').contains(keyword_title))
                    
                    if filter_expr is None:
                        filter_expr = condition
                    else:
                        filter_expr = filter_expr | condition  # OR all keywords
                
                # ========== CRITICAL: Multi-Tenant User Isolation ==========
                # ALWAYS filter by user_id to ensure users only see their own videos
                if user_id:
                    user_filter = Attr('user_id').eq(user_id)
                    if filter_expr is None:
                        filter_expr = user_filter
                    else:
                        filter_expr = filter_expr & user_filter  # AND with user_id
                    logger.info(f"🔒 Filtering search results by user_id: {user_id}")
                
                # Optional session-specific filtering
                if session_id:
                    session_filter = Attr('session_id').eq(session_id)
                    if filter_expr is None:
                        filter_expr = session_filter
                    else:
                        filter_expr = filter_expr & session_filter
                    logger.info(f"🔒 Filtering search results by session_id: {session_id}")
                
                scan_params['FilterExpression'] = filter_expr
            
            response = self.table.scan(**scan_params)
            items = response.get('Items', [])
            logger.info(f"DynamoDB professional scan returned {len(items)} items")
            
            # Professional ranking: DynamoDB already filtered, now just score and rank
            scored_results = []
            for item in items:
                score = self._calculate_match_score(item, query_keywords)
                if score > 0:
                    result = {
                        "job_id": item.get("job_id", ""),
                        "score": score,
                        "metadata": {
                            "video_key": item.get("s3_key", ""),
                            "bucket": item.get("s3_bucket", ""),
                            "semantic_tags": item.get("semantic_tags", []),
                            "analysis_type": item.get("analysis_type", "unknown"),
                            "has_labels": item.get("has_labels", False),
                            "has_text": item.get("has_text", False),
                            "has_blackframes": item.get("has_blackframes", False),
                            "blackframes_count": (item.get("summary", {}) or {}).get("blackframes_count", 0),
                            "timestamp": item.get("search_updated_at", 0),
                            # Provide sample texts for better answers
                            "text_content": item.get("text_content", [])
                        },
                        "document": item.get("searchable_content", "")
                    }
                    scored_results.append(result)
            
            # Sort by score and return top results
            scored_results.sort(key=lambda x: x["score"], reverse=True)
            return scored_results[:limit]
            
        except Exception as e:
            logger.error(f"Search failed: {e}")
            return []
    
    def _calculate_match_score(self, item: Dict, query_keywords: List[str]) -> float:
        """Calculate relevance score based on keyword matches"""
        score = 0.0
        
        # Check searchable content
        searchable_content = item.get("searchable_content", "").lower()
        for keyword in query_keywords:
            if keyword in searchable_content:
                score += 1.0
        
        # Check semantic tags (higher weight)
        semantic_tags = item.get("semantic_tags", [])
        for tag in semantic_tags:
            tag_lower = tag.lower()
            for keyword in query_keywords:
                if keyword in tag_lower or tag_lower in keyword:
                    score += 2.0  # Tags are more important
        
        # Check text content
        text_content = item.get("text_content", [])
        for text in text_content:
            text_lower = text.lower()
            for keyword in query_keywords:
                if keyword in text_lower:
                    score += 1.5
        
        # Bonus for exact matches
        for keyword in query_keywords:
            if keyword in searchable_content.split():
                score += 0.5
        
        return score
    
    def get_video_count(self) -> int:
        """Get total number of searchable videos"""
        try:
            # Count items with search_keywords attribute
            response = self.table.scan(
                Select='COUNT',
                FilterExpression='attribute_exists(search_keywords)'
            )
            return response.get('Count', 0)
        except:
            return 0
    
    def delete_video(self, job_id: str):
        """Remove search metadata from job"""
        try:
            self.table.update_item(
                Key={"job_id": job_id},
                UpdateExpression="REMOVE search_keywords, semantic_tags, searchable_content"
            )
        except Exception as e:
            logger.error(f"Failed to delete search data: {e}")


class CostOptimizedChatBot:
    """
    Kostenoptimierte ChatBot Implementation
    - Weniger Bedrock Calls
    - Einfachere Prompts
    - Caching von Responses
    """
    
    def __init__(self, vector_db: CostOptimizedAWSVectorDB):
        self.vector_db = vector_db
        self.bedrock_client = boto3.client(
            'bedrock-runtime',
            region_name=os.environ.get('AWS_DEFAULT_REGION', 'eu-central-1')
        )
        self.response_cache = {}  # Simple in-memory cache
    
    def chat(self, user_query: str, context_limit: int = 5, user_id: str = None, session_id: str = None) -> Dict[str, Any]:
        """
        Cost-optimized chat with caching and simplified responses
        
        Args:
            user_query: User's search query
            context_limit: Maximum number of videos to include in context
            user_id: User ID for multi-tenant isolation (users only see their own videos)
            session_id: Session ID for session-specific filtering
        """
        try:
            # Check cache first (cache per user!)
            cache_key = f"{user_id or 'anonymous'}:{user_query.lower()}"
            query_hash = hashlib.md5(cache_key.encode()).hexdigest()
            if query_hash in self.response_cache:
                cached_response = self.response_cache[query_hash]
                cached_response["from_cache"] = True
                return cached_response
            
            # 🔒 Perform search with user_id for multi-tenant isolation
            logger.info(f"[CHATBOT] Starting search for: '{user_query}' with limit: {context_limit}, user_id: {user_id}")
            search_results = self.vector_db.semantic_search(user_query, limit=context_limit, user_id=user_id, session_id=session_id)
            logger.info(f"[CHATBOT] Search returned {len(search_results)} results for user {user_id}")
            
            if not search_results:
                response = {
                    "response": "Ich konnte keine passenden Videos finden. Versuchen Sie andere Suchbegriffe.",
                    "matched_videos": [],
                    "context_used": 0,
                    "query": user_query,
                    "timestamp": datetime.now().isoformat()
                }
                return response
            
            # Simple response for basic queries - no LLM needed
            if self._is_simple_query(user_query):
                response_text = self._generate_simple_response(user_query, search_results)
                use_llm = False
            else:
                # Use LLM for complex queries
                response_text = self._generate_bedrock_response(user_query, search_results)
                use_llm = True
            
            # Build response
            context_videos = []
            for result in search_results:
                metadata = result.get("metadata", {})
                video_info = {
                    "job_id": result["job_id"],
                    "video_key": metadata.get("video_key", ""),
                    "bucket": metadata.get("bucket", ""),
                    "similarity_score": round(result["score"], 3),
                    "semantic_tags": metadata.get("semantic_tags", []),
                    "has_labels": metadata.get("has_labels", False),
                    "has_text": metadata.get("has_text", False),
                    "has_blackframes": metadata.get("has_blackframes", False)
                }
                context_videos.append(video_info)
            
            response = {
                "response": response_text,
                "matched_videos": context_videos,
                "context_used": len(context_videos),
                "query": user_query,
                "used_llm": use_llm,
                "timestamp": datetime.now().isoformat()
            }
            
            # Cache response
            self.response_cache[query_hash] = response.copy()
            
            return response
            
        except Exception as e:
            logger.error(f"Chat failed: {e}")
            return {
                "response": f"Entschuldigung, es gab einen Fehler: {str(e)}",
                "matched_videos": [],
                "context_used": 0,
                "query": user_query,
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    def _is_simple_query(self, query: str) -> bool:
        """Check if query can be answered without LLM"""
        simple_patterns = [
            "zeig", "finde", "suche", "welche", "gibt es", "haben", "mit", "videos", "bmw", "blackframe", "blau", "blue", "rot", "grün", "gruen", "text"
        ]
        query_lower = query.lower()
        return any(pattern in query_lower for pattern in simple_patterns)
    
    def _generate_simple_response(self, query: str, results: List[Dict]) -> str:
        """Generate simple response without LLM. Prefer filenames and concrete facts over vague tags."""
        q = query.lower()
        count = len(results)
        if count == 0:
            return "Keine Videos gefunden."

        # Helper: filename
        def fname(path: str) -> str:
            return path.split('/')[-1] if path else "Unbekanntes Video"

        # Helper: filter overly generic tags that confuse answers
        generic_tags = {"file", "page", "text", "webpage", "computer hardware", "label", "document"}
        def filtered_tags(tags: List[str]) -> List[str]:
            out = []
            for t in tags or []:
                tl = str(t).strip()
                if not tl:
                    continue
                if tl.lower() in generic_tags:
                    continue
                out.append(tl)
            return out

        # Intent branches
        is_bmw = "bmw" in q
        is_text = any(w in q for w in ["text", "schrift", "ocr", "kennzeichen", "license plate"]) and not is_bmw
        is_black = any(w in q for w in ["blackframe", "black frame", "schwarze", "schwarzen", "dunkle", "blackframes"])

        # Build per-result summaries used below
        enriched = []
        for r in results:
            m = r.get("metadata", {})
            tags = filtered_tags(m.get("semantic_tags", []))
            texts = m.get("text_content", []) or []
            item = {
                "name": fname(m.get("video_key", "")),
                "tags": tags,
                "texts": texts,
                "has_blackframes": m.get("has_blackframes", False),
                "blackframes_count": m.get("blackframes_count", 0),
                "score": r.get("score", 0.0)
            }
            enriched.append(item)

        # 1) BMW intent: name videos and show sample text hit
        if is_bmw:
            hits = []
            for e in enriched:
                if any("bmw" in (t or "").lower() for t in e["texts"]):
                    hits.append(e)
            # If no explicit text hits, fall back to general matches
            if not hits:
                hits = enriched
            response = f"Ja, BMW kommt in {len(hits)} Video{'s' if len(hits)!=1 else ''} vor:\n"
            for e in hits[:5]:
                sample = next((t for t in e["texts"] if "bmw" in t.lower()), None)
                if sample:
                    response += f"• {e['name']} – Text: \"{sample}\"\n"
                else:
                    response += f"• {e['name']}\n"
            return response.strip()

        # 2) Text intent: list top texts per video
        if is_text:
            response = f"Gefundener Text in {count} Video{'s' if count!=1 else ''} (Auszug):\n"
            for e in enriched[:5]:
                texts = [t for t in e["texts"] if t][:3]
                if texts:
                    response += f"• {e['name']}: {', '.join(texts)}\n"
                else:
                    response += f"• {e['name']}: (kein Text erkannt)\n"
            return response.strip()

        # 3) Blackframes intent: list videos with counts
        if is_black:
            hits = [e for e in enriched if e["has_blackframes"]]
            if not hits:
                return "Keine Blackframes in deinen Videos gefunden."
            response = f"Blackframes gefunden in {len(hits)} Video{'s' if len(hits)!=1 else ''}:\n"
            for e in hits[:10]:
                cnt = e.get("blackframes_count", 0) or 0
                if cnt:
                    response += f"• {e['name']}: {cnt} Blackframes\n"
                else:
                    response += f"• {e['name']}\n"
            return response.strip()

        # 4) Generic listing: show filenames and a few meaningful tags
        response = f"Ich habe {count} Video{'s' if count != 1 else ''} gefunden.\n"
        for e in enriched[:5]:
            details = []
            if e["tags"]:
                details.append(", ".join(e["tags"][:3]))
            if e["texts"]:
                details.append(f"Text: {', '.join(e['texts'][:2])}")
            if details:
                response += f"• {e['name']} – {', '.join(details)}\n"
            else:
                response += f"• {e['name']}\n"
        return response.strip()
    
    def _generate_bedrock_response(self, user_query: str, results: List[Dict]) -> str:
        """Generate response using Bedrock (cost-optimized)"""
        try:
            # Simplified prompt to reduce token usage
            context = f"Videos gefunden: {len(results)}\n"
            for i, result in enumerate(results[:3], 1):  # Limit to 3 for cost
                metadata = result.get("metadata", {})
                tags = metadata.get("semantic_tags", [])[:5]  # Limit tags
                context += f"{i}. {metadata.get('video_key', 'Video')} - {', '.join(tags)}\n"
            
            # Short prompt to minimize tokens
            prompt = f"Benutzer fragt: '{user_query}'\n{context}\nKurze Antwort (max 100 Wörter):"
            
            body = json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 200,  # Limit output tokens
                "temperature": 0.3,  # Lower temperature for consistency
                "messages": [
                    {"role": "user", "content": prompt}
                ]
            })
            
            response = self.bedrock_client.invoke_model(
                modelId="anthropic.claude-3-haiku-20240307-v1:0",  # Use cheaper Haiku model
                body=body
            )
            
            response_body = json.loads(response['body'].read())
            return response_body['content'][0]['text']
            
        except Exception as e:
            logger.error(f"Bedrock response failed: {e}")
            return f"Ich habe {len(results)} Videos gefunden, aber kann sie gerade nicht detailliert beschreiben."
    
    def get_stats(self) -> Dict[str, Any]:
        """Get system statistics"""
        return {
            "total_videos": self.vector_db.get_video_count(),
            "database_type": "cost_optimized_dynamodb",
            "llm_provider": "aws_bedrock_haiku",
            "available": True,
            "cost_optimized": True,
            "last_updated": datetime.now().isoformat()
        }


# Singleton instances
_cost_optimized_vector_db = None
_cost_optimized_chatbot = None

def get_cost_optimized_vector_db() -> CostOptimizedAWSVectorDB:
    """Get cost-optimized Vector DB singleton"""
    global _cost_optimized_vector_db
    if _cost_optimized_vector_db is None:
        _cost_optimized_vector_db = CostOptimizedAWSVectorDB()
    return _cost_optimized_vector_db

def get_cost_optimized_chatbot() -> CostOptimizedChatBot:
    """Get cost-optimized ChatBot singleton"""
    global _cost_optimized_chatbot
    if _cost_optimized_chatbot is None:
        vector_db = get_cost_optimized_vector_db()
        _cost_optimized_chatbot = CostOptimizedChatBot(vector_db)
    return _cost_optimized_chatbot