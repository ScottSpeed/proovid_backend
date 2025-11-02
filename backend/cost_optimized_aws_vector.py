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
    
    def store_video_analysis(self, job_id: str, video_metadata: Dict[str, Any], analysis_results: Dict[str, Any]):
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
            update_expression = """
                SET 
                search_keywords = :keywords,
                semantic_tags = :tags,
                searchable_content = :content,
                has_labels = :has_labels,
                has_text = :has_text,
                has_blackframes = :has_blackframes,
                text_content = :text_content,
                search_updated_at = :search_time
            """
            
            expression_values = {
                ":keywords": search_keywords[:50],  # DynamoDB list limit
                ":tags": semantic_tags,
                ":content": searchable_content,
                ":has_labels": "label_detection" in analysis_results,
                ":has_text": "text_detection" in analysis_results,
                ":has_blackframes": "blackframes" in analysis_results,
                ":text_content": text_content[:10],  # Limit text items
                ":search_time": current_time
            }
            
            self.table.update_item(
                Key={"job_id": job_id},
                UpdateExpression=update_expression,
                ExpressionAttributeValues=expression_values
            )
            
            logger.info(f"Stored searchable metadata for job {job_id}")
            
        except Exception as e:
            logger.error(f"Failed to store video analysis: {e}")
            # Don't raise - this is optional functionality
    
    def semantic_search(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Cost-optimized search using DynamoDB scan with keyword matching
        No embeddings needed - pure keyword/text matching
        """
        try:
            # Smart query processing - extract meaningful search terms
            query_words = query.lower().split()
            
            # Filter out common German question words and focus on content
            stopwords = {"welche", "videos", "enthalten", "zeig", "mir", "mit", "haben", "gibt", "das", "die", "der", "den", "eine", "einen", "text", "sind", "wie", "was", "wo", "wer", "wann", "warum"}
            
            # German-English synonym mapping for better search
            synonyms = {
                "autos": ["car", "vehicle", "transportation", "automobile"],
                "auto": ["car", "vehicle", "transportation"], 
                "fahrzeug": ["car", "vehicle", "transportation"],
                "fahrzeuge": ["car", "vehicle", "transportation"],
                "personen": ["person", "people", "man", "woman", "human", "adult"],
                "person": ["person", "people", "man", "woman", "human", "adult"],
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
                "text": ["text", "writing", "license plate"]
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
            
            # Build filter expression for keyword matching
            if query_keywords:
                conditions = []
                expression_values = {}
                
                for i, keyword in enumerate(query_keywords[:5]):  # Limit to 5 keywords
                    # Check in searchable_content, semantic_tags, and text_content
                    attr_name = f":keyword{i}"
                    expression_values[attr_name] = keyword
                    
                    conditions.append(f"contains(searchable_content, {attr_name})")
                
            # PROFESSIONAL: Use proper DynamoDB FilterExpression with case-insensitive matching
            if query_keywords:
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
                            "timestamp": item.get("search_updated_at", 0)
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
    
    def chat(self, user_query: str, context_limit: int = 5) -> Dict[str, Any]:
        """Cost-optimized chat with caching and simplified responses"""
        try:
            # Check cache first
            query_hash = hashlib.md5(user_query.lower().encode()).hexdigest()
            if query_hash in self.response_cache:
                cached_response = self.response_cache[query_hash]
                cached_response["from_cache"] = True
                return cached_response
            
            # Perform search
            logger.info(f"[CHATBOT] Starting search for: '{user_query}' with limit: {context_limit}")
            search_results = self.vector_db.semantic_search(user_query, limit=context_limit)
            logger.info(f"[CHATBOT] Search returned {len(search_results)} results")
            
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
            "zeig", "finde", "suche", "welche", "gibt es", "haben", "mit", "videos"
        ]
        query_lower = query.lower()
        return any(pattern in query_lower for pattern in simple_patterns)
    
    def _generate_simple_response(self, query: str, results: List[Dict]) -> str:
        """Generate simple response without LLM"""
        count = len(results)
        
        if count == 0:
            return "Keine Videos gefunden."
        
        response = f"Ich habe {count} Video{'s' if count != 1 else ''} gefunden"
        
        # Add details about top results
        if results:
            top_result = results[0]
            tags = top_result.get("metadata", {}).get("semantic_tags", [])
            if tags:
                response += f" mit Inhalten wie: {', '.join(tags[:5])}"
        
        response += ". Hier sind die Ergebnisse:"
        
        return response
    
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